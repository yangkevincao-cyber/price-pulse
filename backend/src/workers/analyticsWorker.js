// backend/src/workers/analyticsWorker.js
const { Queue, Worker } = require('bullmq');
const { redis } = require('../config/redis');
const { logger } = require('../config/logger');
const analyticsService = require('../services/analytics/analyticsService');
const metricsService = require('../services/analytics/metricsService');

/**
 * Analytics Queue
 */
class AnalyticsWorker {
    constructor() {
        this.queueName = 'analytics_queue';
        this.queue = null;
        this.worker = null;
        this.isRunning = false;
    }

    /**
     * Start the worker
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Analytics worker already running');
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
                logger.info(`Analytics job ${job.id} completed`);
            });

            this.worker.on('failed', (job, error) => {
                logger.error(`Analytics job ${job.id} failed:`, error);
            });

            this.worker.on('error', (error) => {
                logger.error('Analytics worker error:', error);
            });

            // Schedule recurring jobs
            await this.scheduleRecurringJobs();

            this.isRunning = true;
            logger.info('Analytics worker started');
        } catch (error) {
            logger.error('Analytics worker start failed:', error);
            throw error;
        }
    }

    /**
     * Schedule recurring jobs
     */
    async scheduleRecurringJobs() {
        // Collect metrics every 5 minutes
        await this.addJob(
            'collect_metrics',
            {},
            {
                repeat: {
                    pattern: '*/5 * * * *',
                },
            }
        );

        // Aggregate daily analytics at midnight
        await this.addJob(
            'aggregate_daily',
            {},
            {
                repeat: {
                    pattern: '0 0 * * *',
                },
            }
        );

        // Generate weekly report on Monday at 6 AM
        await this.addJob(
            'generate_weekly_report',
            {},
            {
                repeat: {
                    pattern: '0 6 * * 1',
                },
            }
        );
    }

    /**
     * Process analytics job
     */
    async processJob(job) {
        const { type, data } = job.data;

        switch (type) {
            case 'track_event':
                await analyticsService.trackEvent(data.event);
                break;

            case 'collect_metrics':
                await metricsService.collectMetrics();
                break;

            case 'aggregate_daily':
                await this.aggregateDaily(data.date);
                break;

            case 'generate_weekly_report':
                await this.generateWeeklyReport();
                break;

            case 'update_realtime':
                await analyticsService.updateRealTimeDashboard(data.event);
                break;

            default:
                throw new Error(`Unknown analytics type: ${type}`);
        }
    }

    /**
     * Aggregate daily analytics
     */
    async aggregateDaily(date) {
        const targetDate = date || new Date();
        const dateStr = targetDate.toISOString().split('T')[0];

        logger.info(`Aggregating daily analytics for ${dateStr}`);

        // Get daily stats
        const stats = await analyticsService.getRealTimeStats();

        // Store in historical table
        await sequelize.query(`
            INSERT INTO daily_analytics (
                date, active_users, searches, transactions, volume, alerts_sent, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (date) DO UPDATE
            SET 
                active_users = $2,
                searches = $3,
                transactions = $4,
                volume = $5,
                alerts_sent = $6,
                updated_at = NOW()
        `, {
            bind: [
                dateStr,
                stats.online_users || 0,
                stats.searches_last_hour || 0,
                stats.transactions_last_hour || 0,
                stats.volume_last_hour || 0,
                stats.alerts_sent_last_hour || 0,
            ],
        });

        logger.info(`Daily analytics aggregated for ${dateStr}`);
    }

    /**
     * Generate weekly report
     */
    async generateWeeklyReport() {
        logger.info('Generating weekly report');

        // Get weekly stats
        const report = await analyticsService.getPlatformAnalytics('7d');

        // Send report to admins
        const adminEmails = await this.getAdminEmails();

        for (const email of adminEmails) {
            await this.sendWeeklyReportEmail(email, report);
        }

        logger.info(`Weekly report sent to ${adminEmails.length} admins`);
    }

    /**
     * Get admin emails
     */
    async getAdminEmails() {
        const { User } = require('../models');
        const admins = await User.findAll({
            where: { role: 'admin', is_active: true },
            attributes: ['email'],
        });
        return admins.map(a => a.email);
    }

    /**
     * Send weekly report email
     */
    async sendWeeklyReportEmail(email, report) {
        // Implementation using emailService
        const emailService = require('../services/notification/emailService');
        await emailService.send({
            to: email,
            subject: 'PricePulse Weekly Analytics Report',
            html: this.buildReportHTML(report),
        });
    }

    /**
     * Build report HTML
     */
    buildReportHTML(report) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1E3A8A, #3B82F6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
                    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
                    .stat { background: #f3f4f6; padding: 15px; border-radius: 10px; text-align: center; }
                    .stat-value { font-size: 24px; font-weight: bold; color: #1E3A8A; }
                    .stat-label { font-size: 12px; color: #6b7280; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>📊 Weekly Analytics Report</h2>
                    <p>${new Date().toLocaleDateString()}</p>
                </div>
                <div class="content">
                    <h2>Platform Overview</h2>
                    <div class="stats">
                        <div class="stat">
                            <div class="stat-value">${report.metrics?.users?.active_users_7d || 0}</div>
                            <div class="stat-label">Active Users</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">$${(report.metrics?.transactions?.completed_volume || 0).toFixed(2)}</div>
                            <div class="stat-label">Revenue</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${report.metrics?.transactions?.completed_transactions || 0}</div>
                            <div class="stat-label">Transactions</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${report.metrics?.listings?.active_listings || 0}</div>
                            <div class="stat-label">Active Listings</div>
                        </div>
                    </div>
                    
                    <h3>Top Categories</h3>
                    <ul>
                        ${report.topCategories?.slice(0, 5).map(cat =>
            `<li>${cat.name}: ${cat.transactions} transactions ($${(cat.volume || 0).toFixed(2)})</li>`
        ).join('') || '<li>No data available</li>'}
                    </ul>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${process.env.FRONTEND_URL}/admin/analytics" style="display: inline-block; padding: 10px 20px; background: #3B82F6; color: white; text-decoration: none; border-radius: 5px;">
                            View Full Analytics
                        </a>
                    </div>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} PricePulse. All rights reserved.</p>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Add analytics job
     */
    async addJob(type, data, options = {}) {
        if (!this.queue) {
            throw new Error('Analytics queue not initialized');
        }

        const job = await this.queue.add(
            type,
            { type, data },
            options
        );

        logger.info(`Analytics job added: ${type} (${job.id})`);
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
            logger.info('Analytics worker stopped');
        } catch (error) {
            logger.error('Analytics worker stop failed:', error);
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
        logger.info(`Analytics queue cleaned (age: ${age}s)`);
    }
}

module.exports = new AnalyticsWorker();