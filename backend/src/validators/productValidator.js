// backend/src/validators/productValidator.js
const { body, param, query } = require('express-validator');

/**
 * Product Validators
 * Validates product-related requests
 */
class ProductValidator {
    /**
     * Create product validation rules
     */
    create() {
        return [
            body('name')
                .notEmpty()
                .withMessage('Product name is required')
                .isLength({ min: 3, max: 500 })
                .withMessage('Product name must be between 3 and 500 characters'),

            body('slug')
                .optional()
                .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
                .withMessage('Invalid slug format'),

            body('description')
                .optional()
                .isLength({ max: 5000 })
                .withMessage('Description must not exceed 5000 characters'),

            body('brand')
                .optional()
                .isLength({ max: 200 })
                .withMessage('Brand must not exceed 200 characters'),

            body('category_id')
                .notEmpty()
                .withMessage('Category ID is required')
                .isInt()
                .withMessage('Invalid category ID'),

            body('images')
                .optional()
                .isArray()
                .withMessage('Images must be an array'),

            body('images.*')
                .optional()
                .isURL()
                .withMessage('Invalid image URL'),

            body('weight')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Weight must be a positive number'),

            body('dimensions')
                .optional()
                .isObject()
                .withMessage('Dimensions must be an object'),

            body('dimensions.length')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Length must be a positive number'),

            body('dimensions.width')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Width must be a positive number'),

            body('dimensions.height')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Height must be a positive number'),

            body('tags')
                .optional()
                .isArray()
                .withMessage('Tags must be an array'),

            body('tags.*')
                .optional()
                .isString()
                .withMessage('Tag must be a string'),

            body('is_featured')
                .optional()
                .isBoolean()
                .withMessage('is_featured must be a boolean'),

            body('metadata')
                .optional()
                .isObject()
                .withMessage('Metadata must be an object'),
        ];
    }

    /**
     * Update product validation rules
     */
    update() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid product ID format'),

            body('name')
                .optional()
                .isLength({ min: 3, max: 500 })
                .withMessage('Product name must be between 3 and 500 characters'),

            body('slug')
                .optional()
                .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
                .withMessage('Invalid slug format'),

            body('description')
                .optional()
                .isLength({ max: 5000 })
                .withMessage('Description must not exceed 5000 characters'),

            body('brand')
                .optional()
                .isLength({ max: 200 })
                .withMessage('Brand must not exceed 200 characters'),

            body('category_id')
                .optional()
                .isInt()
                .withMessage('Invalid category ID'),

            body('images')
                .optional()
                .isArray()
                .withMessage('Images must be an array'),

            body('images.*')
                .optional()
                .isURL()
                .withMessage('Invalid image URL'),

            body('weight')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Weight must be a positive number'),

            body('dimensions')
                .optional()
                .isObject()
                .withMessage('Dimensions must be an object'),

            body('dimensions.length')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Length must be a positive number'),

            body('dimensions.width')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Width must be a positive number'),

            body('dimensions.height')
                .optional()
                .isFloat({ min: 0 })
                .withMessage('Height must be a positive number'),

            body('tags')
                .optional()
                .isArray()
                .withMessage('Tags must be an array'),

            body('tags.*')
                .optional()
                .isString()
                .withMessage('Tag must be a string'),

            body('is_active')
                .optional()
                .isBoolean()
                .withMessage('is_active must be a boolean'),

            body('is_featured')
                .optional()
                .isBoolean()
                .withMessage('is_featured must be a boolean'),
        ];
    }

    /**
     * Get product by ID validation
     */
    getById() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid product ID format'),
        ];
    }

    /**
     * Get product by slug validation
     */
    getBySlug() {
        return [
            param('slug')
                .notEmpty()
                .withMessage('Slug is required')
                .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
                .withMessage('Invalid slug format'),
        ];
    }

    /**
     * Search products validation
     */
    search() {
        return [
            query('q')
                .optional()
                .isString()
                .isLength({ min: 2, max: 500 })
                .withMessage('Search query must be between 2 and 500 characters'),

            query('categoryId')
                .optional()
                .isInt()
                .withMessage('Invalid category ID'),

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

            query('brand')
                .optional()
                .isString()
                .withMessage('Brand must be a string'),

            query('rating')
                .optional()
                .isInt({ min: 1, max: 5 })
                .withMessage('Rating must be between 1 and 5'),

            query('sortBy')
                .optional()
                .isIn(['relevance', 'price_low', 'price_high', 'popularity', 'rating', 'demand', 'newest'])
                .withMessage('Invalid sort field'),

            query('sortOrder')
                .optional()
                .isIn(['ASC', 'DESC'])
                .withMessage('Sort order must be ASC or DESC'),

            query('page')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Page must be at least 1'),

            query('limit')
                .optional()
                .isInt({ min: 1, max: 100 })
                .withMessage('Limit must be between 1 and 100'),

            query('inStock')
                .optional()
                .isBoolean()
                .withMessage('inStock must be a boolean'),

            query('featured')
                .optional()
                .isBoolean()
                .withMessage('featured must be a boolean'),
        ];
    }

    /**
     * Get products by category validation
     */
    getByCategory() {
        return [
            param('categoryId')
                .isInt()
                .withMessage('Invalid category ID'),

            query('limit')
                .optional()
                .isInt({ min: 1, max: 100 })
                .withMessage('Limit must be between 1 and 100'),

            query('page')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Page must be at least 1'),

            query('sortBy')
                .optional()
                .isIn(['created_at', 'price', 'demand_score', 'average_rating'])
                .withMessage('Invalid sort field'),

            query('sortOrder')
                .optional()
                .isIn(['ASC', 'DESC'])
                .withMessage('Sort order must be ASC or DESC'),
        ];
    }

    /**
     * Get price history validation
     */
    getPriceHistory() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid product ID format'),

            query('days')
                .optional()
                .isInt({ min: 1, max: 365 })
                .withMessage('Days must be between 1 and 365'),
        ];
    }

    /**
     * Get price prediction validation
     */
    getPricePrediction() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid product ID format'),

            query('days')
                .optional()
                .isInt({ min: 1, max: 30 })
                .withMessage('Days must be between 1 and 30'),
        ];
    }

    /**
     * Toggle wishlist validation
     */
    toggleWishlist() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid product ID format'),
        ];
    }

    /**
     * Delete product validation
     */
    delete() {
        return [
            param('id')
                .isUUID(4)
                .withMessage('Invalid product ID format'),
        ];
    }
}

module.exports = new ProductValidator();