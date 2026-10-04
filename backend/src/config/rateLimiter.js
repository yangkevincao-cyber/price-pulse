// backend/src/config/rateLimiter.js
const { redis } = require('./redis');
const { logger } = require('./logger');

/**
 * Rate Limiter Configuration
 * Implements sliding window rate limiting with Redis
 */
class RateLimiter {
    constructor() {
        this.defaultWindow = parseInt(process.env.RATE_LIMIT_WINDOW) || 15; // seconds
        this.defaultMax = parseInt(process.env.RATE_LIMIT_MAX) || 100;
        this.enabled = process.env.NODE_ENV !== 'test';

        // Define different rate limits for different endpoints
        this.limits = {
            // Authentication endpoints (stricter)
            auth: {
                window: 300, // 5 minutes
                max: 30,
                message: 'Too many authentication attempts. Please try again later.',
            },
            // Login endpoints (very strict)
            login: {
                window: 900, // 15 minutes
                max: 10,
                message: 'Too many login attempts. Please try again in 15 minutes.',
            },
            // Registration (strict)
            register: {
                window: 3600, // 1 hour
                max: 5,
                message: 'Too many registration attempts. Please try again later.',
            },
            // API endpoints (standard)
            api: {
                window: 60, // 1 minute
                max: 60,
                message: 'Too many requests. Please slow down.',
            },
            // Search endpoints (heavier)
            search: {
                window: 60, // 1 minute
                max: 30,
                message: 'Search limit exceeded. Please wait a moment.',
            },
            // Product creation (stricter)
            product: {
                window: 3600, // 1 hour
                max: 50,
                message: 'Product creation limit exceeded. Please try again later.',
            },
            // Listing creation (stricter)
            listing: {
                window: 3600, // 1 hour
                max: 100,
                message: 'Listing creation limit exceeded. Please try again later.',
            },
            // Scraping endpoints
            scraping: {
                window: 60, // 1 minute
                max: 5,
                message: 'Scraping request limit exceeded.',
            },
            // Admin endpoints (stricter)
            admin: {
                window: 60, // 1 minute
                max: 30,
                message: 'Admin request limit exceeded.',
            },
            // WebSocket connections
            websocket: {
                window: 60, // 1 minute
                max: 20,
                message: 'WebSocket connection limit exceeded.',
            },
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
            if (req.path === '/health') {
                return next();
            }

            // Create unique identifier for the client
            const clientId = this.getClientId(req);
            const key = `rate_limit:${type}:${clientId}`;

            try {
                // Get current count
                const current = await redis.get(key);
                const count = current ? parseInt(current) : 0;

                // Check if limit exceeded
                if (count >= config.max) {
                    const ttl = await redis.ttl(key);

                    // Log rate limit hit
                    logger.warn('Rate limit exceeded', {
                        type,
                        clientId,
                        count,
                        max: config.max,
                        window: config.window,
                        path: req.path,
                        ip: req.ip,
                    });

                    return res.status(429).json({
                        success: false,
                        error: config.message || 'Rate limit exceeded',
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

                // Store for potential later use
                req.rateLimit = {
                    limit: config.max,
                    current: newCount,
                    remaining: Math.max(0, config.max - newCount),
                    window: config.window,
                };

                next();
            } catch (error) {
                // If Redis fails, fallback to allowing request
                logger.error('Rate limiter error:', error);

                // Add fallback headers
                res.setHeader('X-RateLimit-Limit', 'fallback');
                res.setHeader('X-RateLimit-Remaining', 'unknown');

                next();
            }
        };
    }

    /**
     * Create rate limiter for WebSocket connections
     */
    createWebSocketLimiter() {
        const config = this.limits.websocket;

        return async (socket, next) => {
            if (!this.enabled) {
                return next();
            }

            const clientId = socket.handshake.address || socket.id;
            const key = `rate_limit:websocket:${clientId}`;

            try {
                const current = await redis.get(key);
                const count = current ? parseInt(current) : 0;

                if (count >= config.max) {
                    logger.warn('WebSocket rate limit exceeded', {
                        clientId,
                        count,
                        max: config.max,
                    });
                    return next(new Error('WebSocket connection limit exceeded'));
                }

                await redis.incr(key);
                await redis.expire(key, config.window);

                next();
            } catch (error) {
                logger.error('WebSocket rate limiter error:', error);
                next();
            }
        };
    }

    /**
     * Create rate limiter for specific IP
     */
    createIPLimiter(max = 1000, window = 60) {
        return async (req, res, next) => {
            if (!this.enabled) {
                return next();
            }

            const ip = req.ip || req.connection.remoteAddress;
            const key = `rate_limit:ip:${ip}`;

            try {
                const current = await redis.get(key);
                const count = current ? parseInt(current) : 0;

                if (count >= max) {
                    const ttl = await redis.ttl(key);
                    return res.status(429).json({
                        success: false,
                        error: 'IP rate limit exceeded',
                        retryAfter: ttl > 0 ? ttl : window,
                    });
                }

                await redis.incr(key);
                await redis.expire(key, window);

                next();
            } catch (error) {
                logger.error('IP rate limiter error:', error);
                next();
            }
        };
    }

    /**
     * Get unique client identifier
     */
    getClientId(req) {
        // Priority: User ID > API Key > IP Address
        if (req.user && req.user.id) {
            return `user:${req.user.id}`;
        }

        if (req.headers['x-api-key']) {
            return `api:${req.headers['x-api-key'].slice(0, 8)}`;
        }

        // Use IP address or x-forwarded-for
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
     * Get rate limit status for a client
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
     * Reset rate limit for a client
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

    /**
     * Clear all rate limits (admin function)
     */
    async clearAllLimits() {
        try {
            const keys = await redis.keys('rate_limit:*');
            if (keys.length > 0) {
                await redis.del(...keys);
            }
            return keys.length;
        } catch (error) {
            logger.error('Clear rate limits error:', error);
            return 0;
        }
    }

    /**
     * Get rate limit statistics
     */
    async getStats() {
        try {
            const keys = await redis.keys('rate_limit:*');
            const stats = {
                totalKeys: keys.length,
                byType: {},
                topClients: [],
            };

            // Group by type
            for (const key of keys) {
                const parts = key.split(':');
                const type = parts[1] || 'unknown';
                stats.byType[type] = (stats.byType[type] || 0) + 1;
            }

            // Get top clients by count
            const clientCounts = [];
            for (const key of keys) {
                const count = await redis.get(key);
                if (count) {
                    clientCounts.push({
                        key,
                        count: parseInt(count),
                    });
                }
            }

            clientCounts.sort((a, b) => b.count - a.count);
            stats.topClients = clientCounts.slice(0, 10);

            return stats;
        } catch (error) {
            logger.error('Rate limit stats error:', error);
            return null;
        }
    }

    /**
     * Pre-configured middleware instances
     */
    getMiddlewares() {
        return {
            // Standard API rate limiter
            api: this.createLimiter('api'),

            // Authentication rate limiter
            auth: this.createLimiter('auth'),

            // Login rate limiter (extra strict)
            login: this.createLimiter('login'),

            // Registration rate limiter
            register: this.createLimiter('register'),

            // Search rate limiter
            search: this.createLimiter('search'),

            // Product creation rate limiter
            product: this.createLimiter('product'),

            // Listing creation rate limiter
            listing: this.createLimiter('listing'),

            // Admin rate limiter
            admin: this.createLimiter('admin'),

            // Scraping rate limiter
            scraping: this.createLimiter('scraping'),

            // WebSocket rate limiter
            websocket: this.createWebSocketLimiter(),
        };
    }
}

// Export singleton
const rateLimiterConfig = new RateLimiter();
module.exports = rateLimiterConfig;