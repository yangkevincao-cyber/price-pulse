// backend/src/events/listeners/exchangeListeners.js
const { logger } = require('../../config/logger');
const { User } = require('../../models');
const notificationEmitter = require('../emitters/notificationEmitter');
const analyticsEmitter = require('../emitters/analyticsEmitter');
const auditEmitter = require('../emitters/auditEmitter');

class ExchangeListeners {
    /**
     * Register exchange event listeners
     */
    register(emitter) {
        // Exchange listing created
        emitter.on('exchange:created', this.handleExchangeCreated.bind(this));

        // Exchange match found
        emitter.on('exchange:matched', this.handleExchangeMatched.bind(this));

        // Exchange accepted
        emitter.on('exchange:accepted', this.handleExchangeAccepted.bind(this));

        // Exchange completed
        emitter.on('exchange:completed', this.handleExchangeCompleted.bind(this));

        // Exchange cancelled
        emitter.on('exchange:cancelled', this.handleExchangeCancelled.bind(this));

        logger.info('Exchange listeners registered');
    }

    /**
     * Handle exchange created
     */
    async handleExchangeCreated(data) {
        try {
            const { exchange, userId } = data;

            // Send notification
            await notificationEmitter.emitNotification(userId, {
                type: 'system_announcement',
                title: 'Exchange Listing Created',
                message: `Your exchange listing for "${exchange.offered_product_name}" is now live!`,
                action_url: `/exchanges/${exchange.id}`,
                action_label: 'View Listing',
            });

            // Track analytics
            await analyticsEmitter.emitUserAction(userId, 'exchange_created', {
                exchangeId: exchange.id,
                productId: exchange.offered_product_id,
            });

            // Audit
            await auditEmitter.emit('audit:exchange_created', {
                exchangeId: exchange.id,
                userId,
                productId: exchange.offered_product_id,
            });

            logger.info(`Exchange created: ${exchange.id} by user ${userId}`);
        } catch (error) {
            logger.error('Exchange created event handler error:', error);
        }
    }

    /**
     * Handle exchange matched
     */
    async handleExchangeMatched(data) {
        try {
            const { match, userId1, userId2 } = data;

            // Send notification to user 1
            await notificationEmitter.emitExchangeMatch(userId1, match);

            // Send notification to user 2
            await notificationEmitter.emitExchangeMatch(userId2, match);

            // Track analytics
            await analyticsEmitter.emitUserAction(userId1, 'exchange_match_found', {
                matchId: match.id,
                matchScore: match.match_score,
            });

            await analyticsEmitter.emitUserAction(userId2, 'exchange_match_found', {
                matchId: match.id,
                matchScore: match.match_score,
            });

            // Audit
            await auditEmitter.emit('audit:exchange_matched', {
                matchId: match.id,
                user1: userId1,
                user2: userId2,
                score: match.match_score,
            });

            logger.info(`Exchange match found: ${match.id} between ${userId1} and ${userId2}`);
        } catch (error) {
            logger.error('Exchange matched event handler error:', error);
        }
    }

    /**
     * Handle exchange accepted
     */
    async handleExchangeAccepted(data) {
        try {
            const { exchange, userId } = data;

            // Get matched user
            const matchedUser = await User.findByPk(exchange.matched_with_user_id);

            // Send notification to accepting user
            await notificationEmitter.emitNotification(userId, {
                type: 'exchange_accepted',
                title: 'Exchange Accepted! ✅',
                message: `You accepted the exchange for "${exchange.offered_product_name}"`,
                action_url: `/exchanges/${exchange.id}`,
                action_label: 'View Exchange',
            });

            // Send notification to matched user
            if (matchedUser) {
                await notificationEmitter.emitNotification(matchedUser.id, {
                    type: 'exchange_accepted',
                    title: 'Exchange Accepted! ✅',
                    message: `Your exchange for "${exchange.offered_product_name}" has been accepted`,
                    action_url: `/exchanges/${exchange.id}`,
                    action_label: 'View Exchange',
                });
            }

            // Track analytics
            await analyticsEmitter.emitUserAction(userId, 'exchange_accepted', {
                exchangeId: exchange.id,
                matchedWith: exchange.matched_with_user_id,
            });

            // Audit
            await auditEmitter.emit('audit:exchange_accepted', {
                exchangeId: exchange.id,
                userId,
                matchedWith: exchange.matched_with_user_id,
            });

            logger.info(`Exchange accepted: ${exchange.id} by user ${userId}`);
        } catch (error) {
            logger.error('Exchange accepted event handler error:', error);
        }
    }

    /**
     * Handle exchange completed
     */
    async handleExchangeCompleted(data) {
        try {
            const { exchange, userId } = data;

            // Send notification
            await notificationEmitter.emitNotification(userId, {
                type: 'system_announcement',
                title: 'Exchange Completed! 🎉',
                message: `Your exchange for "${exchange.offered_product_name}" has been completed successfully!`,
                action_url: `/exchanges/${exchange.id}`,
                action_label: 'View Exchange',
            });

            // Send notification to matched user
            if (exchange.matched_with_user_id) {
                await notificationEmitter.emitNotification(exchange.matched_with_user_id, {
                    type: 'system_announcement',
                    title: 'Exchange Completed! 🎉',
                    message: `Your exchange for "${exchange.offered_product_name}" has been completed successfully!`,
                    action_url: `/exchanges/${exchange.id}`,
                    action_label: 'View Exchange',
                });
            }

            // Track analytics
            await analyticsEmitter.emitConversion(userId, 'exchange_completed', 1, {
                exchangeId: exchange.id,
            });

            // Audit
            await auditEmitter.emit('audit:exchange_completed', {
                exchangeId: exchange.id,
                userId,
            });

            logger.info(`Exchange completed: ${exchange.id}`);
        } catch (error) {
            logger.error('Exchange completed event handler error:', error);
        }
    }

    /**
     * Handle exchange cancelled
     */
    async handleExchangeCancelled(data) {
        try {
            const { exchange, userId, reason } = data;

            // Send notification
            await notificationEmitter.emitNotification(userId, {
                type: 'system_announcement',
                title: 'Exchange Cancelled',
                message: `Your exchange for "${exchange.offered_product_name}" has been cancelled${reason ? `: ${reason}` : ''}`,
            });

            // Send notification to matched user if exists
            if (exchange.matched_with_user_id) {
                await notificationEmitter.emitNotification(exchange.matched_with_user_id, {
                    type: 'system_announcement',
                    title: 'Exchange Cancelled',
                    message: `The exchange for "${exchange.offered_product_name}" has been cancelled${reason ? `: ${reason}` : ''}`,
                });
            }

            // Audit
            await auditEmitter.emit('audit:exchange_cancelled', {
                exchangeId: exchange.id,
                userId,
                reason,
            });

            logger.info(`Exchange cancelled: ${exchange.id} by user ${userId}`);
        } catch (error) {
            logger.error('Exchange cancelled event handler error:', error);
        }
    }
}

module.exports = new ExchangeListeners();