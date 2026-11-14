// backend/src/workers/notificationWorker.js
const { Queue, Worker } = require('bullmq');
const { redis } = require('../config/redis');
const { logger } = require('../config/logger');
const { Notification, User } = require('../models');
const webSocketService = require('../services/notification/webSocketService');
const pushNotificationService = require('../services/notification/pushNotificationService');
const smsService = require('../services/notification/smsService');

/**
 * Notification Queue
 */
class NotificationWorker {
    constructor() {
        this.queueName = 'notification_queue';
        this.queue = null;
        this.worker = null;
        this.isRunning = false;
    }

    /**
     * Start the worker
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Notification worker already running');
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
                    concurrency: 5,
                    limiter: {
                        max: 20,
                        duration: 1000,
                    },
                }
            );

            // Worker events
            this.worker.on('completed', (job) => {
                logger.info(`Notification job ${job.id} completed`);
            });

            this.worker.on('failed', (job, error) => {
                logger.error(`Notification job ${job.id} failed:`, error);
            });

            this.worker.on('error', (error) => {
                logger.error('Notification worker error:', error);
            });

            this.isRunning = true;
            logger.info('Notification worker started');
        } catch (error) {
            logger.error('Notification worker start failed:', error);
            throw error;
        }
    }

    /**
     * Process notification job
     */
    async processJob(job) {
        const { type, data } = job.data;

        switch (type) {
            case 'send_in_app':
                await this.sendInAppNotification(data);
                break;

            case 'send_push':
                await this.sendPushNotification(data);
                break;

            case 'send_sms':
                await this.sendSmsNotification(data);
                break;

            case 'send_broadcast':
                await this.sendBroadcastNotification(data);
                break;

            default:
                throw new Error(`Unknown notification type: ${type}`);
        }
    }

    /**
     * Send in-app notification
     */
    async sendInAppNotification(data) {
        const { userId, title, message, type, data: extraData, actionUrl, actionLabel } = data;

        // Create notification record
        const notification = await Notification.create({
            user_id: userId,
            type: type || 'system_announcement',
            title,
            message,
            data: extraData || {},
            action_url: actionUrl || null,
            action_label: actionLabel || null,
            channel: ['in_app'],
        });

        // Send via WebSocket
        webSocketService.sendToUser(userId, 'new_notification', notification);

        logger.info(`In-app notification sent to user ${userId}`);
        return notification;
    }

    /**
     * Send push notification
     */
    async sendPushNotification(data) {
        const { userId, title, message, extraData, actionUrl, actionLabel } = data;

        const user = await User.findByPk(userId);
        if (!user || user.preferences?.notifications?.push === false) {
            logger.info(`Push notification skipped for user ${userId} (disabled)`);
            return;
        }

        await pushNotificationService.sendToUser(userId, {
            title,
            message,
            data: extraData || {},
            action_url: actionUrl,
            action_label: actionLabel,
        });

        logger.info(`Push notification sent to user ${userId}`);
    }

    /**
     * Send SMS notification
     */
    async sendSmsNotification(data) {
        const { userId, message } = data;

        const user = await User.findByPk(userId);
        if (!user || !user.phone || user.preferences?.notifications?.sms === false) {
            logger.info(`SMS notification skipped for user ${userId} (no phone or disabled)`);
            return;
        }

        await smsService.sendSms(user.phone, message);

        logger.info(`SMS notification sent to user ${userId}`);
    }

    /**
     * Send broadcast notification
     */
    async sendBroadcastNotification(data) {
        const { title, message, type, extraData, actionUrl, actionLabel, channels, userFilter } = data;

        // Get users based on filter
        const where = { is_active: true };
        if (userFilter === 'sellers') {
            where.role = 'seller';
        } else if (userFilter === 'buyers') {
            where.role = 'buyer';
        }

        const users = await User.findAll({
            where,
            attributes: ['id', 'email', 'phone', 'preferences'],
        });

        let sentCount = 0;

        for (const user of users) {
            // Create notification record
            const notification = await Notification.create({
                user_id: user.id,
                type: type || 'system_announcement',
                title,
                message,
                data: extraData || {},
                action_url: actionUrl || null,
                action_label: actionLabel || null,
                channel: channels || ['in_app'],
            });

            // Send via channels
            const channelsToSend = channels || ['in_app'];

            if (channelsToSend.includes('in_app')) {
                webSocketService.sendToUser(user.id, 'new_notification', notification);
            }

            if (channelsToSend.includes('push') && user.preferences?.notifications?.push !== false) {
                await this.sendPushNotification({
                    userId: user.id,
                    title,
                    message,
                    extraData,
                    actionUrl,
                    actionLabel,
                });
            }

            if (channelsToSend.includes('sms') && user.phone && user.preferences?.notifications?.sms !== false) {
                await this.sendSmsNotification({
                    userId: user.id,
                    message: message.length > 160 ? message.substring(0, 157) + '...' : message,
                });
            }

            sentCount++;

            // Rate limiting
            if (sentCount % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        logger.info(`Broadcast notification sent to ${sentCount} users`);
        return { sentCount };
    }

    /**
     * Add notification job
     */
    async addJob(type, data, options = {}) {
        if (!this.queue) {
            throw new Error('Notification queue not initialized');
        }

        const job = await this.queue.add(
            type,
            { type, data },
            options
        );

        logger.info(`Notification job added: ${type} (${job.id})`);
        return job;
    }

    /**
     * Send notification (convenience method)
     */
    async sendNotification(userId, notification) {
        return this.addJob('send_in_app', {
            userId,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            extraData: notification.data,
            actionUrl: notification.action_url,
            actionLabel: notification.action_label,
        });
    }

    /**
     * Send push notification (convenience method)
     */
    async sendPush(userId, notification) {
        return this.addJob('send_push', {
            userId,
            title: notification.title,
            message: notification.message,
            extraData: notification.data,
            actionUrl: notification.action_url,
            actionLabel: notification.action_label,
        });
    }

    /**
     * Send SMS (convenience method)
     */
    async sendSms(userId, message) {
        return this.addJob('send_sms', {
            userId,
            message,
        });
    }

    /**
     * Broadcast notification (convenience method)
     */
    async broadcast(notification) {
        return this.addJob('send_broadcast', notification);
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
            logger.info('Notification worker stopped');
        } catch (error) {
            logger.error('Notification worker stop failed:', error);
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
        logger.info(`Notification queue cleaned (age: ${age}s)`);
    }
}

module.exports = new NotificationWorker();

