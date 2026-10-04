// backend/src/services/payment/stripeService.js
const Stripe = require('stripe');
const { Payment, Transaction, Listing, User } = require('../../models');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');

class StripeService {
    constructor() {
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        this.connectWebhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    }

    /**
     * Create payment intent
     */
    async createPaymentIntent(data) {
        const { amount, currency, metadata, customerId } = data;

        try {
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency: currency || 'usd',
                metadata: {
                    transaction_id: metadata.transactionId,
                    listing_id: metadata.listingId,
                    buyer_id: metadata.buyerId,
                    seller_id: metadata.sellerId,
                    product_id: metadata.productId,
                    platform_fee: metadata.platformFee || '0.05',
                    ...metadata,
                },
                customer: customerId || undefined,
                automatic_payment_methods: {
                    enabled: true,
                    allow_redirects: 'never',
                },
                payment_method_types: ['card', 'apple_pay', 'google_pay'],
                statement_descriptor: 'PricePulse',
                statement_descriptor_suffix: 'Payment',
            });

            // Store payment record
            await Payment.create({
                user_id: metadata.buyerId,
                transaction_id: metadata.transactionId,
                amount: amount,
                currency: currency || 'usd',
                payment_method: 'stripe',
                payment_provider: 'stripe',
                provider_payment_id: paymentIntent.id,
                status: 'pending',
                payment_intent: paymentIntent,
                metadata: metadata,
            });

            logger.info(`Stripe payment intent created: ${paymentIntent.id}`);

            return {
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status,
            };
        } catch (error) {
            logger.error('Stripe payment intent creation failed:', error);
            throw error;
        }
    }

    /**
     * Confirm payment intent
     */
    async confirmPaymentIntent(paymentIntentId) {
        try {
            const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);

            if (paymentIntent.status === 'succeeded') {
                await this.handleSuccessfulPayment(paymentIntent);
            }

            return paymentIntent;
        } catch (error) {
            logger.error('Payment confirmation failed:', error);
            throw error;
        }
    }

    /**
     * Handle successful payment
     */
    async handleSuccessfulPayment(paymentIntent) {
        const { transaction_id, listing_id, buyer_id, seller_id } = paymentIntent.metadata;

        // Update payment record
        await Payment.update({
            status: 'succeeded',
            paid_at: new Date(),
            provider_payment_id: paymentIntent.id,
        }, {
            where: { provider_payment_id: paymentIntent.id },
        });

        // Update transaction
        await Transaction.update({
            status: 'payment_completed',
            payment_id: paymentIntent.id,
        }, {
            where: { id: transaction_id },
        });

        // Mark listing as sold
        await Listing.update({
            status: 'sold',
            sold_at: new Date(),
            buyer_id: buyer_id,
        }, {
            where: { id: listing_id },
        });

        // Process seller payout (with escrow)
        await this.processPayout(seller_id, paymentIntent.amount, transaction_id);

        // Create notifications
        const { Notification } = require('../../models');
        await Notification.create({
            user_id: buyer_id,
            type: 'payment_update',
            title: 'Payment Successful',
            message: `Your payment of $${(paymentIntent.amount / 100).toFixed(2)} was successful.`,
            data: { transaction_id, payment_intent_id: paymentIntent.id },
            action_url: `/transactions/${transaction_id}`,
            action_label: 'View Order',
        });

        await Notification.create({
            user_id: seller_id,
            type: 'payment_update',
            title: 'Item Sold!',
            message: `Your item has been purchased for $${(paymentIntent.amount / 100).toFixed(2)}.`,
            data: { transaction_id, listing_id },
            action_url: `/transactions/${transaction_id}`,
            action_label: 'View Order',
        });

        // Update product demand score
        const listing = await Listing.findByPk(listing_id, {
            include: ['product'],
        });
        if (listing && listing.product) {
            await listing.product.updateDemandScore();
        }

        // Clear cache
        await redis.delPattern(`prices:${listing_id}`);
        await redis.delPattern(`product:${listing_id}`);

        logger.info(`Payment succeeded: ${paymentIntent.id} for transaction ${transaction_id}`);
    }

    /**
     * Process seller payout
     */
    async processPayout(sellerId, amount, transactionId) {
        try {
            const seller = await User.findByPk(sellerId);

            if (!seller || !seller.stripe_account_id) {
                logger.warn(`Seller ${sellerId} has no Stripe account`);
                return;
            }

            const platformFee = amount * 0.05; // 5% platform fee
            const sellerAmount = amount - platformFee;

            // Create transfer to seller
            const transfer = await this.stripe.transfers.create({
                amount: Math.round(sellerAmount),
                currency: 'usd',
                destination: seller.stripe_account_id,
                transfer_group: `ORDER_${transactionId}`,
                metadata: {
                    transaction_id: transactionId,
                    seller_id: sellerId,
                    platform_fee: Math.round(platformFee),
                },
            });

            // Update transaction with transfer ID
            await Transaction.update({
                stripe_transfer_id: transfer.id,
            }, {
                where: { id: transactionId },
            });

            logger.info(`Payout processed for seller ${sellerId}: ${transfer.id}`);

            return transfer;
        } catch (error) {
            logger.error('Payout processing failed:', error);
            throw error;
        }
    }

    /**
     * Handle webhook events
     */
    async handleWebhook(event) {
        switch (event.type) {
            case 'payment_intent.succeeded':
                await this.handleSuccessfulPayment(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await this.handleFailedPayment(event.data.object);
                break;

            case 'charge.refunded':
                await this.handleRefund(event.data.object);
                break;

            case 'payment_intent.amount_capturable_updated':
                logger.info('Payment intent amount capturable updated:', event.data.object.id);
                break;

            default:
                logger.info(`Unhandled Stripe webhook event: ${event.type}`);
        }
    }

    /**
     * Handle failed payment
     */
    async handleFailedPayment(paymentIntent) {
        const { transaction_id } = paymentIntent.metadata;

        await Payment.update({
            status: 'failed',
            failure_message: paymentIntent.last_payment_error?.message || 'Payment failed',
        }, {
            where: { provider_payment_id: paymentIntent.id },
        });

        await Transaction.update({
            status: 'cancelled',
            cancelled_at: new Date(),
        }, {
            where: { id: transaction_id },
        });

        logger.warn(`Payment failed: ${paymentIntent.id} for transaction ${transaction_id}`);
    }

    /**
     * Handle refund
     */
    async handleRefund(charge) {
        const paymentIntent = charge.payment_intent;

        await Payment.update({
            status: 'refunded',
            refund_amount: charge.amount_refunded / 100,
            refunded_at: new Date(),
        }, {
            where: { provider_payment_id: paymentIntent },
        });

        await Transaction.update({
            status: 'refunded',
            refunded_at: new Date(),
        }, {
            where: { payment_id: paymentIntent },
        });

        logger.info(`Refund processed: ${charge.id} for payment ${paymentIntent}`);
    }

    /**
     * Create refund
     */
    async createRefund(paymentIntentId, amount, reason) {
        try {
            const refund = await this.stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount: amount ? Math.round(amount * 100) : undefined,
                reason: reason || 'requested_by_customer',
            });

            return refund;
        } catch (error) {
            logger.error('Refund creation failed:', error);
            throw error;
        }
    }

    /**
     * Create Stripe Connect account for seller
     */
    async createConnectAccount(email, country = 'US') {
        try {
            const account = await this.stripe.accounts.create({
                type: 'express',
                country: country,
                email: email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                business_type: 'individual',
                business_profile: {
                    name: 'PricePulse Seller',
                    url: process.env.FRONTEND_URL,
                },
                settings: {
                    payouts: {
                        schedule: {
                            interval: 'daily',
                        },
                    },
                },
            });

            return account;
        } catch (error) {
            logger.error('Connect account creation failed:', error);
            throw error;
        }
    }

    /**
     * Create account link for onboarding
     */
    async createAccountLink(accountId, returnUrl, refreshUrl) {
        try {
            const accountLink = await this.stripe.accountLinks.create({
                account: accountId,
                return_url: returnUrl,
                refresh_url: refreshUrl,
                type: 'account_onboarding',
            });

            return accountLink;
        } catch (error) {
            logger.error('Account link creation failed:', error);
            throw error;
        }
    }

    /**
     * Get account balance
     */
    async getBalance(accountId) {
        try {
            const balance = await this.stripe.balance.retrieve({
                stripeAccount: accountId,
            });
            return balance;
        } catch (error) {
            logger.error('Balance retrieval failed:', error);
            throw error;
        }
    }

    /**
     * Create customer
     */
    async createCustomer(email, name, metadata = {}) {
        try {
            const customer = await this.stripe.customers.create({
                email,
                name,
                metadata,
            });
            return customer;
        } catch (error) {
            logger.error('Customer creation failed:', error);
            throw error;
        }
    }

    /**
     * Attach payment method to customer
     */
    async attachPaymentMethod(customerId, paymentMethodId) {
        try {
            const paymentMethod = await this.stripe.paymentMethods.attach(
                paymentMethodId,
                { customer: customerId }
            );
            return paymentMethod;
        } catch (error) {
            logger.error('Payment method attachment failed:', error);
            throw error;
        }
    }

    /**
     * Set default payment method
     */
    async setDefaultPaymentMethod(customerId, paymentMethodId) {
        try {
            const customer = await this.stripe.customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });
            return customer;
        } catch (error) {
            logger.error('Default payment method update failed:', error);
            throw error;
        }
    }
}

module.exports = new StripeService();