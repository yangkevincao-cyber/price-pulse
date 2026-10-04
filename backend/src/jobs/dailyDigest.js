// backend/src/jobs/dailyDigest.js
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');
const { User, DemandAlert, Transaction, Listing } = require('../models');
const emailService = require('../services/notification/emailService');

class DailyDigestJob {
    constructor() {
        this.name = 'daily_digest';
        this.isRunning = false;
        this.lastRun = null;
    }

    /**
     * Run the job
     */
    async run() {
        if (this.isRunning) {
            logger.warn('Daily digest job already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting daily digest job');

        try {
            // Get all sellers who opted in for daily digest
            const sellers = await User.findAll({
                where: {
                    role: 'seller',
                    is_active: true,
                    'preferences.notifications.email': true,
                    'preferences.alert_frequency': 'daily',
                },
            });

            let sentCount = 0;

            for (const seller of sellers) {
                try {
                    // Get seller's alerts from last 24 hours
                    const alerts = await DemandAlert.findAll({
                        where: {
                            user_id: seller.id,
                            created_at: { [sequelize.Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                            read: false,
                        },
                        order: [['opportunity_score', 'DESC']],
                        limit: 10,
                    });

                    if (alerts.length === 0) {
                        continue;
                    }

                    // Get seller's stats
                    const stats = await this.getSellerStats(seller.id);

                    // Send digest email
                    await emailService.sendDailyDigestEmail(seller, alerts, stats);

                    sentCount++;
                } catch (error) {
                    logger.error(`Failed to send daily digest for seller ${seller.id}:`, error);
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            logger.info(`Daily digest sent to ${sentCount} sellers`);
            this.lastRun = new Date();
        } catch (error) {
            logger.error('Daily digest job failed:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Get seller stats
     */
    async getSellerStats(sellerId) {
        const stats = await sequelize.query(`
            SELECT 
                (SELECT COUNT(*) FROM listings 
                 WHERE user_id = $1 AND status = 'active') as active_listings,
                (SELECT COUNT(*) FROM transactions 
                 WHERE seller_id = $1 AND status = 'completed' 
                 AND completed_at > NOW() - INTERVAL '24 hours') as sales_today,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions 
                 WHERE seller_id = $1 AND status = 'completed' 
                 AND completed_at > NOW() - INTERVAL '24 hours') as revenue_today,
                (SELECT COUNT(*) FROM demand_alerts 
                 WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours') as alerts_today
        `, {
            bind: [sellerId],
            type: sequelize.QueryTypes.SELECT,
        });

        return stats[0] || {
            active_listings: 0,
            sales_today: 0,
            revenue_today: 0,
            alerts_today: 0,
        };
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

module.exports = new DailyDigestJob();