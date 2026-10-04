// backend/tests/unit/controllers/productController.test.js
const productController = require('../../../src/controllers/productController');
const { Product, Category, Listing, Wishlist } = require('../../../src/models');
const { mockRequest, mockResponse } = require('../../fixtures/mocks');
const pricePredictionService = require('../../../src/services/intelligence/pricePredictionService');
const recommendationService = require('../../../src/services/intelligence/recommendationService');

// Mock services
jest.mock('../../../src/services/intelligence/pricePredictionService');
jest.mock('../../../src/services/intelligence/recommendationService');
jest.mock('../../../src/services/cache/cacheService');

describe('Product Controller', () => {
    let req, res;
    const mockProduct = {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Test Product',
        slug: 'test-product',
        description: 'Test description',
        price: 99.99,
        category_id: 1,
        is_active: true,
        is_featured: false,
        demand_score: 0.8,
        average_rating: 4.5,
        review_count: 10,
        wishlist_count: 5,
        view_count: 100,
        search_count: 50,
        tags: ['test', 'product'],
        incrementViewCount: jest.fn().mockResolvedValue(101),
        getPriceRange: jest.fn().mockResolvedValue({
            min_price: 90,
            max_price: 110,
            avg_price: 100,
            seller_count: 5,
        }),
        updateDemandScore: jest.fn().mockResolvedValue(true),
    };

    beforeEach(() => {
        req = mockRequest();
        res = mockResponse();
        jest.clearAllMocks();
    });

    describe('getAllProducts', () => {
        it('should get all products with pagination', async () => {
            const mockFindAndCountAll = jest.spyOn(Product, 'findAndCountAll').mockResolvedValue({
                count: 10,
                rows: [mockProduct],
            });

            req.query = { page: 1, limit: 10 };
            await productController.getAllProducts(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        products: expect.any(Array),
                        pagination: expect.any(Object),
                    }),
                })
            );
            expect(mockFindAndCountAll).toHaveBeenCalled();
        });

        it('should filter products by category', async () => {
            const mockFindAndCountAll = jest.spyOn(Product, 'findAndCountAll').mockResolvedValue({
                count: 5,
                rows: [mockProduct],
            });

            req.query = { categoryId: 1 };
            await productController.getAllProducts(req, res);

            expect(mockFindAndCountAll).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        category_id: 1,
                        is_active: true,
                        is_deleted: false,
                    }),
                })
            );
        });

        it('should handle search query', async () => {
            const mockFindAndCountAll = jest.spyOn(Product, 'findAndCountAll').mockResolvedValue({
                count: 3,
                rows: [mockProduct],
            });

            req.query = { search: 'test' };
            await productController.getAllProducts(req, res);

            expect(mockFindAndCountAll).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        name: expect.objectContaining({
                            [expect.any(Symbol)]: '%test%',
                        }),
                    }),
                })
            );
        });

        it('should handle errors gracefully', async () => {
            jest.spyOn(Product, 'findAndCountAll').mockRejectedValue(new Error('Database error'));

            await productController.getAllProducts(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: 'Failed to fetch products',
                })
            );
        });
    });

    describe('getProductById', () => {
        it('should get product by ID with related data', async () => {
            const mockFindByPk = jest.spyOn(Product, 'findByPk').mockResolvedValue(mockProduct);
            pricePredictionService.predictPrice.mockResolvedValue({
                predicted_price: 95,
                confidence_interval: { lower: 90, upper: 100 },
                recommendation: { action: 'BUY', message: 'Good deal' },
            });
            recommendationService.getSimilarProducts.mockResolvedValue([mockProduct]);

            req.params = { id: mockProduct.id };
            await productController.getProductById(req, res);

            expect(mockFindByPk).toHaveBeenCalledWith(
                mockProduct.id,
                expect.objectContaining({
                    include: expect.any(Array),
                })
            );
            expect(mockProduct.incrementViewCount).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        product: mockProduct,
                        price_prediction: expect.any(Object),
                        similar_products: expect.any(Array),
                    }),
                })
            );
        });

        it('should return 404 if product not found', async () => {
            jest.spyOn(Product, 'findByPk').mockResolvedValue(null);

            req.params = { id: 'non-existent-id' };
            await productController.getProductById(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: 'Product not found',
                })
            );
        });
    });

    describe('getProductBySlug', () => {
        it('should get product by slug', async () => {
            const mockFindOne = jest.spyOn(Product, 'findOne').mockResolvedValue(mockProduct);

            req.params = { slug: 'test-product' };
            await productController.getProductBySlug(req, res);

            expect(mockFindOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { slug: 'test-product', is_active: true, is_deleted: false },
                })
            );
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('createProduct', () => {
        it('should create a new product (admin only)', async () => {
            const mockCreate = jest.spyOn(Product, 'create').mockResolvedValue(mockProduct);
            req.user = { role: 'admin' };
            req.body = {
                name: 'New Product',
                category_id: 1,
                price: 99.99,
                description: 'New product description',
                brand: 'Test Brand',
            };

            await productController.createProduct(req, res);

            expect(mockCreate).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: 'Product created successfully',
                })
            );
        });

        it('should return validation errors for invalid data', async () => {
            req.user = { role: 'admin' };
            req.body = { name: '' }; // Invalid data
            // Mock validation errors
            const mockValidation = jest.fn().mockReturnValue({
                isEmpty: () => false,
                array: () => [{ msg: 'Name is required', param: 'name' }],
            });
            jest.mock('express-validator', () => ({
                validationResult: mockValidation,
            }));

            await productController.createProduct(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    errors: expect.any(Array),
                })
            );
        });
    });

    describe('searchProducts', () => {
        it('should search products with query', async () => {
            const mockFindAll = jest.spyOn(Product, 'findAll').mockResolvedValue([mockProduct]);

            req.query = { q: 'test', limit: 10 };
            await productController.searchProducts(req, res);

            expect(mockFindAll).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.any(Array),
                    meta: expect.objectContaining({
                        query: 'test',
                        total: expect.any(Number),
                    }),
                })
            );
        });

        it('should return error for short query', async () => {
            req.query = { q: 'a' };
            await productController.searchProducts(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: 'Search query must be at least 2 characters',
                })
            );
        });
    });

    describe('toggleWishlist', () => {
        it('should add product to wishlist', async () => {
            const mockFindByPk = jest.spyOn(Product, 'findByPk').mockResolvedValue(mockProduct);
            const mockFindOne = jest.spyOn(Wishlist, 'findOne').mockResolvedValue(null);
            const mockCreate = jest.spyOn(Wishlist, 'create').mockResolvedValue({});

            req.user = { id: 'user-id' };
            req.params = { id: mockProduct.id };

            await productController.toggleWishlist(req, res);

            expect(mockCreate).toHaveBeenCalledWith({
                user_id: 'user-id',
                product_id: mockProduct.id,
            });
            expect(mockProduct.update).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    inWishlist: true,
                })
            );
        });

        it('should remove product from wishlist', async () => {
            const mockFindByPk = jest.spyOn(Product, 'findByPk').mockResolvedValue(mockProduct);
            const mockWishlist = { destroy: jest.fn().mockResolvedValue(true) };
            const mockFindOne = jest.spyOn(Wishlist, 'findOne').mockResolvedValue(mockWishlist);

            req.user = { id: 'user-id' };
            req.params = { id: mockProduct.id };

            await productController.toggleWishlist(req, res);

            expect(mockWishlist.destroy).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    inWishlist: false,
                })
            );
        });
    });
});