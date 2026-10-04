// backend/src/services/notification/pushNotificationService.js
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');
const { User } = require('../../models');

class PushNotificationService {
    /**
     * Send push notification to user
     */
    async sendToUser(userId, notification) {
        try {
            // Get user's push tokens
            const tokens = await this.getUserPushTokens(userId);

            if (!tokens || tokens.length === 0) {
                logger.info(`No push tokens found for user ${userId}`);
                return;
            }

            // Prepare notification payload
            const payload = {
                title: notification.title,
                body: notification.message,
                data: notification.data || {},
                icon: notification.icon || '/logo/pricepulse-mark.png',
                badge: notification.badge,
                sound: notification.sound || 'default',
                actions: notification.actions || [],
                vibrate: notification.vibrate || [200, 100, 200],
                requireInteraction: notification.requireInteraction || false,
                tag: notification.tag || `notification_${Date.now()}`,
            };

            // Send to each token
            const results = await Promise.allSettled(
                tokens.map(token => this.sendToToken(token, payload))
            );

            // Clean up invalid tokens
            const failedTokens = results
                .map((result, index) => ({ result, token: tokens[index] }))
                .filter(({ result }) => result.status === 'rejected')
                .map(({ token }) => token);

            if (failedTokens.length > 0) {
                await this.removeInvalidTokens(userId, failedTokens);
            }

            logger.info(`Push notification sent to user ${userId}: ${notification.title}`);

            return { success: true, results };

        } catch (error) {
            logger.error('Push notification failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send to specific token
     */
    async sendToToken(token, payload) {
        try {
            // Use web push protocol
            // This would integrate with web-push library for browser notifications
            // For mobile, this would use FCM (Firebase Cloud Messaging) or APNS

            // For web push
            if (token.startsWith('web_')) {
                await this.sendWebPush(token, payload);
            }

            // For mobile (FCM)
            if (token.startsWith('fcm_')) {
                await this.sendFCM(token, payload);
            }

            // For iOS (APNS)
            if (token.startsWith('apns_')) {
                await this.sendAPNS(token, payload);
            }

            return { success: true };

        } catch (error) {
            logger.error('Push send failed:', error);
            throw error;
        }
    }

    /**
     * Send web push
     */
    async sendWebPush(token, payload) {
        // Implementation using web-push library
        // const webpush = require('web-push');
        // webpush.setVapidDetails(...)
        // await webpush.sendNotification(token, JSON.stringify(payload))

        // Mock implementation
        logger.info(`Web push sent to ${token}`);
    }

    /**
     * Send FCM (Firebase Cloud Messaging)
     */
    async sendFCM(token, payload) {
        // Implementation using firebase-admin
        // const admin = require('firebase-admin');
        // await admin.messaging().send({
        //     token,
        //     notification: {
        //         title: payload.title,
        //         body: payload.body,
        //     },
        //     data: payload.data,
        // })

        logger.info(`FCM push sent to ${token}`);
    }

    /**
     * Send APNS (Apple Push Notification Service)
     */
    async sendAPNS(token, payload) {
        // Implementation using apns2
        // const apn = require('apn');
        // const provider = new apn.Provider(...)
        // await provider.send(notification, token)

        logger.info(`APNS push sent to ${token}`);
    }

    /**
     * Get user push tokens
     */
    async getUserPushTokens(userId) {
        const key = `push_tokens:${userId}`;
        const tokens = await redis.smembers(key);
        return tokens;
    }

    /**
     * Register push token
     */
    async registerToken(userId, token, platform = 'web') {
        const key = `push_tokens:${userId}`;
        const prefixedToken = `${platform}_${token}`;

        await redis.sadd(key, prefixedToken);
        await redis.expire(key, 86400 * 30); // 30 days

        logger.info(`Push token registered for user ${userId}: ${platform}`);

        return { success: true };
    }

    /**
     * Remove push token
     */
    async removeToken(userId, token) {
        const key = `push_tokens:${userId}`;
        await redis.srem(key, token);

        logger.info(`Push token removed for user ${userId}`);

        return { success: true };
    }

    /**
     * Remove invalid tokens
     */
    async removeInvalidTokens(userId, tokens) {
        const key = `push_tokens:${userId}`;
        for (const token of tokens) {
            await redis.srem(key, token);
        }

        logger.info(`Removed ${tokens.length} invalid tokens for user ${userId}`);

        return { success: true };
    }

    /**
     * Send notification to multiple users
     */
    async sendToMany(userIds, notification) {
        const results = [];

        for (const userId of userIds) {
            const result = await this.sendToUser(userId, notification);
            results.push({ userId, result });
        }

        return results;
    }

    /**
     * Send broadcast notification (all users with tokens)
     */
    async sendBroadcast(notification) {
        try {
            // Get all users with push tokens
            const keys = await redis.keys('push_tokens:*');
            const userIds = keys.map(key => key.replace('push_tokens:', ''));

            const results = await this.sendToMany(userIds, notification);

            logger.info(`Broadcast push sent to ${userIds.length} users`);

            return results;
        } catch (error) {
            logger.error('Broadcast push failed:', error);
            throw error;
        }
    }

    /**
     * Send notification to subscribers of a topic
     */
    async sendToTopic(topic, notification) {
        // This would integrate with FCM topic messaging
        // await admin.messaging().sendToTopic(topic, {
        //     notification: {
        //         title: notification.title,
        //         body: notification.body,
        //     },
        //     data: notification.data,
        // })

        logger.info(`Topic push sent to ${topic}`);

        return { success: true };
    }
}

module.exports = new PushNotificationService();