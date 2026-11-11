// backend/src/controllers/notificationController.js
const { Notification, User } = require('../models');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const emailService = require('../services/notification/emailService');
const pushNotificationService = require('../services/notification/pushNotificationService');
const smsService = require('../services/notification/smsService');
const webSocketService = require('../services/notification/webSocketService');

class NotificationController {
    /**
     * Get user's notifications
     */
    async getNotifications(req, res) {
        try {
            const userId = req.user.id;
            const {
                page = 1,
                limit = 20,
                unreadOnly = false,
                type,
                startDate,
                endDate
            } = req.query;

            const offset = (page - 1) * limit;

            const where = { user_id: userId };
            if (unreadOnly === 'true') {
                where.read = false;
            }
            if (type) {
                where.type = type;
            }
            if (startDate) {
                where.created_at = { [Op.gte]: new Date(startDate) };
            }
            if (endDate) {
                where.created_at = { ...where.created_at, [Op.lte]: new Date(endDate) };
            }

            const { count, rows } = await Notification.findAndCountAll({
                where,
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            const unreadCount = await Notification.count({
                where: { user_id: userId, read: false },
            });

            return res.json({
                success: true,
                data: {
                    notifications: rows,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                    unread_count: unreadCount,
                },
            });
        } catch (error) {
            logger.error('Get notifications error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch notifications',
            });
        }
    }

    /**
     * Get notification by ID
     */
    async getNotification(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const notification = await Notification.findOne({
                where: { id, user_id: userId },
            });

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found',
                });
            }

            return res.json({
                success: true,
                data: { notification },
            });
        } catch (error) {
            logger.error('Get notification error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch notification',
            });
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const notification = await Notification.findOne({
                where: { id, user_id: userId },
            });

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found',
                });
            }

            await notification.markAsRead();

            // Get updated unread count
            const unreadCount = await Notification.count({
                where: { user_id: userId, read: false },
            });

            // Update WebSocket
            webSocketService.sendToUser(userId, 'notification_read', {
                notification_id: id,
                unread_count: unreadCount,
            });

            return res.json({
                success: true,
                message: 'Notification marked as read',
                data: { unread_count: unreadCount },
            });
        } catch (error) {
            logger.error('Mark as read error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to mark notification as read',
            });
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(req, res) {
        try {
            const userId = req.user.id;

            await Notification.update(
                { read: true, read_at: new Date() },
                { where: { user_id: userId, read: false } }
            );

            // Update WebSocket
            webSocketService.sendToUser(userId, 'all_notifications_read', {
                unread_count: 0,
            });

            return res.json({
                success: true,
                message: 'All notifications marked as read',
            });
        } catch (error) {
            logger.error('Mark all as read error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to mark notifications as read',
            });
        }
    }

    /**
     * Delete notification
     */
    async deleteNotification(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const notification = await Notification.findOne({
                where: { id, user_id: userId },
            });

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found',
                });
            }

            await notification.destroy();

            return res.json({
                success: true,
                message: 'Notification deleted successfully',
            });
        } catch (error) {
            logger.error('Delete notification error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete notification',
            });
        }
    }

    /**
     * Delete all notifications
     */
    async deleteAll(req, res) {
        try {
            const userId = req.user.id;

            await Notification.destroy({
                where: { user_id: userId },
            });

            return res.json({
                success: true,
                message: 'All notifications deleted successfully',
            });
        } catch (error) {
            logger.error('Delete all notifications error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete notifications',
            });
        }
    }

    /**
     * Get notification preferences
     */
    async getPreferences(req, res) {
        try {
            const userId = req.user.id;

            const user = await User.findByPk(userId, {
                attributes: ['preferences'],
            });

            const preferences = user.preferences?.notifications || {
                email: true,
                push: true,
                sms: false,
                in_app: true,
                types: {
                    demand_alert: true,
                    price_drop: true,
                    exchange_match: true,
                    transaction_update: true,
                    payment_update: true,
                    shipping_update: true,
                    review_received: true,
                    offer_received: true,
                    system_announcement: true,
                    security_alert: true,
                },
            };

            return res.json({
                success: true,
                data: { preferences },
            });
        } catch (error) {
            logger.error('Get notification preferences error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch notification preferences',
            });
        }
    }

    /**
     * Update notification preferences
     */
    async updatePreferences(req, res) {
        try {
            const userId = req.user.id;
            const { preferences } = req.body;

            const user = await User.findByPk(userId);

            // Merge with existing preferences
            const currentPrefs = user.preferences || {};
            currentPrefs.notifications = {
                ...currentPrefs.notifications,
                ...preferences,
            };

            await user.update({ preferences: currentPrefs });

            return res.json({
                success: true,
                message: 'Notification preferences updated successfully',
                data: { preferences: currentPrefs.notifications },
            });
        } catch (error) {
            logger.error('Update notification preferences error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to update preferences',
            });
        }
    }

    /**
     * Send notification (admin only)
     */
    async sendNotification(req, res) {
        try {
            const {
                userId,
                type,
                title,
                message,
                data,
                action_url,
                action_label,
                channels = ['in_app']
            } = req.body;

            // Create notification in database
            const notification = await Notification.create({
                user_id: userId,
                type: type || 'system_announcement',
                title,
                message,
                data: data || {},
                action_url: action_url || null,
                action_label: action_label || null,
                channel: channels,
            });

            // Send via channels
            const user = await User.findByPk(userId);

            // Send email
            if (channels.includes('email') && user.preferences?.notifications?.email !== false) {
                try {
                    await emailService.send({
                        to: user.email,
                        subject: title,
                        html: this.buildEmailTemplate(title, message, action_url, action_label),
                    });
                } catch (error) {
                    logger.error('Email notification error:', error);
                }
            }

            // Send push notification
            if (channels.includes('push') && user.preferences?.notifications?.push !== false) {
                try {
                    await pushNotificationService.sendToUser(userId, {
                        title,
                        message,
                        data: data || {},
                        action_url,
                        action_label,
                    });
                } catch (error) {
                    logger.error('Push notification error:', error);
                }
            }

            // Send SMS
            if (channels.includes('sms') && user.preferences?.notifications?.sms !== false && user.phone) {
                try {
                    await smsService.sendSms(user.phone, message);
                } catch (error) {
                    logger.error('SMS notification error:', error);
                }
            }

            // Send WebSocket
            if (channels.includes('in_app')) {
                webSocketService.sendToUser(userId, 'new_notification', notification);
            }

            return res.status(201).json({
                success: true,
                message: 'Notification sent successfully',
                data: { notification },
            });
        } catch (error) {
            logger.error('Send notification error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to send notification',
            });
        }
    }

    /**
     * Broadcast notification (admin only)
     */
    async broadcastNotification(req, res) {
        try {
            const {
                type,
                title,
                message,
                data,
                action_url,
                action_label,
                channels = ['in_app', 'email'],
                userFilter = 'all'
            } = req.body;

            let users;
            if (userFilter === 'sellers') {
                users = await User.findAll({
                    where: { role: 'seller', is_active: true },
                });
            } else if (userFilter === 'buyers') {
                users = await User.findAll({
                    where: { role: 'buyer', is_active: true },
                });
            } else {
                users = await User.findAll({
                    where: { is_active: true },
                });
            }

            let sentCount = 0;
            const results = [];

            for (const user of users) {
                try {
                    // Create notification
                    const notification = await Notification.create({
                        user_id: user.id,
                        type: type || 'system_announcement',
                        title,
                        message,
                        data: data || {},
                        action_url: action_url || null,
                        action_label: action_label || null,
                        channel: channels,
                    });

                    sentCount++;

                    // Send via channels (asynchronously)
                    if (channels.includes('email') && user.preferences?.notifications?.email !== false) {
                        setImmediate(async () => {
                            try {
                                await emailService.send({
                                    to: user.email,
                                    subject: title,
                                    html: this.buildEmailTemplate(title, message, action_url, action_label),
                                });
                            } catch (error) {
                                logger.error(`Email notification error for user ${user.id}:`, error);
                            }
                        });
                    }

                    if (channels.includes('in_app')) {
                        webSocketService.sendToUser(user.id, 'new_notification', notification);
                    }

                    // Rate limiting for push/SMS
                    if (channels.includes('push') && user.preferences?.notifications?.push !== false) {
                        setTimeout(async () => {
                            try {
                                await pushNotificationService.sendToUser(user.id, {
                                    title,
                                    message,
                                    data: data || {},
                                    action_url,
                                    action_label,
                                });
                            } catch (error) {
                                logger.error(`Push notification error for user ${user.id}:`, error);
                            }
                        }, Math.random() * 1000);
                    }

                    if (channels.includes('sms') && user.preferences?.notifications?.sms !== false && user.phone) {
                        setTimeout(async () => {
                            try {
                                await smsService.sendSms(user.phone, message);
                            } catch (error) {
                                logger.error(`SMS notification error for user ${user.id}:`, error);
                            }
                        }, Math.random() * 1000);
                    }

                } catch (error) {
                    logger.error(`Broadcast notification error for user ${user.id}:`, error);
                    results.push({ user_id: user.id, error: error.message });
                }
            }

            return res.json({
                success: true,
                message: `Broadcast notification sent to ${sentCount} users`,
                data: {
                    total_users: users.length,
                    sent: sentCount,
                    errors: results.length,
                },
            });
        } catch (error) {
            logger.error('Broadcast notification error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to broadcast notification',
            });
        }
    }

    /**
     * Get notification stats
     */
    async getStats(req, res) {
        try {
            const userId = req.user.id;

            const stats = await Notification.findAll({
                where: { user_id: userId },
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN read THEN 1 ELSE 0 END')), 'read'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN read THEN 0 ELSE 1 END')), 'unread'],
                ],
            });

            const byType = await Notification.findAll({
                where: { user_id: userId },
                attributes: [
                    'type',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                group: ['type'],
                order: [[sequelize.literal('count'), 'DESC']],
            });

            return res.json({
                success: true,
                data: {
                    stats: stats[0] || { total: 0, read: 0, unread: 0 },
                    by_type: byType,
                },
            });
        } catch (error) {
            logger.error('Get notification stats error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch notification stats',
            });
        }
    }

    /**
     * Build email template
     */
    buildEmailTemplate(title, message, actionUrl, actionLabel) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1E3A8A, #3B82F6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 12px 30px; background: #3B82F6; color: white; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>PricePulse</h2>
                </div>
                <div class="content">
                    <h2>${title}</h2>
                    <p>${message}</p>
                    ${actionUrl ? `
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${actionUrl}" class="button">${actionLabel || 'View Details'}</a>
                        </div>
                    ` : ''}
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} PricePulse. All rights reserved.</p>
                    <p><a href="${process.env.FRONTEND_URL}/settings/notifications">Manage your preferences</a></p>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Get notification types
     */
    async getNotificationTypes(req, res) {
        try {
            const types = [
                'demand_alert',
                'price_drop',
                'exchange_match',
                'exchange_accepted',
                'transaction_update',
                'payment_update',
                'shipping_update',
                'review_received',
                'offer_received',
                'offer_accepted',
                'system_announcement',
                'security_alert',
            ];

            return res.json({
                success: true,
                data: types,
            });
        } catch (error) {
            logger.error('Get notification types error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch notification types',
            });
        }
    }

    /**
     * Test notification (admin only)
     */
    async testNotification(req, res) {
        try {
            const { channel = 'email' } = req.query;
            const userId = req.user.id;

            const testMessage = 'This is a test notification from PricePulse.';

            let result;
            switch (channel) {
                case 'email': {
                    const user = await User.findByPk(userId);
                    if (!user || !user.email) {
                        return res.status(400).json({
                            success: false,
                            error: 'User does not have an email address',
                        });
                    }
                    result = await emailService.send({
                        to: user.email,
                        subject: 'Test Notification',
                        html: this.buildEmailTemplate('Test Notification', testMessage),
                    });
                    break;
                }

                case 'push': {
                    result = await pushNotificationService.sendToUser(userId, {
                        title: 'Test Notification',
                        message: testMessage,
                    });
                    break;
                }

                case 'sms': {
                    const userData = await User.findByPk(userId);
                    if (!userData || !userData.phone) {
                        return res.status(400).json({
                            success: false,
                            error: 'User does not have a phone number',
                        });
                    }
                    result = await smsService.sendSms(userData.phone, testMessage);
                    break;
                }

                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid channel',
                    });
            }

            return res.json({
                success: true,
                message: `Test notification sent via ${channel}`,
                data: result,
            });
        } catch (error) {
            logger.error('Test notification error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to send test notification',
            });
        }
    }
}

module.exports = new NotificationController();