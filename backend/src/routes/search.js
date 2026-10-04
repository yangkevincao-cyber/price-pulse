// backend/src/routes/search.js
const express = require('express');
const router = express.Router();
const { query } = require('express-validator');

const searchController = require('../controllers/searchController');
const { authenticate, isAdmin } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Validation rules
const searchValidation = [
    query('q').optional().isString().isLength({ min: 1, max: 500 }),
    query('categoryId').optional().isInt().withMessage('Invalid category ID'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('Minimum price must be positive'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Maximum price must be positive'),
    query('condition').optional().isIn(['new', 'like-new', 'good', 'fair', 'poor']),
    query('brand').optional().isString(),
    query('rating').optional().isInt({ min: 1, max: 5 }),
    query('sortBy').optional().isIn(['relevance', 'price_low', 'price_high', 'popularity', 'rating', 'demand', 'newest']),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('inStock').optional().isBoolean(),
    query('featured').optional().isBoolean(),
    query('tags').optional().isString(),
];

// Routes
router.get('/advanced',
    rateLimiter.search,
    searchValidation,
    searchController.advancedSearch
);

router.get('/autocomplete',
    searchController.autocomplete
);

router.get('/popular',
    searchController.getPopularSearches
);

router.get('/filters',
    searchController.getSearchFilters
);

router.get('/analytics',
    authenticate,
    isAdmin,
    searchController.getSearchAnalytics
);

router.post('/cache/clear',
    authenticate,
    isAdmin,
    searchController.clearSearchCache
);

module.exports = router;