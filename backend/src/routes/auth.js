// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Validation rules
const registerValidation = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('username').isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/).withMessage('Password must contain at least one special character'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('role').optional().isIn(['buyer', 'seller']).withMessage('Invalid role'),
];

const loginValidation = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
];

const passwordResetValidation = [
    body('email').isEmail().withMessage('Valid email is required'),
];

const changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
];

const socialLoginValidation = [
    body('provider').isIn(['google', 'facebook', 'apple']).withMessage('Invalid provider'),
    body('accessToken').notEmpty().withMessage('Access token is required'),
];

// Routes
router.post('/register',
    rateLimiter.register,
    registerValidation,
    authController.register
);

router.post('/login',
    rateLimiter.login,
    loginValidation,
    authController.login
);

router.post('/social-login',
    rateLimiter.login,
    socialLoginValidation,
    authController.socialLogin
);

router.post('/refresh-token',
    rateLimiter.auth,
    authController.refreshToken
);

router.post('/logout',
    authenticate,
    authController.logout
);

router.get('/verify-email/:token',
    authController.verifyEmail
);

router.post('/resend-verification',
    rateLimiter.auth,
    authController.resendVerification
);

router.post('/request-password-reset',
    rateLimiter.auth,
    passwordResetValidation,
    authController.requestPasswordReset
);

router.post('/reset-password',
    rateLimiter.auth,
    authController.resetPassword
);

router.post('/change-password',
    authenticate,
    rateLimiter.auth,
    changePasswordValidation,
    authController.changePassword
);

router.get('/profile',
    authenticate,
    authController.getProfile
);

router.put('/profile',
    authenticate,
    authController.updateProfile
);

router.post('/deactivate',
    authenticate,
    authController.deactivateAccount
);

router.delete('/account',
    authenticate,
    authController.deleteAccount
);

router.post('/revoke-tokens',
    authenticate,
    authController.revokeAllTokens
);

router.get('/check',
    authenticate,
    authController.checkAuth
);

module.exports = router;