// backend/tests/unit/models/Product.test.js
const { Product, Category, Listing } = require('../../../src/models');

describe('Product Model', () => {
    let category;
    let productData;

    beforeEach(async () => {
        category = await Category.create({
            name: 'Test Category',
            slug: 'test-category',
            description: 'Test category description',
            is_active: true,
        });

        productData = {
            name: 'Test Product',
            slug: 'test-product',
            description: 'Test product description',
            brand: 'Test Brand',
            category_id: category.id,
            price: 99.99,
            is_active: true,
        };
    });

    describe('Validation', () => {
        it('should create a valid product', async () => {
            const product = await Product.create(productData);
            expect(product.id).toBeDefined();
            expect(product.name).toBe(productData.name);
            expect(product.slug).toBe(productData.slug);
            expect(product.category_id).toBe(category.id);
        });

        it('should require name', async () => {
            const invalidData = { ...productData, name: null };
            await expect(Product.create(invalidData)).rejects.toThrow();
        });

        it('should require category_id', async () => {
            const invalidData = { ...productData, category_id: null };
            await expect(Product.create(invalidData)).rejects.toThrow();
        });

        it('should enforce unique slug', async () => {
            await Product.create(productData);
            await expect(Product.create(productData)).rejects.toThrow();
        });

        it('should generate slug from name if not provided', async () => {
            const product = await Product.create({
                ...productData,
                slug: undefined,
                name: 'New Test Product',
            });
            expect(product.slug).toBe('new-test-product');
        });

        it('should validate slug format', async () => {
            const invalidData = { ...productData, slug: 'Invalid Slug!' };
            await expect(Product.create(invalidData)).rejects.toThrow();
        });

        it('should validate image URLs', async () => {
            const invalidData = {
                ...productData,
                images: ['not-a-url'],
            };
            await expect(Product.create(invalidData)).rejects.toThrow();
        });
    });

    describe('Instance Methods', () => {
        let product;

        beforeEach(async () => {
            product = await Product.create(productData);
        });

        it('should increment view count', async () => {
            const initialViews = product.view_count;
            await product.incrementViewCount();
            expect(product.view_count).toBe(initialViews + 1);
        });

        it('should increment search count', async () => {
            const initialSearches = product.search_count;
            await product.incrementSearchCount();
            expect(product.search_count).toBe(initialSearches + 1);
        });

        it('should update demand score', async () => {
            await product.updateDemandScore();
            expect(product.demand_score).toBeDefined();
            expect(parseFloat(product.demand_score)).toBeGreaterThanOrEqual(0);
            expect(parseFloat(product.demand_score)).toBeLessThanOrEqual(1);
        });

        it('should get price range', async () => {
            // Create some listings
            await Listing.create({
                user_id: '22222222-2222-2222-2222-222222222222',
                product_id: product.id,
                title: 'Test Listing 1',
                price: 89.99,
                condition: 'new',
                status: 'active',
            });
            await Listing.create({
                user_id: '22222222-2222-2222-2222-222222222222',
                product_id: product.id,
                title: 'Test Listing 2',
                price: 109.99,
                condition: 'new',
                status: 'active',
            });

            const priceRange = await product.getPriceRange();
            expect(priceRange.min_price).toBe('89.99');
            expect(priceRange.max_price).toBe('109.99');
            expect(priceRange.seller_count).toBe(2);
        });

        it('should exclude deleted fields from JSON', () => {
            const json = product.toJSON();
            expect(json).not.toHaveProperty('is_deleted');
            expect(json).not.toHaveProperty('deleted_at');
        });
    });

    describe('Scopes', () => {
        let product;

        beforeEach(async () => {
            product = await Product.create(productData);
        });

        it('should scope active products', async () => {
            const activeProducts = await Product.scope('active').findAll();
            expect(activeProducts.length).toBeGreaterThan(0);
        });

        it('should scope featured products', async () => {
            await product.update({ is_featured: true });
            const featured = await Product.scope('featured').findAll();
            expect(featured.length).toBeGreaterThan(0);
        });

        it('should scope trending products', async () => {
            const trending = await Product.scope('trending').findAll();
            expect(trending.length).toBeGreaterThan(0);
        });
    });

    describe('Hooks', () => {
        it('should generate slug before validation', async () => {
            const product = await Product.create({
                ...productData,
                name: 'Another Test Product',
                slug: undefined,
            });
            expect(product.slug).toBe('another-test-product');
        });
    });

    describe('Relationships', () => {
        it('should have category association', async () => {
            const product = await Product.create(productData);
            const category = await product.getCategory();
            expect(category).toBeDefined();
            expect(category.id).toBe(productData.category_id);
        });

        it('should have listings association', async () => {
            const product = await Product.create(productData);
            expect(product).toHaveProperty('listings');
            expect(product).toHaveProperty('price_history');
        });
    });
});