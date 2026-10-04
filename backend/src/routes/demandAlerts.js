// backend/src/routes/demandAlerts.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

const demandAlertController = require('../controllers/demandAlertController');
const { authenticate, isAdmin } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Validation rules
const subscriptionValidation = [
    body('category_id').optional().isInt().withMessage('Invalid category ID'),
    body('product_id').optional().isUUID(4).withMessage('Invalid product ID'),
    body('min_demand_score').optional().isFloat({ min: 0, max: 1 }).withMessage('Score must be between 0 and 1'),
    body('alert_frequency').optional().isIn(['instant', 'daily', 'weekly']).withMessage('Invalid frequency'),
];

const alertIdValidation = [
    param('id').isInt().withMessage('Invalid alert ID format'),
];

// Routes
router.get('/my-alerts',
    authenticate,
    demandAlertController.getMyAlerts
);

router.get('/recent',
    authenticate,
    demandAlertController.getRecentAlerts
);

router.get('/opportunities',
    authenticate,
    demandAlertController.getOpportunities
);

router.get('/stats',
    authenticate,
    demandAlertController.getAlertStats
);

router.patch('/:id/read',
    authenticate,
    alertIdValidation,
    demandAlertController.markAsRead
);

router.patch('/read-all',
    authenticate,
    demandAlertController.markAllAsRead
);

// Subscription routes
router.get('/subscriptions',
    authenticate,
    demandAlertController.getSubscriptions
);

router.post('/subscribe',
    authenticate,
    rateLimiter.auth,
    subscriptionValidation,
    demandAlertController.subscribe
);

router.delete('/unsubscribe',
    authenticate,
    subscriptionValidation,
    demandAlertController.unsubscribe
);

// Admin routes
router.post('/generate',
    authenticate,
    isAdmin,
    demandAlertController.triggerAlertGeneration
);

module.exports = router;