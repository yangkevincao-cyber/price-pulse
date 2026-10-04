// backend/src/routes/categories.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

const categoryController = require('../controllers/categoryController');
const { authenticate, isAdmin } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Validation rules
const categoryValidation = [
    body('name').notEmpty().withMessage('Category name is required'),
    body('slug').optional().isString(),
    body('description').optional().isString(),
    body('parent_category_id').optional().isInt().withMessage('Invalid parent category ID'),
    body('icon').optional().isString(),
    body('display_order').optional().isInt().withMessage('Display order must be an integer'),
];

const categoryIdValidation = [
    param('id').isInt().withMessage('Invalid category ID format'),
];

// Routes
router.get('/',
    categoryController.getAllCategories
);

router.get('/tree',
    categoryController.getCategoryTree
);

router.get('/stats',
    categoryController.getCategoryStats
);

router.get('/:id',
    categoryIdValidation,
    categoryController.getCategoryById
);

router.get('/slug/:slug',
    categoryController.getCategoryBySlug
);

// Admin routes
router.post('/',
    authenticate,
    isAdmin,
    rateLimiter.product,
    categoryValidation,
    categoryController.createCategory
);

router.put('/:id',
    authenticate,
    isAdmin,
    categoryIdValidation,
    categoryValidation,
    categoryController.updateCategory
);

router.delete('/:id',
    authenticate,
    isAdmin,
    categoryIdValidation,
    categoryController.deleteCategory
);

module.exports = router;