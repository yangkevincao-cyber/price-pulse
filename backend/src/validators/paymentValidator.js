// backend/src/validators/paymentValidator.js
const { body, param, query } = require('express-validator');

/**
 * Payment Validators
 * Validates payment-related requests
 */
class PaymentValidator {
    /**
     * Create Stripe payment validation rules
     */
    createStripePayment() {
        return [
            body('amount')
                .notEmpty()
                .withMessage('Amount is required')
                .isFloat({ min: 0.01 })
                .withMessage('Amount must be at least 0.01'),

            body('currency')
                .optional()
                .isString()
                .isLength({ min: 3, max: 3 })
                .withMessage('Currency must be a 3-letter code'),

            body('transactionId')
                .notEmpty()
                .withMessage('Transaction ID is required')
                .isUUID(4)
                .withMessage('Invalid transaction ID format'),

            body('listingId')
                .notEmpty()
                .withMessage('Listing ID is required')
                .isUUID(4)
                .withMessage('Invalid listing ID format'),

            body('sellerId')
                .notEmpty()
                .withMessage('Seller ID is required')
                .isUUID(4)
                .withMessage('Invalid seller ID format'),

            body('productId')
                .notEmpty()
                .withMessage('Product ID is required')
                .isUUID(4)
                .withMessage('Invalid product ID format'),
        ];
    }

    /**
     * Confirm Stripe payment validation rules
     */
    confirmStripePayment() {
        return [
            body('paymentIntentId')
                .notEmpty()
                .withMessage('Payment intent ID is required'),
        ];
    }

    /**
     * Create PayPal order validation rules
     */
    createPaypalOrder() {
        return [
            body('amount')
                .notEmpty()
                .withMessage('Amount is required')
                .isFloat({ min: 0.01 })
                .withMessage('Amount must be at least 0.01'),

            body('currency')
                .optional()
                .isString()
                .isLength({ min: 3, max: 3 })
                .withMessage('Currency must be a 3-letter code'),

            body('transactionId')
                .notEmpty()
                .withMessage('Transaction ID is required')
                .isUUID(4)
                .withMessage('Invalid transaction ID format'),

            body('listingId')
                .notEmpty()
                .withMessage('Listing ID is required')
                .isUUID(4)
                .withMessage('Invalid listing ID format'),

            body('sellerId')
                .notEmpty()
                .withMessage('Seller ID is required')
                .isUUID(4)
                .withMessage('Invalid seller ID format'),

            body('productId')
                .notEmpty()
                .withMessage('Product ID is required')
                .isUUID(4)
                .withMessage('Invalid product ID format'),
        ];
    }

    /**
     * Capture PayPal order validation rules
     */
    capturePaypalOrder() {
        return [
            body('orderId')
                .notEmpty()
                .withMessage('Order ID is required'),
        ];
    }

    /**
     * Get payment by ID validation
     */
    getById() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid payment ID format'),
        ];
    }

    /**
     * Request refund validation rules
     */
    requestRefund() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid payment ID format'),

            body('reason')
                .optional()
                .isString()
                .withMessage('Reason must be a string'),

            body('amount')
                .optional()
                .isFloat({ min: 0.01 })
                .withMessage('Refund amount must be at least 0.01')
                .custom((value, { req }) => {
                    if (value && value > req.body.totalAmount) {
                        throw new Error('Refund amount cannot exceed payment amount');
                    }
                    return true;
                }),
        ];
    }

    /**
     * Get transactions validation
     */
    getTransactions() {
        return [
            query('page')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Page must be at least 1'),

            query('limit')
                .optional()
                .isInt({ min: 1, max: 100 })
                .withMessage('Limit must be between 1 and 100'),

            query('status')
                .optional()
                .isIn(['pending', 'processing', 'succeeded', 'failed', 'refunded'])
                .withMessage('Invalid status'),
        ];
    }

    /**
     * Create Connect account validation
     */
    createConnectAccount() {
        return [
            body('email')
                .optional()
                .isEmail()
                .withMessage('Invalid email format'),

            body('country')
                .optional()
                .isString()
                .isLength({ min: 2, max: 2 })
                .withMessage('Country must be a 2-letter code'),
        ];
    }
}

module.exports = new PaymentValidator();