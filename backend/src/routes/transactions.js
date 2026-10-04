// backend/src/routes/transactions.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

const transactionController = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Validation rules
const transactionValidation = [
    body('listingId').isUUID(4).withMessage('Valid listing ID is required'),
    body('paymentMethod').isIn(['stripe', 'paypal']).withMessage('Invalid payment method'),
    body('shippingAddress').isObject().withMessage('Shipping address is required'),
    body('shippingAddress.street').notEmpty().withMessage('Street is required'),
    body('shippingAddress.city').notEmpty().withMessage('City is required'),
    body('shippingAddress.state').notEmpty().withMessage('State is required'),
    body('shippingAddress.postal_code').notEmpty().withMessage('Postal code is required'),
    body('shippingAddress.country').notEmpty().withMessage('Country is required'),
    body('notes').optional().isString(),
];

const transactionIdValidation = [
    param('id').isUUID(4).withMessage('Invalid transaction ID format'),
];

const shippingValidation = [
    body('trackingNumber').notEmpty().withMessage('Tracking number is required'),
    body('carrier').notEmpty().withMessage('Carrier is required'),
];

// Routes
router.get('/',
    authenticate,
    transactionController.getUserTransactions
);

router.get('/stats',
    authenticate,
    transactionController.getTransactionStats
);

router.get('/:id',
    authenticate,
    transactionIdValidation,
    transactionController.getTransaction
);

router.get('/:id/status',
    authenticate,
    transactionIdValidation,
    transactionController.getTransactionStatus
);

router.post('/',
    authenticate,
    rateLimiter.transaction,
    transactionValidation,
    transactionController.createTransaction
);

router.patch('/:id/shipped',
    authenticate,
    transactionIdValidation,
    shippingValidation,
    transactionController.markAsShipped
);

router.patch('/:id/delivered',
    authenticate,
    transactionIdValidation,
    transactionController.markAsDelivered
);

router.patch('/:id/cancel',
    authenticate,
    transactionIdValidation,
    transactionController.cancelTransaction
);

module.exports = router;