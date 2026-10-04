// backend/src/socket/handlers/connectionHandler.js
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');

class ConnectionHandler {
    /**
     * Handle new connection
     */
    async handleConnection(socket, io) {
        try {
            const userId = socket.user.id;
            const userKey = `user:${userId}:status`;

            // Store user status in Redis
            await redis.hset(userKey, {
                socketId: socket.id,
                status: 'online',
                lastActive: new Date().toISOString(),
                userAgent: socket.handshake.headers['user-agent'],
                ip: socket.handshake.address,
            });
            await redis.expire(userKey, 3600); // 1 hour

            // Get user's online status for their connections
            const userSockets = await redis.smembers(`user:${userId}:sockets`);
            await redis.sadd(`user:${userId}:sockets`, socket.id);
            await redis.expire(`user:${userId}:sockets`, 3600);

            logger.info(`User ${userId} connected with socket ${socket.id}`);

            return { userId, socketId: socket.id };
        } catch (error) {
            logger.error('Connection handler error:', error);
            throw error;
        }
    }

    /**
     * Handle disconnection
     */
    async handleDisconnect(socket) {
        try {
            const userId = socket.user?.id;
            if (userId) {
                const userKey = `user:${userId}:status`;
                await redis.del(userKey);
                await redis.srem(`user:${userId}:sockets`, socket.id);
                logger.info(`User ${userId} disconnected from socket ${socket.id}`);
            }
        } catch (error) {
            logger.error('Disconnect handler error:', error);
        }
    }

    /**
     * Get user status
     */
    async getUserStatus(userId) {
        try {
            const userKey = `user:${userId}:status`;
            const status = await redis.hgetall(userKey);
            return status;
        } catch (error) {
            logger.error('Get user status error:', error);
            return null;
        }
    }

    /**
     * Get online users
     */
    async getOnlineUsers() {
        try {
            const keys = await redis.keys('user:*:status');
            const users = [];
            for (const key of keys) {
                const status = await redis.hgetall(key);
                const userId = key.split(':')[1];
                users.push({ userId, ...status });
            }
            return users;
        } catch (error) {
            logger.error('Get online users error:', error);
            return [];
        }
    }
}

module.exports = new ConnectionHandler();