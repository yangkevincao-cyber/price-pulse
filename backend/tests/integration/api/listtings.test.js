// backend/tests/integration/api/listings.test.js
const request = require('supertest');
const { app } = require('../../../src/app');
const { Product, Category, Listing } = require('../../../src/models');

describe('Listings API Integration', () => {
    let authToken;
    let sellerToken;
    let category;
    let product;
    let listingId;

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

        // Create test category
        const categoryResponse = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name: 'API Test Category',
                slug: 'api-test-category',
                description: 'Category for API tests',
                is_active: true,
            });
        category = categoryResponse.body.data.category;

        // Create test product
        const productResponse = await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name: 'API Test Product',
                category_id: category.id,
                price: 99.99,
                description: 'Product for API tests',
                brand: 'Test Brand',
                is_active: true,
            });
        product = productResponse.body.data.product;
    });

    describe('POST /api/listings', () => {
        it('should create listing with seller token', async () => {
            const response = await request(app)
                .post('/api/listings')
                .set('Authorization', `Bearer ${sellerToken}`)
                .send({
                    product_id: product.id,
                    title: 'Test Listing',
                    description: 'Test listing description',
                    price: 89.99,
                    condition: 'new',
                    quantity: 2,
                    shipping_cost: 5.99,
                    accepts_offers: true,
                })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.listing.title).toBe('Test Listing');
            expect(response.body.data.listing.price).toBe('89.99');
            expect(response.body.data.listing.status).toBe('active');

            listingId = response.body.data.listing.id;
        });

        it('should return error without seller role', async () => {
            // Login as buyer
            const buyerResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'buyer@pricepulse.com',
                    password: 'Buyer@123456',
                });
            const buyerToken = buyerResponse.body.data.tokens.accessToken;

            const response = await request(app)
                .post('/api/listings')
                .set('Authorization', `Bearer ${buyerToken}`)
                .send({
                    product_id: product.id,
                    title: 'Buyer Listing',
                    price: 99.99,
                    condition: 'new',
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Only sellers can create listings');
        });

        it('should return validation error for missing fields', async () => {
            const response = await request(app)
                .post('/api/listings')
                .set('Authorization', `Bearer ${sellerToken}`)
                .send({
                    product_id: product.id,
                    // Missing required fields
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.errors).toBeDefined();
        });
    });

    describe('GET /api/listings', () => {
        it('should get all listings', async () => {
            const response = await request(app)
                .get('/api/listings')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.listings).toBeDefined();
            expect(Array.isArray(response.body.data.listings)).toBe(true);
            expect(response.body.data.pagination).toBeDefined();
        });

        it('should filter listings by category', async () => {
            const response = await request(app)
                .get(`/api/listings?categoryId=${category.id}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.listings).toBeDefined();
        });

        it('should filter listings by price range', async () => {
            const response = await request(app)
                .get('/api/listings?minPrice=50&maxPrice=100')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.listings).toBeDefined();
        });

        it('should sort listings', async () => {
            const response = await request(app)
                .get('/api/listings?sortBy=price&sortOrder=ASC')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.listings).toBeDefined();
        });
    });

    describe('GET /api/listings/:id', () => {
        it('should get listing by ID', async () => {
            const response = await request(app)
                .get(`/api/listings/${listingId}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.listing.id).toBe(listingId);
            expect(response.body.data.listing).toHaveProperty('seller');
            expect(response.body.data.listing).toHaveProperty('product');
        });

        it('should return 404 for non-existent listing', async () => {
            const response = await request(app)
                .get('/api/listings/11111111-1111-1111-1111-111111111111')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Listing not found');
        });
    });

    describe('PUT /api/listings/:id', () => {
        it('should update listing as owner', async () => {
            const response = await request(app)
                .put(`/api/listings/${listingId}`)
                .set('Authorization', `Bearer ${sellerToken}`)
                .send({
                    title: 'Updated Listing Title',
                    price: 79.99,
                    description: 'Updated description',
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.listing.title).toBe('Updated Listing Title');
            expect(response.body.data.listing.price).toBe('79.99');
        });

        it('should return error when updating as non-owner', async () => {
            const response = await request(app)
                .put(`/api/listings/${listingId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Admin Update',
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('do not own this listing');
        });
    });

    describe('PATCH /api/listings/:id/toggle-status', () => {
        it('should toggle listing status', async () => {
            const response = await request(app)
                .patch(`/api/listings/${listingId}/toggle-status`)
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.listing.status).toBe('paused');

            // Toggle back
            const toggleBack = await request(app)
                .patch(`/api/listings/${listingId}/toggle-status`)
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(200);

            expect(toggleBack.body.data.listing.status).toBe('active');
        });
    });

    describe('DELETE /api/listings/:id', () => {
        it('should delete listing as owner', async () => {
            const response = await request(app)
                .delete(`/api/listings/${listingId}`)
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Listing deleted successfully');
        });

        it('should return error for already deleted listing', async () => {
            const response = await request(app)
                .delete(`/api/listings/${listingId}`)
                .set('Authorization', `Bearer ${sellerToken}`)
                .expect(500);

            expect(response.body.success).toBe(false);
        });
    });
});