// backend/src/workers/priceUpdateWorker.js
const { Queue, Worker } = require('bullmq');
const { redis } = require('../config/redis');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const { Product, PriceHistory, Listing } = require('../models');

/**
 * Price Update Queue
 */
class PriceUpdateWorker {
    constructor() {
        this.queueName = 'price_update_queue';
        this.queue = null;
        this.worker = null;
        this.isRunning = false;
    }

    /**
     * Start the worker
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Price update worker already running');
            return;
        }

        try {
            // Create queue
            this.queue = new Queue(this.queueName, {
                connection: redis,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 1000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            });

            // Create worker
            this.worker = new Worker(
                this.queueName,
                async (job) => {
                    await this.processJob(job);
                },
                {
                    connection: redis,
                    concurrency: 5,
                }
            );

            // Worker events
            this.worker.on('completed', (job) => {
                logger.info(`Price update job ${job.id} completed`);
            });

            this.worker.on('failed', (job, error) => {
                logger.error(`Price update job ${job.id} failed:`, error);
            });

            this.worker.on('error', (error) => {
                logger.error('Price update worker error:', error);
            });

            // Schedule recurring jobs
            await this.scheduleRecurringJobs();

            this.isRunning = true;
            logger.info('Price update worker started');
        } catch (error) {
            logger.error('Price update worker start failed:', error);
            throw error;
        }
    }

    /**
     * Schedule recurring jobs
     */
    async scheduleRecurringJobs() {
        // Update price history every hour
        await this.addJob(
            'update_price_history',
            {},
            {
                repeat: {
                    pattern: '0 * * * *',
                },
            }
        );

        // Update product demand scores every 6 hours
        await this.addJob(
            'update_demand_scores',
            {},
            {
                repeat: {
                    pattern: '0 */6 * * *',
                },
            }
        );

        // Clean old price history daily
        await this.addJob(
            'clean_price_history',
            {},
            {
                repeat: {
                    pattern: '0 1 * * *',
                },
            }
        );
    }

    /**
     * Process price update job
     */
    async processJob(job) {
        const { type, data } = job.data;

        switch (type) {
            case 'update_price_history':
                await this.updatePriceHistory();
                break;

            case 'update_demand_scores':
                await this.updateDemandScores();
                break;

            case 'clean_price_history':
                await this.cleanPriceHistory();
                break;

            case 'update_product_price':
                await this.updateProductPrice(data.productId);
                break;

            case 'check_price_alerts':
                await this.checkPriceAlerts(data.productId);
                break;

            default:
                throw new Error(`Unknown price update type: ${type}`);
        }
    }

    /**
     * Update price history for all active listings
     */
    async updatePriceHistory() {
        logger.info('Updating price history');

        const listings = await Listing.findAll({
            where: { status: 'active' },
            include: ['product'],
        });

        let updatedCount = 0;

        for (const listing of listings) {
            try {
                await PriceHistory.create({
                    product_id: listing.product_id,
                    price: listing.price,
                    source: 'listing',
                    source_id: listing.id,
                });
                updatedCount++;
            } catch (error) {
                logger.error(`Failed to update price history for listing ${listing.id}:`, error);
            }

            // Rate limiting
            if (updatedCount % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        logger.info(`Price history updated for ${updatedCount} listings`);
        return updatedCount;
    }

    /**
     * Update demand scores for all products
     */
    async updateDemandScores() {
        logger.info('Updating demand scores');

        const products = await Product.findAll({
            where: { is_active: true, is_deleted: false },
        });

        let updatedCount = 0;

        for (const product of products) {
            try {
                await product.updateDemandScore();
                updatedCount++;
            } catch (error) {
                logger.error(`Failed to update demand score for product ${product.id}:`, error);
            }

            // Rate limiting
            if (updatedCount % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        logger.info(`Demand scores updated for ${updatedCount} products`);
        return updatedCount;
    }

    /**
     * Clean old price history
     */
    async cleanPriceHistory() {
        logger.info('Cleaning price history');

        const deleted = await PriceHistory.destroy({
            where: {
                created_at: { [sequelize.Op.lt]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
            },
        });

        logger.info(`Cleaned ${deleted} old price history records`);
        return deleted;
    }

    /**
     * Update product price
     */
    async updateProductPrice(productId) {
        const product = await Product.findByPk(productId);
        if (!product) {
            logger.error(`Product ${productId} not found`);
            return;
        }

        // Get latest price from listings
        const latestListing = await Listing.findOne({
            where: {
                product_id: productId,
                status: 'active',
            },
            order: [['created_at', 'DESC']],
        });

        if (latestListing) {
            await PriceHistory.create({
                product_id: productId,
                price: latestListing.price,
                source: 'listing',
                source_id: latestListing.id,
            });

            // Update product demand score
            await product.updateDemandScore();

            logger.info(`Price updated for product ${productId}`);
        }
    }

    /**
     * Check price alerts for product
     */
    async checkPriceAlerts(productId) {
        const product = await Product.findByPk(productId);
        if (!product) {
            return;
        }

        // Get users with price alerts for this product
        const { Wishlist } = require('../models');
        const wishlists = await Wishlist.findAll({
            where: {
                product_id: productId,
                target_price: { [sequelize.Op.not]: null },
                notified: false,
            },
            include: ['user'],
        });

        // Get current best price
        const bestPrice = await Listing.findOne({
            where: {
                product_id: productId,
                status: 'active',
            },
            order: [['price', 'ASC']],
            attributes: ['price'],
        });

        if (!bestPrice) {
            return;
        }

        for (const wishlist of wishlists) {
            if (bestPrice.price <= wishlist.target_price) {
                // Send price alert
                const { Notification } = require('../models');
                await Notification.create({
                    user_id: wishlist.user_id,
                    type: 'price_drop',
                    title: `Price Alert: ${product.name}`,
                    message: `Price dropped to $${bestPrice.price}! Your target was $${wishlist.target_price}.`,
                    data: {
                        product_id: productId,
                        current_price: bestPrice.price,
                        target_price: wishlist.target_price,
                    },
                    action_url: `/product/${product.slug}`,
                    action_label: 'View Product',
                });

                await wishlist.update({ notified: true, notified_at: new Date() });
                logger.info(`Price alert sent for product ${productId} to user ${wishlist.user_id}`);
            }
        }
    }

    /**
     * Add price update job
     */
    async addJob(type, data, options = {}) {
        if (!this.queue) {
            throw new Error('Price update queue not initialized');
        }

        const job = await this.queue.add(
            type,
            { type, data },
            options
        );

        logger.info(`Price update job added: ${type} (${job.id})`);
        return job;
    }

    /**
     * Get queue status
     */
    async getStatus() {
        if (!this.queue) {
            return { status: 'not_initialized' };
        }

        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getCompletedCount(),
            this.queue.getFailedCount(),
            this.queue.getDelayedCount(),
        ]);

        return {
            status: this.isRunning ? 'running' : 'stopped',
            waiting,
            active,
            completed,
            failed,
            delayed,
        };
    }

    /**
     * Stop the worker
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }

        try {
            await this.worker?.close();
            await this.queue?.close();
            this.isRunning = false;
            logger.info('Price update worker stopped');
        } catch (error) {
            logger.error('Price update worker stop failed:', error);
            throw error;
        }
    }

    /**
     * Clean old jobs
     */
    async clean(age = 86400) {
        if (!this.queue) {
            return;
        }

        await this.queue.clean(age, 1000, 'completed');
        await this.queue.clean(age, 1000, 'failed');
        logger.info(`Price update queue cleaned (age: ${age}s)`);
    }
}

module.exports = new PriceUpdateWorker();