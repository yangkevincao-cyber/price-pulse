// backend/src/controllers/analyticsController.js
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');
const analyticsService = require('../services/analytics/analyticsService');
const metricsService = require('../services/analytics/metricsService');
const reportService = require('../services/analytics/reportService');

class AnalyticsController {
    /**
     * Track event
     */
    async trackEvent(req, res) {
        try {
            const { type, productId, listingId, data } = req.body;

            const event = {
                type,
                userId: req.user?.id || null,
                productId,
                listingId,
                data: data || {},
                timestamp: new Date().toISOString(),
            };

            await analyticsService.trackEvent(event);

            return res.json({
                success: true,
                message: 'Event tracked successfully',
            });
        } catch (error) {
            logger.error('Track event error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to track event',
            });
        }
    }

    /**
     * Get seller analytics
     */
    async getSellerAnalytics(req, res) {
        try {
            const userId = req.user.id;
            const { period = '30d' } = req.query;

            const analytics = await analyticsService.getSellerAnalytics(userId, period);

            return res.json({
                success: true,
                data: analytics,
            });
        } catch (error) {
            logger.error('Get seller analytics error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch seller analytics',
            });
        }
    }

    /**
     * Get platform analytics (admin)
     */
    async getPlatformAnalytics(req, res) {
        try {
            const { period = '30d' } = req.query;

            const analytics = await analyticsService.getPlatformAnalytics(period);

            return res.json({
                success: true,
                data: analytics,
            });
        } catch (error) {
            logger.error('Get platform analytics error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch platform analytics',
            });
        }
    }

    /**
     * Get conversion funnel
     */
    async getConversionFunnel(req, res) {
        try {
            const { period = '30d' } = req.query;

            const funnel = await analyticsService.getConversionFunnel(period);

            return res.json({
                success: true,
                data: funnel,
            });
        } catch (error) {
            logger.error('Get conversion funnel error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch conversion funnel',
            });
        }
    }

    /**
     * Get real-time stats
     */
    async getRealtimeStats(req, res) {
        try {
            const stats = await analyticsService.getRealTimeStats();

            return res.json({
                success: true,
                data: stats,
            });
        } catch (error) {
            logger.error('Get realtime stats error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch realtime stats',
            });
        }
    }

    /**
     * Get system metrics
     */
    async getSystemMetrics(req, res) {
        try {
            const metrics = await metricsService.collectMetrics();

            return res.json({
                success: true,
                data: metrics,
            });
        } catch (error) {
            logger.error('Get system metrics error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch system metrics',
            });
        }
    }

    /**
     * Get historical metrics
     */
    async getHistoricalMetrics(req, res) {
        try {
            const { days = 7 } = req.query;

            const metrics = await metricsService.getHistoricalMetrics(days);

            return res.json({
                success: true,
                data: metrics,
            });
        } catch (error) {
            logger.error('Get historical metrics error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch historical metrics',
            });
        }
    }

    /**
     * Generate report
     */
    async generateReport(req, res) {
        try {
            const { type = 'sales', period = '30d', format = 'json', sellerId } = req.query;

            let report;
            switch (type) {
                case 'sales':
                    report = await reportService.generateSalesReport(period);
                    break;
                case 'marketing':
                    report = await reportService.generateMarketingReport(period);
                    break;
                case 'seller':
                    if (!sellerId) {
                        return res.status(400).json({
                            success: false,
                            error: 'Seller ID required for seller report',
                        });
                    }
                    report = await reportService.generateSellerReport(sellerId, period);
                    break;
                case 'product':
                    if (!req.query.productId) {
                        return res.status(400).json({
                            success: false,
                            error: 'Product ID required for product report',
                        });
                    }
                    report = await reportService.generateProductReport(req.query.productId, period);
                    break;
                case 'user':
                    if (!req.query.userId) {
                        return res.status(400).json({
                            success: false,
                            error: 'User ID required for user report',
                        });
                    }
                    report = await reportService.generateUserReport(req.query.userId);
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid report type',
                    });
            }

            if (format === 'pdf') {
                const pdf = await reportService.exportReportPDF(report, `${type}_report`);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=${type}_report.pdf`);
                return res.send(pdf);
            }

            return res.json({
                success: true,
                data: report,
            });
        } catch (error) {
            logger.error('Generate report error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to generate report',
            });
        }
    }

    /**
     * Get dashboard summary (seller)
     */
    async getDashboardSummary(req, res) {
        try {
            const userId = req.user.id;

            // Get basic stats
            const stats = await sequelize.query(`
                SELECT 
                    (SELECT COUNT(*) FROM listings WHERE user_id = $1 AND status = 'active') as active_listings,
                    (SELECT COUNT(*) FROM listings WHERE user_id = $1 AND status = 'sold' AND sold_at > NOW() - INTERVAL '30 days') as sales_30d,
                    (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE seller_id = $1 AND status = 'completed' AND completed_at > NOW() - INTERVAL '30 days') as revenue_30d,
                    (SELECT COUNT(*) FROM demand_alerts WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days') as alerts_7d,
                    (SELECT COUNT(*) FROM exchange_listings WHERE user_id = $1 AND status = 'active') as active_exchanges,
                    (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE reviewed_id = $1 AND status = 'approved') as avg_rating
            `, {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT,
            });

            // Get recent activity
            const activity = await sequelize.query(`
                (
                    SELECT 
                        'sale' as type,
                        completed_at as timestamp,
                        amount as data
                    FROM transactions
                    WHERE seller_id = $1 AND status = 'completed'
                    ORDER BY completed_at DESC
                    LIMIT 5
                )
                UNION
                (
                    SELECT 
                        'alert' as type,
                        created_at as timestamp,
                        opportunity_score as data
                    FROM demand_alerts
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    LIMIT 5
                )
                UNION
                (
                    SELECT 
                        'view' as type,
                        created_at as timestamp,
                        views as data
                    FROM listing_views
                    WHERE seller_id = $1
                    ORDER BY created_at DESC
                    LIMIT 5
                )
                ORDER BY timestamp DESC
                LIMIT 20
            `, {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT,
            });

            return res.json({
                success: true,
                data: {
                    stats: stats[0],
                    recent_activity: activity,
                },
            });
        } catch (error) {
            logger.error('Get dashboard summary error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch dashboard summary',
            });
        }
    }

    /**
     * Get product performance
     */
    async getProductPerformance(req, res) {
        try {
            const userId = req.user.id;
            const { period = '30d' } = req.query;

            const performance = await sequelize.query(`
                SELECT 
                    p.id,
                    p.name,
                    p.slug,
                    p.main_image,
                    COUNT(DISTINCT lv.id) as views,
                    COUNT(DISTINCT t.id) as sales,
                    COALESCE(SUM(t.amount), 0) as revenue,
                    COALESCE(AVG(t.amount), 0) as avg_price,
                    p.demand_score,
                    p.average_rating
                FROM products p
                JOIN listings l ON l.product_id = p.id AND l.user_id = $1
                LEFT JOIN listing_views lv ON lv.listing_id = l.id 
                    AND lv.created_at > NOW() - INTERVAL '${period}'
                LEFT JOIN transactions t ON t.listing_id = l.id 
                    AND t.status = 'completed'
                    AND t.completed_at > NOW() - INTERVAL '${period}'
                WHERE l.status IN ('active', 'sold')
                GROUP BY p.id
                ORDER BY revenue DESC
                LIMIT 20
            `, {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT,
            });

            return res.json({
                success: true,
                data: performance,
            });
        } catch (error) {
            logger.error('Get product performance error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch product performance',
            });
        }
    }

    /**
     * Get buyer insights
     */
    async getBuyerInsights(req, res) {
        try {
            const userId = req.user.id;

            const insights = await sequelize.query(`
                WITH buyer_stats AS (
                    SELECT 
                        COUNT(*) as total_orders,
                        SUM(amount) as total_spent,
                        AVG(amount) as avg_order_value,
                        COUNT(DISTINCT seller_id) as unique_sellers,
                        MAX(completed_at) as last_purchase
                    FROM transactions
                    WHERE buyer_id = $1 AND status = 'completed'
                ),
                category_preferences AS (
                    SELECT 
                        c.name as category,
                        COUNT(*) as purchases,
                        SUM(t.amount) as spent
                    FROM transactions t
                    JOIN listings l ON l.id = t.listing_id
                    JOIN products p ON p.id = l.product_id
                    JOIN categories c ON c.id = p.category_id
                    WHERE t.buyer_id = $1 AND t.status = 'completed'
                    GROUP BY c.id
                    ORDER BY spent DESC
                    LIMIT 5
                )
                SELECT 
                    (SELECT row_to_json(buyer_stats) FROM buyer_stats) as stats,
                    (SELECT json_agg(row_to_json(category_preferences)) FROM category_preferences) as preferences
            `, {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT,
            });

            return res.json({
                success: true,
                data: insights[0],
            });
        } catch (error) {
            logger.error('Get buyer insights error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch buyer insights',
            });
        }
    }

    /**
     * Export analytics data
     */
    async exportAnalytics(req, res) {
        try {
            const { type = 'sales', period = '30d', format = 'csv' } = req.query;

            let data;
            switch (type) {
                case 'sales':
                    data = await reportService.generateSalesReport(period);
                    break;
                case 'seller':
                    data = await reportService.generateSellerReport(req.user.id, period);
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid export type',
                    });
            }

            if (format === 'csv') {
                // Convert to CSV
                const csv = this.convertToCSV(data);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=${type}_report.csv`);
                return res.send(csv);
            }

            return res.json({
                success: true,
                data,
            });
        } catch (error) {
            logger.error('Export analytics error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to export analytics',
            });
        }
    }

    /**
     * Convert data to CSV
     */
    convertToCSV(data) {
        if (!data) return '';

        // Flatten data for CSV
        const flatten = (obj, prefix = '') => {
            const result = {};
            for (const key in obj) {
                const value = obj[key];
                const newKey = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    Object.assign(result, flatten(value, newKey));
                } else if (Array.isArray(value)) {
                    result[newKey] = JSON.stringify(value);
                } else {
                    result[newKey] = value;
                }
            }
            return result;
        };

        const flatData = flatten(data);
        const headers = Object.keys(flatData);
        const values = headers.map(h => flatData[h] || '');

        return headers.join(',') + '\n' + values.join(',');
    }
}

module.exports = new AnalyticsController();