// backend/src/routes/payments.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

const paymentController = require('../controllers/paymentController');
const { authenticate, isAdmin } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Validation rules
const stripePaymentValidation = [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be at least 0.01'),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('transactionId').isUUID(4).withMessage('Valid transaction ID is required'),
    body('listingId').isUUID(4).withMessage('Valid listing ID is required'),
    body('sellerId').isUUID(4).withMessage('Valid seller ID is required'),
    body('productId').isUUID(4).withMessage('Valid product ID is required'),
];

const paypalOrderValidation = [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be at least 0.01'),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('transactionId').isUUID(4).withMessage('Valid transaction ID is required'),
    body('listingId').isUUID(4).withMessage('Valid listing ID is required'),
    body('sellerId').isUUID(4).withMessage('Valid seller ID is required'),
    body('productId').isUUID(4).withMessage('Valid product ID is required'),
];

const paymentIdValidation = [
    param('id').isUUID(4).withMessage('Invalid payment ID format'),
];

const refundValidation = [
    body('reason').optional().isString(),
    body('amount').optional().isFloat({ min: 0.01 }).withMessage('Refund amount must be positive'),
];

// Routes
router.get('/transactions',
    authenticate,
    paymentController.getTransactions
);

router.get('/summary',
    authenticate,
    paymentController.getPaymentSummary
);

router.get('/:id',
    authenticate,
    paymentIdValidation,
    paymentController.getPaymentById
);

// Stripe routes
router.post('/stripe/create-payment',
    authenticate,
    rateLimiter.transaction,
    stripePaymentValidation,
    paymentController.createStripePayment
);

router.post('/stripe/confirm',
    authenticate,
    paymentController.confirmStripePayment
);

router.post('/stripe/create-connect-account',
    authenticate,
    paymentController.createConnectAccount
);

router.post('/stripe/webhook',
    express.raw({ type: 'application/json' }),
    paymentController.handleStripeWebhook
);

// PayPal routes
router.post('/paypal/create-order',
    authenticate,
    rateLimiter.transaction,
    paypalOrderValidation,
    paymentController.createPaypalOrder
);

router.post('/paypal/capture',
    authenticate,
    paymentController.capturePaypalOrder
);

router.post('/paypal/webhook',
    express.raw({ type: 'application/json' }),
    paymentController.handlePaypalWebhook
);

// Refund routes
router.post('/:id/refund',
    authenticate,
    paymentIdValidation,
    refundValidation,
    paymentController.requestRefund
);

module.exports = router;