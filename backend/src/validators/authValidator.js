// backend/src/validators/authValidator.js
const { body, param } = require('express-validator');
const { User } = require('../models');

/**
 * Authentication Validators
 * Validates auth-related requests
 */
class AuthValidator {
    /**
     * Register validation rules
     */
    register() {
        return [
            body('email')
                .notEmpty()
                .withMessage('Email is required')
                .isEmail()
                .withMessage('Invalid email format')
                .normalizeEmail()
                .custom(async (email) => {
                    const user = await User.findOne({
                        where: { email: email.toLowerCase() }
                    });
                    if (user) {
                        throw new Error('Email already registered');
                    }
                    return true;
                }),

            body('username')
                .notEmpty()
                .withMessage('Username is required')
                .isLength({ min: 3, max: 30 })
                .withMessage('Username must be between 3 and 30 characters')
                .matches(/^[a-zA-Z0-9_]+$/)
                .withMessage('Username can only contain letters, numbers, and underscores')
                .custom(async (username) => {
                    const user = await User.findOne({
                        where: { username: username.toLowerCase() }
                    });
                    if (user) {
                        throw new Error('Username already taken');
                    }
                    return true;
                }),

            body('password')
                .notEmpty()
                .withMessage('Password is required')
                .isLength({ min: 8 })
                .withMessage('Password must be at least 8 characters')
                .matches(/[A-Z]/)
                .withMessage('Password must contain at least one uppercase letter')
                .matches(/[a-z]/)
                .withMessage('Password must contain at least one lowercase letter')
                .matches(/[0-9]/)
                .withMessage('Password must contain at least one number')
                .matches(/[^A-Za-z0-9]/)
                .withMessage('Password must contain at least one special character'),

            body('firstName')
                .notEmpty()
                .withMessage('First name is required')
                .isLength({ min: 2, max: 50 })
                .withMessage('First name must be between 2 and 50 characters')
                .matches(/^[a-zA-Z\s'-]+$/)
                .withMessage('First name can only contain letters, spaces, apostrophes, and hyphens'),

            body('lastName')
                .notEmpty()
                .withMessage('Last name is required')
                .isLength({ min: 2, max: 50 })
                .withMessage('Last name must be between 2 and 50 characters')
                .matches(/^[a-zA-Z\s'-]+$/)
                .withMessage('Last name can only contain letters, spaces, apostrophes, and hyphens'),

            body('role')
                .optional()
                .isIn(['buyer', 'seller'])
                .withMessage('Role must be either buyer or seller'),
        ];
    }

    /**
     * Login validation rules
     */
    login() {
        return [
            body('email')
                .notEmpty()
                .withMessage('Email is required')
                .isEmail()
                .withMessage('Invalid email format')
                .normalizeEmail(),

            body('password')
                .notEmpty()
                .withMessage('Password is required'),
        ];
    }

    /**
     * Social login validation rules
     */
    socialLogin() {
        return [
            body('provider')
                .notEmpty()
                .withMessage('Provider is required')
                .isIn(['google', 'facebook', 'apple'])
                .withMessage('Invalid provider'),

            body('accessToken')
                .notEmpty()
                .withMessage('Access token is required'),
        ];
    }

    /**
     * Refresh token validation rules
     */
    refreshToken() {
        return [
            body('refreshToken')
                .notEmpty()
                .withMessage('Refresh token is required'),
        ];
    }

    /**
     * Password reset request validation rules
     */
    requestPasswordReset() {
        return [
            body('email')
                .notEmpty()
                .withMessage('Email is required')
                .isEmail()
                .withMessage('Invalid email format')
                .normalizeEmail(),
        ];
    }

    /**
     * Reset password validation rules
     */
    resetPassword() {
        return [
            body('token')
                .notEmpty()
                .withMessage('Reset token is required'),

            body('newPassword')
                .notEmpty()
                .withMessage('New password is required')
                .isLength({ min: 8 })
                .withMessage('Password must be at least 8 characters')
                .matches(/[A-Z]/)
                .withMessage('Password must contain at least one uppercase letter')
                .matches(/[a-z]/)
                .withMessage('Password must contain at least one lowercase letter')
                .matches(/[0-9]/)
                .withMessage('Password must contain at least one number')
                .matches(/[^A-Za-z0-9]/)
                .withMessage('Password must contain at least one special character'),
        ];
    }

    /**
     * Change password validation rules
     */
    changePassword() {
        return [
            body('currentPassword')
                .notEmpty()
                .withMessage('Current password is required'),

            body('newPassword')
                .notEmpty()
                .withMessage('New password is required')
                .isLength({ min: 8 })
                .withMessage('Password must be at least 8 characters')
                .custom((value, { req }) => {
                    if (value === req.body.currentPassword) {
                        throw new Error('New password must be different from current password');
                    }
                    return true;
                }),
        ];
    }

    /**
     * Email verification validation rules
     */
    verifyEmail() {
        return [
            param('token')
                .notEmpty()
                .withMessage('Verification token is required'),
        ];
    }

    /**
     * Resend verification validation rules
     */
    resendVerification() {
        return [
            body('email')
                .notEmpty()
                .withMessage('Email is required')
                .isEmail()
                .withMessage('Invalid email format')
                .normalizeEmail(),
        ];
    }

    /**
     * Profile update validation rules
     */
    updateProfile() {
        return [
            body('firstName')
                .optional()
                .isLength({ min: 2, max: 50 })
                .withMessage('First name must be between 2 and 50 characters')
                .matches(/^[a-zA-Z\s'-]+$/)
                .withMessage('First name can only contain letters, spaces, apostrophes, and hyphens'),

            body('lastName')
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
}

module.exports = new AuthValidator();