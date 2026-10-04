// backend/src/middleware/cache.js
const { redis } = require('../config/redis');
const { logger } = require('../config/logger');

/**
 * Cache Middleware
 * Caches GET requests with Redis
 */
const cacheMiddleware = (duration = 3600) => {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Skip cache for authenticated requests (optional)
        if (req.user) {
            return next();
        }

        // Generate cache key
        const key = `cache:${req.originalUrl || req.url}`;

        try {
            // Check cache
            const cachedData = await redis.get(key);
            if (cachedData) {
                logger.debug(`Cache hit: ${key}`);
                const data = JSON.parse(cachedData);
                res.setHeader('X-Cache', 'HIT');
                return res.json(data);
            }

            // Store original send function
            const originalSend = res.json;
            res.json = function (data) {
                // Cache response
                redis.setex(key, duration, JSON.stringify(data))
                    .then(() => {
                        logger.debug(`Cache set: ${key} (${duration}s)`);
                    })
                    .catch((error) => {
                        logger.error(`Cache set error: ${key}`, error);
                    });

                res.setHeader('X-Cache', 'MISS');
                originalSend.call(this, data);
            };

            next();
        } catch (error) {
            logger.error('Cache middleware error:', error);
            next();
        }
    };
};

/**
 * Clear cache by pattern
 */
const clearCache = async (pattern) => {
    try {
        const keys = await redis.keys(`cache:${pattern}`);
        if (keys.length > 0) {
            await redis.del(...keys);
            logger.info(`Cache cleared: ${keys.length} keys (${pattern})`);
        }
        return keys.length;
    } catch (error) {
        logger.error('Clear cache error:', error);
        return 0;
    }
};

/**
 * Invalidate cache on data change
 */
const invalidateCache = (pattern) => {
    return async (req, res, next) => {
        try {
            await clearCache(pattern);
        } catch (error) {
            logger.error('Invalidate cache error:', error);
        }
        next();
    };
};

module.exports = {
    cacheMiddleware,
    clearCache,
    invalidateCache,
};