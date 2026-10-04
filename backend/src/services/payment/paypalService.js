// backend/src/services/payment/paypalService.js
const axios = require('axios');
const { Payment, Transaction, Listing, User } = require('../../models');
const { logger } = require('../../config/logger');

class PayPalService {
    constructor() {
        this.baseURL = process.env.NODE_ENV === 'production'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
        this.clientId = process.env.PAYPAL_CLIENT_ID;
        this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Get PayPal access token
     */
    async getAccessToken() {
        if (this.accessToken && this.tokenExpiry > Date.now()) {
            return this.accessToken;
        }

        try {
            const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

            const response = await axios.post(
                `${this.baseURL}/v1/oauth2/token`,
                'grant_type=client_credentials',
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

            return this.accessToken;
        } catch (error) {
            logger.error('PayPal access token failed:', error);
            throw error;
        }
    }

    /**
     * Create PayPal order
     */
    async createOrder(data) {
        const { amount, currency, transactionId, listingId, buyerId, sellerId } = data;

        try {
            const token = await this.getAccessToken();

            const order = {
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: currency || 'USD',
                        value: amount.toFixed(2),
                        breakdown: {
                            item_total: {
                                currency_code: currency || 'USD',
                                value: amount.toFixed(2),
                            },
                        },
                    },
                    payee: {
                        email_address: data.sellerEmail,
                    },
                    payment_instruction: {
                        platform_fees: [{
                            amount: {
                                currency_code: currency || 'USD',
                                value: (amount * 0.05).toFixed(2),
                            },
                        }],
                    },
                    custom_id: JSON.stringify({
                        transaction_id: transactionId,
                        listing_id: listingId,
                        buyer_id: buyerId,
                        seller_id: sellerId,
                    }),
                }],
                application_context: {
                    return_url: data.returnUrl || `${process.env.FRONTEND_URL}/payment/success`,
                    cancel_url: data.cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
                    brand_name: 'PricePulse',
                    landing_page: 'BILLING',
                    user_action: 'PAY_NOW',
                    shipping_preference: 'GET_FROM_FILE',
                },
            };

            const response = await axios.post(
                `${this.baseURL}/v2/checkout/orders`,
                order,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            // Store order
            await Payment.create({
                user_id: buyerId,
                transaction_id: transactionId,
                amount: amount,
                currency: currency || 'USD',
                payment_method: 'paypal',
                payment_provider: 'paypal',
                provider_payment_id: response.data.id,
                status: 'pending',
                metadata: {
                    listing_id: listingId,
                    seller_id: sellerId,
                },
            });

            const approvalLink = response.data.links.find(link => link.rel === 'approve');

            return {
                orderId: response.data.id,
                approvalUrl: approvalLink?.href,
                status: response.data.status,
            };
        } catch (error) {
            logger.error('PayPal order creation failed:', error);
            throw error;
        }
    }

    /**
     * Capture PayPal order
     */
    async captureOrder(orderId) {
        try {
            const token = await this.getAccessToken();

            const response = await axios.post(
                `${this.baseURL}/v2/checkout/orders/${orderId}/capture`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.data.status === 'COMPLETED') {
                await this.handleSuccessfulPayment(orderId, response.data);
            }

            return response.data;
        } catch (error) {
            logger.error('PayPal capture failed:', error);
            throw error;
        }
    }

    /**
     * Handle successful payment
     */
    async handleSuccessfulPayment(orderId, captureData) {
        const customId = JSON.parse(captureData.purchase_units[0].custom_id);
        const { transaction_id, listing_id, buyer_id, seller_id } = customId;

        // Update payment
        await Payment.update({
            status: 'succeeded',
            paid_at: new Date(),
            provider_payment_id: captureData.id,
            provider_customer_id: captureData.payer?.payer_id,
        }, {
            where: { provider_payment_id: orderId },
        });

        // Update transaction
        await Transaction.update({
            status: 'payment_completed',
            payment_id: captureData.id,
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
        const seller = await User.findByPk(seller_id);
        if (seller && seller.paypal_account_id) {
            await this.processPayout(seller_id, captureData.purchase_units[0].amount.value, transaction_id);
        }

        // Create notifications
        const { Notification } = require('../../models');
        await Notification.create({
            user_id: buyer_id,
            type: 'payment_update',
            title: 'Payment Successful',
            message: `Your payment of $${captureData.purchase_units[0].amount.value} was successful.`,
            data: { transaction_id, order_id: orderId },
            action_url: `/transactions/${transaction_id}`,
            action_label: 'View Order',
        });

        await Notification.create({
            user_id: seller_id,
            type: 'payment_update',
            title: 'Item Sold!',
            message: `Your item has been purchased for $${captureData.purchase_units[0].amount.value}.`,
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

        logger.info(`PayPal payment succeeded: ${orderId} for transaction ${transaction_id}`);
    }

    /**
     * Process seller payout
     */
    async processPayout(sellerId, amount, transactionId) {
        try {
            const seller = await User.findByPk(sellerId);

            if (!seller || !seller.paypal_account_id) {
                logger.warn(`Seller ${sellerId} has no PayPal account`);
                return;
            }

            const platformFee = amount * 0.05;
            const sellerAmount = amount - platformFee;

            // Create payout to seller
            const token = await this.getAccessToken();

            const payout = await axios.post(
                `${this.baseURL}/v1/payments/payouts`,
                {
                    sender_batch_header: {
                        sender_batch_id: `ORDER_${transactionId}_${Date.now()}`,
                        email_subject: 'You have a payment from PricePulse',
                        email_message: 'Your item was sold on PricePulse!',
                    },
                    items: [{
                        recipient_type: 'EMAIL',
                        amount: {
                            value: sellerAmount.toFixed(2),
                            currency: 'USD',
                        },
                        receiver: seller.paypal_account_id,
                        note: `Payment for order ${transactionId}`,
                        sender_item_id: `item_${transactionId}`,
                    }],
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            // Update transaction with payout ID
            await Transaction.update({
                paypal_payout_id: payout.data.batch_header.payout_batch_id,
            }, {
                where: { id: transactionId },
            });

            logger.info(`PayPal payout processed for seller ${sellerId}: ${payout.data.batch_header.payout_batch_id}`);

            return payout.data;
        } catch (error) {
            logger.error('PayPal payout failed:', error);
            throw error;
        }
    }

    /**
     * Refund payment
     */
    async refundPayment(captureId, amount, reason) {
        try {
            const token = await this.getAccessToken();

            const refundData = amount ? {
                amount: {
                    value: amount.toFixed(2),
                    currency_code: 'USD',
                },
                note_to_payer: reason || 'Refund requested',
            } : {};

            const response = await axios.post(
                `${this.baseURL}/v2/payments/captures/${captureId}/refund`,
                refundData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            await Payment.update({
                status: 'refunded',
                refund_amount: amount || response.data.amount.value,
                refunded_at: new Date(),
            }, {
                where: { provider_payment_id: captureId },
            });

            await Transaction.update({
                status: 'refunded',
                refunded_at: new Date(),
            }, {
                where: { payment_id: captureId },
            });

            logger.info(`PayPal refund processed: ${captureId}`);

            return response.data;
        } catch (error) {
            logger.error('PayPal refund failed:', error);
            throw error;
        }
    }

    /**
     * Get order details
     */
    async getOrder(orderId) {
        try {
            const token = await this.getAccessToken();

            const response = await axios.get(
                `${this.baseURL}/v2/checkout/orders/${orderId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data;
        } catch (error) {
            logger.error('Get order failed:', error);
            throw error;
        }
    }
}

module.exports = new PayPalService();