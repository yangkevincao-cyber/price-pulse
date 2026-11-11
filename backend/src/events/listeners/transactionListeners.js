// backend/src/events/listeners/transactionListeners.js
const { logger } = require('../../config/logger');
const { User } = require('../../models');
const notificationEmitter = require('../emitters/notificationEmitter');
const analyticsEmitter = require('../emitters/analyticsEmitter');
const auditEmitter = require('../emitters/auditEmitter');

class TransactionListeners {
    /**
     * Register transaction event listeners
     */
    register(emitter) {
        // Transaction created
        emitter.on('transaction:created', this.handleTransactionCreated.bind(this));

        // Transaction completed
        emitter.on('transaction:completed', this.handleTransactionCompleted.bind(this));

        // Transaction cancelled
        emitter.on('transaction:cancelled', this.handleTransactionCancelled.bind(this));

        // Transaction refunded
        emitter.on('transaction:refunded', this.handleTransactionRefunded.bind(this));

        // Transaction shipped
        emitter.on('transaction:shipped', this.handleTransactionShipped.bind(this));

        // Transaction delivered
        emitter.on('transaction:delivered', this.handleTransactionDelivered.bind(this));

        // Transaction disputed
        emitter.on('transaction:disputed', this.handleTransactionDisputed.bind(this));

        logger.info('Transaction listeners registered');
    }

    /**
     * Handle transaction created
     */
    async handleTransactionCreated(data) {
        try {
            const { transaction } = data;

            // Send notification to buyer
            await notificationEmitter.emitTransactionUpdate(transaction.buyer_id, transaction, 'created');

            // Send notification to seller
            await notificationEmitter.emitTransactionUpdate(transaction.seller_id, transaction, 'created');

            // Track analytics
            await analyticsEmitter.emitUserAction(transaction.buyer_id, 'transaction_created', {
                transactionId: transaction.id,
                amount: transaction.amount,
            });

            // Audit
            await auditEmitter.emitTransaction(transaction.buyer_id, transaction.id, 'created', {
                amount: transaction.amount,
                sellerId: transaction.seller_id,
            });

            logger.info(`Transaction created: ${transaction.id}`);
        } catch (error) {
            logger.error('Transaction created event handler error:', error);
        }
    }

    /**
     * Handle transaction completed
     */
    async handleTransactionCompleted(data) {
        try {
            const { transaction } = data;

            // Update seller stats
            await User.increment('total_sales', {
                by: 1,
                where: { id: transaction.seller_id },
            });

            // Send notification to buyer
            await notificationEmitter.emitTransactionUpdate(transaction.buyer_id, transaction, 'completed');

            // Send notification to seller
            await notificationEmitter.emitTransactionUpdate(transaction.seller_id, transaction, 'completed');

            // Track analytics
            await analyticsEmitter.emitConversion(transaction.buyer_id, 'purchase', transaction.amount, {
                transactionId: transaction.id,
                sellerId: transaction.seller_id,
            });

            // Audit
            await auditEmitter.emitTransaction(transaction.buyer_id, transaction.id, 'completed', {
                amount: transaction.amount,
                sellerId: transaction.seller_id,
            });

            // Update product demand score
            const { Listing } = require('../../models');
            const listing = await Listing.findByPk(transaction.listing_id);
            if (listing && listing.product_id) {
                const { Product } = require('../../models');
                const product = await Product.findByPk(listing.product_id);
                if (product) {
                    await product.updateDemandScore();
                }
            }

            logger.info(`Transaction completed: ${transaction.id}`);
        } catch (error) {
            logger.error('Transaction completed event handler error:', error);
        }
    }

    /**
     * Handle transaction cancelled
     */
    async handleTransactionCancelled(data) {
        try {
            const { transaction, reason } = data;

            // Send notification to buyer
            await notificationEmitter.emitTransactionUpdate(transaction.buyer_id, transaction, 'cancelled');

            // Send notification to seller
            await notificationEmitter.emitTransactionUpdate(transaction.seller_id, transaction, 'cancelled');

            // Audit
            await auditEmitter.emitTransaction(transaction.buyer_id, transaction.id, 'cancelled', {
                reason,
                sellerId: transaction.seller_id,
            });

            logger.info(`Transaction cancelled: ${transaction.id}`);
        } catch (error) {
            logger.error('Transaction cancelled event handler error:', error);
        }
    }

    /**
     * Handle transaction refunded
     */
    async handleTransactionRefunded(data) {
        try {
            const { transaction, amount, reason } = data;

            // Send notification to buyer
            await notificationEmitter.emitTransactionUpdate(transaction.buyer_id, transaction, 'refunded');

            // Send notification to seller
            await notificationEmitter.emitTransactionUpdate(transaction.seller_id, transaction, 'refunded');

            // Audit
            await auditEmitter.emitTransaction(transaction.buyer_id, transaction.id, 'refunded', {
                amount,
                reason,
                sellerId: transaction.seller_id,
            });

            logger.info(`Transaction refunded: ${transaction.id}`);
        } catch (error) {
            logger.error('Transaction refunded event handler error:', error);
        }
    }

    /**
     * Handle transaction shipped
     */
    async handleTransactionShipped(data) {
        try {
            const { transaction, trackingNumber, carrier } = data;

            // Send notification to buyer
            await notificationEmitter.emitTransactionUpdate(transaction.buyer_id, transaction, 'shipped', {
                trackingNumber,
                carrier,
            });

            // Send notification to seller
            await notificationEmitter.emitTransactionUpdate(transaction.seller_id, transaction, 'shipped', {
                trackingNumber,
                carrier,
            });

            // Audit
            await auditEmitter.emitTransaction(transaction.buyer_id, transaction.id, 'shipped', {
                trackingNumber,
                carrier,
                sellerId: transaction.seller_id,
            });

            logger.info(`Transaction shipped: ${transaction.id}`);
        } catch (error) {
            logger.error('Transaction shipped event handler error:', error);
        }
    }

    /**
     * Handle transaction delivered
     */
    async handleTransactionDelivered(data) {
        try {
            const { transaction } = data;

            // Send notification to buyer
            await notificationEmitter.emitTransactionUpdate(transaction.buyer_id, transaction, 'delivered');

            // Send notification to seller
            await notificationEmitter.emitTransactionUpdate(transaction.seller_id, transaction, 'delivered');

            // Audit
            await auditEmitter.emitTransaction(transaction.buyer_id, transaction.id, 'delivered', {
                sellerId: transaction.seller_id,
            });

            logger.info(`Transaction delivered: ${transaction.id}`);
        } catch (error) {
            logger.error('Transaction delivered event handler error:', error);
        }
    }

    /**
     * Handle transaction disputed
     */
    async handleTransactionDisputed(data) {
        try {
            const { transaction, reason } = data;

            // Send notification to buyer
            await notificationEmitter.emitTransactionUpdate(transaction.buyer_id, transaction, 'disputed');

            // Send notification to seller
            await notificationEmitter.emitTransactionUpdate(transaction.seller_id, transaction, 'disputed');

            // Send notification to admin
            const { User } = require('../../models');
            const admins = await User.findAll({
                where: { role: 'admin', is_active: true },
            });

            for (const admin of admins) {
                await notificationEmitter.emitNotification(admin.id, {
                    type: 'security_alert',
                    title: '⚠️ Transaction Disputed',
                    message: `Transaction ${transaction.id} has been disputed. Amount: $${transaction.amount}`,
                    action_url: `/admin/transactions/${transaction.id}`,
                    action_label: 'Review Dispute',
                });
            }

            // Audit
            await auditEmitter.emitTransaction(transaction.buyer_id, transaction.id, 'disputed', {
                reason,
                sellerId: transaction.seller_id,
            });

            logger.info(`Transaction disputed: ${transaction.id}`);
        } catch (error) {
            logger.error('Transaction disputed event handler error:', error);
        }
    }
}

module.exports = new TransactionListeners();