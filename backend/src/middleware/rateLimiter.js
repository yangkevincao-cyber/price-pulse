// backend/src/middleware/rateLimiter.js
const { redis } = require('../config/redis');
const { logger } = require('../config/logger');

/**
 * Rate Limiter Middleware
 * Implements sliding window rate limiting with Redis
 */
class RateLimiter {
    constructor() {
        this.defaultWindow = parseInt(process.env.RATE_LIMIT_WINDOW) || 60;
        this.defaultMax = parseInt(process.env.RATE_LIMIT_MAX) || 100;
        this.enabled = process.env.NODE_ENV !== 'test';

        // Pre-configured rate limits
        this.limits = {
            // Authentication endpoints (stricter)
            auth: { window: 300, max: 30, message: 'Too many authentication attempts' },
            login: { window: 900, max: 10, message: 'Too many login attempts' },
            register: { window: 3600, max: 5, message: 'Too many registration attempts' },

            // API endpoints
            api: { window: 60, max: 60, message: 'Too many requests' },
            search: { window: 60, max: 30, message: 'Search limit exceeded' },

            // Creation endpoints
            product: { window: 3600, max: 50, message: 'Product creation limit exceeded' },
            listing: { window: 3600, max: 100, message: 'Listing creation limit exceeded' },
            transaction: { window: 3600, max: 50, message: 'Transaction limit exceeded' },

            // Admin endpoints
            admin: { window: 60, max: 30, message: 'Admin request limit exceeded' },

            // WebSocket
            websocket: { window: 60, max: 20, message: 'WebSocket connection limit exceeded' },
        };
    }

    /**
     * Create rate limiter middleware
     */
    createLimiter(type = 'api', options = {}) {
        const config = {
            ...this.limits[type] || this.limits.api,
            ...options,
        };

        return async (req, res, next) => {
            if (!this.enabled) {
                return next();
            }

            // Skip rate limiting for health checks
            if (req.path === '/health' || req.path === '/version') {
                return next();
            }

            // Get client identifier
            const clientId = this.getClientId(req);
            const key = `rate_limit:${type}:${clientId}`;

            try {
                const current = await redis.get(key);
                const count = current ? parseInt(current) : 0;

                if (count >= config.max) {
                    const ttl = await redis.ttl(key);

                    logger.warn('Rate limit exceeded', {
                        type,
                        clientId,
                        count,
                        max: config.max,
                        path: req.path,
                        ip: req.ip,
                    });

                    return res.status(429).json({
                        success: false,
                        error: config.message || 'Rate limit exceeded',
                        code: 'RATE_LIMIT_EXCEEDED',
                        retryAfter: ttl > 0 ? ttl : config.window,
                        limit: config.max,
                        remaining: 0,
                    });
                }

                // Increment counter
                const newCount = await redis.incr(key);

                // Set expiry if this is the first request
                if (newCount === 1) {
                    await redis.expire(key, config.window);
                }

                // Add rate limit headers
                const ttl = await redis.ttl(key);
                res.setHeader('X-RateLimit-Limit', config.max);
                res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - newCount));
                res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + (ttl > 0 ? ttl : config.window));

                req.rateLimit = {
                    limit: config.max,
                    current: newCount,
                    remaining: Math.max(0, config.max - newCount),
                    window: config.window,
                };

                next();
            } catch (error) {
                // If Redis fails, allow request
                logger.error('Rate limiter error:', error);
                next();
            }
        };
    }

    /**
     * Get client identifier
     */
    getClientId(req) {
        // Priority: User ID > API Key > IP Address
        if (req.user && req.user.id) {
            return `user:${req.user.id}`;
        }

        if (req.headers['x-api-key']) {
            return `api:${req.headers['x-api-key'].slice(0, 8)}`;
        }

        // Use IP address
        const ip = req.headers['x-forwarded-for']
            ? req.headers['x-forwarded-for'].split(',')[0].trim()
            : req.ip || req.connection.remoteAddress || 'unknown';

        // Add user agent for better identification
        const userAgent = req.headers['user-agent']
            ? req.headers['user-agent'].slice(0, 20)
            : 'unknown';

        return `ip:${ip}:${userAgent}`;
    }

    /**
     * Get rate limit status
     */
    async getStatus(req, type = 'api') {
        const clientId = this.getClientId(req);
        const key = `rate_limit:${type}:${clientId}`;

        try {
            const current = await redis.get(key);
            const ttl = await redis.ttl(key);
            const config = this.limits[type] || this.limits.api;

            const count = current ? parseInt(current) : 0;

            return {
                limit: config.max,
                current: count,
                remaining: Math.max(0, config.max - count),
                window: config.window,
                resetIn: ttl > 0 ? ttl : config.window,
                resetAt: new Date(Date.now() + (ttl > 0 ? ttl : config.window) * 1000),
            };
        } catch (error) {
            logger.error('Rate limit status error:', error);
            return null;
        }
    }

    /**
     * Reset rate limit
     */
    async resetLimit(req, type = 'api') {
        const clientId = this.getClientId(req);
        const key = `rate_limit:${type}:${clientId}`;

        try {
            await redis.del(key);
            return true;
        } catch (error) {
            logger.error('Rate limit reset error:', error);
            return false;
        }
    }
}

// Export singleton
const rateLimiter = new RateLimiter();

// Pre-configured middleware
rateLimiter.api = rateLimiter.createLimiter('api');
rateLimiter.auth = rateLimiter.createLimiter('auth');
rateLimiter.login = rateLimiter.createLimiter('login');
rateLimiter.register = rateLimiter.createLimiter('register');
rateLimiter.search = rateLimiter.createLimiter('search');
rateLimiter.product = rateLimiter.createLimiter('product');
rateLimiter.listing = rateLimiter.createLimiter('listing');
rateLimiter.transaction = rateLimiter.createLimiter('transaction');
rateLimiter.admin = rateLimiter.createLimiter('admin');

module.exports = rateLimiter;