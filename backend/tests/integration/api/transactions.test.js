// backend/tests/integration/api/transactions.test.js
const request = require('supertest');
const { app } = require('../../../src/app');
const { Product, Category, Listing } = require('../../../src/models');

describe('Transactions API Integration', () => {
    let authToken;
    let sellerToken;
    let buyerToken;
    let category;
    let product;
    let listing;
    let transactionId;

    beforeAll(async () => {
        // Get admin token
        const adminResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'admin@pricepulse.com',
                password: 'Admin@123456',
            });
        authToken = adminResponse.body.data.tokens.accessToken;

        // Get seller token
        const sellerResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'seller@pricepulse.com',
                password: 'Seller@123456',
            });
        sellerToken = sellerResponse.body.data.tokens.accessToken;

        // Get buyer token
        const buyerResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'buyer@pricepulse.com',
                password: 'Buyer@123456',
            });
        buyerToken = buyerResponse.body.data.tokens.accessToken;

        // Create test category
        const categoryResponse = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name: 'Transaction Test Category',
                slug: 'transaction-test-category',
                description: 'Category for transaction tests',
                is_active: true,
            });
        category = categoryResponse.body.data.category;

        // Create test product
        const productResponse = await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name: 'Transaction Test Product',
                category_id: category.id,
                price: 199.99,
                description: 'Product for transaction tests',
                brand: 'Test Brand',
                is_active: true,
            });
        product = productResponse.body.data.product;

        // Create test listing
        const listingResponse = await request(app)
            .post('/api/listings')
            .set('Authorization', `Bearer ${sellerToken}`)
            .send({
                product_id: product.id,
                title: 'Transaction Test Listing',
                description: 'Listing for transaction tests',
                price: 149.99,
                condition: 'new',
                quantity: 5,
                shipping_cost: 9.99,
                accepts_offers: true,
            });
        listing = listingResponse.body.data.listing;
    });

    describe('POST /api/transactions', () => {
        it('should create transaction as buyer', async () => {
            const response = await request(app)
                .post('/api/transactions')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    listingId: listing.id,
                    paymentMethod: 'stripe',
                    shippingAddress: {
                        street: '123 Test St',
                        city: 'Test City',
                        state: 'TS',
                        postal_code: '12345',
                        country: 'USA',
                    },
                    notes: 'Test transaction',
                })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transaction.status).toBe('pending');
            expect(response.body.data.transaction.total_amount).toBeDefined();
            expect(response.body.data.payment).toBeDefined();

            transactionId = response.body.data.transaction.id;
        });

        it('should return error when buying own listing', async () => {
            const response = await request(app)
                .post('/api/transactions')
                .set('Authorization', `Bearer ${sellerToken}`)
                .send({
                    listingId: listing.id,
                    paymentMethod: 'stripe',
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
            expect(response.body.error).toContain('cannot purchase your own listing');
        });

        it('should return error for invalid listing', async () => {
            const response = await request(app)
                .post('/api/transactions')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    listingId: '11111111-1111-1111-1111-111111111111',
                    paymentMethod: 'stripe',
                    shippingAddress: {
                        street: '123 Test St',
                        city: 'Test City',
                        state: 'TS',
                        postal_code: '12345',
                        country: 'USA',
                    },
                })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Listing not found');
        });
    });

    describe('GET /api/transactions', () => {
        it('should get user transactions as buyer', async () => {
            const response = await request(app)
                .get('/api/transactions')
                .set('Authorization', `Bearer ${buyerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transactions).toBeDefined();
            expect(Array.isArray(response.body.data.transactions)).toBe(true);
            expect(response.body.data.pagination).toBeDefined();
        });

        it('should get user transactions as seller', async () => {
            const response = await request(app)
                .get('/api/transactions')
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transactions).toBeDefined();
        });

        it('should filter transactions by role', async () => {
            const response = await request(app)
                .get('/api/transactions?role=buyer')
                .set('Authorization', `Bearer ${buyerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transactions).toBeDefined();
        });
    });

    describe('GET /api/transactions/:id', () => {
        it('should get transaction as buyer', async () => {
            const response = await request(app)
                .get(`/api/transactions/${transactionId}`)
                .set('Authorization', `Bearer ${buyerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transaction.id).toBe(transactionId);
            expect(response.body.data.transaction).toHaveProperty('buyer');
            expect(response.body.data.transaction).toHaveProperty('seller');
            expect(response.body.data.transaction).toHaveProperty('listing');
        });

        it('should get transaction as seller', async () => {
            const response = await request(app)
                .get(`/api/transactions/${transactionId}`)
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transaction.id).toBe(transactionId);
        });

        it('should return error when accessing as non-participant', async () => {
            // Login as a different user
            const otherResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'other@example.com',
                    password: 'Test@123456',
                });
            const otherToken = otherResponse.body.data.tokens.accessToken;

            const response = await request(app)
                .get(`/api/transactions/${transactionId}`)
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('do not have access');
        });
    });

    describe('PATCH /api/transactions/:id/shipped', () => {
        it('should mark transaction as shipped (seller)', async () => {
            // First, update payment status
            await request(app)
                .post('/api/payments/stripe/confirm')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    paymentIntentId: 'mock_payment_intent_id',
                });

            const response = await request(app)
                .patch(`/api/transactions/${transactionId}/shipped`)
                .set('Authorization', `Bearer ${sellerToken}`)
                .send({
                    trackingNumber: '1Z999AA10123456784',
                    carrier: 'usps',
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transaction.status).toBe('shipping');
        });

        it('should return error when marking as shipped by non-seller', async () => {
            const response = await request(app)
                .patch(`/api/transactions/${transactionId}/shipped`)
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    trackingNumber: '1Z999AA10123456784',
                    carrier: 'usps',
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('not the seller');
        });
    });

    describe('PATCH /api/transactions/:id/delivered', () => {
        it('should mark transaction as delivered (buyer)', async () => {
            const response = await request(app)
                .patch(`/api/transactions/${transactionId}/delivered`)
                .set('Authorization', `Bearer ${buyerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transaction.status).toBe('delivered');
        });

        it('should return error when marking as delivered by non-buyer', async () => {
            const response = await request(app)
                .patch(`/api/transactions/${transactionId}/delivered`)
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('not the buyer');
        });
    });

    describe('GET /api/transactions/stats', () => {
        it('should get transaction stats as seller', async () => {
            const response = await request(app)
                .get('/api/transactions/stats?role=seller')
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('stats');
            expect(response.body.data).toHaveProperty('status_counts');
        });

        it('should get transaction stats as buyer', async () => {
            const response = await request(app)
                .get('/api/transactions/stats?role=buyer')
                .set('Authorization', `Bearer ${buyerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('stats');
        });
    });

    describe('PATCH /api/transactions/:id/cancel', () => {
        it('should cancel transaction', async () => {
            // Create a new transaction for cancellation test
            const newListing = await request(app)
                .post('/api/listings')
                .set('Authorization', `Bearer ${sellerToken}`)
                .send({
                    product_id: product.id,
                    title: 'Cancel Test Listing',
                    price: 99.99,
                    condition: 'new',
                    quantity: 1,
                });

            const newTransaction = await request(app)
                .post('/api/transactions')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    listingId: newListing.body.data.listing.id,
                    paymentMethod: 'stripe',
                    shippingAddress: {
                        street: '123 Test St',
                        city: 'Test City',
                        state: 'TS',
                        postal_code: '12345',
                        country: 'USA',
                    },
                });

            const response = await request(app)
                .patch(`/api/transactions/${newTransaction.body.data.transaction.id}/cancel`)
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    reason: 'Changed my mind',
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.transaction.status).toBe('cancelled');
        });
    });
});