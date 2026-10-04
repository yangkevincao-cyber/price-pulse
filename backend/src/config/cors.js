// backend/src/config/cors.js
const { logger } = require('./logger');

/**
 * CORS Configuration
 * Handles Cross-Origin Resource Sharing settings
 */
class CorsConfig {
    constructor() {
        this.allowedOrigins = this.parseOrigins(process.env.CORS_ORIGINS);
        this.allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
        this.allowedHeaders = [
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
        this.exposedHeaders = [
            'X-Request-ID',
            'X-RateLimit-Limit',
            'X-RateLimit-Remaining',
            'X-RateLimit-Reset',
            'X-Total-Count',
        ];
        this.maxAge = 86400; // 24 hours in seconds
        this.credentials = true;
        this.preflightContinue = false;
        this.optionsSuccessStatus = 204;

        // Development fallback
        if (process.env.NODE_ENV === 'development') {
            this.allowedOrigins = ['*'];
            this.allowedMethods = ['*'];
            this.allowedHeaders = ['*'];
            this.exposedHeaders = ['*'];
        }
    }

    /**
     * Parse origins from environment variable
     */
    parseOrigins(origins) {
        if (!origins) return ['http://localhost:3001', 'https://pricepulse.com'];

        // Handle wildcard
        if (origins === '*') return '*';

        // Handle comma-separated list
        return origins.split(',').map(origin => origin.trim()).filter(Boolean);
    }

    /**
     * Dynamic origin validation
     */
    validateOrigin(origin) {
        // Allow wildcard
        if (this.allowedOrigins === '*') return true;

        // Allow localhost in development
        if (process.env.NODE_ENV === 'development') {
            if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
                return true;
            }
        }

        // Check against allowed origins
        return this.allowedOrigins.some(allowed => {
            // Exact match
            if (allowed === origin) return true;

            // Wildcard subdomain match
            if (allowed.startsWith('*.')) {
                const domain = allowed.slice(2);
                return origin && origin.endsWith(domain);
            }

            // Regex match (for advanced patterns)
            if (allowed.startsWith('/') && allowed.endsWith('/')) {
                const regex = new RegExp(allowed.slice(1, -1));
                return regex.test(origin);
            }

            return false;
        });
    }

    /**
     * Get CORS middleware
     */
    getMiddleware() {
        return (req, res, next) => {
            const origin = req.headers.origin;

            // Log CORS requests in development
            if (process.env.NODE_ENV === 'development') {
                logger.debug(`CORS request from: ${origin}`);
            }

            // Check if origin is allowed
            const isAllowed = this.validateOrigin(origin);

            if (isAllowed) {
                // Set CORS headers
                res.setHeader('Access-Control-Allow-Origin', origin || '*');
                res.setHeader('Access-Control-Allow-Methods', this.allowedMethods.join(', '));
                res.setHeader('Access-Control-Allow-Headers', this.allowedHeaders.join(', '));
                res.setHeader('Access-Control-Expose-Headers', this.exposedHeaders.join(', '));
                res.setHeader('Access-Control-Allow-Credentials', String(this.credentials));
                res.setHeader('Access-Control-Max-Age', String(this.maxAge));
            } else {
                // Log blocked requests
                if (origin) {
                    logger.warn(`CORS blocked request from: ${origin}`);
                }
            }

            // Handle preflight
            if (req.method === 'OPTIONS') {
                if (isAllowed) {
                    res.status(this.optionsSuccessStatus).send();
                } else {
                    res.status(403).json({
                        error: 'CORS blocked',
                        message: 'Origin not allowed',
                    });
                }
                return;
            }

            next();
        };
    }

    /**
     * Get allowed origins list (for debugging)
     */
    getAllowedOrigins() {
        return this.allowedOrigins;
    }

    /**
     * Get CORS configuration summary
     */
    getConfigSummary() {
        return {
            allowedOrigins: this.allowedOrigins,
            allowedMethods: this.allowedMethods,
            allowedHeaders: this.allowedHeaders,
            exposedHeaders: this.exposedHeaders,
            credentials: this.credentials,
            maxAge: this.maxAge,
            environment: process.env.NODE_ENV,
        };
    }
}

// Export singleton
const corsConfig = new CorsConfig();
module.exports = corsConfig;