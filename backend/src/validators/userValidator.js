// backend/src/validators/userValidator.js
const { body, param, query } = require('express-validator');

/**
 * User Validators
 * Validates user-related requests
 */
class UserValidator {
    /**
     * Get user by ID validation
     */
    getById() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid user ID format'),
        ];
    }

    /**
     * Update profile validation rules
     */
    updateProfile() {
        return [
            body('first_name')
                .optional()
                .isLength({ min: 2, max: 50 })
                .withMessage('First name must be between 2 and 50 characters')
                .matches(/^[a-zA-Z\s'-]+$/)
                .withMessage('First name can only contain letters, spaces, apostrophes, and hyphens'),

            body('last_name')
                .optional()
                .isLength({ min: 2, max: 50 })
                .withMessage('Last name must be between 2 and 50 characters')
                .matches(/^[a-zA-Z\s'-]+$/)
                .withMessage('Last name can only contain letters, spaces, apostrophes, and hyphens'),

            body('bio')
                .optional()
                .isLength({ max: 500 })
                .withMessage('Bio must not exceed 500 characters'),

            body('phone')
                .optional()
                .matches(/^\+?[1-9]\d{1,14}$/)
                .withMessage('Invalid phone number format'),

            body('location_country')
                .optional()
                .isString()
                .withMessage('Country must be a string'),

            body('location_city')
                .optional()
                .isString()
                .withMessage('City must be a string'),

            body('location_lat')
                .optional()
                .isFloat({ min: -90, max: 90 })
                .withMessage('Invalid latitude'),

            body('location_lng')
                .optional()
                .isFloat({ min: -180, max: 180 })
                .withMessage('Invalid longitude'),

            body('avatar')
                .optional()
                .isURL()
                .withMessage('Invalid avatar URL'),

            body('preferences')
                .optional()
                .isObject()
                .withMessage('Preferences must be an object'),
        ];
    }

    /**
     * Update settings validation rules
     */
    updateSettings() {
        return [
            body('preferences')
                .optional()
                .isObject()
                .withMessage('Preferences must be an object'),

            body('preferences.notifications')
                .optional()
                .isObject()
                .withMessage('Notification preferences must be an object'),

            body('preferences.notifications.email')
                .optional()
                .isBoolean()
                .withMessage('Email preference must be a boolean'),

            body('preferences.notifications.push')
                .optional()
                .isBoolean()
                .withMessage('Push preference must be a boolean'),

            body('preferences.notifications.sms')
                .optional()
                .isBoolean()
                .withMessage('SMS preference must be a boolean'),

            body('preferences.notifications.in_app')
                .optional()
                .isBoolean()
                .withMessage('In-app preference must be a boolean'),

            body('phone')
                .optional()
                .matches(/^\+?[1-9]\d{1,14}$/)
                .withMessage('Invalid phone number format'),

            body('location_country')
                .optional()
                .isString()
                .withMessage('Country must be a string'),
        ];
    }

    /**
     * Upload avatar validation
     */
    uploadAvatar() {
        return [
            // No validation needed for file upload
            // File validation is handled by multer
        ];
    }

    /**
     * Get user notifications validation
     */
    getNotifications() {
        return [
            query('page')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Page must be at least 1'),

            query('limit')
                .optional()
                .isInt({ min: 1, max: 100 })
                .withMessage('Limit must be between 1 and 100'),

            query('unreadOnly')
                .optional()
                .isBoolean()
                .withMessage('unreadOnly must be a boolean'),
        ];
    }

    /**
     * Mark notification as read validation
     */
    markNotificationRead() {
        return [
            param('id')
                .isInt()
                .withMessage('Invalid notification ID'),
        ];
    }
}

module.exports = new UserValidator();