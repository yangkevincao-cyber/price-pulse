// backend/src/validators/listingValidator.js
const { body, param, query } = require('express-validator');

/**
 * Listing Validators
 * Validates listing-related requests
 */
class ListingValidator {
    /**
     * Create listing validation rules
     */
    create() {
        return [
            body('product_id')
                .notEmpty()
                .withMessage('Product ID is required')
                .isUUID(4)
                .withMessage('Invalid product ID format'),

            body('title')
                .notEmpty()
                .withMessage('Title is required')
                .isLength({ min: 5, max: 500 })
                .withMessage('Title must be between 5 and 500 characters'),

            body('description')
                .optional()
                .isLength({ max: 5000 })
                .withMessage('Description must not exceed 5000 characters'),

            body('price')
                .notEmpty()
                .withMessage('Price is required')
                .isFloat({ min: 0 })
                .withMessage('Price must be a positive number'),

            body('original_price')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Original price must be a positive number')
                .custom((value, { req }) => {
                    if (value && value < req.body.price) {
                        throw new Error('Original price must be greater than current price');
                    }
                    return true;
                }),

            body('condition')
                .notEmpty()
                .withMessage('Condition is required')
                .isIn(['new', 'like-new', 'good', 'fair', 'poor'])
                .withMessage('Invalid condition'),

            body('quantity')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Quantity must be at least 1'),

            body('images')
                .optional()
                .isArray()
                .withMessage('Images must be an array'),

            body('images.*')
                .optional()
                .isURL()
                .withMessage('Invalid image URL'),

            body('shipping_cost')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Shipping cost must be a positive number'),

            body('shipping_from_country')
                .optional()
                .isString()
                .withMessage('Shipping country must be a string'),

            body('shipping_from_city')
                .optional()
                .isString()
                .withMessage('Shipping city must be a string'),

            body('accepts_offers')
                .optional()
                .isBoolean()
                .withMessage('accepts_offers must be a boolean'),

            body('min_offer_price')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Minimum offer price must be a positive number')
                .custom((value, { req }) => {
                    if (value && value > req.body.price) {
                        throw new Error('Minimum offer price must be less than current price');
                    }
                    return true;
                }),
        ];
    }

    /**
     * Update listing validation rules
     */
    update() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid listing ID format'),

            body('title')
                .optional()
                .isLength({ min: 5, max: 500 })
                .withMessage('Title must be between 5 and 500 characters'),

            body('description')
                .optional()
                .isLength({ max: 5000 })
                .withMessage('Description must not exceed 5000 characters'),

            body('price')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Price must be a positive number'),

            body('original_price')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Original price must be a positive number')
                .custom((value, { req }) => {
                    if (value && req.body.price && value < req.body.price) {
                        throw new Error('Original price must be greater than current price');
                    }
                    return true;
                }),

            body('condition')
                .optional()
                .isIn(['new', 'like-new', 'good', 'fair', 'poor'])
                .withMessage('Invalid condition'),

            body('quantity')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Quantity must be at least 1'),

            body('shipping_cost')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Shipping cost must be a positive number'),

            body('accepts_offers')
                .optional()
                .isBoolean()
                .withMessage('accepts_offers must be a boolean'),

            body('min_offer_price')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Minimum offer price must be a positive number'),
        ];
    }

    /**
     * Get listing by ID validation
     */
    getById() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid listing ID format'),
        ];
    }

    /**
     * Get listings validation
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

            query('productId')
                .optional()
                .isUUID(4)
                .withMessage('Invalid product ID format'),

            query('sellerId')
                .optional()
                .isUUID(4)
                .withMessage('Invalid seller ID format'),

            query('search')
                .optional()
                .isString()
                .withMessage('Search query must be a string'),

            query('minPrice')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Minimum price must be a positive number'),

            query('maxPrice')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Maximum price must be a positive number'),

            query('condition')
                .optional()
                .isIn(['new', 'like-new', 'good', 'fair', 'poor'])
                .withMessage('Invalid condition'),

            query('sortBy')
                .optional()
                .isIn(['created_at', 'price', 'views', 'clicks'])
                .withMessage('Invalid sort field'),

            query('sortOrder')
                .optional()
                .isIn(['ASC', 'DESC'])
                .withMessage('Sort order must be ASC or DESC'),

            query('inStock')
                .optional()
                .isBoolean()
                .withMessage('inStock must be a boolean'),
        ];
    }

    /**
     * Delete listing validation
     */
    delete() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid listing ID format'),
        ];
    }

    /**
     * Toggle listing status validation
     */
    toggleStatus() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid listing ID format'),
        ];
    }

    /**
     * Upload images validation
     */
    uploadImages() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid listing ID format'),
        ];
    }

    /**
     * Delete image validation
     */
    deleteImage() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid listing ID format'),

            param('imageIndex')
                .isInt({ min: 0 })
                .withMessage('Invalid image index'),
        ];
    }
}

module.exports = new ListingValidator();