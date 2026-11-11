// backend/src/jobs/metricsAggregator.js
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');
const metricsService = require('../services/analytics/metricsService');

class MetricsAggregatorJob {
    constructor() {
        this.name = 'metrics_aggregator';
        this.isRunning = false;
        this.lastRun = null;
    }

    /**
     * Run the job
     */
    async run() {
        if (this.isRunning) {
            logger.warn('Metrics aggregator job already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting metrics aggregator job');

        try {
            // Collect system metrics
            const systemMetrics = await metricsService.collectMetrics();

            // Aggregate business metrics
            const businessMetrics = await this.aggregateBusinessMetrics();

            // Aggregate user metrics
            const userMetrics = await this.aggregateUserMetrics();

            // Aggregate transaction metrics
            const transactionMetrics = await this.aggregateTransactionMetrics();

            // Store aggregated metrics
            await this.storeMetrics({
                system: systemMetrics,
                business: businessMetrics,
                user: userMetrics,
                transaction: transactionMetrics,
            });

            // Update cache with latest metrics
            await this.updateCache(systemMetrics, businessMetrics);

            logger.info('Metrics aggregator job completed');
            this.lastRun = new Date();
        } catch (error) {
            logger.error('Metrics aggregator job failed:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Aggregate business metrics
     */
    async aggregateBusinessMetrics() {
        const metrics = await sequelize.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
                (SELECT COUNT(*) FROM users WHERE role = 'seller' AND is_active = true) as total_sellers,
                (SELECT COUNT(*) FROM users WHERE role = 'buyer' AND is_active = true) as total_buyers,
                (SELECT COUNT(*) FROM users WHERE last_active > NOW() - INTERVAL '24 hours') as active_users_24h,
                (SELECT COUNT(*) FROM listings WHERE status = 'active') as active_listings,
                (SELECT COUNT(*) FROM listings WHERE status = 'sold' AND sold_at > NOW() - INTERVAL '24 hours') as sales_24h,
                (SELECT COUNT(*) FROM transactions WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as transactions_24h,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as revenue_24h,
                (SELECT COUNT(*) FROM demand_alerts WHERE created_at > NOW() - INTERVAL '24 hours') as alerts_24h,
                (SELECT COUNT(*) FROM search_queries WHERE created_at > NOW() - INTERVAL '24 hours') as searches_24h
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        return metrics[0];
    }

    /**
     * Aggregate user metrics
     */
    async aggregateUserMetrics() {
        const metrics = await sequelize.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'seller' THEN 1 END) as sellers,
                COUNT(CASE WHEN role = 'buyer' THEN 1 END) as buyers,
                AVG(seller_rating) as avg_seller_rating,
                AVG(total_sales) as avg_total_sales,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_users_7d,
                COUNT(CASE WHEN last_active > NOW() - INTERVAL '7 days' THEN 1 END) as active_users_7d
            FROM users
            WHERE is_active = true
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        return metrics[0];
    }

    /**
     * Aggregate transaction metrics
     */
    async aggregateTransactionMetrics() {
        const metrics = await sequelize.query(`
            SELECT 
                COUNT(*) as total_transactions,
                SUM(amount) as total_volume,
                AVG(amount) as avg_transaction_value,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_volume,
                AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as avg_completed_value,
                COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_transactions,
                COUNT(DISTINCT buyer_id) as unique_buyers,
                COUNT(DISTINCT seller_id) as unique_sellers
            FROM transactions
            WHERE created_at > NOW() - INTERVAL '30 days'
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        return metrics[0];
    }

    /**
     * Store metrics
     */
    async storeMetrics(metrics) {
        await sequelize.query(`
            INSERT INTO metrics_history (
                timestamp,
                system_metrics,
                business_metrics,
                user_metrics,
                transaction_metrics
            ) VALUES (NOW(), $1, $2, $3, $4)
        `, {
            bind: [
                JSON.stringify(metrics.system),
                JSON.stringify(metrics.business),
                JSON.stringify(metrics.user),
                JSON.stringify(metrics.transaction),
            ],
        });
    }

    /**
     * Update cache with latest metrics
     */
    async updateCache(systemMetrics, businessMetrics) {
        const { redis } = require('../config/redis');

        // Cache system metrics
        await redis.setex('metrics:system', 300, JSON.stringify(systemMetrics));

        // Cache business metrics
        await redis.setex('metrics:business', 300, JSON.stringify(businessMetrics));

        // Cache combined summary
        await redis.setex('metrics:summary', 300, JSON.stringify({
            timestamp: new Date().toISOString(),
            system: systemMetrics,
            business: businessMetrics,
        }));
    }

    /**
     * Get job status
     */
    getStatus() {
        return {
            name: this.name,
            isRunning: this.isRunning,
            lastRun: this.lastRun,
        };
    }
}

module.exports = new MetricsAggregatorJob();