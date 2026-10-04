// backend/src/controllers/adminController.js
const { User, Product, Listing, Transaction, Category, DemandAlert, FraudLog } = require('../models');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const { validationResult } = require('express-validator');
const cacheService = require('../services/cache/cacheService');
const scrapingService = require('../services/scraping/scrapingService');
const metricsService = require('../services/analytics/metricsService');
const reportService = require('../services/analytics/reportService');
const fraudDetectionService = require('../services/intelligence/fraudDetectionService');

class AdminController {
    /**
     * Get admin dashboard metrics
     */
    async getMetrics(req, res) {
        try {
            const { range = '30d' } = req.query;

            const metrics = await sequelize.query(`
                WITH user_metrics AS (
                    SELECT 
                        COUNT(*) as total_users,
                        COUNT(CASE WHEN role = 'seller' THEN 1 END) as total_sellers,
                        COUNT(CASE WHEN role = 'buyer' THEN 1 END) as total_buyers,
                        COUNT(CASE WHEN role = 'admin' THEN 1 END) as total_admins,
                        COUNT(CASE WHEN is_active THEN 1 END) as active_users,
                        COUNT(CASE WHEN email_verified THEN 1 END) as verified_users,
                        COUNT(CASE WHEN last_active > NOW() - INTERVAL '7 days' THEN 1 END) as active_7d
                    FROM users
                ),
                listing_metrics AS (
                    SELECT 
                        COUNT(*) as total_listings,
                        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_listings,
                        COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_listings,
                        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_listings,
                        AVG(price) as avg_listing_price
                    FROM listings
                ),
                transaction_metrics AS (
                    SELECT 
                        COUNT(*) as total_transactions,
                        SUM(amount) as total_volume,
                        AVG(amount) as avg_transaction,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
                        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_volume,
                        COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_transactions
                    FROM transactions
                    WHERE created_at > NOW() - INTERVAL '${range}'
                ),
                alert_metrics AS (
                    SELECT 
                        COUNT(*) as total_alerts,
                        AVG(opportunity_score) as avg_opportunity_score,
                        AVG(CASE WHEN clicked THEN 1 ELSE 0 END) * 100 as click_through_rate
                    FROM demand_alerts
                    WHERE created_at > NOW() - INTERVAL '${range}'
                ),
                fraud_metrics AS (
                    SELECT 
                        COUNT(*) as total_fraud_cases,
                        COUNT(CASE WHEN resolved THEN 1 END) as resolved_cases,
                        AVG(risk_score) as avg_risk_score
                    FROM fraud_logs
                    WHERE created_at > NOW() - INTERVAL '${range}'
                )
                SELECT 
                    (SELECT row_to_json(user_metrics) FROM user_metrics) as users,
                    (SELECT row_to_json(listing_metrics) FROM listing_metrics) as listings,
                    (SELECT row_to_json(transaction_metrics) FROM transaction_metrics) as transactions,
                    (SELECT row_to_json(alert_metrics) FROM alert_metrics) as alerts,
                    (SELECT row_to_json(fraud_metrics) FROM fraud_metrics) as fraud
            `, {
                type: sequelize.QueryTypes.SELECT,
            });

            // Get daily stats
            const daily = await sequelize.query(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as transactions,
                    SUM(amount) as volume,
                    COUNT(DISTINCT user_id) as unique_users
                FROM transactions
                WHERE created_at > NOW() - INTERVAL '${range}'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 30
            `, {
                type: sequelize.QueryTypes.SELECT,
            });

            return res.json({
                success: true,
                data: {
                    metrics: metrics[0],
                    daily: daily,
                    period: range,
                },
            });
        } catch (error) {
            logger.error('Get admin metrics error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch metrics',
            });
        }
    }

    /**
     * Get all users (admin)
     */
    async getUsers(req, res) {
        try {
            const { page = 1, limit = 20, search, role, status } = req.query;

            const offset = (page - 1) * limit;

            const where = {};
            if (search) {
                where[sequelize.Op.or] = [
                    { username: { [sequelize.Op.iLike]: `%${search}%` } },
                    { email: { [sequelize.Op.iLike]: `%${search}%` } },
                    { first_name: { [sequelize.Op.iLike]: `%${search}%` } },
                    { last_name: { [sequelize.Op.iLike]: `%${search}%` } },
                ];
            }
            if (role) {
                where.role = role;
            }
            if (status === 'active') {
                where.is_active = true;
            } else if (status === 'inactive') {
                where.is_active = false;
            }

            const { count, rows } = await User.findAndCountAll({
                where,
                attributes: {
                    exclude: ['password', 'verification_token', 'reset_token', 'reset_token_expiry'],
                },
                include: [
                    {
                        model: Listing,
                        as: 'listings',
                        attributes: ['id', 'status'],
                        required: false,
                    },
                    {
                        model: Transaction,
                        as: 'sales',
                        where: { status: 'completed' },
                        required: false,
                        attributes: ['id', 'amount'],
                    },
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            return res.json({
                success: true,
                data: {
                    users: rows,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                },
            });
        } catch (error) {
            logger.error('Get users error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch users',
            });
        }
    }

    /**
     * Get user by ID (admin)
     */
    async getUserById(req, res) {
        try {
            const { id } = req.params;

            const user = await User.findByPk(id, {
                attributes: {
                    exclude: ['password', 'verification_token', 'reset_token', 'reset_token_expiry'],
                },
                include: [
                    {
                        model: Listing,
                        as: 'listings',
                        required: false,
                    },
                    {
                        model: Transaction,
                        as: 'purchases',
                        required: false,
                    },
                    {
                        model: Transaction,
                        as: 'sales',
                        required: false,
                    },
                    {
                        model: Review,
                        as: 'reviews_received',
                        required: false,
                    },
                    {
                        model: FraudLog,
                        as: 'fraud_logs',
                        required: false,
                        limit: 10,
                        order: [['created_at', 'DESC']],
                    },
                ],
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found',
                });
            }

            // Get user stats
            const stats = await sequelize.query(`
                SELECT 
                    (SELECT COUNT(*) FROM listings WHERE user_id = $1) as total_listings,
                    (SELECT COUNT(*) FROM transactions WHERE seller_id = $1 AND status = 'completed') as total_sales,
                    (SELECT COUNT(*) FROM transactions WHERE buyer_id = $1 AND status = 'completed') as total_purchases,
                    (SELECT SUM(amount) FROM transactions WHERE seller_id = $1 AND status = 'completed') as total_revenue,
                    (SELECT AVG(rating) FROM reviews WHERE reviewed_id = $1 AND status = 'approved') as avg_rating,
                    (SELECT COUNT(*) FROM fraud_logs WHERE user_id = $1) as fraud_reports
            `, {
                bind: [id],
                type: sequelize.QueryTypes.SELECT,
            });

            return res.json({
                success: true,
                data: {
                    user,
                    stats: stats[0],
                },
            });
        } catch (error) {
            logger.error('Get user by ID error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch user',
            });
        }
    }

    /**
     * Update user (admin)
     */
    async updateUser(req, res) {
        try {
            const { id } = req.params;
            const { role, is_active, is_verified, ...updateData } = req.body;

            const user = await User.findByPk(id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found',
                });
            }

            // Only allow specific fields
            const allowedFields = ['role', 'is_active', 'is_verified'];
            const filteredData = {};
            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    filteredData[field] = req.body[field];
                }
            }

            await user.update(filteredData);

            // Clear cache
            await cacheService.deletePattern(`user:${id}`);

            logger.info(`User updated by admin: ${id}`);

            return res.json({
                success: true,
                message: 'User updated successfully',
                data: { user },
            });
        } catch (error) {
            logger.error('Update user error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to update user',
            });
        }
    }

    /**
     * Delete user (admin)
     */
    async deleteUser(req, res) {
        try {
            const { id } = req.params;

            const user = await User.findByPk(id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found',
                });
            }

            // Prevent deleting yourself
            if (id === req.user.id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete your own account',
                });
            }

            await user.destroy();

            // Clear cache
            await cacheService.deletePattern(`user:${id}`);

            logger.info(`User deleted by admin: ${id}`);

            return res.json({
                success: true,
                message: 'User deleted successfully',
            });
        } catch (error) {
            logger.error('Delete user error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete user',
            });
        }
    }

    /**
     * Get system status
     */
    async getSystemStatus(req, res) {
        try {
            const status = {
                database: await this.checkDatabase(),
                redis: await this.checkRedis(),
                storage: await this.checkStorage(),
                services: await this.checkServices(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: require('os').loadavg(),
                timestamp: new Date().toISOString(),
            };

            return res.json({
                success: true,
                data: status,
            });
        } catch (error) {
            logger.error('Get system status error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get system status',
            });
        }
    }

    /**
     * Check database health
     */
    async checkDatabase() {
        try {
            await sequelize.authenticate();
            return { status: 'healthy', message: 'Database connected' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }

    /**
     * Check Redis health
     */
    async checkRedis() {
        try {
            const { redis } = require('../config/redis');
            await redis.ping();
            return { status: 'healthy', message: 'Redis connected' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }

    /**
     * Check storage health
     */
    async checkStorage() {
        try {
            const fs = require('fs');
            const path = require('path');
            const uploadDir = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            return { status: 'healthy', message: 'Storage accessible' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }

    /**
     * Check services health
     */
    async checkServices() {
        const services = {
            scraping: await scrapingService.getStatus(),
            // Add other services here
        };
        return services;
    }

    /**
     * Get admin logs
     */
    async getLogs(req, res) {
        try {
            const { type = 'access', limit = 100 } = req.query;

            // Read log files
            const path = require('path');
            const fs = require('fs');
            const logDir = path.join(__dirname, '../../logs');
            const logFile = path.join(logDir, `${type}.log`);

            if (!fs.existsSync(logFile)) {
                return res.json({
                    success: true,
                    data: [],
                });
            }

            const content = fs.readFileSync(logFile, 'utf8');
            const lines = content.split('\n').filter(Boolean).slice(-parseInt(limit));

            return res.json({
                success: true,
                data: lines,
            });
        } catch (error) {
            logger.error('Get logs error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch logs',
            });
        }
    }

    /**
     * Generate report
     */
    async generateReport(req, res) {
        try {
            const { type = 'sales', period = '30d', format = 'json' } = req.query;

            let report;
            switch (type) {
                case 'sales':
                    report = await reportService.generateSalesReport(period);
                    break;
                case 'marketing':
                    report = await reportService.generateMarketingReport(period);
                    break;
                case 'system':
                    // System report
                    report = await this.getSystemStatus();
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
     * Clear cache (admin)
     */
    async clearCache(req, res) {
        try {
            const { pattern } = req.body;

            let deleted;
            if (pattern) {
                deleted = await cacheService.deletePattern(pattern);
            } else {
                deleted = await cacheService.clearAll();
            }

            return res.json({
                success: true,
                message: 'Cache cleared successfully',
                data: { deleted_keys: deleted },
            });
        } catch (error) {
            logger.error('Clear cache error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to clear cache',
            });
        }
    }

    /**
     * Get pending fraud cases
     */
    async getFraudCases(req, res) {
        try {
            const { page = 1, limit = 20, resolved = false } = req.query;

            const offset = (page - 1) * limit;

            const where = {};
            if (resolved === 'true') {
                where.resolved = true;
            } else if (resolved === 'false') {
                where.resolved = false;
            }

            const { count, rows } = await FraudLog.findAndCountAll({
                where,
                include: [
                    {
                        model: User,
                        attributes: ['id', 'username', 'email', 'role'],
                    },
                    {
                        model: Transaction,
                        required: false,
                    },
                ],
                order: [
                    ['severity', 'DESC'],
                    ['created_at', 'DESC'],
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            return res.json({
                success: true,
                data: {
                    fraud_cases: rows,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                },
            });
        } catch (error) {
            logger.error('Get fraud cases error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch fraud cases',
            });
        }
    }

    /**
     * Review fraud case
     */
    async reviewFraudCase(req, res) {
        try {
            const { id } = req.params;
            const { resolution, notes } = req.body;

            const result = await fraudDetectionService.reviewFraudCase(
                id,
                req.user.id,
                resolution,
                notes
            );

            return res.json({
                success: true,
                message: 'Fraud case reviewed successfully',
                data: result,
            });
        } catch (error) {
            logger.error('Review fraud case error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to review fraud case',
            });
        }
    }
}

module.exports = new AdminController();