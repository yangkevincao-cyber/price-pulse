// backend/src/socket/middleware/rateLimiter.js
const { redis } = require('../../config/redis');
const { logger } = require('../../config/logger');

/**
 * Socket.IO Rate Limiter Middleware
 */
const rateLimiter = async (socket, next) => {
    try {
        const userId = socket.user?.id;
        if (!userId) {
            return next();
        }

        const key = `socket:rate:${userId}`;
        const current = await redis.incr(key);

        if (current === 1) {
            await redis.expire(key, 60); // 1 minute window
        }

        const maxRequests = 20; // Max 20 messages per minute
        if (current > maxRequests) {
            logger.warn(`Rate limit exceeded for socket user ${userId}`);
            return next(new Error('Rate limit exceeded'));
        }

        next();
    } catch (error) {
        logger.error('Socket rate limiter error:', error);
        next();
    }
};

module.exports = rateLimiter;