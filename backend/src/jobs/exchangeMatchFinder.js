// backend/src/jobs/exchangeMatchFinder.js
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');
const { Exchange } = require('../models');
const exchangeMatchingService = require('../services/intelligence/exchangeMatchingService');

class ExchangeMatchFinderJob {
    constructor() {
        this.name = 'exchange_match_finder';
        this.isRunning = false;
        this.lastRun = null;
    }

    /**
     * Run the job
     */
    async run() {
        if (this.isRunning) {
            logger.warn('Exchange match finder job already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting exchange match finder job');

        try {
            // Get active exchange listings that need matching
            const listings = await Exchange.findAll({
                where: {
                    status: 'active',
                    matched_at: null,
                    created_at: { [sequelize.Op.lt]: new Date(Date.now() - 30 * 60 * 1000) }, // Older than 30 minutes
                },
                limit: 100,
            });

            let matchCount = 0;

            for (const listing of listings) {
                try {
                    // Find matches for this listing
                    const matches = await exchangeMatchingService.findMatches(listing.id);

                    if (matches && matches.length > 0) {
                        // Send notification about matches
                        await this.notifyMatches(listing.user_id, matches);
                        matchCount++;
                    }
                } catch (error) {
                    logger.error(`Failed to find matches for listing ${listing.id}:`, error);
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            logger.info(`Exchange match finder job completed: ${matchCount} listings matched`);
            this.lastRun = new Date();
        } catch (error) {
            logger.error('Exchange match finder job failed:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Notify user about matches
     */
    async notifyMatches(userId, matches) {
        const { Notification } = require('../models');
        const topMatches = matches.slice(0, 5);

        for (const match of topMatches) {
            await Notification.create({
                user_id: userId,
                type: 'exchange_match',
                title: `🤝 Exchange Match Found!`,
                message: `${Math.round(match.match_score * 100)}% match quality for ${match.offered_product_name}`,
                data: {
                    match_id: match.match_id,
                    match_score: match.match_score,
                    product_name: match.offered_product_name,
                },
                action_url: `/exchanges/matches/${match.match_id}`,
                action_label: 'View Match',
            });
        }

        // Send email digest
        if (topMatches.length > 0) {
            const user = await User.findByPk(userId);
            if (user) {
                const emailService = require('../services/notification/emailService');
                await emailService.sendExchangeMatchEmail(user, topMatches[0]);
            }
        }
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

module.exports = new ExchangeMatchFinderJob();