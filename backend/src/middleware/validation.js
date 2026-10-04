// backend/src/middleware/validation.js
const { validationResult } = require('express-validator');
const { logger } = require('../config/logger');

/**
 * Validation error handler
 * Checks for validation errors and returns formatted response
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
        return next();
    }

    // Format errors
    const formattedErrors = errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value,
    }));

    logger.warn('Validation error', {
        path: req.path,
        method: req.method,
        errors: formattedErrors,
        body: req.body,
    });

    return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: formattedErrors,
    });
};

/**
 * Custom validation for IDs
 */
const isValidUUID = (value) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
};

/**
 * Custom validation for phone numbers
 */
const isValidPhone = (value) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(value);
};

/**
 * Custom validation for URLs
 */
const isValidUrl = (value) => {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
};

/**
 * Sanitize input
 */
const sanitize = (value) => {
    if (typeof value === 'string') {
        // Remove HTML tags
        return value.replace(/<[^>]*>/g, '');
    }
    return value;
};

/**
 * Sanitize request body
 */
const sanitizeBody = (fields = []) => {
    return (req, res, next) => {
        if (fields.length === 0) {
            // Sanitize all string fields
            for (const key in req.body) {
                if (typeof req.body[key] === 'string') {
                    req.body[key] = sanitize(req.body[key]);
                }
            }
        } else {
            // Sanitize specific fields
            for (const field of fields) {
                if (req.body[field] && typeof req.body[field] === 'string') {
                    req.body[field] = sanitize(req.body[field]);
                }
            }
        }
        next();
    };
};

/**
 * Check if email is valid
 */
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Check if password meets requirements
 */
const isStrongPassword = (password) => {
    const requirements = {
        minLength: 8,
        hasUpperCase: /[A-Z]/.test(password),
        hasLowerCase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    return password.length >= requirements.minLength &&
        requirements.hasUpperCase &&
        requirements.hasLowerCase &&
        requirements.hasNumber &&
        requirements.hasSpecialChar;
};

/**
 * Check if date is valid
 */
const isValidDate = (date) => {
    const d = new Date(date);
    return d instanceof Date && !isNaN(d);
};

/**
 * Check if value is in array
 */
const isInArray = (value, array) => {
    return array.includes(value);
};

module.exports = {
    validate,
    sanitize,
    sanitizeBody,
    isValidUUID,
    isValidPhone,
    isValidUrl,
    isValidEmail,
    isStrongPassword,
    isValidDate,
    isInArray,
};