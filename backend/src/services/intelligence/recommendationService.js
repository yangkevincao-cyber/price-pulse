// backend/src/services/intelligence/recommendationService.js
const { sequelize } = require('../../config/database');
const { Product, User, Listing, SearchQuery, Wishlist, Transaction, Review } = require('../../models');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');

class RecommendationService {
    constructor() {
        this.cacheTTL = 3600; // 1 hour
        this.recommendationLimit = 20;
    }

    /**
     * Get personalized recommendations for a user
     */
    async getPersonalizedRecommendations(userId, limit = 10) {
        const cacheKey = `recommendations:personalized:${userId}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            return JSON.parse(cached);
        }

        try {
            // Get user's browsing and purchase history
            const userHistory = await this.getUserHistory(userId);

            // Generate recommendations using multiple strategies
            const recommendations = await this.generateRecommendations(userId, userHistory, limit);

            // Cache results
            await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(recommendations));

            return recommendations;
        } catch (error) {
            logger.error('Personalized recommendations error:', error);
            return this.getFallbackRecommendations(limit);
        }
    }

    /**
     * Get trending recommendations
     */
    async getTrendingRecommendations(limit = 10, categoryId = null) {
        const cacheKey = `recommendations:trending:${categoryId || 'all'}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            return JSON.parse(cached);
        }

        try {
            const where = {};
            if (categoryId) {
                where.category_id = categoryId;
            }

            const products = await Product.findAll({
                where: {
                    ...where,
                    is_active: true,
                    is_deleted: false,
                },
                attributes: {
                    include: [
                        [sequelize.literal(`
                            (SELECT COUNT(*) FROM search_queries sq 
                             WHERE sq.product_id = Product.id 
                             AND sq.created_at > NOW() - INTERVAL '7 days')
                        `), 'search_count_7d'],
                        [sequelize.literal(`
                            (SELECT COUNT(*) FROM wishlists w 
                             WHERE w.product_id = Product.id 
                             AND w.created_at > NOW() - INTERVAL '7 days')
                        `), 'wishlist_count_7d'],
                        [sequelize.literal(`
                            (SELECT COUNT(*) FROM transactions t 
                             JOIN listings l ON l.id = t.listing_id 
                             WHERE l.product_id = Product.id 
                             AND t.status = 'completed' 
                             AND t.completed_at > NOW() - INTERVAL '7 days')
                        `), 'sales_count_7d'],
                    ],
                },
                order: [
                    [sequelize.literal('search_count_7d'), 'DESC'],
                    [sequelize.literal('wishlist_count_7d'), 'DESC'],
                    ['demand_score', 'DESC'],
                ],
                limit: limit,
                include: ['category'],
            });

            const trending = products.map(product => ({
                ...product.toJSON(),
                popularity_score: this.calculateTrendingScore(product),
            }));

            await redis.setex(cacheKey, 1800, JSON.stringify(trending)); // 30 min cache

            return trending;
        } catch (error) {
            logger.error('Trending recommendations error:', error);
            return [];
        }
    }

    /**
     * Get similar products recommendations
     */
    async getSimilarProducts(productId, limit = 10) {
        const cacheKey = `recommendations:similar:${productId}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            return JSON.parse(cached);
        }

        try {
            const product = await Product.findByPk(productId, {
                include: ['category'],
            });

            if (!product) {
                return [];
            }

            // Find similar products based on category, tags, and price
            const similar = await Product.findAll({
                where: {
                    id: { [sequelize.Op.ne]: productId },
                    is_active: true,
                    is_deleted: false,
                    category_id: product.category_id,
                },
                order: [
                    ['demand_score', 'DESC'],
                    ['average_rating', 'DESC'],
                ],
                limit: limit,
                include: ['category'],
            });

            // Score similarity
            const scored = similar.map(p => {
                const score = this.calculateSimilarityScore(product, p);
                return { ...p.toJSON(), similarity_score: score };
            });

            scored.sort((a, b) => b.similarity_score - a.similarity_score);

            await redis.setex(cacheKey, 3600, JSON.stringify(scored));

            return scored;
        } catch (error) {
            logger.error('Similar products error:', error);
            return [];
        }
    }

    /**
     * Get frequently bought together recommendations
     */
    async getFrequentlyBoughtTogether(productId, limit = 5) {
        const cacheKey = `recommendations:together:${productId}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            return JSON.parse(cached);
        }

        try {
            // Find products frequently bought together
            const results = await sequelize.query(`
                WITH product_transactions AS (
                    SELECT DISTINCT t.id as transaction_id
                    FROM transactions t
                    JOIN listings l ON l.id = t.listing_id
                    WHERE l.product_id = $1
                        AND t.status = 'completed'
                ),
                related_products AS (
                    SELECT 
                        l.product_id,
                        COUNT(*) as frequency,
                        AVG(t.amount) as avg_price
                    FROM transactions t
                    JOIN listings l ON l.id = t.listing_id
                    WHERE t.id IN (SELECT transaction_id FROM product_transactions)
                        AND l.product_id != $1
                    GROUP BY l.product_id
                    ORDER BY frequency DESC
                    LIMIT $2
                )
                SELECT 
                    p.*,
                    rp.frequency,
                    rp.avg_price
                FROM related_products rp
                JOIN products p ON p.id = rp.product_id
                WHERE p.is_active = true AND p.is_deleted = false
            `, {
                bind: [productId, limit],
                type: sequelize.QueryTypes.SELECT,
            });

            await redis.setex(cacheKey, 3600, JSON.stringify(results));

            return results;
        } catch (error) {
            logger.error('Frequently bought together error:', error);
            return [];
        }
    }

    /**
     * Get category-based recommendations
     */
    async getCategoryRecommendations(userId, limit = 10) {
        try {
            // Find user's preferred categories
            const userPreferences = await this.getUserCategoryPreferences(userId);

            if (userPreferences.length === 0) {
                return this.getTrendingRecommendations(limit);
            }

            const categoryIds = userPreferences.map(p => p.category_id);

            const products = await Product.findAll({
                where: {
                    category_id: { [sequelize.Op.in]: categoryIds },
                    is_active: true,
                    is_deleted: false,
                    id: { [sequelize.Op.notIn]: await this.getUserProductIds(userId) },
                },
                order: [
                    ['demand_score', 'DESC'],
                    ['average_rating', 'DESC'],
                ],
                limit: limit,
                include: ['category'],
            });

            return products;
        } catch (error) {
            logger.error('Category recommendations error:', error);
            return this.getTrendingRecommendations(limit);
        }
    }

    /**
     * Get user's browsing and purchase history
     */
    async getUserHistory(userId) {
        const [searches, views, purchases, wishlists, ratings] = await Promise.all([
            SearchQuery.findAll({
                where: { user_id: userId },
                attributes: ['query_text', 'product_id', 'created_at'],
                order: [['created_at', 'DESC']],
                limit: 50,
            }),
            sequelize.query(`
                SELECT product_id, COUNT(*) as view_count
                FROM product_views
                WHERE user_id = $1
                GROUP BY product_id
                ORDER BY view_count DESC
                LIMIT 20
            `, {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT,
            }),
            Transaction.findAll({
                where: {
                    buyer_id: userId,
                    status: 'completed',
                },
                include: [{
                    model: Listing,
                    as: 'listing',
                    include: ['product'],
                }],
                order: [['completed_at', 'DESC']],
                limit: 20,
            }),
            Wishlist.findAll({
                where: { user_id: userId },
                include: ['product'],
                order: [['created_at', 'DESC']],
                limit: 20,
            }),
            Review.findAll({
                where: { reviewer_id: userId, status: 'approved' },
                include: ['product'],
                order: [['created_at', 'DESC']],
                limit: 20,
            }),
        ]);

        return {
            searches,
            views,
            purchases,
            wishlists,
            ratings,
        };
    }

    /**
     * Generate recommendations using multiple strategies
     */
    async generateRecommendations(userId, history, limit) {
        const recommendations = [];
        const strategies = [];

        // Strategy 1: Based on purchase history
        if (history.purchases.length > 0) {
            const purchasedProducts = history.purchases.map(t => t.listing?.product);
            const similarToPurchased = await this.getSimilarProducts(
                purchasedProducts[0]?.id,
                Math.ceil(limit * 0.3)
            );
            strategies.push({ source: 'purchase_history', items: similarToPurchased });
        }

        // Strategy 2: Based on wishlist
        if (history.wishlists.length > 0) {
            const wishlistProducts = history.wishlists.map(w => w.product);
            const similarToWishlist = await Promise.all(
                wishlistProducts.slice(0, 3).map(p =>
                    this.getSimilarProducts(p.id, Math.ceil(limit * 0.2))
                )
            );
            strategies.push({
                source: 'wishlist',
                items: similarToWishlist.flat().slice(0, Math.ceil(limit * 0.3))
            });
        }

        // Strategy 3: Based on recent searches
        if (history.searches.length > 0) {
            const searchTerms = history.searches.slice(0, 5).map(s => s.query_text);
            const searchBased = await this.getProductsFromSearchTerms(searchTerms, Math.ceil(limit * 0.2));
            strategies.push({ source: 'search_history', items: searchBased });
        }

        // Strategy 4: Based on ratings
        if (history.ratings.length > 0) {
            const ratedProducts = history.ratings.map(r => r.product);
            const similarToRated = await Promise.all(
                ratedProducts.slice(0, 3).map(p =>
                    this.getSimilarProducts(p.id, Math.ceil(limit * 0.2))
                )
            );
            strategies.push({
                source: 'ratings',
                items: similarToRated.flat().slice(0, Math.ceil(limit * 0.3))
            });
        }

        // Strategy 5: Trending products (fallback)
        const trending = await this.getTrendingRecommendations(Math.ceil(limit * 0.2));
        strategies.push({ source: 'trending', items: trending });

        // Combine and deduplicate recommendations
        const seenIds = new Set();
        const combined = [];

        // Weighted scoring based on strategy
        const weights = {
            purchase_history: 1.0,
            wishlist: 0.8,
            ratings: 0.7,
            search_history: 0.6,
            trending: 0.3,
        };

        // Also exclude products user already owns or interacted with
        const userProductIds = await this.getUserProductIds(userId);

        for (const strategy of strategies) {
            const weight = weights[strategy.source] || 0.5;
            for (const item of strategy.items) {
                if (!item || !item.id) continue;
                if (seenIds.has(item.id)) continue;
                if (userProductIds.includes(item.id)) continue;

                seenIds.add(item.id);
                combined.push({
                    ...item,
                    recommendation_score: weight * (item.demand_score || 0.5) * 100,
                    source: strategy.source,
                });
            }
        }

        // Sort by recommendation score
        combined.sort((a, b) => b.recommendation_score - a.recommendation_score);

        // Return top recommendations
        return combined.slice(0, limit);
    }

    /**
     * Get user's category preferences
     */
    async getUserCategoryPreferences(userId) {
        const preferences = await sequelize.query(`
            SELECT 
                p.category_id,
                COUNT(DISTINCT t.id) as purchase_count,
                COUNT(DISTINCT w.id) as wishlist_count,
                COUNT(DISTINCT v.id) as view_count,
                AVG(r.rating) as avg_rating
            FROM users u
            LEFT JOIN transactions t ON t.buyer_id = u.id AND t.status = 'completed'
            LEFT JOIN listings l ON l.id = t.listing_id
            LEFT JOIN products p ON p.id = l.product_id
            LEFT JOIN wishlists w ON w.user_id = u.id AND w.product_id = p.id
            LEFT JOIN product_views v ON v.user_id = u.id AND v.product_id = p.id
            LEFT JOIN reviews r ON r.reviewer_id = u.id AND r.product_id = p.id
            WHERE u.id = $1
            GROUP BY p.category_id
            HAVING COUNT(DISTINCT t.id) > 0 OR COUNT(DISTINCT w.id) > 0
            ORDER BY 
                (COUNT(DISTINCT t.id) * 0.5 + 
                 COUNT(DISTINCT w.id) * 0.3 + 
                 COUNT(DISTINCT v.id) * 0.2) DESC
            LIMIT 5
        `, {
            bind: [userId],
            type: sequelize.QueryTypes.SELECT,
        });

        return preferences;
    }

    /**
     * Get products from search terms
     */
    async getProductsFromSearchTerms(terms, limit) {
        const products = await Product.findAll({
            where: {
                name: { [sequelize.Op.iLike]: { [sequelize.Op.any]: terms.map(t => `%${t}%`) } },
                is_active: true,
                is_deleted: false,
            },
            order: [
                ['demand_score', 'DESC'],
                ['average_rating', 'DESC'],
            ],
            limit: limit,
            include: ['category'],
        });

        return products;
    }

    /**
     * Get user's product IDs (to exclude from recommendations)
     */
    async getUserProductIds(userId) {
        const results = await sequelize.query(`
            SELECT DISTINCT p.id
            FROM products p
            LEFT JOIN listings l ON l.product_id = p.id AND l.user_id = $1
            LEFT JOIN transactions t ON t.listing_id = l.id AND t.buyer_id = $1
            WHERE l.user_id = $1 OR t.buyer_id = $1
        `, {
            bind: [userId],
            type: sequelize.QueryTypes.SELECT,
        });

        return results.map(r => r.id);
    }

    /**
     * Calculate trending score
     */
    calculateTrendingScore(product) {
        const searchWeight = 0.4;
        const wishlistWeight = 0.3;
        const salesWeight = 0.3;

        const searchScore = Math.min((product.dataValues.search_count_7d || 0) / 100, 1);
        const wishlistScore = Math.min((product.dataValues.wishlist_count_7d || 0) / 20, 1);
        const salesScore = Math.min((product.dataValues.sales_count_7d || 0) / 10, 1);

        return (searchScore * searchWeight) +
            (wishlistScore * wishlistWeight) +
            (salesScore * salesWeight);
    }

    /**
     * Calculate similarity score between two products
     */
    calculateSimilarityScore(productA, productB) {
        let score = 0;

        // Category match (40%)
        if (productA.category_id === productB.category_id) {
            score += 0.4;
        }

        // Price similarity (20%)
        const priceDiff = Math.abs(productA.price - productB.price);
        const priceRange = Math.max(productA.price, productB.price) * 0.5;
        if (priceDiff <= priceRange) {
            score += 0.2 * (1 - priceDiff / priceRange);
        }

        // Brand similarity (20%)
        if (productA.brand && productB.brand && productA.brand === productB.brand) {
            score += 0.2;
        }

        // Tag similarity (20%)
        if (productA.tags && productB.tags) {
            const commonTags = productA.tags.filter(tag => productB.tags.includes(tag));
            const maxTags = Math.max(productA.tags.length, productB.tags.length);
            if (maxTags > 0) {
                score += 0.2 * (commonTags.length / maxTags);
            }
        }

        return Math.min(score, 1);
    }

    /**
     * Get fallback recommendations
     */
    async getFallbackRecommendations(limit) {
        const products = await Product.findAll({
            where: {
                is_active: true,
                is_deleted: false,
            },
            order: [
                ['demand_score', 'DESC'],
                ['average_rating', 'DESC'],
            ],
            limit: limit,
            include: ['category'],
        });

        return products;
    }

    /**
     * Get real-time recommendations (for homepage)
     */
    async getHomepageRecommendations(userId = null) {
        const recommendations = {
            trending: await this.getTrendingRecommendations(10),
            newArrivals: await this.getNewArrivals(10),
            topRated: await this.getTopRated(10),
        };

        // If user is logged in, add personalized section
        if (userId) {
            recommendations.personalized = await this.getPersonalizedRecommendations(userId, 10);
        }

        return recommendations;
    }

    /**
     * Get new arrivals
     */
    async getNewArrivals(limit = 10) {
        const products = await Product.findAll({
            where: {
                is_active: true,
                is_deleted: false,
            },
            order: [['created_at', 'DESC']],
            limit: limit,
            include: ['category'],
        });

        return products;
    }

    /**
     * Get top rated products
     */
    async getTopRated(limit = 10) {
        const products = await Product.findAll({
            where: {
                is_active: true,
                is_deleted: false,
                average_rating: { [sequelize.Op.gt]: 4 },
            },
            order: [
                ['average_rating', 'DESC'],
                ['review_count', 'DESC'],
            ],
            limit: limit,
            include: ['category'],
        });

        return products;
    }

    /**
     * Get recommendations by price range
     */
    async getRecommendationsByPriceRange(minPrice, maxPrice, limit = 10) {
        const products = await Product.findAll({
            where: {
                is_active: true,
                is_deleted: false,
                price: {
                    [sequelize.Op.between]: [minPrice, maxPrice],
                },
            },
            order: [
                ['demand_score', 'DESC'],
                ['average_rating', 'DESC'],
            ],
            limit: limit,
            include: ['category'],
        });

        return products;
    }

    /**
     * Get recommendations for similar users (collaborative filtering)
     */
    async getCollaborativeRecommendations(userId, limit = 10) {
        try {
            // Find users with similar purchase history
            const similarUsers = await sequelize.query(`
                WITH user_products AS (
                    SELECT DISTINCT l.product_id
                    FROM transactions t
                    JOIN listings l ON l.id = t.listing_id
                    WHERE t.buyer_id = $1
                        AND t.status = 'completed'
                ),
                similar_users AS (
                    SELECT 
                        t.buyer_id,
                        COUNT(DISTINCT l.product_id) as common_products,
                        COUNT(DISTINCT t.id) as total_purchases
                    FROM transactions t
                    JOIN listings l ON l.id = t.listing_id
                    WHERE l.product_id IN (SELECT product_id FROM user_products)
                        AND t.buyer_id != $1
                        AND t.status = 'completed'
                    GROUP BY t.buyer_id
                    HAVING COUNT(DISTINCT l.product_id) >= 2
                    ORDER BY common_products DESC, total_purchases DESC
                    LIMIT 10
                )
                SELECT 
                    l.product_id,
                    p.name,
                    p.price,
                    p.images,
                    p.demand_score,
                    COUNT(DISTINCT t.id) as purchase_count
                FROM transactions t
                JOIN listings l ON l.id = t.listing_id
                JOIN products p ON p.id = l.product_id
                WHERE t.buyer_id IN (SELECT buyer_id FROM similar_users)
                    AND l.product_id NOT IN (SELECT product_id FROM user_products)
                    AND p.is_active = true AND p.is_deleted = false
                GROUP BY l.product_id, p.name, p.price, p.images, p.demand_score
                ORDER BY purchase_count DESC, p.demand_score DESC
                LIMIT $2
            `, {
                bind: [userId, limit],
                type: sequelize.QueryTypes.SELECT,
            });

            return similarUsers;
        } catch (error) {
            logger.error('Collaborative recommendations error:', error);
            return [];
        }
    }

    /**
     * Get seasonal recommendations
     */
    async getSeasonalRecommendations(limit = 10) {
        const month = new Date().getMonth();
        const season = this.getSeason(month);

        const seasonalKeywords = {
            'spring': ['garden', 'plant', 'flower', 'outdoor', 'sport'],
            'summer': ['beach', 'swim', 'sun', 'outdoor', 'grill'],
            'fall': ['school', 'office', 'indoor', 'cozy', 'warm'],
            'winter': ['warm', 'cozy', 'indoor', 'gift', 'holiday'],
        };

        const keywords = seasonalKeywords[season] || [];

        const products = await Product.findAll({
            where: {
                is_active: true,
                is_deleted: false,
                [sequelize.Op.or]: [
                    { name: { [sequelize.Op.iLike]: { [sequelize.Op.any]: keywords.map(k => `%${k}%`) } } },
                    { tags: { [sequelize.Op.overlap]: keywords } },
                ],
            },
            order: [
                ['demand_score', 'DESC'],
                ['created_at', 'DESC'],
            ],
            limit: limit,
            include: ['category'],
        });

        return products;
    }

    /**
     * Get season from month
     */
    getSeason(month) {
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'fall';
        return 'winter';
    }

    /**
     * Warm up cache with popular recommendations
     */
    async warmUpCache() {
        try {
            logger.info('Starting recommendation cache warm-up...');

            // Warm up trending
            await this.getTrendingRecommendations(20);

            // Warm up top categories
            const categories = await sequelize.query(`
                SELECT id FROM categories WHERE is_active = true
            `, {
                type: sequelize.QueryTypes.SELECT,
            });

            for (const category of categories) {
                await this.getTrendingRecommendations(10, category.id);
            }

            // Warm up new arrivals and top rated
            await this.getNewArrivals(10);
            await this.getTopRated(10);

            logger.info('Recommendation cache warm-up completed');
        } catch (error) {
            logger.error('Cache warm-up error:', error);
        }
    }

    /**
     * Get recommendation analytics
     */
    async getRecommendationAnalytics(days = 7) {
        const stats = await sequelize.query(`
            SELECT 
                source,
                COUNT(*) as total_recommendations,
                COUNT(DISTINCT user_id) as unique_users,
                AVG(score) as avg_score,
                SUM(CASE WHEN clicked THEN 1 ELSE 0 END) as clicks,
                SUM(CASE WHEN converted THEN 1 ELSE 0 END) as conversions
            FROM recommendation_logs
            WHERE created_at > NOW() - INTERVAL '${days} days'
            GROUP BY source
            ORDER BY total_recommendations DESC
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        const totals = await sequelize.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN clicked THEN 1 ELSE 0 END) as total_clicks,
                SUM(CASE WHEN converted THEN 1 ELSE 0 END) as total_conversions,
                AVG(CASE WHEN clicked THEN 1 ELSE 0 END) * 100 as click_through_rate,
                AVG(CASE WHEN converted THEN 1 ELSE 0 END) * 100 as conversion_rate
            FROM recommendation_logs
            WHERE created_at > NOW() - INTERVAL '${days} days'
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        return {
            stats,
            totals: totals[0],
            period: `${days} days`,
        };
    }

    /**
     * Track recommendation interaction
     */
    async trackInteraction(userId, productId, source, action) {
        try {
            await sequelize.query(`
                INSERT INTO recommendation_logs (
                    user_id, product_id, source, action, score, created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
            `, {
                bind: [userId, productId, source, action, Math.random() * 0.5 + 0.5],
            });

            logger.info(`Recommendation tracked: ${source} - ${action} for user ${userId}`);
        } catch (error) {
            logger.error('Track recommendation error:', error);
        }
    }
}

module.exports = new RecommendationService();