// backend/src/workers/emailWorker.js
const { Queue, Worker } = require('bullmq');
const { redis } = require('../config/redis');
const { logger } = require('../config/logger');
const emailService = require('../services/notification/emailService');

/**
 * Email Queue
 */
class EmailWorker {
    constructor() {
        this.queueName = 'email_queue';
        this.queue = null;
        this.worker = null;
        this.isRunning = false;
    }

    /**
     * Start the worker
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Email worker already running');
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
                    limiter: {
                        max: 10,
                        duration: 1000,
                    },
                }
            );

            // Worker events
            this.worker.on('completed', (job) => {
                logger.info(`Email job ${job.id} completed`);
            });

            this.worker.on('failed', (job, error) => {
                logger.error(`Email job ${job.id} failed:`, error);
            });

            this.worker.on('error', (error) => {
                logger.error('Email worker error:', error);
            });

            this.isRunning = true;
            logger.info('Email worker started');
        } catch (error) {
            logger.error('Email worker start failed:', error);
            throw error;
        }
    }

    /**
     * Process email job
     */
    async processJob(job) {
        const { type, data } = job.data;

        switch (type) {
            case 'send_welcome':
                await emailService.sendWelcomeEmail(data.user);
                break;

            case 'send_password_reset':
                await emailService.sendPasswordResetEmail(data.user, data.token);
                break;

            case 'send_demand_alert':
                await emailService.sendDemandAlertEmail(data.user, data.alert);
                break;

            case 'send_weekly_digest':
                await emailService.sendWeeklyDigestEmail(data.user, data.opportunities);
                break;

            case 'send_price_drop':
                await emailService.sendPriceDropAlert(data.user, data.product, data.oldPrice, data.newPrice);
                break;

            case 'send_exchange_match':
                await emailService.sendExchangeMatchEmail(data.user, data.match);
                break;

            case 'send_custom':
                await emailService.send(data.options);
                break;

            default:
                throw new Error(`Unknown email type: ${type}`);
        }
    }

    /**
     * Add email to queue
     */
    async addEmail(type, data, options = {}) {
        if (!this.queue) {
            throw new Error('Email queue not initialized');
        }

        const job = await this.queue.add(
            type,
            { type, data },
            {
                ...options,
                jobId: `${type}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            }
        );

        logger.info(`Email job added: ${type} (${job.id})`);
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
            logger.info('Email worker stopped');
        } catch (error) {
            logger.error('Email worker stop failed:', error);
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
        logger.info(`Email queue cleaned (age: ${age}s)`);
    }
}

module.exports = new EmailWorker();