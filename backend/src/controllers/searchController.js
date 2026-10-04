// backend/src/controllers/searchController.js
const { Product, Category, Listing, SearchQuery } = require('../models');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const cacheService = require('../services/cache/cacheService');

class SearchController {
    /**
     * Advanced search with filters
     */
    async advancedSearch(req, res) {
        try {
            const {
                q,
                categoryId,
                minPrice,
                maxPrice,
                condition,
                brand,
                rating,
                sortBy = 'relevance',
                sortOrder = 'DESC',
                page = 1,
                limit = 20,
                inStock = false,
                featured = false,
                tags,
            } = req.query;

            const offset = (page - 1) * limit;

            // Build search query
            const where = {
                is_active: true,
                is_deleted: false,
            };

            // Text search
            if (q && q.length >= 2) {
                where[Op.or] = [
                    { name: { [Op.iLike]: `%${q}%` } },
                    { description: { [Op.iLike]: `%${q}%` } },
                    { brand: { [Op.iLike]: `%${q}%` } },
                    { tags: { [Op.contains]: [q.toLowerCase()] } },
                ];
            }

            // Category filter
            if (categoryId) {
                where.category_id = categoryId;
            }

            // Brand filter
            if (brand) {
                where.brand = { [Op.iLike]: `%${brand}%` };
            }

            // Tags filter
            if (tags) {
                const tagArray = Array.isArray(tags) ? tags : tags.split(',');
                where.tags = { [Op.overlap]: tagArray };
            }

            // Featured filter
            if (featured === 'true') {
                where.is_featured = true;
            }

            // Build listing filters
            const listingWhere = { status: 'active' };

            if (minPrice) {
                listingWhere.price = { [Op.gte]: parseFloat(minPrice) };
            }
            if (maxPrice) {
                listingWhere.price = {
                    ...listingWhere.price,
                    [Op.lte]: parseFloat(maxPrice)
                };
            }
            if (condition) {
                listingWhere.condition = condition;
            }
            if (inStock === 'true') {
                listingWhere.available_quantity = { [Op.gt]: 0 };
            }

            // Build sort order
            const order = [];
            if (sortBy === 'relevance' && q) {
                order.push([sequelize.literal(`similarity(name, '${q}')`), 'DESC']);
            } else if (sortBy === 'price_low') {
                order.push([sequelize.literal('(SELECT MIN(price) FROM listings WHERE product_id = Product.id AND status = \'active\')'), 'ASC']);
            } else if (sortBy === 'price_high') {
                order.push([sequelize.literal('(SELECT MAX(price) FROM listings WHERE product_id = Product.id AND status = \'active\')'), 'DESC']);
            } else if (sortBy === 'popularity') {
                order.push(['search_count', 'DESC']);
            } else if (sortBy === 'rating') {
                order.push(['average_rating', 'DESC']);
            } else if (sortBy === 'demand') {
                order.push(['demand_score', 'DESC']);
            } else if (sortBy === 'newest') {
                order.push(['created_at', 'DESC']);
            } else {
                order.push(['created_at', 'DESC']);
            }

            // Execute search
            const { count, rows } = await Product.findAndCountAll({
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
                        separate: true,
                        limit: 5,
                    },
                ],
                order,
                limit: parseInt(limit),
                offset: parseInt(offset),
                distinct: true,
                subQuery: false,
            });

            // Get price ranges for products
            const products = await Promise.all(rows.map(async (product) => {
                const priceRange = await product.getPriceRange();
                return {
                    ...product.toJSON(),
                    price_range: priceRange,
                    listings_count: priceRange.seller_count || 0,
                };
            }));

            // Log search
            if (q && q.length >= 2) {
                await SearchQuery.create({
                    query_text: q,
                    user_id: req.user?.id || null,
                    ip_hash: req.ip ? require('crypto').createHash('sha256').update(req.ip).digest('hex') : null,
                    session_id: req.session?.id || null,
                    product_id: null,
                    category_id: categoryId || null,
                    search_type: 'advanced',
                    filters: JSON.stringify(req.query),
                    results_count: count,
                });
            }

            // Get search suggestions
            const suggestions = q && q.length >= 2 ? await this.getSearchSuggestions(q) : [];

            return res.json({
                success: true,
                data: {
                    products,
                    suggestions,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                    meta: {
                        query: q,
                        filters: req.query,
                        took: Date.now() - req._startTime,
                    },
                },
            });
        } catch (error) {
            logger.error('Advanced search error:', error);
            return res.status(500).json({
                success: false,
                error: 'Search failed',
            });
        }
    }

    /**
     * Autocomplete / instant search
     */
    async autocomplete(req, res) {
        try {
            const { q, limit = 10, categoryId } = req.query;

            if (!q || q.length < 1) {
                return res.json({
                    success: true,
                    data: [],
                });
            }

            const cacheKey = `search:autocomplete:${q}:${categoryId || 'all'}`;
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return res.json({
                    success: true,
                    data: cached,
                });
            }

            const where = {
                is_active: true,
                is_deleted: false,
                name: { [Op.iLike]: `${q}%` },
            };

            if (categoryId) {
                where.category_id = categoryId;
            }

            const products = await Product.findAll({
                where,
                attributes: ['id', 'name', 'slug', 'main_image', 'demand_score'],
                include: [
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['id', 'name', 'slug'],
                    },
                ],
                order: [
                    [sequelize.literal(`similarity(name, '${q}')`), 'DESC'],
                    ['demand_score', 'DESC'],
                ],
                limit: parseInt(limit),
            });

            // Also search categories
            const categories = await Category.findAll({
                where: {
                    is_active: true,
                    name: { [Op.iLike]: `${q}%` },
                },
                attributes: ['id', 'name', 'slug', 'icon'],
                limit: 5,
            });

            const result = {
                products,
                categories,
                total: products.length + categories.length,
            };

            await cacheService.set(cacheKey, result, 300); // 5 minutes

            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            logger.error('Autocomplete error:', error);
            return res.status(500).json({
                success: false,
                error: 'Autocomplete failed',
            });
        }
    }

    /**
     * Get search suggestions
     */
    async getSearchSuggestions(query) {
        try {
            const cacheKey = `search:suggestions:${query}`;
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return cached;
            }

            // Get popular searches
            const popularSearches = await SearchQuery.findAll({
                attributes: [
                    'query_text',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                where: {
                    query_text: { [Op.iLike]: `%${query}%` },
                    created_at: { [Op.gt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                },
                group: ['query_text'],
                order: [[sequelize.literal('count'), 'DESC']],
                limit: 5,
            });

            // Get trending products
            const trendingProducts = await Product.findAll({
                where: {
                    is_active: true,
                    is_deleted: false,
                    name: { [Op.iLike]: `%${query}%` },
                },
                attributes: ['name', 'slug', 'demand_score'],
                order: [['demand_score', 'DESC']],
                limit: 5,
            });

            const suggestions = {
                popular_searches: popularSearches.map(s => s.query_text),
                trending_products: trendingProducts.map(p => p.name),
                categories: await this.getMatchingCategories(query),
            };

            await cacheService.set(cacheKey, suggestions, 3600);

            return suggestions;
        } catch (error) {
            logger.error('Get search suggestions error:', error);
            return { popular_searches: [], trending_products: [], categories: [] };
        }
    }

    /**
     * Get matching categories
     */
    async getMatchingCategories(query) {
        const categories = await Category.findAll({
            where: {
                is_active: true,
                name: { [Op.iLike]: `%${query}%` },
            },
            attributes: ['id', 'name', 'slug'],
            limit: 3,
        });
        return categories;
    }

    /**
     * Get popular searches
     */
    async getPopularSearches(req, res) {
        try {
            const { limit = 10, days = 7 } = req.query;

            const cacheKey = `search:popular:${days}`;
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return res.json({
                    success: true,
                    data: cached,
                });
            }

            const popular = await SearchQuery.findAll({
                attributes: [
                    'query_text',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'search_count'],
                    [sequelize.fn('AVG', sequelize.col('results_count')), 'avg_results'],
                ],
                where: {
                    created_at: { [Op.gt]: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
                },
                group: ['query_text'],
                order: [[sequelize.literal('search_count'), 'DESC']],
                limit: parseInt(limit),
            });

            await cacheService.set(cacheKey, popular, 3600);

            return res.json({
                success: true,
                data: popular,
            });
        } catch (error) {
            logger.error('Get popular searches error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch popular searches',
            });
        }
    }

    /**
     * Get search filters
     */
    async getSearchFilters(req, res) {
        try {
            const { categoryId } = req.query;

            const cacheKey = `search:filters:${categoryId || 'all'}`;
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return res.json({
                    success: true,
                    data: cached,
                });
            }

            const where = {
                is_active: true,
                is_deleted: false,
            };

            if (categoryId) {
                where.category_id = categoryId;
            }

            // Get filter options
            const filters = {
                brands: await Product.findAll({
                    where,
                    attributes: [
                        'brand',
                        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                    ],
                    group: ['brand'],
                    having: sequelize.literal('brand IS NOT NULL'),
                    order: [[sequelize.literal('count'), 'DESC']],
                    limit: 20,
                }),
                conditions: await Listing.findAll({
                    where: {
                        status: 'active',
                    },
                    attributes: [
                        'condition',
                        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                    ],
                    group: ['condition'],
                    order: [[sequelize.literal('count'), 'DESC']],
                }),
                priceRange: await Listing.findOne({
                    where: { status: 'active' },
                    attributes: [
                        [sequelize.fn('MIN', sequelize.col('price')), 'min'],
                        [sequelize.fn('MAX', sequelize.col('price')), 'max'],
                        [sequelize.fn('AVG', sequelize.col('price')), 'avg'],
                    ],
                }),
                ratings: await Product.findAll({
                    where: {
                        ...where,
                        average_rating: { [Op.gt]: 0 },
                    },
                    attributes: [
                        [sequelize.fn('FLOOR', sequelize.col('average_rating')), 'rating'],
                        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                    ],
                    group: ['rating'],
                    order: [['rating', 'DESC']],
                    having: sequelize.literal('rating > 0'),
                }),
            };

            await cacheService.set(cacheKey, filters, 3600);

            return res.json({
                success: true,
                data: filters,
            });
        } catch (error) {
            logger.error('Get search filters error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch search filters',
            });
        }
    }

    /**
     * Search analytics
     */
    async getSearchAnalytics(req, res) {
        try {
            const { days = 7 } = req.query;

            const analytics = await SearchQuery.findAll({
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total_searches'],
                    [sequelize.fn('COUNT', sequelize.literal('DISTINCT user_id')), 'unique_users'],
                    [sequelize.fn('AVG', sequelize.col('results_count')), 'avg_results'],
                ],
                where: {
                    created_at: { [Op.gt]: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
                },
                group: [sequelize.fn('DATE', sequelize.col('created_at'))],
                order: [[sequelize.literal('date'), 'DESC']],
            });

            const topSearches = await SearchQuery.findAll({
                attributes: [
                    'query_text',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                where: {
                    created_at: { [Op.gt]: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
                },
                group: ['query_text'],
                order: [[sequelize.literal('count'), 'DESC']],
                limit: 20,
            });

            return res.json({
                success: true,
                data: {
                    daily: analytics,
                    top_searches: topSearches,
                    period: `${days} days`,
                },
            });
        } catch (error) {
            logger.error('Get search analytics error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch search analytics',
            });
        }
    }

    /**
     * Clear search cache (admin)
     */
    async clearSearchCache(req, res) {
        try {
            await cacheService.deletePattern('search:*');
            await cacheService.deletePattern('autocomplete:*');
            await cacheService.deletePattern('suggestions:*');

            return res.json({
                success: true,
                message: 'Search cache cleared successfully',
            });
        } catch (error) {
            logger.error('Clear search cache error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to clear search cache',
            });
        }
    }
}

module.exports = new SearchController();