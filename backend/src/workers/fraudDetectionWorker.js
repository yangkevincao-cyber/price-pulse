// backend/src/workers/fraudDetectionWorker.js
const { Queue, Worker } = require('bullmq');
const { redis } = require('../config/redis');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const { FraudLog, User, Transaction } = require('../models');
const fraudDetectionService = require('../services/intelligence/fraudDetectionService');

/**
 * Fraud Detection Queue
 */
class FraudDetectionWorker {
    constructor() {
        this.queueName = 'fraud_detection_queue';
        this.queue = null;
        this.worker = null;
        this.isRunning = false;
    }

    /**
     * Start the worker
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Fraud detection worker already running');
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
                    concurrency: 3,
                }
            );

            // Worker events
            this.worker.on('completed', (job) => {
                logger.info(`Fraud detection job ${job.id} completed`);
            });

            this.worker.on('failed', (job, error) => {
                logger.error(`Fraud detection job ${job.id} failed:`, error);
            });

            this.worker.on('error', (error) => {
                logger.error('Fraud detection worker error:', error);
            });

            // Schedule recurring jobs
            await this.scheduleRecurringJobs();

            this.isRunning = true;
            logger.info('Fraud detection worker started');
        } catch (error) {
            logger.error('Fraud detection worker start failed:', error);
            throw error;
        }
    }

    /**
     * Schedule recurring jobs
     */
    async scheduleRecurringJobs() {
        // Scan for suspicious activity every 15 minutes
        await this.addJob(
            'scan_suspicious',
            {},
            {
                repeat: {
                    pattern: '*/15 * * * *',
                },
            }
        );

        // Update ML model weekly
        await this.addJob(
            'update_ml_model',
            {},
            {
                repeat: {
                    pattern: '0 0 * * 0',
                },
            }
        );

        // Clean old fraud logs monthly
        await this.addJob(
            'clean_fraud_logs',
            {},
            {
                repeat: {
                    pattern: '0 0 1 * *',
                },
            }
        );
    }

    /**
     * Process fraud detection job
     */
    async processJob(job) {
        const { type, data } = job.data;

        switch (type) {
            case 'detect_fraud':
                await this.detectFraud(data.transaction);
                break;

            case 'scan_suspicious':
                await this.scanSuspiciousActivity();
                break;

            case 'update_ml_model':
                await this.updateMLModel();
                break;

            case 'clean_fraud_logs':
                await this.cleanFraudLogs();
                break;

            case 'review_fraud_case':
                await this.reviewFraudCase(data.fraudId, data.reviewerId, data.resolution, data.notes);
                break;

            default:
                throw new Error(`Unknown fraud detection type: ${type}`);
        }
    }

    /**
     * Detect fraud for a transaction
     */
    async detectFraud(transaction) {
        const result = await fraudDetectionService.detectFraud(transaction);

        if (result.isFraudulent) {
            logger.warn(`Fraud detected for transaction ${transaction.id}`, {
                riskScore: result.riskScore,
                flags: result.flags,
            });
        }

        return result;
    }

    /**
     * Scan for suspicious activity
     */
    async scanSuspiciousActivity() {
        logger.info('Scanning for suspicious activity');

        const suspiciousTransactions = await this.findSuspiciousTransactions();

        for (const transaction of suspiciousTransactions) {
            await this.detectFraud(transaction);
        }

        const suspiciousUsers = await this.findSuspiciousUsers();

        for (const user of suspiciousUsers) {
            await this.checkUserFraud(user);
        }

        logger.info(`Scanned ${suspiciousTransactions.length} transactions and ${suspiciousUsers.length} users`);
    }

    /**
     * Find suspicious transactions
     */
    async findSuspiciousTransactions() {
        const transactions = await Transaction.findAll({
            where: {
                status: 'pending',
                created_at: { [sequelize.Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                amount: { [sequelize.Op.gt]: 1000 },
            },
            include: ['buyer', 'seller', 'listing'],
        });

        // Filter for suspicious patterns
        return transactions.filter(t => {
            // High value from new user
            if (t.buyer?.created_at > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
                return true;
            }

            // Rapid transactions from same user
            // (handled by fraud detection service)

            // Unusual payment method
            // (handled by fraud detection service)

            return false;
        });
    }

    /**
     * Find suspicious users
     */
    async findSuspiciousUsers() {
        const users = await User.findAll({
            where: {
                is_active: true,
                created_at: { [sequelize.Op.gt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
            include: [
                {
                    model: Transaction,
                    as: 'purchases',
                    where: { status: 'completed' },
                    required: false,
                },
            ],
        });

        return users.filter(u => {
            // Multiple purchases from new account
            if (u.purchases?.length > 10) {
                return true;
            }

            // High value purchases from new account
            const totalSpent = u.purchases?.reduce((sum, t) => sum + t.amount, 0) || 0;
            if (totalSpent > 10000) {
                return true;
            }

            return false;
        });
    }

    /**
     * Check user for fraud
     */
    async checkUserFraud(user) {
        const fraudLogs = await FraudLog.count({
            where: { user_id: user.id, resolved: false },
        });

        if (fraudLogs > 3) {
            // Auto-suspend user
            await user.update({ is_active: false });
            logger.warn(`User ${user.id} auto-suspended due to fraud reports`);
        }
    }

    /**
     * Update ML model
     */
    async updateMLModel() {
        logger.info('Updating ML model');

        // Get training data
        const trainingData = await FraudLog.findAll({
            where: {
                created_at: { [sequelize.Op.gt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                resolved: true,
            },
        });

        if (trainingData.length < 100) {
            logger.info(`Insufficient training data: ${trainingData.length} samples`);
            return;
        }

        // Train model (mock implementation)
        // In production, this would use a real ML library like TensorFlow.js or Python integration
        logger.info(`ML model updated with ${trainingData.length} samples`);
    }

    /**
     * Clean old fraud logs
     */
    async cleanFraudLogs() {
        logger.info('Cleaning fraud logs');

        const deleted = await FraudLog.destroy({
            where: {
                resolved: true,
                created_at: { [sequelize.Op.lt]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
            },
        });

        logger.info(`Cleaned ${deleted} old fraud logs`);
        return deleted;
    }

    /**
     * Review fraud case
     */
    async reviewFraudCase(fraudId, reviewerId, resolution, notes) {
        const fraudLog = await FraudLog.findByPk(fraudId);

        if (!fraudLog) {
            throw new Error('Fraud case not found');
        }

        await fraudLog.resolve(notes, resolution, reviewerId);

        // If resolution is 'block', block the user
        if (resolution === 'user_banned') {
            await User.update(
                { is_active: false },
                { where: { id: fraudLog.user_id } }
            );
        }

        logger.info(`Fraud case ${fraudId} reviewed by ${reviewerId}: ${resolution}`);
        return fraudLog;
    }

    /**
     * Add fraud detection job
     */
    async addJob(type, data, options = {}) {
        if (!this.queue) {
            throw new Error('Fraud detection queue not initialized');
        }

        const job = await this.queue.add(
            type,
            { type, data },
            options
        );

        logger.info(`Fraud detection job added: ${type} (${job.id})`);
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
            logger.info('Fraud detection worker stopped');
        } catch (error) {
            logger.error('Fraud detection worker stop failed:', error);
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
        logger.info(`Fraud detection queue cleaned (age: ${age}s)`);
    }
}

module.exports = new FraudDetectionWorker();
