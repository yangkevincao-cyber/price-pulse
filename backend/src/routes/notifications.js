// backend/src/routes/notifications.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const notificationController = require('../controllers/notificationController');
const { authenticate, isAdmin } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Validation rules
const notificationValidation = [
    body('userId').isUUID(4).withMessage('Valid user ID is required'),
    body('type').isString().notEmpty().withMessage('Notification type is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('data').optional().isObject(),
    body('action_url').optional().isString(),
    body('action_label').optional().isString(),
    body('channels').optional().isArray(),
];

const broadcastValidation = [
    body('title').notEmpty().withMessage('Title is required'),
    body('message').notEmpty().withMessage('Message is required'),
    body('type').optional().isString(),
    body('data').optional().isObject(),
    body('action_url').optional().isString(),
    body('action_label').optional().isString(),
    body('channels').optional().isArray(),
    body('userFilter').optional().isIn(['all', 'sellers', 'buyers']).withMessage('Invalid user filter'),
];

const notificationIdValidation = [
    param('id').isInt().withMessage('Invalid notification ID format'),
];

// Routes
router.get('/',
    authenticate,
    notificationController.getNotifications
);

router.get('/types',
    authenticate,
    notificationController.getNotificationTypes
);

router.get('/stats',
    authenticate,
    notificationController.getStats
);

router.get('/preferences',
    authenticate,
    notificationController.getPreferences
);

router.get('/:id',
    authenticate,
    notificationIdValidation,
    notificationController.getNotification
);

router.patch('/preferences',
    authenticate,
    notificationController.updatePreferences
);

router.patch('/:id/read',
    authenticate,
    notificationIdValidation,
    notificationController.markAsRead
);

router.patch('/read-all',
    authenticate,
    notificationController.markAllAsRead
);

router.delete('/:id',
    authenticate,
    notificationIdValidation,
    notificationController.deleteNotification
);

router.delete('/',
    authenticate,
    notificationController.deleteAll
);

// Admin routes
router.post('/send',
    authenticate,
    isAdmin,
    rateLimiter.auth,
    notificationValidation,
    notificationController.sendNotification
);

router.post('/broadcast',
    authenticate,
    isAdmin,
    rateLimiter.auth,
    broadcastValidation,
    notificationController.broadcastNotification
);

router.post('/test',
    authenticate,
    isAdmin,
    notificationController.testNotification
);

module.exports = router;