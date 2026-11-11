// backend/src/services/payment/escrowService.js
const { Transaction } = require('../../models');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');
const stripeService = require('./stripeService');

class EscrowService {
    /**
     * Release escrow funds to seller
     */
    async releaseFunds(transactionId, userId) {
        const transaction = await Transaction.findByPk(transactionId, {
            include: ['listing', 'buyer', 'seller'],
        });

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        // Verify user is buyer or admin
        if (transaction.buyer_id !== userId && transaction.seller_id !== userId) {
            throw new Error('Unauthorized to release funds');
        }

        if (transaction.status !== 'delivered') {
            throw new Error('Item must be marked as delivered before releasing funds');
        }

        // Check if funds already released
        const escrowKey = `escrow:${transactionId}`;
        const released = await redis.get(escrowKey);
        if (released === 'released') {
            throw new Error('Funds already released');
        }

        // Process payout
        const amount = transaction.amount;

        // Update seller's balance or process payout
        if (transaction.seller.stripe_account_id) {
            await stripeService.processPayout(
                transaction.seller_id,
                amount,
                transactionId
            );
        }

        // Mark as completed
        await transaction.update({
            status: 'completed',
            completed_at: new Date(),
        });

        // Mark escrow as released
        await redis.setex(escrowKey, 86400 * 30, 'released'); // 30 days

        logger.info(`Escrow funds released for transaction ${transactionId}`);

        return {
            success: true,
            message: 'Funds released successfully',
            transaction: transaction.toJSON(),
        };
    }

    /**
     * Hold funds in escrow
     */
    async holdFunds(transactionId) {
        const escrowKey = `escrow:${transactionId}`;
        await redis.setex(escrowKey, 86400 * 14, 'held'); // 14 days
        logger.info(`Escrow hold created for transaction ${transactionId}`);
    }

    /**
     * Check escrow status
     */
    async getEscrowStatus(transactionId) {
        const escrowKey = `escrow:${transactionId}`;
        const status = await redis.get(escrowKey);
        return status || 'not_held';
    }

    /**
     * Extend escrow hold
     */
    async extendEscrow(transactionId, days = 7) {
        const escrowKey = `escrow:${transactionId}`;
        const currentStatus = await redis.get(escrowKey);

        if (!currentStatus) {
            throw new Error('No escrow hold found');
        }

        // Extend expiry
        const ttl = await redis.ttl(escrowKey);
        await redis.expire(escrowKey, ttl + (days * 86400));

        logger.info(`Escrow extended for transaction ${transactionId} by ${days} days`);

        return { success: true, message: `Escrow extended by ${days} days` };
    }

    /**
     * Dispute escrow
     */
    async disputeEscrow(transactionId, userId, reason) {
        const transaction = await Transaction.findByPk(transactionId);

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        if (transaction.buyer_id !== userId && transaction.seller_id !== userId) {
            throw new Error('Unauthorized to dispute');
        }

        // Mark as disputed
        await transaction.update({
            status: 'disputed',
            dispute_reason: reason,
        });

        logger.info(`Escrow disputed for transaction ${transactionId} by user ${userId}`);

        return {
            success: true,
            message: 'Dispute filed. Admin will review.',
            transactionId,
        };
    }

    /**
     * Resolve dispute
     */
    async resolveDispute(transactionId, resolution, adminId) {
        const transaction = await Transaction.findByPk(transactionId);

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        if (resolution === 'release') {
            await this.releaseFunds(transactionId, transaction.seller_id);
            await transaction.update({
                dispute_resolution: 'Released funds to seller',
                dispute_resolved_at: new Date(),
            });
        } else if (resolution === 'refund') {
            await transaction.update({
                status: 'refunded',
                refunded_at: new Date(),
                dispute_resolution: 'Refunded to buyer',
                dispute_resolved_at: new Date(),
            });
            // Process refund
            if (transaction.payment_id) {
                // Refund logic
            }
        } else {
            throw new Error('Invalid resolution');
        }

        logger.info(`Dispute resolved for transaction ${transactionId} by admin ${adminId}`);

        return {
            success: true,
            message: `Dispute resolved with action: ${resolution}`,
            transaction: transaction.toJSON(),
        };
    }
}

module.exports = new EscrowService();