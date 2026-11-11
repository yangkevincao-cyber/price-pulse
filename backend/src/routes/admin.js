// backend/src/routes/admin.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

const adminController = require('../controllers/adminController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Validation rules
const userUpdateValidation = [
    body('role').optional().isIn(['buyer', 'seller', 'admin']).withMessage('Invalid role'),
    body('is_active').optional().isBoolean(),
    body('is_verified').optional().isBoolean(),
];

const userIdValidation = [
    param('id').isUUID(4).withMessage('Invalid user ID format'),
];

const fraudReviewValidation = [
    body('resolution').isIn(['none', 'flagged', 'blocked', 'reviewed', 'user_suspended', 'user_banned'])
        .withMessage('Invalid resolution'),
    body('notes').optional().isString(),
];

const reportValidation = [
    query('type').optional().isIn(['sales', 'marketing', 'system']).withMessage('Invalid report type'),
    query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period'),
    query('format').optional().isIn(['json', 'pdf', 'csv']).withMessage('Invalid format'),
];

// Dashboard
router.get('/metrics',
    authenticate,
    isAdmin,
    adminController.getMetrics
);

router.get('/system-status',
    authenticate,
    isAdmin,
    adminController.getSystemStatus
);

router.get('/logs',
    authenticate,
    isAdmin,
    adminController.getLogs
);

// User management
router.get('/users',
    authenticate,
    isAdmin,
    adminController.getUsers
);

router.get('/users/:id',
    authenticate,
    isAdmin,
    userIdValidation,
    adminController.getUserById
);

router.put('/users/:id',
    authenticate,
    isAdmin,
    userIdValidation,
    userUpdateValidation,
    adminController.updateUser
);

router.delete('/users/:id',
    authenticate,
    isAdmin,
    userIdValidation,
    adminController.deleteUser
);

// Reports
router.get('/report',
    authenticate,
    isAdmin,
    reportValidation,
    adminController.generateReport
);

// Cache management
router.post('/cache/clear',
    authenticate,
    isAdmin,
    adminController.clearCache
);

// Fraud management
router.get('/fraud-cases',
    authenticate,
    isAdmin,
    adminController.getFraudCases
);

router.post('/fraud-cases/:id/review',
    authenticate,
    isAdmin,
    fraudReviewValidation,
    adminController.reviewFraudCase
);

module.exports = router;