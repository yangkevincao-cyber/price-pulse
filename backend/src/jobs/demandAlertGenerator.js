// backend/src/jobs/demandAlertGenerator.js
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');
const { Product, Category, User, DemandAlert } = require('../models');
const demandAlertService = require('../services/intelligence/demandAlertService');
const notificationWorker = require('../workers/notificationWorker');

class DemandAlertGeneratorJob {
    constructor() {
        this.name = 'demand_alert_generator';
        this.isRunning = false;
        this.lastRun = null;
    }

    /**
     * Run the job
     */
    async run() {
        if (this.isRunning) {
            logger.warn('Demand alert generator job already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting demand alert generator job');

        try {
            // Generate demand alerts
            const result = await demandAlertService.generateAlerts();

            // Send notifications for high-priority alerts
            await this.sendAlertNotifications(result.alerts);

            // Update alert statistics
            await this.updateAlertStats(result);

            logger.info(`Demand alert generator job completed: ${result.generatedCount} alerts generated`);
            this.lastRun = new Date();
        } catch (error) {
            logger.error('Demand alert generator job failed:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Send alert notifications
     */
    async sendAlertNotifications(alerts) {
        for (const alert of alerts) {
            if (alert.opportunity_score > 0.8) {
                // Send push notification for high opportunity alerts
                await notificationWorker.sendPush(alert.user_id, {
                    title: `🚀 Demand Spike: ${alert.product_name}`,
                    message: alert.message,
                    data: {
                        alert_id: alert.id,
                        product_id: alert.product_id,
                        opportunity_score: alert.opportunity_score,
                    },
                    action_url: `/seller/alerts?alert=${alert.id}`,
                    action_label: 'View Alert',
                });

                // Send SMS for critical alerts
                if (alert.opportunity_score > 0.9) {
                    const user = await User.findByPk(alert.user_id);
                    if (user && user.phone) {
                        await notificationWorker.sendSms(alert.user_id,
                            `PricePulse: ${alert.product_name} demand spike! ${Math.round(alert.opportunity_score * 100)}% opportunity. Check your dashboard.`
                        );
                    }
                }
            }
        }
    }

    /**
     * Update alert statistics
     */
    async updateAlertStats(result) {
        // Store aggregated stats
        const stats = {
            total: result.generatedCount,
            by_type: result.alerts.reduce((acc, alert) => {
                acc[alert.alert_type] = (acc[alert.alert_type] || 0) + 1;
                return acc;
            }, {}),
            avg_opportunity_score: result.alerts.reduce((sum, alert) => sum + alert.opportunity_score, 0) / (result.alerts.length || 1),
        };

        await sequelize.query(`
            INSERT INTO alert_stats (stats, generated_at)
            VALUES ($1, NOW())
        `, {
            bind: [JSON.stringify(stats)],
        });
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

module.exports = new DemandAlertGeneratorJob();