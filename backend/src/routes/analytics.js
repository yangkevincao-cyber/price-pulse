// backend/src/routes/analytics.js
const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');

const analyticsController = require('../controllers/analyticsController');
const { authenticate, isAdmin } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Validation rules
const eventValidation = [
    body('type').isString().notEmpty().withMessage('Event type is required'),
    body('productId').optional().isUUID(4).withMessage('Invalid product ID'),
    body('listingId').optional().isUUID(4).withMessage('Invalid listing ID'),
    body('data').optional().isObject(),
];

const reportValidation = [
    query('type').optional().isIn(['sales', 'marketing', 'seller', 'product', 'user']).withMessage('Invalid report type'),
    query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period'),
    query('format').optional().isIn(['json', 'pdf', 'csv']).withMessage('Invalid format'),
    query('sellerId').optional().isUUID(4).withMessage('Invalid seller ID'),
    query('productId').optional().isUUID(4).withMessage('Invalid product ID'),
    query('userId').optional().isUUID(4).withMessage('Invalid user ID'),
];

// Routes
router.post('/track',
    authenticate,
    eventValidation,
    analyticsController.trackEvent
);

router.get('/seller',
    authenticate,
    analyticsController.getSellerAnalytics
);

router.get('/platform',
    authenticate,
    isAdmin,
    analyticsController.getPlatformAnalytics
);

router.get('/funnel',
    authenticate,
    analyticsController.getConversionFunnel
);

router.get('/realtime',
    authenticate,
    analyticsController.getRealtimeStats
);

router.get('/system',
    authenticate,
    isAdmin,
    analyticsController.getSystemMetrics
);

router.get('/historical',
    authenticate,
    isAdmin,
    analyticsController.getHistoricalMetrics
);

router.get('/report',
    authenticate,
    reportValidation,
    analyticsController.generateReport
);

router.get('/dashboard',
    authenticate,
    analyticsController.getDashboardSummary
);

router.get('/performance',
    authenticate,
    analyticsController.getProductPerformance
);

router.get('/insights',
    authenticate,
    analyticsController.getBuyerInsights
);

router.get('/export',
    authenticate,
    analyticsController.exportAnalytics
);

module.exports = router;