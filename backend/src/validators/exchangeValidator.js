// backend/src/validators/exchangeValidator.js
const { body, param, query } = require('express-validator');

/**
 * Exchange Validators
 * Validates exchange-related requests
 */
class ExchangeValidator {
    /**
     * Create exchange listing validation rules
     */
    create() {
        return [
            body('offered_product_id')
                .notEmpty()
                .withMessage('Offered product ID is required')
                .isUUID(4)
                .withMessage('Invalid product ID format'),

            body('offered_condition')
                .notEmpty()
                .withMessage('Offered condition is required')
                .isIn(['new', 'like-new', 'good', 'fair', 'poor'])
                .withMessage('Invalid condition'),

            body('offered_quantity')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Quantity must be at least 1'),

            body('wanted_product_id')
                .optional()
                .isUUID(4)
                .withMessage('Invalid product ID format'),

            body('wanted_product_name')
                .optional()
                .isString()
                .withMessage('Wanted product name must be a string'),

            body('wanted_condition')
                .optional()
                .isIn(['new', 'like-new', 'good', 'fair', 'poor', 'any'])
                .withMessage('Invalid condition'),

            body('wanted_category_id')
                .optional()
                .isInt()
                .withMessage('Invalid category ID'),

            body('cash_adjustment')
                .optional()
                .isFloat()
                .withMessage('Cash adjustment must be a number'),

            body('notes')
                .optional()
                .isLength({ max: 1000 })
                .withMessage('Notes must not exceed 1000 characters'),
        ];
    }

    /**
     * Update exchange listing validation rules
     */
    update() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid exchange ID format'),

            body('offered_condition')
                .optional()
                .isIn(['new', 'like-new', 'good', 'fair', 'poor'])
                .withMessage('Invalid condition'),

            body('offered_quantity')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Quantity must be at least 1'),

            body('wanted_product_id')
                .optional()
                .isUUID(4)
                .withMessage('Invalid product ID format'),

            body('wanted_product_name')
                .optional()
                .isString()
                .withMessage('Wanted product name must be a string'),

            body('wanted_condition')
                .optional()
                .isIn(['new', 'like-new', 'good', 'fair', 'poor', 'any'])
                .withMessage('Invalid condition'),

            body('cash_adjustment')
                .optional()
                .isFloat()
                .withMessage('Cash adjustment must be a number'),

            body('notes')
                .optional()
                .isLength({ max: 1000 })
                .withMessage('Notes must not exceed 1000 characters'),
        ];
    }

    /**
     * Get exchange listing by ID validation
     */
    getById() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid exchange ID format'),
        ];
    }

    /**
     * Get exchange listings validation
     */
    getListings() {
        return [
            query('page')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Page must be at least 1'),

            query('limit')
                .optional()
                .isInt({ min: 1, max: 100 })
                .withMessage('Limit must be between 1 and 100'),

            query('categoryId')
                .optional()
                .isInt()
                .withMessage('Invalid category ID'),

            query('search')
                .optional()
                .isString()
                .withMessage('Search query must be a string'),

            query('condition')
                .optional()
                .isIn(['new', 'like-new', 'good', 'fair', 'poor'])
                .withMessage('Invalid condition'),

            query('sortBy')
                .optional()
                .isIn(['created_at', 'match_score', 'cash_adjustment'])
                .withMessage('Invalid sort field'),

            query('sortOrder')
                .optional()
                .isIn(['ASC', 'DESC'])
                .withMessage('Sort order must be ASC or DESC'),
        ];
    }

    /**
     * Delete exchange listing validation
     */
    delete() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid exchange ID format'),
        ];
    }

    /**
     * Accept match validation
     */
    acceptMatch() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid exchange ID format'),
        ];
    }

    /**
     * Decline match validation
     */
    declineMatch() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid exchange ID format'),
        ];
    }
}

module.exports = new ExchangeValidator();