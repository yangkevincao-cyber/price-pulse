// backend/src/middleware/cors.js
const { logger } = require('../config/logger');

/**
 * CORS Middleware
 * Handles Cross-Origin Resource Sharing
 */
const corsMiddleware = (req, res, next) => {
    const allowedOrigins = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
        : ['http://localhost:3001', 'https://pricepulse.com'];

    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    const allowedHeaders = [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        'X-Device-Fingerprint',
        'X-Request-ID',
    ];
    const exposedHeaders = [
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Total-Count',
    ];

    const origin = req.headers.origin;

    // Check if origin is allowed
    const isAllowed = allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV === 'development' && origin?.includes('localhost'));

    if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
        res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '));
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
    } else if (origin) {
        logger.warn(`CORS blocked request from: ${origin}`);
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
        if (isAllowed) {
            return res.status(204).send();
        } else {
            return res.status(403).json({
                success: false,
                error: 'CORS blocked',
                code: 'CORS_BLOCKED',
            });
        }
    }

    next();
};

module.exports = corsMiddleware;