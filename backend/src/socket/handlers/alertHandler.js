// backend/src/socket/handlers/alertHandler.js
const { logger } = require('../../config/logger');
const { DemandAlert } = require('../../models');

class AlertHandler {
    /**
     * Send initial alerts to seller
     */
    async sendInitialAlerts(socket) {
        try {
            const userId = socket.user.id;

            const alerts = await DemandAlert.findAll({
                where: {
                    user_id: userId,
                    read: false,
                },
                order: [['created_at', 'DESC']],
                limit: 20,
            });

            const unreadCount = await DemandAlert.count({
                where: { user_id: userId, read: false },
            });

            socket.emit('initial_alerts', {
                alerts,
                unreadCount,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`Initial alerts sent to ${socket.user.username}`);
        } catch (error) {
            logger.error('Send initial alerts error:', error);
        }
    }

    /**
     * Subscribe to alerts
     */
    subscribeAlerts(socket) {
        const room = `seller_${socket.user.id}`;
        socket.join(room);
        socket.emit('alerts_subscribed', {
            success: true,
            timestamp: new Date().toISOString(),
        });

        logger.debug(`User ${socket.user.username} subscribed to alerts`);
    }

    /**
     * Mark alert as read
     */
    async markAlertRead(socket, data) {
        try {
            const { alertId } = data;
            const userId = socket.user.id;

            const alert = await DemandAlert.findOne({
                where: { id: alertId, user_id: userId },
            });

            if (!alert) {
                socket.emit('alert_error', {
                    error: 'Alert not found',
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            await alert.update({
                read: true,
                read_at: new Date(),
            });

            // Get updated unread count
            const unreadCount = await DemandAlert.count({
                where: { user_id: userId, read: false },
            });

            socket.emit('alert_read', {
                alertId,
                unreadCount,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`Alert ${alertId} marked as read by ${socket.user.username}`);
        } catch (error) {
            logger.error('Mark alert read error:', error);
            socket.emit('alert_error', {
                error: 'Failed to mark alert as read',
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Mark all alerts as read
     */
    async markAllAlertsRead(socket) {
        try {
            const userId = socket.user.id;

            await DemandAlert.update(
                { read: true, read_at: new Date() },
                { where: { user_id: userId, read: false } }
            );

            socket.emit('all_alerts_read', {
                success: true,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`All alerts marked as read by ${socket.user.username}`);
        } catch (error) {
            logger.error('Mark all alerts read error:', error);
            socket.emit('alert_error', {
                error: 'Failed to mark alerts as read',
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Send new alert to user
     */
    async sendAlert(socket, alert) {
        try {
            socket.emit('new_demand_alert', {
                ...alert.toJSON(),
                timestamp: new Date().toISOString(),
            });

            // Update unread count
            const unreadCount = await DemandAlert.count({
                where: { user_id: socket.user.id, read: false },
            });

            socket.emit('unread_count_update', { unreadCount });

            logger.debug(`Alert ${alert.id} sent to ${socket.user.username}`);
        } catch (error) {
            logger.error('Send alert error:', error);
        }
    }
}

module.exports = new AlertHandler();