// backend/src/validators/transactionValidator.js
const { body, param, query } = require('express-validator');

/**
 * Transaction Validators
 * Validates transaction-related requests
 */
class TransactionValidator {
    /**
     * Create transaction validation rules
     */
    create() {
        return [
            body('listingId')
                .notEmpty()
                .withMessage('Listing ID is required')
                .isUUID(4)
                .withMessage('Invalid listing ID format'),

            body('paymentMethod')
                .notEmpty()
                .withMessage('Payment method is required')
                .isIn(['stripe', 'paypal'])
                .withMessage('Invalid payment method'),

            body('shippingAddress')
                .notEmpty()
                .withMessage('Shipping address is required')
                .isObject()
                .withMessage('Shipping address must be an object'),

            body('shippingAddress.street')
                .notEmpty()
                .withMessage('Street address is required')
                .isString()
                .withMessage('Street must be a string'),

            body('shippingAddress.city')
                .notEmpty()
                .withMessage('City is required')
                .isString()
                .withMessage('City must be a string'),

            body('shippingAddress.state')
                .notEmpty()
                .withMessage('State is required')
                .isString()
                .withMessage('State must be a string'),

            body('shippingAddress.postal_code')
                .notEmpty()
                .withMessage('Postal code is required')
                .isString()
                .withMessage('Postal code must be a string'),

            body('shippingAddress.country')
                .notEmpty()
                .withMessage('Country is required')
                .isString()
                .withMessage('Country must be a string'),

            body('notes')
                .optional()
                .isLength({ max: 500 })
                .withMessage('Notes must not exceed 500 characters'),
        ];
    }

    /**
     * Get transaction by ID validation
     */
    getById() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid transaction ID format'),
        ];
    }

    /**
     * Get user transactions validation
     */
    getUserTransactions() {
        return [
            query('page')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Page must be at least 1'),

            query('limit')
                .optional()
                .isInt({ min: 1, max: 100 })
                .withMessage('Limit must be between 1 and 100'),

            query('role')
                .optional()
                .isIn(['buyer', 'seller'])
                .withMessage('Role must be buyer or seller'),

            query('status')
                .optional()
                .isIn(['pending', 'payment_pending', 'payment_processing', 'payment_completed', 'shipping', 'delivered', 'completed', 'cancelled', 'refunded', 'disputed'])
                .withMessage('Invalid status'),
        ];
    }

    /**
     * Mark as shipped validation
     */
    markAsShipped() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid transaction ID format'),

            body('trackingNumber')
                .notEmpty()
                .withMessage('Tracking number is required')
                .isString()
                .withMessage('Tracking number must be a string'),

            body('carrier')
                .notEmpty()
                .withMessage('Carrier is required')
                .isString()
                .withMessage('Carrier must be a string')
                .isIn(['usps', 'ups', 'fedex', 'dhl', 'other'])
                .withMessage('Invalid carrier'),
        ];
    }

    /**
     * Mark as delivered validation
     */
    markAsDelivered() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid transaction ID format'),
        ];
    }

    /**
     * Cancel transaction validation
     */
    cancel() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid transaction ID format'),

            body('reason')
                .optional()
                .isString()
                .withMessage('Reason must be a string'),
        ];
    }

    /**
     * Get transaction status validation
     */
    getStatus() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid transaction ID format'),
        ];
    }

    /**
     * Get transaction stats validation
     */
    getStats() {
        return [
            query('role')
                .optional()
                .isIn(['buyer', 'seller'])
                .withMessage('Role must be buyer or seller'),
        ];
    }
}

module.exports = new TransactionValidator();