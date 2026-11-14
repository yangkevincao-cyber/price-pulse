// backend/src/workers/scrapingWorker.js
const { Queue, Worker } = require('bullmq');
const { redis } = require('../config/redis');
const { logger } = require('../config/logger');
const scrapingService = require('../services/scraping/scrapingService');
const scrapingScheduler = require('../services/scraping/scheduler');

/**
 * Scraping Queue
 */
class ScrapingWorker {
    constructor() {
        this.queueName = 'scraping_queue';
        this.queue = null;
        this.worker = null;
        this.isRunning = false;
        this.scheduler = null;
    }

    /**
     * Start the worker
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Scraping worker already running');
            return;
        }

        try {
            // Initialize scraping service
            await scrapingService.initialize();

            // Start scheduler
            await scrapingScheduler.start();

            // Create queue
            this.queue = new Queue(this.queueName, {
                connection: redis,
                defaultJobOptions: {
                    attempts: 2,
                    backoff: {
                        type: 'exponential',
                        delay: 5000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                    timeout: 120000, // 2 minutes
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
                    concurrency: 2,
                }
            );

            // Worker events
            this.worker.on('completed', (job) => {
                logger.info(`Scraping job ${job.id} completed`);
            });

            this.worker.on('failed', (job, error) => {
                logger.error(`Scraping job ${job.id} failed:`, error);
            });

            this.worker.on('error', (error) => {
                logger.error('Scraping worker error:', error);
            });

            this.isRunning = true;
            logger.info('Scraping worker started');
        } catch (error) {
            logger.error('Scraping worker start failed:', error);
            throw error;
        }
    }

    /**
     * Process scraping job
     */
    async processJob(job) {
        const { type, data } = job.data;

        switch (type) {
            case 'scrape_product':
                await scrapingService.scrapeProduct(data.productName, data.sources);
                break;

            case 'scrape_trending':
                await scrapingScheduler.scheduleTrendingScraping();
                break;

            case 'scrape_daily':
                await scrapingScheduler.scheduleDailyScraping();
                break;

            case 'scrape_hourly':
                await scrapingScheduler.scheduleHourlyScraping();
                break;

            case 'manual_scrape':
                await scrapingScheduler.manualScrape(data.productName, data.sources);
                break;

            default:
                throw new Error(`Unknown scraping type: ${type}`);
        }
    }

    /**
     * Add scraping job
     */
    async addJob(type, data, options = {}) {
        if (!this.queue) {
            throw new Error('Scraping queue not initialized');
        }

        const job = await this.queue.add(
            type,
            { type, data },
            {
                ...options,
                jobId: `${type}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            }
        );

        logger.info(`Scraping job added: ${type} (${job.id})`);
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

        const scrapingStatus = await scrapingService.getStatus();

        return {
            status: this.isRunning ? 'running' : 'stopped',
            waiting,
            active,
            completed,
            failed,
            delayed,
            scraping: scrapingStatus,
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
            await scrapingScheduler.stop();
            await this.worker?.close();
            await this.queue?.close();
            await scrapingService.close();
            this.isRunning = false;
            logger.info('Scraping worker stopped');
        } catch (error) {
            logger.error('Scraping worker stop failed:', error);
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
        logger.info(`Scraping queue cleaned (age: ${age}s)`);
    }
}

module.exports = new ScrapingWorker();
