// backend/src/middleware/logger.js
const { logger } = require('../config/logger');

/**
 * Request Logger Middleware
 * Logs all incoming requests
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log request
    logger.info(`Incoming request`, {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id,
        requestId: req.id,
    });

    // Log response on finish
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 400 ? 'error' : 'info';

        logger[logLevel](`Request completed`, {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            userId: req.user?.id,
            requestId: req.id,
        });
    });

    next();
};

/**
 * Error Logger Middleware
 * Logs all errors
 */
const errorLogger = (err, req, res, next) => {
    logger.error(`Error occurred`, {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        ip: req.ip,
        requestId: req.id,
    });
    next(err);
};

module.exports = {
    requestLogger,
    errorLogger,
};