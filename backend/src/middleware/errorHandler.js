// backend/src/middleware/errorHandler.js
const { logger } = require('../config/logger');

/**
 * Global Error Handler
 * Catches all errors and returns formatted response
 */
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const errorMessage = err.message || 'Internal server error';
    const errorCode = err.code || 'INTERNAL_ERROR';

    // Log error
    logger.error('Error occurred', {
        code: errorCode,
        message: errorMessage,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id,
    });

    // Mongoose validation error
    if (err.name === 'SequelizeValidationError') {
        const errors = err.errors.map(e => ({
            field: e.path,
            message: e.message,
            value: e.value,
        }));
        return res.status(400).json({
            success: false,
            error: 'Validation error',
            code: 'VALIDATION_ERROR',
            errors,
        });
    }

    // Sequelize unique constraint error
    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            success: false,
            error: 'Resource already exists',
            code: 'DUPLICATE_RESOURCE',
            details: err.errors.map(e => e.message),
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: 'Invalid token',
            code: 'INVALID_TOKEN',
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: 'Token expired',
            code: 'TOKEN_EXPIRED',
        });
    }

    // Multer errors
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large',
                code: 'FILE_TOO_LARGE',
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                error: 'Unexpected file',
                code: 'UNEXPECTED_FILE',
            });
        }
        return res.status(400).json({
            success: false,
            error: err.message,
            code: 'FILE_ERROR',
        });
    }

    // Development error details
    if (process.env.NODE_ENV === 'development') {
        return res.status(statusCode).json({
            success: false,
            error: errorMessage,
            code: errorCode,
            stack: err.stack,
            details: err.details || null,
        });
    }

    // Production error response
    return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        code: errorCode,
    });
};

/**
 * 404 Not Found Handler
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        code: 'ROUTE_NOT_FOUND',
        path: req.path,
        method: req.method,
    });
};

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
};