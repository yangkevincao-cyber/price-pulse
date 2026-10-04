// backend/src/socket/handlers/exchangeHandler.js
const { logger } = require('../../config/logger');
const { Exchange, User, Product } = require('../../models');
const exchangeMatchingService = require('../../services/intelligence/exchangeMatchingService');

class ExchangeHandler {
    /**
     * Send initial matches
     */
    async sendInitialMatches(socket) {
        try {
            const userId = socket.user.id;

            // Get user's exchange listings with pending matches
            const matches = await Exchange.findAll({
                where: {
                    user_id: userId,
                    status: 'matched',
                },
                include: [
                    {
                        model: User,
                        as: 'matched_user',
                        attributes: ['id', 'username', 'seller_rating', 'avatar'],
                    },
                    {
                        model: Product,
                        as: 'offeredProduct',
                        attributes: ['id', 'name', 'images'],
                    },
                    {
                        model: Product,
                        as: 'wantedProduct',
                        attributes: ['id', 'name', 'images'],
                    },
                ],
                order: [['matched_at', 'DESC']],
            });

            socket.emit('initial_exchange_matches', {
                matches,
                count: matches.length,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`Initial exchange matches sent to ${socket.user.username}`);
        } catch (error) {
            logger.error('Send initial matches error:', error);
        }
    }

    /**
     * Subscribe to exchange updates
     */
    subscribeExchanges(socket) {
        const room = `seller_${socket.user.id}`;
        socket.join(room);
        socket.emit('exchanges_subscribed', {
            success: true,
            timestamp: new Date().toISOString(),
        });

        logger.debug(`User ${socket.user.username} subscribed to exchanges`);
    }

    /**
     * Accept exchange match
     */
    async acceptExchange(socket, data) {
        try {
            const { matchId } = data;
            const userId = socket.user.id;

            const result = await exchangeMatchingService.acceptMatch(matchId, userId);

            // Send confirmation
            socket.emit('exchange_accepted', {
                matchId,
                success: true,
                message: result.message,
                timestamp: new Date().toISOString(),
            });

            // Notify other party
            const match = await Exchange.findByPk(matchId);
            if (match && match.matched_with_user_id) {
                const { io } = require('../index');
                const socketServer = io ? io : require('../index').getIO();
                if (socketServer) {
                    socketServer.sendToUser(match.matched_with_user_id, 'exchange_accepted_by_other', {
                        matchId,
                        userId: socket.user.id,
                        username: socket.user.username,
                        timestamp: new Date().toISOString(),
                    });
                }
            }

            logger.debug(`Exchange ${matchId} accepted by ${socket.user.username}`);
        } catch (error) {
            logger.error('Accept exchange error:', error);
            socket.emit('exchange_error', {
                error: error.message || 'Failed to accept exchange',
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Decline exchange match
     */
    async declineExchange(socket, data) {
        try {
            const { matchId } = data;
            const userId = socket.user.id;

            const result = await exchangeMatchingService.declineMatch(matchId, userId);

            socket.emit('exchange_declined', {
                matchId,
                success: true,
                message: result.message,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`Exchange ${matchId} declined by ${socket.user.username}`);
        } catch (error) {
            logger.error('Decline exchange error:', error);
            socket.emit('exchange_error', {
                error: error.message || 'Failed to decline exchange',
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Send new match notification
     */
    async sendMatchNotification(socket, match) {
        try {
            socket.emit('new_exchange_match', {
                ...match,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`Exchange match ${match.id} sent to ${socket.user.username}`);
        } catch (error) {
            logger.error('Send match notification error:', error);
        }
    }

    /**
     * Send exchange status update
     */
    async sendStatusUpdate(socket, exchangeId, status) {
        try {
            socket.emit('exchange_status_update', {
                exchangeId,
                status,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`Exchange ${exchangeId} status update sent to ${socket.user.username}`);
        } catch (error) {
            logger.error('Send status update error:', error);
        }
    }
}

module.exports = new ExchangeHandler();