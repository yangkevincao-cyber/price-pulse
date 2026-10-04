// backend/tests/integration/api/products.test.js
const request = require('supertest');
const { app } = require('../../../src/app');

describe('Products API Integration', () => {
    let authToken;
    let productId;

    beforeAll(async () => {
        // Login to get auth token
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'admin@pricepulse.com',
                password: 'Admin@123456',
            });

        authToken = response.body.data.tokens.accessToken;
    });

    describe('GET /api/products', () => {
        it('should get all products', async () => {
            const response = await request(app)
                .get('/api/products')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('products');
            expect(Array.isArray(response.body.data.products)).toBe(true);
            expect(response.body.data).toHaveProperty('pagination');
        });

        it('should filter products by category', async () => {
            const response = await request(app)
                .get('/api/products?categoryId=1')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.products).toBeDefined();
        });

        it('should filter products by search query', async () => {
            const response = await request(app)
                .get('/api/products?search=iphone')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.products).toBeDefined();
        });
    });

    describe('GET /api/products/:id', () => {
        it('should get product by ID', async () => {
            // First get a product
            const products = await request(app)
                .get('/api/products?limit=1')
                .expect(200);

            const product = products.body.data.products[0];
            productId = product.id;

            const response = await request(app)
                .get(`/api/products/${productId}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.product.id).toBe(productId);
            expect(response.body.data).toHaveProperty('price_prediction');
            expect(response.body.data).toHaveProperty('similar_products');
        });

        it('should return 404 for non-existent product', async () => {
            const response = await request(app)
                .get('/api/products/11111111-1111-1111-1111-111111111111')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Product not found');
        });
    });

    describe('GET /api/products/trending', () => {
        it('should get trending products', async () => {
            const response = await request(app)
                .get('/api/products/trending')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    describe('GET /api/products/search', () => {
        it('should search products', async () => {
            const response = await request(app)
                .get('/api/products/search?q=iphone')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.meta).toHaveProperty('query');
        });

        it('should return error for short query', async () => {
            const response = await request(app)
                .get('/api/products/search?q=a')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('at least 2 characters');
        });
    });

    describe('POST /api/products (Admin only)', () => {
        it('should create product with admin token', async () => {
            const response = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test API Product',
                    category_id: 1,
                    price: 99.99,
                    description: 'Test product description',
                    brand: 'Test Brand',
                    is_active: true,
                })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.product.name).toBe('Test API Product');
            productId = response.body.data.product.id;
        });

        it('should return error without admin token', async () => {
            const response = await request(app)
                .post('/api/products')
                .send({
                    name: 'Unauthorized Product',
                    category_id: 1,
                    price: 99.99,
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('No token provided');
        });
    });

    describe('PUT /api/products/:id (Admin only)', () => {
        it('should update product with admin token', async () => {
            const response = await request(app)
                .put(`/api/products/${productId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Updated Test Product',
                    price: 199.99,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.product.name).toBe('Updated Test Product');
            expect(response.body.data.product.price).toBe('199.99');
        });
    });

    describe('DELETE /api/products/:id (Admin only)', () => {
        it('should delete product with admin token', async () => {
            const response = await request(app)
                .delete(`/api/products/${productId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Product deleted successfully');
        });
    });
});