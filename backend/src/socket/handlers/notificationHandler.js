// backend/src/socket/handlers/notificationHandler.js
const { logger } = require('../../config/logger');
const { Notification } = require('../../models');

class NotificationHandler {
    /**
     * Send initial notifications
     */
    async sendInitialNotifications(socket) {
        try {
            const userId = socket.user.id;

            const notifications = await Notification.findAll({
                where: {
                    user_id: userId,
                    read: false,
                },
                order: [['created_at', 'DESC']],
                limit: 20,
            });

            const unreadCount = await Notification.count({
                where: { user_id: userId, read: false },
            });

            socket.emit('initial_notifications', {
                notifications,
                unreadCount,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`Initial notifications sent to ${socket.user.username}`);
        } catch (error) {
            logger.error('Send initial notifications error:', error);
        }
    }

    /**
     * Mark notification as read
     */
    async markRead(socket, data) {
        try {
            const { notificationId } = data;
            const userId = socket.user.id;

            const notification = await Notification.findOne({
                where: { id: notificationId, user_id: userId },
            });

            if (!notification) {
                socket.emit('notification_error', {
                    error: 'Notification not found',
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            await notification.update({
                read: true,
                read_at: new Date(),
            });

            // Get updated unread count
            const unreadCount = await Notification.count({
                where: { user_id: userId, read: false },
            });

            socket.emit('notification_read', {
                notificationId,
                unreadCount,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`Notification ${notificationId} marked as read by ${socket.user.username}`);
        } catch (error) {
            logger.error('Mark notification read error:', error);
            socket.emit('notification_error', {
                error: 'Failed to mark notification as read',
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllRead(socket) {
        try {
            const userId = socket.user.id;

            await Notification.update(
                { read: true, read_at: new Date() },
                { where: { user_id: userId, read: false } }
            );

            socket.emit('all_notifications_read', {
                success: true,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`All notifications marked as read by ${socket.user.username}`);
        } catch (error) {
            logger.error('Mark all notifications read error:', error);
            socket.emit('notification_error', {
                error: 'Failed to mark notifications as read',
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Send new notification
     */
    async sendNotification(socket, notification) {
        try {
            socket.emit('new_notification', {
                ...notification.toJSON(),
                timestamp: new Date().toISOString(),
            });

            // Update unread count
            const unreadCount = await Notification.count({
                where: { user_id: socket.user.id, read: false },
            });

            socket.emit('unread_count_update', { unreadCount });

            logger.debug(`Notification ${notification.id} sent to ${socket.user.username}`);
        } catch (error) {
            logger.error('Send notification error:', error);
        }
    }

    /**
     * Get notification count
     */
    async getUnreadCount(userId) {
        try {
            return await Notification.count({
                where: { user_id: userId, read: false },
            });
        } catch (error) {
            logger.error('Get unread count error:', error);
            return 0;
        }
    }
}

module.exports = new NotificationHandler();