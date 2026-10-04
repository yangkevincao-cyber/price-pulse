// backend/tests/unit/services/productService.test.js
const { Product, Category, Listing } = require('../../../src/models');
const pricePredictionService = require('../../../src/services/intelligence/pricePredictionService');
const recommendationService = require('../../../src/services/intelligence/recommendationService');

describe('Product Service', () => {
    let category;
    let product;

    beforeEach(async () => {
        category = await Category.create({
            name: 'Test Category',
            slug: 'test-category',
            description: 'Test category description',
            is_active: true,
        });

        product = await Product.create({
            name: 'Test Product',
            slug: 'test-product',
            description: 'Test product description',
            category_id: category.id,
            brand: 'Test Brand',
            price: 99.99,
            is_active: true,
        });
    });

    describe('Price Prediction Service', () => {
        it('should predict price with sufficient history', async () => {
            // Create price history
            const prices = [100, 98, 95, 97, 96, 99, 98];
            for (const price of prices) {
                await PriceHistory.create({
                    product_id: product.id,
                    price: price,
                    source: 'listing',
                });
            }

            const prediction = await pricePredictionService.predictPrice(product.id, 7);
            expect(prediction).toHaveProperty('predicted_price');
            expect(prediction).toHaveProperty('confidence_interval');
            expect(prediction).toHaveProperty('recommendation');
            expect(prediction.product_id).toBe(product.id);
        });

        it('should return fallback prediction with insufficient data', async () => {
            const prediction = await pricePredictionService.predictPrice(product.id, 7);
            expect(prediction).toHaveProperty('predicted_price');
            expect(prediction.model_confidence).toBeLessThan(0.5);
        });
    });

    describe('Recommendation Service', () => {
        it('should get trending products', async () => {
            const trending = await recommendationService.getTrendingRecommendations(5);
            expect(Array.isArray(trending)).toBe(true);
            expect(trending.length).toBeGreaterThan(0);
        });

        it('should get similar products', async () => {
            const similar = await recommendationService.getSimilarProducts(product.id, 5);
            expect(Array.isArray(similar)).toBe(true);
        });

        it('should calculate similarity score', async () => {
            const productB = await Product.create({
                name: 'Test Product 2',
                slug: 'test-product-2',
                category_id: category.id,
                brand: 'Test Brand',
                price: 89.99,
                is_active: true,
            });

            const score = recommendationService.calculateSimilarityScore(product, productB);
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThanOrEqual(1);
        });
    });
});