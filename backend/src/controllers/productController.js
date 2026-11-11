// backend/src/controllers/productController.js
const { Product, Category, Listing, PriceHistory, Wishlist } = require('../models');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const { validationResult } = require('express-validator');
const cacheService = require('../services/cache/cacheService');
const uploadService = require('../services/file/uploadService');
const pricePredictionService = require('../services/intelligence/pricePredictionService');
const recommendationService = require('../services/intelligence/recommendationService');

class ProductController {
    /**
     * Get all products with filters
     */
    async getAllProducts(req, res) {
        try {
            const {
                page = 1,
                limit = 20,
                categoryId,
                search,
                minPrice,
                maxPrice,
                condition,
                sortBy = 'created_at',
                sortOrder = 'DESC',
                inStock,
                featured,
            } = req.query;

            const offset = (page - 1) * limit;

            const where = {
                is_active: true,
                is_deleted: false,
            };

            // Filters
            if (categoryId) {
                where.category_id = categoryId;
            }

            if (search) {
                where.name = { [sequelize.Op.iLike]: `%${search}%` };
            }

            if (featured === 'true') {
                where.is_featured = true;
            }

            // Price range filter (via associated listings)
            const listingWhere = { status: 'active' };
            if (minPrice) {
                listingWhere.price = { [sequelize.Op.gte]: minPrice };
            }
            if (maxPrice) {
                listingWhere.price = {
                    ...listingWhere.price,
                    [sequelize.Op.lte]: maxPrice
                };
            }
            if (condition) {
                listingWhere.condition = condition;
            }
            if (inStock === 'true') {
                listingWhere.available_quantity = { [sequelize.Op.gt]: 0 };
            }

            // Build query
            const query = {
                where,
                include: [
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['id', 'name', 'slug'],
                    },
                    {
                        model: Listing,
                        as: 'listings',
                        where: listingWhere,
                        required: false,
                        attributes: ['id', 'price', 'condition', 'available_quantity'],
                        separate: true,
                        limit: 5,
                    },
                ],
                order: [[sortBy, sortOrder]],
                limit: parseInt(limit),
                offset: parseInt(offset),
                distinct: true,
            };

            const { count, rows } = await Product.findAndCountAll(query);

            // Get price ranges for each product
            const products = await Promise.all(rows.map(async (product) => {
                const priceRange = await product.getPriceRange();
                return {
                    ...product.toJSON(),
                    price_range: priceRange,
                    listings_count: priceRange.seller_count || 0,
                };
            }));

            return res.json({
                success: true,
                data: {
                    products,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                },
            });
        } catch (error) {
            logger.error('Get products error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch products',
            });
        }
    }

    /**
     * Get product by ID
     */
    async getProductById(req, res) {
        try {
            const { id } = req.params;

            const product = await Product.findByPk(id, {
                include: [
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['id', 'name', 'slug', 'parent_category_id'],
                    },
                    {
                        model: Listing,
                        as: 'listings',
                        where: { status: 'active', available_quantity: { [sequelize.Op.gt]: 0 } },
                        required: false,
                        limit: 10,
                        include: ['seller'],
                    },
                    {
                        model: PriceHistory,
                        as: 'price_history',
                        required: false,
                        limit: 30,
                        order: [['created_at', 'DESC']],
                    },
                ],
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Product not found',
                });
            }

            // Increment view count
            await product.incrementViewCount();

            // Get price prediction
            const prediction = await pricePredictionService.predictPrice(product.id);

            // Get similar products
            const similar = await recommendationService.getSimilarProducts(product.id, 5);

            return res.json({
                success: true,
                data: {
                    product,
                    price_prediction: prediction,
                    similar_products: similar,
                },
            });
        } catch (error) {
            logger.error('Get product error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch product',
            });
        }
    }

    /**
     * Get product by slug
     */
    async getProductBySlug(req, res) {
        try {
            const { slug } = req.params;

            const product = await Product.findOne({
                where: { slug, is_active: true, is_deleted: false },
                include: [
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['id', 'name', 'slug'],
                    },
                    {
                        model: Listing,
                        as: 'listings',
                        where: { status: 'active', available_quantity: { [sequelize.Op.gt]: 0 } },
                        required: false,
                        limit: 10,
                        include: ['seller'],
                    },
                ],
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Product not found',
                });
            }

            // Increment view count
            await product.incrementViewCount();

            // Get price prediction
            const prediction = await pricePredictionService.predictPrice(product.id);

            return res.json({
                success: true,
                data: {
                    product,
                    price_prediction: prediction,
                },
            });
        } catch (error) {
            logger.error('Get product by slug error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch product',
            });
        }
    }

    /**
     * Create product (admin only)
     */
    async createProduct(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array(),
                });
            }

            const productData = req.body;

            // Generate slug
            if (!productData.slug) {
                productData.slug = productData.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '');
            }

            const product = await Product.create(productData);

            logger.info(`Product created: ${product.name} (${product.id})`);

            return res.status(201).json({
                success: true,
                message: 'Product created successfully',
                data: { product },
            });
        } catch (error) {
            logger.error('Create product error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to create product',
            });
        }
    }

    /**
     * Update product (admin only)
     */
    async updateProduct(req, res) {
        try {
            const { id } = req.params;
            const product = await Product.findByPk(id);

            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Product not found',
                });
            }

            // Update product
            await product.update(req.body);

            // Clear cache
            await cacheService.deletePattern(`product:${id}`);
            await cacheService.deletePattern(`products:list:*`);

            logger.info(`Product updated: ${product.name} (${product.id})`);

            return res.json({
                success: true,
                message: 'Product updated successfully',
                data: { product },
            });
        } catch (error) {
            logger.error('Update product error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to update product',
            });
        }
    }

    /**
     * Delete product (admin only)
     */
    async deleteProduct(req, res) {
        try {
            const { id } = req.params;
            const product = await Product.findByPk(id);

            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Product not found',
                });
            }

            // Soft delete
            await product.update({
                is_deleted: true,
                deleted_at: new Date(),
                is_active: false,
            });

            // Clear cache
            await cacheService.deletePattern(`product:${id}`);
            await cacheService.deletePattern(`products:list:*`);

            logger.info(`Product deleted: ${product.name} (${product.id})`);

            return res.json({
                success: true,
                message: 'Product deleted successfully',
            });
        } catch (error) {
            logger.error('Delete product error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete product',
            });
        }
    }

    /**
     * Get trending products
     */
    async getTrendingProducts(req, res) {
        try {
            const { limit = 20, categoryId } = req.query;

            const trending = await recommendationService.getTrendingRecommendations(
                parseInt(limit),
                categoryId
            );

            return res.json({
                success: true,
                data: trending,
            });
        } catch (error) {
            logger.error('Get trending products error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch trending products',
            });
        }
    }

    /**
     * Get product price history
     */
    async getPriceHistory(req, res) {
        try {
            const { id } = req.params;
            const { days = 30 } = req.query;

            const history = await PriceHistory.findAll({
                where: {
                    product_id: id,
                    created_at: { [sequelize.Op.gt]: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
                },
                order: [['created_at', 'ASC']],
            });

            return res.json({
                success: true,
                data: history,
            });
        } catch (error) {
            logger.error('Get price history error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch price history',
            });
        }
    }

    /**
     * Get product price prediction
     */
    async getPricePrediction(req, res) {
        try {
            const { id } = req.params;
            const { days = 7 } = req.query;

            const prediction = await pricePredictionService.predictPrice(id, parseInt(days));

            return res.json({
                success: true,
                data: prediction,
            });
        } catch (error) {
            logger.error('Get price prediction error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get price prediction',
            });
        }
    }

    /**
     * Search products
     */
    async searchProducts(req, res) {
        try {
            const { q, limit = 20, categoryId, sortBy = 'relevance' } = req.query;

            if (!q || q.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Search query must be at least 2 characters',
                });
            }

            const where = {
                is_active: true,
                is_deleted: false,
                name: { [sequelize.Op.iLike]: `%${q}%` },
            };

            if (categoryId) {
                where.category_id = categoryId;
            }

            const order = [];
            if (sortBy === 'relevance') {
                order.push([sequelize.literal(`similarity(name, '${q}')`), 'DESC']);
            } else if (sortBy === 'price_low') {
                order.push(['price', 'ASC']);
            } else if (sortBy === 'price_high') {
                order.push(['price', 'DESC']);
            } else if (sortBy === 'popularity') {
                order.push(['search_count', 'DESC']);
            } else if (sortBy === 'rating') {
                order.push(['average_rating', 'DESC']);
            } else if (sortBy === 'demand') {
                order.push(['demand_score', 'DESC']);
            }

            const products = await Product.findAll({
                where,
                order,
                limit: parseInt(limit),
                include: ['category'],
            });

            // Log search
            await sequelize.query(`
                INSERT INTO search_queries (query_text, user_id, results_count, created_at)
                VALUES ($1, $2, $3, NOW())
            `, {
                bind: [q, req.user?.id || null, products.length],
            });

            return res.json({
                success: true,
                data: products,
                meta: {
                    query: q,
                    total: products.length,
                },
            });
        } catch (error) {
            logger.error('Search products error:', error);
            return res.status(500).json({
                success: false,
                error: 'Search failed',
            });
        }
    }

    /**
     * Get products by category
     */
    async getProductsByCategory(req, res) {
        try {
            const { categoryId } = req.params;
            const { limit = 20, page = 1, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;

            const offset = (page - 1) * limit;

            const products = await Product.findAndCountAll({
                where: {
                    category_id: categoryId,
                    is_active: true,
                    is_deleted: false,
                },
                include: ['category'],
                order: [[sortBy, sortOrder]],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            return res.json({
                success: true,
                data: {
                    products: products.rows,
                    pagination: {
                        total: products.count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(products.count / limit),
                    },
                },
            });
        } catch (error) {
            logger.error('Get products by category error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch products',
            });
        }
    }

    /**
     * Get featured products
     */
    async getFeaturedProducts(req, res) {
        try {
            const { limit = 10 } = req.query;

            const products = await Product.findAll({
                where: {
                    is_featured: true,
                    is_active: true,
                    is_deleted: false,
                },
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                include: ['category'],
            });

            return res.json({
                success: true,
                data: products,
            });
        } catch (error) {
            logger.error('Get featured products error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch featured products',
            });
        }
    }

    /**
     * Toggle product wishlist
     */
    async toggleWishlist(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const product = await Product.findByPk(id);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Product not found',
                });
            }

            // Check if already in wishlist
            const existing = await Wishlist.findOne({
                where: { user_id: userId, product_id: id },
            });

            if (existing) {
                await existing.destroy();
                await product.update({
                    wishlist_count: Math.max(0, product.wishlist_count - 1),
                });

                return res.json({
                    success: true,
                    message: 'Product removed from wishlist',
                    inWishlist: false,
                });
            } else {
                await Wishlist.create({
                    user_id: userId,
                    product_id: id,
                });
                await product.update({
                    wishlist_count: product.wishlist_count + 1,
                });

                return res.json({
                    success: true,
                    message: 'Product added to wishlist',
                    inWishlist: true,
                });
            }
        } catch (error) {
            logger.error('Toggle wishlist error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to update wishlist',
            });
        }
    }

    /**
     * Get user's wishlist
     */
    async getWishlist(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 20, page = 1 } = req.query;

            const offset = (page - 1) * limit;

            const wishlist = await Wishlist.findAndCountAll({
                where: { user_id: userId },
                include: [{
                    model: Product,
                    as: 'product',
                    include: ['category'],
                }],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            return res.json({
                success: true,
                data: {
                    wishlist: wishlist.rows,
                    pagination: {
                        total: wishlist.count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(wishlist.count / limit),
                    },
                },
            });
        } catch (error) {
            logger.error('Get wishlist error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch wishlist',
            });
        }
    }

    /**
     * Upload product images
     */
    async uploadProductImages(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Verify product exists
            const product = await Product.findByPk(id);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Product not found'
                });
            }

            // Verify user owns the product or is admin
            if (product.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this product'
                });
            }

            // Check if files were uploaded
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No images uploaded'
                });
            }

            // Process each image
            const processedImages = [];
            for (const file of req.files) {
                // Upload and process image
                const result = await uploadService.uploadFile(file, 'products', {
                    process: true,
                    generateThumbnails: true
                });

                processedImages.push({
                    original: result.url,
                    thumbnail: result.thumbnails?.find(t => t.size === 'thumb')?.url,
                    medium: result.processed?.find(p => p.size === 'medium')?.url,
                    large: result.processed?.find(p => p.size === 'large')?.url,
                    metadata: result.metadata
                });
            }

            // Update product with new images
            const currentImages = product.images || [];
            const newImages = processedImages.map(img => img.original);
            await product.update({
                images: [...currentImages, ...newImages],
                main_image: currentImages.length === 0 ? newImages[0] : product.main_image
            });

            // Clear cache
            await cacheService.deletePattern(`product:${id}`);

            return res.status(201).json({
                success: true,
                message: 'Product images uploaded successfully',
                data: {
                    images: processedImages,
                    product: product.toJSON()
                }
            });

        } catch (error) {
            logger.error('Upload product images error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload product images'
            });
        }
    }

    /**
     * Set main product image
     */
    async setMainProductImage(req, res) {
        try {
            const { id, imageIndex } = req.params;
            const userId = req.user.id;

            const product = await Product.findByPk(id);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Product not found'
                });
            }

            if (product.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this product'
                });
            }

            const images = product.images || [];
            const index = parseInt(imageIndex);

            if (index < 0 || index >= images.length) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid image index'
                });
            }

            await product.update({ main_image: images[index] });

            // Clear cache
            await cacheService.deletePattern(`product:${id}`);

            return res.json({
                success: true,
                message: 'Main image updated successfully',
                data: { main_image: images[index] }
            });

        } catch (error) {
            logger.error('Set main product image error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to set main image'
            });
        }
    }

    /**
     * Delete product image
     */
    async deleteProductImage(req, res) {
        try {
            const { id, imageIndex } = req.params;
            const userId = req.user.id;

            const product = await Product.findByPk(id);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Product not found'
                });
            }

            if (product.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this product'
                });
            }

            const images = product.images || [];
            const index = parseInt(imageIndex);

            if (index < 0 || index >= images.length) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid image index'
                });
            }

            // Delete file from storage
            const imageUrl = images[index];
            const filename = imageUrl.split('/').pop();
            await uploadService.deleteFile(filename);

            // Remove from product
            images.splice(index, 1);
            await product.update({
                images,
                main_image: images.length > 0 && product.main_image === imageUrl
                    ? images[0]
                    : product.main_image
            });

            // Clear cache
            await cacheService.deletePattern(`product:${id}`);

            return res.json({
                success: true,
                message: 'Product image deleted successfully',
                data: { images }
            });

        } catch (error) {
            logger.error('Delete product image error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete product image'
            });
        }
    }
}

module.exports = new ProductController();