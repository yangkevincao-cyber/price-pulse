// backend/src/services/scraping/scheduler.js
const cron = require('node-cron');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');
const { Product, ExternalSource, SearchQuery } = require('../../models');
const { sequelize } = require('../../config/database');
const scrapingService = require('./scrapingService');

class ScrapingScheduler {
    constructor() {
        this.isRunning = false;
        this.jobs = [];
    }

    /**
     * Start all scheduled jobs
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Scraping scheduler already running');
            return;
        }

        try {
            // Initialize scraping service
            await scrapingService.initialize();

            // Schedule jobs
            this.scheduleDailyScraping();
            this.scheduleHourlyScraping();
            this.scheduleTrendingScraping();
            this.scheduleCleanup();
            this.scheduleHealthCheck();

            this.isRunning = true;
            logger.info('Scraping scheduler started');
        } catch (error) {
            logger.error('Failed to start scraping scheduler:', error);
        }
    }

    /**
     * Stop all jobs
     */
    async stop() {
        for (const job of this.jobs) {
            job.stop();
        }
        this.jobs = [];
        this.isRunning = false;
        await scrapingService.close();
        logger.info('Scraping scheduler stopped');
    }

    /**
     * Schedule daily scraping (2 AM)
     */
    scheduleDailyScraping() {
        const job = cron.schedule('0 2 * * *', async () => {
            logger.info('Starting daily scraping job');

            try {
                // Get top products by search count
                const topProducts = await sequelize.query(`
                    SELECT 
                        p.id,
                        p.name,
                        COUNT(DISTINCT sq.id) as search_count
                    FROM products p
                    LEFT JOIN search_queries sq ON sq.query_text ILIKE '%' || p.name || '%'
                        AND sq.created_at > NOW() - INTERVAL '7 days'
                    WHERE p.is_active = true AND p.is_deleted = false
                    GROUP BY p.id
                    ORDER BY search_count DESC
                    LIMIT 100
                `, {
                    type: sequelize.QueryTypes.SELECT,
                });

                let scrapedCount = 0;
                for (const product of topProducts) {
                    try {
                        const results = await scrapingService.scrapeProduct(product.name);
                        scrapedCount += results.reduce((sum, r) => sum + r.count, 0);

                        // Rate limiting
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (error) {
                        logger.error(`Failed to scrape ${product.name}:`, error);
                    }
                }

                logger.info(`Daily scraping completed: ${scrapedCount} products scraped`);
            } catch (error) {
                logger.error('Daily scraping job failed:', error);
            }
        });

        this.jobs.push(job);
        logger.info('Daily scraping job scheduled (2 AM)');
    }

    /**
     * Schedule hourly scraping
     */
    scheduleHourlyScraping() {
        const job = cron.schedule('0 * * * *', async () => {
            logger.info('Starting hourly scraping job');

            try {
                // Get trending products from last hour
                const trendingProducts = await sequelize.query(`
                    SELECT DISTINCT p.name
                    FROM search_queries sq
                    JOIN products p ON sq.query_text ILIKE '%' || p.name || '%'
                    WHERE sq.created_at > NOW() - INTERVAL '1 hour'
                        AND p.is_active = true AND p.is_deleted = false
                    ORDER BY COUNT(DISTINCT sq.id) DESC
                    LIMIT 20
                `, {
                    type: sequelize.QueryTypes.SELECT,
                });

                let scrapedCount = 0;
                for (const product of trendingProducts) {
                    try {
                        const results = await scrapingService.scrapeProduct(product.name);
                        scrapedCount += results.reduce((sum, r) => sum + r.count, 0);

                        // Rate limiting
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        logger.error(`Failed to scrape ${product.name}:`, error);
                    }
                }

                logger.info(`Hourly scraping completed: ${scrapedCount} products scraped`);
            } catch (error) {
                logger.error('Hourly scraping job failed:', error);
            }
        });

        this.jobs.push(job);
        logger.info('Hourly scraping job scheduled');
    }

    /**
     * Schedule trending products scraping (every 4 hours)
     */
    scheduleTrendingScraping() {
        const job = cron.schedule('0 */4 * * *', async () => {
            logger.info('Starting trending products scraping');

            try {
                // Get trending products
                const trending = await sequelize.query(`
                    SELECT 
                        p.id,
                        p.name,
                        p.demand_score,
                        COUNT(DISTINCT sq.id) as searches
                    FROM products p
                    LEFT JOIN search_queries sq ON sq.query_text ILIKE '%' || p.name || '%'
                        AND sq.created_at > NOW() - INTERVAL '24 hours'
                    WHERE p.demand_score > 0.7
                        AND p.is_active = true AND p.is_deleted = false
                    GROUP BY p.id
                    ORDER BY searches DESC
                    LIMIT 50
                `, {
                    type: sequelize.QueryTypes.SELECT,
                });

                let scrapedCount = 0;
                for (const product of trending) {
                    try {
                        // Scrape from major sources only
                        const results = await scrapingService.scrapeProduct(product.name, ['amazon', 'ebay']);
                        scrapedCount += results.reduce((sum, r) => sum + r.count, 0);

                        await new Promise(resolve => setTimeout(resolve, 1500));
                    } catch (error) {
                        logger.error(`Failed to scrape trending ${product.name}:`, error);
                    }
                }

                logger.info(`Trending scraping completed: ${scrapedCount} products scraped`);
            } catch (error) {
                logger.error('Trending scraping job failed:', error);
            }
        });

        this.jobs.push(job);
        logger.info('Trending scraping job scheduled (every 4 hours)');
    }

    /**
     * Schedule cleanup of old data
     */
    scheduleCleanup() {
        const job = cron.schedule('0 3 * * *', async () => {
            logger.info('Starting scraping cleanup');

            try {
                // Clean old scraping logs
                await sequelize.query(`
                    DELETE FROM scraping_logs
                    WHERE created_at < NOW() - INTERVAL '30 days'
                `);

                // Clean old external prices (keep 90 days)
                await sequelize.query(`
                    DELETE FROM external_prices
                    WHERE scraped_at < NOW() - INTERVAL '90 days'
                `);

                // Update product demand scores
                await sequelize.query(`
                    UPDATE products
                    SET demand_score = LEAST(1.0, 
                        (search_count / 1000.0) * 0.4 +
                        (wishlist_count / 100.0) * 0.3 +
                        (view_count / 500.0) * 0.3
                    )
                    WHERE is_active = true
                `);

                logger.info('Scraping cleanup completed');
            } catch (error) {
                logger.error('Cleanup job failed:', error);
            }
        });

        this.jobs.push(job);
        logger.info('Cleanup job scheduled (3 AM)');
    }

    /**
     * Schedule health check
     */
    scheduleHealthCheck() {
        const job = cron.schedule('*/5 * * * *', async () => {
            try {
                const status = await scrapingService.getStatus();

                // Check if any source has high failure rate
                for (const source of status.sources) {
                    if (source.stats.success_rate < 50 && source.stats.total > 10) {
                        logger.warn(`Source ${source.source_name} has low success rate: ${source.stats.success_rate}%`);

                        // Send alert
                        await this.sendAlert(source);
                    }
                }

                // Update Redis with status
                await redis.setex('scraping:status', 300, JSON.stringify(status));
            } catch (error) {
                logger.error('Health check failed:', error);
            }
        });

        this.jobs.push(job);
        logger.info('Health check job scheduled (every 5 minutes)');
    }

    /**
     * Send alert for source issues
     */
    async sendAlert(source) {
        const { Notification } = require('../../models');
        const User = require('../../models/User');

        const admins = await User.findAll({
            where: { role: 'admin', is_active: true },
        });

        for (const admin of admins) {
            await Notification.create({
                user_id: admin.id,
                type: 'system_announcement',
                title: `⚠️ Scraping Alert: ${source.source_name}`,
                message: `Success rate dropped to ${source.stats.success_rate}%. ${source.stats.failed} failures in the last 24 hours.`,
                data: {
                    source: source.source_name,
                    success_rate: source.stats.success_rate,
                    failures: source.stats.failed,
                },
                action_url: '/admin/scraping',
                action_label: 'View Status',
                channel: ['in_app', 'email'],
            });
        }
    }

    /**
     * Run manual scrape
     */
    async manualScrape(productName, sources = null) {
        logger.info(`Manual scrape requested: ${productName}`);

        try {
            await scrapingService.initialize();
            const results = await scrapingService.scrapeProduct(productName, sources);

            return {
                success: true,
                product: productName,
                results,
            };
        } catch (error) {
            logger.error('Manual scrape failed:', error);
            return {
                success: false,
                product: productName,
                error: error.message,
            };
        }
    }

    /**
     * Get scraping statistics
     */
    async getStats(days = 7) {
        const stats = await sequelize.query(`
            SELECT 
                source,
                COUNT(*) as total_attempts,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
                AVG(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100 as success_rate,
                COUNT(DISTINCT query) as unique_products
            FROM scraping_logs
            WHERE created_at > NOW() - INTERVAL '${days} days'
            GROUP BY source
            ORDER BY source
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        const total = await sequelize.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed
            FROM scraping_logs
            WHERE created_at > NOW() - INTERVAL '${days} days'
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        return {
            sources: stats,
            total: total[0],
            period: `${days} days`,
        };
    }
}

module.exports = new ScrapingScheduler();