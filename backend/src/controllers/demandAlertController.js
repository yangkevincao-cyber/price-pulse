// backend/src/controllers/demandAlertController.js
const { DemandAlert, User, Category, Product } = require('../models');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const demandAlertService = require('../services/intelligence/demandAlertService');

class DemandAlertController {
    /**
     * Get user's demand alerts
     */
    async getMyAlerts(req, res) {
        try {
            const userId = req.user.id;
            const { unreadOnly = false, limit = 20, page = 1 } = req.query;

            const offset = (page - 1) * limit;

            const where = { user_id: userId };
            if (unreadOnly === 'true') {
                where.read = false;
            }

            const { count, rows } = await DemandAlert.findAndCountAll({
                where,
                include: [
                    {
                        model: Product,
                        as: 'product',
                        attributes: ['id', 'name', 'slug', 'images'],
                    },
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['id', 'name', 'slug'],
                    },
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            const unreadCount = await DemandAlert.count({
                where: { user_id: userId, read: false },
            });

            return res.json({
                success: true,
                data: {
                    alerts: rows,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                    unread_count: unreadCount,
                },
            });
        } catch (error) {
            logger.error('Get alerts error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch alerts',
            });
        }
    }

    /**
     * Get recent alerts
     */
    async getRecentAlerts(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 5 } = req.query;

            const alerts = await DemandAlert.findAll({
                where: { user_id: userId },
                include: [
                    {
                        model: Product,
                        as: 'product',
                        attributes: ['id', 'name', 'slug', 'images'],
                    },
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
            });

            return res.json({
                success: true,
                data: alerts,
            });
        } catch (error) {
            logger.error('Get recent alerts error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch recent alerts',
            });
        }
    }

    /**
     * Mark alert as read
     */
    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const alert = await DemandAlert.findOne({
                where: { id, user_id: userId },
            });

            if (!alert) {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found',
                });
            }

            await alert.markAsRead();

            return res.json({
                success: true,
                message: 'Alert marked as read',
            });
        } catch (error) {
            logger.error('Mark as read error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to mark alert as read',
            });
        }
    }

    /**
     * Mark all alerts as read
     */
    async markAllAsRead(req, res) {
        try {
            const userId = req.user.id;

            await DemandAlert.update(
                { read: true, read_at: new Date() },
                { where: { user_id: userId, read: false } }
            );

            return res.json({
                success: true,
                message: 'All alerts marked as read',
            });
        } catch (error) {
            logger.error('Mark all as read error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to mark alerts as read',
            });
        }
    }

    /**
     * Subscribe to demand alerts
     */
    async subscribe(req, res) {
        try {
            const userId = req.user.id;
            const { category_id, product_id, min_demand_score, alert_frequency } = req.body;

            if (!category_id && !product_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Either category_id or product_id is required',
                });
            }

            const result = await demandAlertService.subscribeToAlerts(userId, {
                category_id,
                product_id,
                min_demand_score,
                alert_frequency,
            });

            return res.json({
                success: true,
                message: 'Subscribed to demand alerts successfully',
                data: result,
            });
        } catch (error) {
            logger.error('Subscribe error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to subscribe',
            });
        }
    }

    /**
     * Unsubscribe from demand alerts
     */
    async unsubscribe(req, res) {
        try {
            const userId = req.user.id;
            const { category_id, product_id } = req.body;

            if (!category_id && !product_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Either category_id or product_id is required',
                });
            }

            const result = await demandAlertService.unsubscribeFromAlerts(userId, category_id, product_id);

            return res.json({
                success: true,
                message: 'Unsubscribed from demand alerts successfully',
                data: result,
            });
        } catch (error) {
            logger.error('Unsubscribe error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to unsubscribe',
            });
        }
    }

    /**
     * Get user's subscriptions
     */
    async getSubscriptions(req, res) {
        try {
            const userId = req.user.id;

            const user = await User.findByPk(userId, {
                attributes: ['preferences'],
            });

            const subscriptions = user?.preferences?.alerts || {
                category_subscriptions: [],
                product_subscriptions: [],
                min_demand_score: 0.7,
                frequency: 'daily',
            };

            // Get category and product details
            const categoryIds = subscriptions.category_subscriptions || [];
            const productIds = subscriptions.product_subscriptions || [];

            const categories = await Category.findAll({
                where: { id: categoryIds },
                attributes: ['id', 'name', 'slug'],
            });

            const products = await Product.findAll({
                where: { id: productIds },
                attributes: ['id', 'name', 'slug', 'images'],
            });

            return res.json({
                success: true,
                data: {
                    subscriptions: {
                        categories,
                        products,
                        min_demand_score: subscriptions.min_demand_score || 0.7,
                        frequency: subscriptions.frequency || 'daily',
                    },
                },
            });
        } catch (error) {
            logger.error('Get subscriptions error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch subscriptions',
            });
        }
    }

    /**
     * Get alert statistics
     */
    async getAlertStats(req, res) {
        try {
            const userId = req.user.id;
            const { days = 30 } = req.query;

            const stats = await DemandAlert.findAll({
                where: {
                    user_id: userId,
                    created_at: { [sequelize.Op.gt]: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
                },
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN read THEN 1 ELSE 0 END')), 'read_count'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN clicked THEN 1 ELSE 0 END')), 'click_count'],
                    [sequelize.fn('AVG', sequelize.col('opportunity_score')), 'avg_opportunity_score'],
                ],
            });

            const alertTypes = await DemandAlert.findAll({
                where: {
                    user_id: userId,
                    created_at: { [sequelize.Op.gt]: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
                },
                attributes: [
                    'alert_type',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                group: ['alert_type'],
            });

            return res.json({
                success: true,
                data: {
                    stats: stats[0] || { total: 0, read_count: 0, click_count: 0, avg_opportunity_score: 0 },
                    alert_types: alertTypes,
                    period: `${days} days`,
                },
            });
        } catch (error) {
            logger.error('Get alert stats error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch alert statistics',
            });
        }
    }

    /**
     * Trigger manual alert generation (admin only)
     */
    async triggerAlertGeneration(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required',
                });
            }

            const result = await demandAlertService.generateAlerts();

            return res.json({
                success: true,
                message: `Alert generation completed: ${result.generatedCount} alerts created`,
                data: result,
            });
        } catch (error) {
            logger.error('Trigger alert generation error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to generate alerts',
            });
        }
    }

    /**
     * Get alert opportunities (for sellers)
     */
    async getOpportunities(req, res) {
        try {
            const userId = req.user.id;
            const { categoryId, limit = 20 } = req.query;

            // Get demand opportunities
            const opportunities = await demandAlertService.findDemandOpportunities();

            // Filter by category if provided
            let filtered = opportunities;
            if (categoryId) {
                filtered = opportunities.filter(opp => opp.category_id === parseInt(categoryId));
            }

            // Filter out products user already sells
            const userProducts = await sequelize.query(`
                SELECT DISTINCT product_id
                FROM listings
                WHERE user_id = $1 AND status = 'active'
            `, {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT,
            });

            const userProductIds = userProducts.map(p => p.product_id);
            filtered = filtered.filter(opp => !userProductIds.includes(opp.product_id));

            // Sort by opportunity score
            filtered.sort((a, b) => b.opportunity_score - a.opportunity_score);

            // Limit results
            const results = filtered.slice(0, parseInt(limit));

            return res.json({
                success: true,
                data: {
                    opportunities: results,
                    total: filtered.length,
                    limit: parseInt(limit),
                },
            });
        } catch (error) {
            logger.error('Get opportunities error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch opportunities',
            });
        }
    }
}

module.exports = new DemandAlertController();