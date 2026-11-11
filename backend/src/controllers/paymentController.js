// backend/src/controllers/paymentController.js
const { Payment, Transaction, User } = require('../models');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const stripeService = require('../services/payment/stripeService');
const paypalService = require('../services/payment/paypalService');

class PaymentController {
    /**
     * Create Stripe payment intent
     */
    async createStripePayment(req, res) {
        try {
            const { amount, currency, transactionId, listingId, sellerId, productId } = req.body;
            const buyerId = req.user.id;

            // Verify transaction
            const transaction = await Transaction.findByPk(transactionId);
            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    error: 'Transaction not found',
                });
            }

            if (transaction.buyer_id !== buyerId) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not the buyer of this transaction',
                });
            }

            const platformFee = amount * 0.05;

            const result = await stripeService.createPaymentIntent({
                amount,
                currency,
                metadata: {
                    transactionId,
                    listingId,
                    buyerId,
                    sellerId,
                    productId,
                    platformFee: platformFee.toFixed(2),
                },
                customerId: req.user.stripe_customer_id || undefined,
            });

            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            logger.error('Create Stripe payment error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to create payment',
            });
        }
    }

    /**
     * Confirm Stripe payment
     */
    async confirmStripePayment(req, res) {
        try {
            const { paymentIntentId } = req.body;

            const result = await stripeService.confirmPaymentIntent(paymentIntentId);

            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            logger.error('Confirm Stripe payment error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to confirm payment',
            });
        }
    }

    /**
     * Create PayPal order
     */
    async createPaypalOrder(req, res) {
        try {
            const { amount, currency, transactionId, listingId, sellerId } = req.body;
            const buyerId = req.user.id;

            // Verify transaction
            const transaction = await Transaction.findByPk(transactionId);
            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    error: 'Transaction not found',
                });
            }

            if (transaction.buyer_id !== buyerId) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not the buyer of this transaction',
                });
            }

            const seller = await User.findByPk(sellerId);

            const result = await paypalService.createOrder({
                amount,
                currency,
                transactionId,
                listingId,
                buyerId,
                sellerId,
                sellerEmail: seller.email,
                returnUrl: `${process.env.FRONTEND_URL}/payment/success`,
                cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel`,
            });

            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            logger.error('Create PayPal order error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to create PayPal order',
            });
        }
    }

    /**
     * Capture PayPal order
     */
    async capturePaypalOrder(req, res) {
        try {
            const { orderId } = req.body;

            const result = await paypalService.captureOrder(orderId);

            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            logger.error('Capture PayPal order error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to capture PayPal order',
            });
        }
    }

    /**
     * Get payment transactions
     */
    async getTransactions(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, status } = req.query;

            const offset = (page - 1) * limit;

            const where = { user_id: userId };
            if (status) {
                where.status = status;
            }

            const { count, rows } = await Payment.findAndCountAll({
                where,
                include: [
                    {
                        model: Transaction,
                        as: 'transaction',
                        include: ['listing', 'buyer', 'seller'],
                    },
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            return res.json({
                success: true,
                data: {
                    payments: rows,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                },
            });
        } catch (error) {
            logger.error('Get payment transactions error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch payment transactions',
            });
        }
    }

    /**
     * Get payment by ID
     */
    async getPaymentById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const payment = await Payment.findByPk(id, {
                include: [
                    {
                        model: Transaction,
                        as: 'transaction',
                        include: ['listing', 'buyer', 'seller'],
                    },
                ],
            });

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found',
                });
            }

            if (payment.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this payment',
                });
            }

            return res.json({
                success: true,
                data: { payment },
            });
        } catch (error) {
            logger.error('Get payment error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch payment',
            });
        }
    }

    /**
     * Request refund
     */
    async requestRefund(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const { reason, amount } = req.body;

            const payment = await Payment.findByPk(id, {
                include: ['transaction'],
            });

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found',
                });
            }

            if (payment.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this payment',
                });
            }

            if (payment.status !== 'succeeded') {
                return res.status(400).json({
                    success: false,
                    error: 'Payment cannot be refunded',
                });
            }

            let refund;
            if (payment.payment_method === 'stripe') {
                refund = await stripeService.createRefund(
                    payment.provider_payment_id,
                    amount,
                    reason
                );
            } else if (payment.payment_method === 'paypal') {
                refund = await paypalService.refundPayment(
                    payment.provider_payment_id,
                    amount,
                    reason
                );
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Unsupported payment method for refund',
                });
            }

            return res.json({
                success: true,
                message: 'Refund initiated successfully',
                data: { refund },
            });
        } catch (error) {
            logger.error('Request refund error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to process refund',
            });
        }
    }

    /**
     * Create Stripe Connect account for seller
     */
    async createConnectAccount(req, res) {
        try {
            const userId = req.user.id;
            const { email, country = 'US' } = req.body;

            const account = await stripeService.createConnectAccount(email || req.user.email, country);

            await User.update(
                { stripe_account_id: account.id },
                { where: { id: userId } }
            );

            const accountLink = await stripeService.createAccountLink(
                account.id,
                `${process.env.FRONTEND_URL}/settings/payouts/return`,
                `${process.env.FRONTEND_URL}/settings/payouts/refresh`
            );

            return res.json({
                success: true,
                data: {
                    onboarding_url: accountLink.url,
                    account_id: account.id,
                },
            });
        } catch (error) {
            logger.error('Create Connect account error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to create Stripe Connect account',
            });
        }
    }

    /**
     * Get payment summary
     */
    async getPaymentSummary(req, res) {
        try {
            const userId = req.user.id;

            const summary = await Payment.findAll({
                where: { user_id: userId },
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total_payments'],
                    [sequelize.fn('SUM', sequelize.col('amount')), 'total_spent'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = \'succeeded\' THEN amount ELSE 0 END')), 'total_successful'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = \'refunded\' THEN refund_amount ELSE 0 END')), 'total_refunded'],
                ],
            });

            // Get recent payments
            const recent = await Payment.findAll({
                where: { user_id: userId },
                order: [['created_at', 'DESC']],
                limit: 5,
                include: ['transaction'],
            });

            return res.json({
                success: true,
                data: {
                    summary: summary[0] || {
                        total_payments: 0,
                        total_spent: 0,
                        total_successful: 0,
                        total_refunded: 0,
                    },
                    recent_payments: recent,
                },
            });
        } catch (error) {
            logger.error('Get payment summary error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch payment summary',
            });
        }
    }

    /**
     * Handle Stripe webhook
     */
    async handleStripeWebhook(req, res) {
        try {
            const sig = req.headers['stripe-signature'];
            let event;

            try {
                event = stripeService.stripe.webhooks.constructEvent(
                    req.rawBody,
                    sig,
                    process.env.STRIPE_WEBHOOK_SECRET
                );
            } catch (err) {
                logger.error('Stripe webhook signature verification failed:', err);
                return res.status(400).send(`Webhook Error: ${err.message}`);
            }

            await stripeService.handleWebhook(event);

            return res.json({ received: true });
        } catch (error) {
            logger.error('Stripe webhook error:', error);
            return res.status(500).json({
                success: false,
                error: 'Webhook processing failed',
            });
        }
    }

    /**
     * Handle PayPal webhook
     */
    async handlePaypalWebhook(req, res) {
        try {
            // Verify webhook signature

            // Process webhook event
            // PayPal webhook handling logic

            return res.json({ received: true });
        } catch (error) {
            logger.error('PayPal webhook error:', error);
            return res.status(500).json({
                success: false,
                error: 'Webhook processing failed',
            });
        }
    }
}

module.exports = new PaymentController();