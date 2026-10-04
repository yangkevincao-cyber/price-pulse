// backend/src/controllers/transactionController.js
const { Transaction, Listing, User, Payment, Notification } = require('../models');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const { validationResult } = require('express-validator');
const stripeService = require('../services/payment/stripeService');
const paypalService = require('../services/payment/paypalService');
const escrowService = require('../services/payment/escrowService');
const fraudDetectionService = require('../services/intelligence/fraudDetectionService');

class TransactionController {
    /**
     * Create a new transaction (buyer purchases item)
     */
    async createTransaction(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array(),
                });
            }

            const buyerId = req.user.id;
            const { listingId, paymentMethod, shippingAddress, notes } = req.body;

            // Get listing
            const listing = await Listing.findByPk(listingId, {
                include: ['seller', 'product'],
            });

            if (!listing) {
                return res.status(404).json({
                    success: false,
                    error: 'Listing not found',
                });
            }

            // Validate listing is available
            if (!listing.isAvailable()) {
                return res.status(400).json({
                    success: false,
                    error: 'Listing is not available for purchase',
                });
            }

            // Prevent buying own listing
            if (listing.user_id === buyerId) {
                return res.status(400).json({
                    success: false,
                    error: 'You cannot purchase your own listing',
                });
            }

            // Calculate totals
            const amount = parseFloat(listing.price);
            const platformFee = amount * 0.05; // 5% platform fee
            const shippingCost = parseFloat(listing.shipping_cost || 0);
            const taxAmount = 0; // TODO: Implement tax calculation
            const totalAmount = amount + platformFee + shippingCost + taxAmount;

            // Fraud detection
            const fraudCheck = await fraudDetectionService.detectFraud({
                userId: buyerId,
                productId: listing.product_id,
                amount: totalAmount,
                title: listing.title,
                description: listing.description,
                ipAddress: req.ip,
                deviceFingerprint: req.headers['device-fingerprint'],
                listingId: listingId,
            });

            if (fraudCheck.isFraudulent) {
                logger.warn(`Fraudulent transaction attempt by user ${buyerId}`, fraudCheck);
                return res.status(403).json({
                    success: false,
                    error: 'Transaction blocked due to fraud detection',
                    riskScore: fraudCheck.riskScore,
                });
            }

            // Create transaction
            const transaction = await Transaction.create({
                listing_id: listingId,
                buyer_id: buyerId,
                seller_id: listing.user_id,
                amount: amount,
                platform_fee: platformFee,
                shipping_cost: shippingCost,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                status: 'pending',
                payment_method: paymentMethod,
                shipping_address: shippingAddress,
                notes: notes || null,
            });

            // Hold funds in escrow
            await escrowService.holdFunds(transaction.id);

            // Create payment intent based on method
            let paymentResult;
            if (paymentMethod === 'stripe') {
                paymentResult = await stripeService.createPaymentIntent({
                    amount: totalAmount,
                    currency: 'usd',
                    metadata: {
                        transactionId: transaction.id,
                        listingId: listingId,
                        buyerId: buyerId,
                        sellerId: listing.user_id,
                        productId: listing.product_id,
                        platformFee: platformFee,
                    },
                    customerId: req.user.stripe_customer_id || undefined,
                });
            } else if (paymentMethod === 'paypal') {
                const seller = await User.findByPk(listing.user_id);
                paymentResult = await paypalService.createOrder({
                    amount: totalAmount,
                    currency: 'usd',
                    transactionId: transaction.id,
                    listingId: listingId,
                    buyerId: buyerId,
                    sellerId: listing.user_id,
                    sellerEmail: seller.email,
                    returnUrl: `${process.env.FRONTEND_URL}/payment/success`,
                    cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel`,
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Unsupported payment method',
                });
            }

            // Update transaction with payment details
            await transaction.update({
                payment_id: paymentResult.paymentIntentId || paymentResult.orderId,
                status: 'payment_pending',
            });

            // Update listing quantity
            await listing.update({
                available_quantity: listing.available_quantity - 1,
            });

            // Send notifications
            await Notification.create({
                user_id: buyerId,
                type: 'transaction_update',
                title: 'Order Created',
                message: `Your order has been created. Total: $${totalAmount.toFixed(2)}`,
                data: { transaction_id: transaction.id },
                action_url: `/transactions/${transaction.id}`,
                action_label: 'View Order',
            });

            await Notification.create({
                user_id: listing.user_id,
                type: 'transaction_update',
                title: 'New Order Received',
                message: `You have a new order for "${listing.title}"`,
                data: { transaction_id: transaction.id },
                action_url: `/transactions/${transaction.id}`,
                action_label: 'View Order',
            });

            logger.info(`Transaction created: ${transaction.id} by user ${buyerId}`);

            return res.status(201).json({
                success: true,
                message: 'Transaction created successfully',
                data: {
                    transaction,
                    payment: paymentResult,
                },
            });
        } catch (error) {
            logger.error('Create transaction error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to create transaction',
            });
        }
    }

    /**
     * Get transaction by ID
     */
    async getTransaction(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const transaction = await Transaction.findByPk(id, {
                include: [
                    {
                        model: Listing,
                        as: 'listing',
                        include: ['product', 'seller'],
                    },
                    {
                        model: User,
                        as: 'buyer',
                        attributes: ['id', 'username', 'email', 'avatar'],
                    },
                    {
                        model: User,
                        as: 'seller',
                        attributes: ['id', 'username', 'email', 'avatar', 'seller_rating'],
                    },
                    {
                        model: Payment,
                        as: 'payment',
                    },
                ],
            });

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    error: 'Transaction not found',
                });
            }

            // Check access
            if (transaction.buyer_id !== userId && transaction.seller_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this transaction',
                });
            }

            return res.json({
                success: true,
                data: { transaction },
            });
        } catch (error) {
            logger.error('Get transaction error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch transaction',
            });
        }
    }

    /**
     * Get user's transactions
     */
    async getUserTransactions(req, res) {
        try {
            const userId = req.user.id;
            const { role, status, page = 1, limit = 20 } = req.query;

            const offset = (page - 1) * limit;

            const where = {};
            if (role === 'buyer') {
                where.buyer_id = userId;
            } else if (role === 'seller') {
                where.seller_id = userId;
            } else {
                where[sequelize.Op.or] = [
                    { buyer_id: userId },
                    { seller_id: userId },
                ];
            }

            if (status) {
                where.status = status;
            }

            const { count, rows } = await Transaction.findAndCountAll({
                where,
                include: [
                    {
                        model: Listing,
                        as: 'listing',
                        include: ['product', 'seller'],
                    },
                    {
                        model: User,
                        as: 'buyer',
                        attributes: ['id', 'username', 'avatar'],
                    },
                    {
                        model: User,
                        as: 'seller',
                        attributes: ['id', 'username', 'avatar', 'seller_rating'],
                    },
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            return res.json({
                success: true,
                data: {
                    transactions: rows,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                },
            });
        } catch (error) {
            logger.error('Get user transactions error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch transactions',
            });
        }
    }

    /**
     * Mark transaction as shipped
     */
    async markAsShipped(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const { trackingNumber, carrier } = req.body;

            const transaction = await Transaction.findByPk(id);

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    error: 'Transaction not found',
                });
            }

            // Check seller
            if (transaction.seller_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You are not the seller of this transaction',
                });
            }

            if (transaction.status !== 'payment_completed') {
                return res.status(400).json({
                    success: false,
                    error: 'Transaction must be paid before shipping',
                });
            }

            await transaction.markAsShipped(trackingNumber, carrier);

            // Send notification to buyer
            await Notification.create({
                user_id: transaction.buyer_id,
                type: 'shipping_update',
                title: 'Order Shipped!',
                message: `Your order #${transaction.id} has been shipped. Tracking: ${trackingNumber}`,
                data: { transaction_id: transaction.id },
                action_url: `/transactions/${transaction.id}`,
                action_label: 'Track Order',
            });

            logger.info(`Transaction ${id} marked as shipped by user ${userId}`);

            return res.json({
                success: true,
                message: 'Transaction marked as shipped',
                data: { transaction },
            });
        } catch (error) {
            logger.error('Mark as shipped error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to update shipping status',
            });
        }
    }

    /**
     * Mark transaction as delivered
     */
    async markAsDelivered(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const transaction = await Transaction.findByPk(id);

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    error: 'Transaction not found',
                });
            }

            // Check buyer
            if (transaction.buyer_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You are not the buyer of this transaction',
                });
            }

            if (transaction.status !== 'shipping') {
                return res.status(400).json({
                    success: false,
                    error: 'Transaction is not in shipping status',
                });
            }

            await transaction.markAsDelivered();

            // Release escrow funds
            await escrowService.releaseFunds(transaction.id, userId);

            // Send notification to seller
            await Notification.create({
                user_id: transaction.seller_id,
                type: 'transaction_update',
                title: 'Order Delivered',
                message: `Your order #${transaction.id} has been marked as delivered!`,
                data: { transaction_id: transaction.id },
                action_url: `/transactions/${transaction.id}`,
                action_label: 'View Order',
            });

            logger.info(`Transaction ${id} marked as delivered by user ${userId}`);

            return res.json({
                success: true,
                message: 'Transaction marked as delivered. Funds released to seller.',
                data: { transaction },
            });
        } catch (error) {
            logger.error('Mark as delivered error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to update delivery status',
            });
        }
    }

    /**
     * Cancel transaction
     */
    async cancelTransaction(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const { reason } = req.body;

            const transaction = await Transaction.findByPk(id);

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    error: 'Transaction not found',
                });
            }

            // Check if user can cancel
            if (transaction.buyer_id !== userId && transaction.seller_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You cannot cancel this transaction',
                });
            }

            // Check if transaction can be cancelled
            if (!['pending', 'payment_pending', 'payment_processing'].includes(transaction.status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Transaction cannot be cancelled at this stage',
                });
            }

            // Cancel transaction
            await transaction.update({
                status: 'cancelled',
                cancelled_at: new Date(),
                notes: reason ? `${transaction.notes || ''}\nCancellation reason: ${reason}` : transaction.notes,
            });

            // Release escrow funds
            await escrowService.releaseFunds(transaction.id, userId);

            // Update listing quantity
            const listing = await Listing.findByPk(transaction.listing_id);
            if (listing) {
                await listing.update({
                    available_quantity: listing.available_quantity + 1,
                });
            }

            // Send notifications
            await Notification.create({
                user_id: transaction.buyer_id,
                type: 'transaction_update',
                title: 'Order Cancelled',
                message: `Your order #${transaction.id} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
                data: { transaction_id: transaction.id },
                action_url: `/transactions/${transaction.id}`,
                action_label: 'View Order',
            });

            await Notification.create({
                user_id: transaction.seller_id,
                type: 'transaction_update',
                title: 'Order Cancelled',
                message: `Order #${transaction.id} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
                data: { transaction_id: transaction.id },
                action_url: `/transactions/${transaction.id}`,
                action_label: 'View Order',
            });

            logger.info(`Transaction ${id} cancelled by user ${userId}`);

            return res.json({
                success: true,
                message: 'Transaction cancelled successfully',
                data: { transaction },
            });
        } catch (error) {
            logger.error('Cancel transaction error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to cancel transaction',
            });
        }
    }

    /**
     * Get transaction status
     */
    async getTransactionStatus(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const transaction = await Transaction.findByPk(id, {
                attributes: ['id', 'status', 'created_at', 'updated_at'],
            });

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    error: 'Transaction not found',
                });
            }

            // Check access
            if (transaction.buyer_id !== userId && transaction.seller_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this transaction',
                });
            }

            return res.json({
                success: true,
                data: {
                    id: transaction.id,
                    status: transaction.status,
                    created_at: transaction.created_at,
                    updated_at: transaction.updated_at,
                },
            });
        } catch (error) {
            logger.error('Get transaction status error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch transaction status',
            });
        }
    }

    /**
     * Get transaction stats
     */
    async getTransactionStats(req, res) {
        try {
            const userId = req.user.id;
            const { role = 'seller' } = req.query;

            const where = {};
            if (role === 'seller') {
                where.seller_id = userId;
            } else if (role === 'buyer') {
                where.buyer_id = userId;
            } else {
                where[sequelize.Op.or] = [
                    { buyer_id: userId },
                    { seller_id: userId },
                ];
            }

            const stats = await Transaction.findAll({
                where: {
                    ...where,
                    status: 'completed',
                },
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total_transactions'],
                    [sequelize.fn('SUM', sequelize.col('amount')), 'total_revenue'],
                    [sequelize.fn('AVG', sequelize.col('amount')), 'avg_order_value'],
                ],
            });

            // Get transaction counts by status
            const statusCounts = await Transaction.findAll({
                where,
                attributes: [
                    'status',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                group: ['status'],
            });

            return res.json({
                success: true,
                data: {
                    stats: stats[0] || { total_transactions: 0, total_revenue: 0, avg_order_value: 0 },
                    status_counts: statusCounts,
                },
            });
        } catch (error) {
            logger.error('Get transaction stats error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch transaction stats',
            });
        }
    }
}

module.exports = new TransactionController();