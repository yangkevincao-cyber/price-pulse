// backend/tests/integration/api/payments.test.js
const request = require('supertest');
const { app } = require('../../../src/app');
const { Product, Category, Listing, Transaction, Payment } = require('../../../src/models');

describe('Payments API Integration', () => {
    let authToken;
    let sellerToken;
    let buyerToken;
    let category;
    let product;
    let listing;
    let transaction;
    let paymentId;

    beforeAll(async () => {
        // Get tokens
        const adminResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'admin@pricepulse.com',
                password: 'Admin@123456',
            });
        authToken = adminResponse.body.data.tokens.accessToken;

        const sellerResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'seller@pricepulse.com',
                password: 'Seller@123456',
            });
        sellerToken = sellerResponse.body.data.tokens.accessToken;

        const buyerResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'buyer@pricepulse.com',
                password: 'Buyer@123456',
            });
        buyerToken = buyerResponse.body.data.tokens.accessToken;

        // Create test data
        const categoryResponse = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name: 'Payment Test Category',
                slug: 'payment-test-category',
                description: 'Category for payment tests',
                is_active: true,
            });
        category = categoryResponse.body.data.category;

        const productResponse = await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name: 'Payment Test Product',
                category_id: category.id,
                price: 299.99,
                description: 'Product for payment tests',
                brand: 'Test Brand',
                is_active: true,
            });
        product = productResponse.body.data.product;

        const listingResponse = await request(app)
            .post('/api/listings')
            .set('Authorization', `Bearer ${sellerToken}`)
            .send({
                product_id: product.id,
                title: 'Payment Test Listing',
                description: 'Listing for payment tests',
                price: 199.99,
                condition: 'new',
                quantity: 3,
                shipping_cost: 9.99,
                accepts_offers: false,
            });
        listing = listingResponse.body.data.listing;

        // Create transaction
        const transactionResponse = await request(app)
            .post('/api/transactions')
            .set('Authorization', `Bearer ${buyerToken}`)
            .send({
                listingId: listing.id,
                paymentMethod: 'stripe',
                shippingAddress: {
                    street: '123 Payment St',
                    city: 'Payment City',
                    state: 'PC',
                    postal_code: '12345',
                    country: 'USA',
                },
                notes: 'Payment test transaction',
            });
        transaction = transactionResponse.body.data.transaction;
    });

    describe('POST /api/payments/stripe/create-payment', () => {
        it('should create Stripe payment intent', async () => {
            const response = await request(app)
                .post('/api/payments/stripe/create-payment')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    amount: transaction.total_amount,
                    currency: 'usd',
                    transactionId: transaction.id,
                    listingId: listing.id,
                    sellerId: listing.user_id,
                    productId: product.id,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('clientSecret');
            expect(response.body.data).toHaveProperty('paymentIntentId');
            expect(response.body.data).toHaveProperty('status');

            paymentId = response.body.data.paymentIntentId;
        });

        it('should return error for invalid transaction', async () => {
            const response = await request(app)
                .post('/api/payments/stripe/create-payment')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    amount: 100,
                    currency: 'usd',
                    transactionId: '11111111-1111-1111-1111-111111111111',
                    listingId: listing.id,
                    sellerId: listing.user_id,
                    productId: product.id,
                })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Transaction not found');
        });

        it('should return error for non-buyer', async () => {
            const response = await request(app)
                .post('/api/payments/stripe/create-payment')
                .set('Authorization', `Bearer ${sellerToken}`)
                .send({
                    amount: transaction.total_amount,
                    currency: 'usd',
                    transactionId: transaction.id,
                    listingId: listing.id,
                    sellerId: listing.user_id,
                    productId: product.id,
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('not the buyer');
        });
    });

    describe('POST /api/payments/stripe/confirm', () => {
        it('should confirm Stripe payment', async () => {
            // Create a payment intent first
            const paymentResponse = await request(app)
                .post('/api/payments/stripe/create-payment')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    amount: transaction.total_amount,
                    currency: 'usd',
                    transactionId: transaction.id,
                    listingId: listing.id,
                    sellerId: listing.user_id,
                    productId: product.id,
                });

            const response = await request(app)
                .post('/api/payments/stripe/confirm')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    paymentIntentId: paymentResponse.body.data.paymentIntentId,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('status');
        });

        it('should return error for invalid payment intent', async () => {
            const response = await request(app)
                .post('/api/payments/stripe/confirm')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    paymentIntentId: 'invalid_intent_id',
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/payments/paypal/create-order', () => {
        it('should create PayPal order', async () => {
            const response = await request(app)
                .post('/api/payments/paypal/create-order')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    amount: transaction.total_amount,
                    currency: 'usd',
                    transactionId: transaction.id,
                    listingId: listing.id,
                    sellerId: listing.user_id,
                    productId: product.id,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('orderId');
            expect(response.body.data).toHaveProperty('approvalUrl');
        });

        it('should return error for invalid transaction', async () => {
            const response = await request(app)
                .post('/api/payments/paypal/create-order')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    amount: 100,
                    currency: 'usd',
                    transactionId: '11111111-1111-1111-1111-111111111111',
                    listingId: listing.id,
                    sellerId: listing.user_id,
                    productId: product.id,
                })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Transaction not found');
        });
    });

    describe('POST /api/payments/paypal/capture', () => {
        it('should capture PayPal order', async () => {
            // Create a PayPal order first
            const orderResponse = await request(app)
                .post('/api/payments/paypal/create-order')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    amount: transaction.total_amount,
                    currency: 'usd',
                    transactionId: transaction.id,
                    listingId: listing.id,
                    sellerId: listing.user_id,
                    productId: product.id,
                });

            const response = await request(app)
                .post('/api/payments/paypal/capture')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    orderId: orderResponse.body.data.orderId,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('status');
        });
    });

    describe('GET /api/payments/transactions', () => {
        it('should get payment transactions', async () => {
            const response = await request(app)
                .get('/api/payments/transactions')
                .set('Authorization', `Bearer ${buyerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.payments).toBeDefined();
            expect(Array.isArray(response.body.data.payments)).toBe(true);
            expect(response.body.data.pagination).toBeDefined();
        });

        it('should filter by status', async () => {
            const response = await request(app)
                .get('/api/payments/transactions?status=processing')
                .set('Authorization', `Bearer ${buyerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.payments).toBeDefined();
        });
    });

    describe('GET /api/payments/:id', () => {
        it('should get payment by ID', async () => {
            // Get a payment first
            const paymentsResponse = await request(app)
                .get('/api/payments/transactions')
                .set('Authorization', `Bearer ${buyerToken}`);

            const payment = paymentsResponse.body.data.payments[0];
            if (payment) {
                const response = await request(app)
                    .get(`/api/payments/${payment.id}`)
                    .set('Authorization', `Bearer ${buyerToken}`)
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(response.body.data.payment.id).toBe(payment.id);
                expect(response.body.data.payment).toHaveProperty('transaction');
            }
        });

        it('should return error for non-existent payment', async () => {
            const response = await request(app)
                .get('/api/payments/11111111-1111-1111-1111-111111111111')
                .set('Authorization', `Bearer ${buyerToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Payment not found');
        });
    });

    describe('POST /api/payments/:id/refund', () => {
        it('should request refund for payment', async () => {
            // First create a completed payment
            const paymentResponse = await request(app)
                .post('/api/payments/stripe/create-payment')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    amount: transaction.total_amount,
                    currency: 'usd',
                    transactionId: transaction.id,
                    listingId: listing.id,
                    sellerId: listing.user_id,
                    productId: product.id,
                });

            // Confirm payment
            await request(app)
                .post('/api/payments/stripe/confirm')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    paymentIntentId: paymentResponse.body.data.paymentIntentId,
                });

            const response = await request(app)
                .post(`/api/payments/${paymentResponse.body.data.paymentIntentId}/refund`)
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    reason: 'Test refund',
                    amount: transaction.total_amount,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Refund initiated successfully');
        });

        it('should return error for non-existent payment', async () => {
            const response = await request(app)
                .post('/api/payments/11111111-1111-1111-1111-111111111111/refund')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    reason: 'Test refund',
                    amount: 100,
                })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Payment not found');
        });
    });

    describe('GET /api/payments/summary', () => {
        it('should get payment summary', async () => {
            const response = await request(app)
                .get('/api/payments/summary')
                .set('Authorization', `Bearer ${buyerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('summary');
            expect(response.body.data).toHaveProperty('recent_payments');
            expect(response.body.data.summary).toHaveProperty('total_payments');
            expect(response.body.data.summary).toHaveProperty('total_spent');
        });

        it('should get payment summary for seller', async () => {
            const response = await request(app)
                .get('/api/payments/summary')
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('summary');
        });
    });

    describe('POST /api/payments/stripe/create-connect-account', () => {
        it('should create Stripe Connect account for seller', async () => {
            const response = await request(app)
                .post('/api/payments/stripe/create-connect-account')
                .set('Authorization', `Bearer ${sellerToken}`)
                .send({
                    email: 'seller.connect@example.com',
                    country: 'US',
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('onboarding_url');
            expect(response.body.data).toHaveProperty('account_id');
        });

        it('should return error for non-seller', async () => {
            const response = await request(app)
                .post('/api/payments/stripe/create-connect-account')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    email: 'buyer.connect@example.com',
                    country: 'US',
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Insufficient permissions');
        });
    });

    describe('Stripe Webhook', () => {
        it('should handle Stripe webhook events', async () => {
            const webhookPayload = {
                id: 'evt_test_webhook',
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        id: 'pi_test_123',
                        amount: 1000,
                        currency: 'usd',
                        metadata: {
                            transaction_id: transaction.id,
                            listing_id: listing.id,
                            buyer_id: transaction.buyer_id,
                            seller_id: transaction.seller_id,
                        },
                    },
                },
            };

            const response = await request(app)
                .post('/api/payments/stripe/webhook')
                .send(webhookPayload)
                .set('stripe-signature', 'test_signature')
                .expect(200);

            expect(response.body.received).toBe(true);
        });
    });

    describe('PayPal Webhook', () => {
        it('should handle PayPal webhook events', async () => {
            const webhookPayload = {
                event_type: 'PAYMENT.CAPTURE.COMPLETED',
                resource: {
                    id: 'test_paypal_payment',
                    amount: {
                        value: '100.00',
                        currency_code: 'USD',
                    },
                    custom_id: JSON.stringify({
                        transaction_id: transaction.id,
                        listing_id: listing.id,
                    }),
                },
            };

            const response = await request(app)
                .post('/api/payments/paypal/webhook')
                .send(webhookPayload)
                .expect(200);

            expect(response.body.received).toBe(true);
        });
    });

    describe('Payment Error Handling', () => {
        it('should handle invalid payment method', async () => {
            const response = await request(app)
                .post('/api/transactions')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    listingId: listing.id,
                    paymentMethod: 'invalid_method',
                    shippingAddress: {
                        street: '123 Test St',
                        city: 'Test City',
                        state: 'TS',
                        postal_code: '12345',
                        country: 'USA',
                    },
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid payment method');
        });

        it('should handle payment failure', async () => {
            const response = await request(app)
                .post('/api/payments/stripe/create-payment')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    amount: 0.01, // Too small amount
                    currency: 'usd',
                    transactionId: transaction.id,
                    listingId: listing.id,
                    sellerId: listing.user_id,
                    productId: product.id,
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('Payment Security', () => {
        it('should not allow access to other user\'s payments', async () => {
            // Get another user's token
            const otherResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'other@example.com',
                    password: 'Test@123456',
                });
            const otherToken = otherResponse.body.data.tokens.accessToken;

            // Get a payment from the first user
            const paymentsResponse = await request(app)
                .get('/api/payments/transactions')
                .set('Authorization', `Bearer ${buyerToken}`);

            const payment = paymentsResponse.body.data.payments[0];
            if (payment) {
                const response = await request(app)
                    .get(`/api/payments/${payment.id}`)
                    .set('Authorization', `Bearer ${otherToken}`)
                    .expect(403);

                expect(response.body.success).toBe(false);
                expect(response.body.error).toContain('do not have access');
            }
        });

        it('should validate refund amount', async () => {
            const response = await request(app)
                .post(`/api/payments/${paymentId}/refund`)
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    reason: 'Test refund',
                    amount: 999999, // Exceeds payment amount
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Refund amount cannot exceed');
        });
    });
});