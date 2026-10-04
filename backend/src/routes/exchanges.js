// backend/src/routes/exchanges.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

const exchangeController = require('../controllers/exchangeController');
const { authenticate, isSeller, isAdmin } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Validation rules
const exchangeValidation = [
    body('offered_product_id').isUUID(4).withMessage('Valid offered product ID is required'),
    body('offered_condition').isIn(['new', 'like-new', 'good', 'fair', 'poor']).withMessage('Invalid condition'),
    body('offered_quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('wanted_product_id').optional().isUUID(4).withMessage('Invalid wanted product ID'),
    body('wanted_product_name').optional().isString(),
    body('wanted_condition').optional().isIn(['new', 'like-new', 'good', 'fair', 'poor', 'any']).withMessage('Invalid condition'),
    body('cash_adjustment').optional().isFloat().withMessage('Cash adjustment must be a number'),
    body('notes').optional().isString(),
];

const exchangeIdValidation = [
    param('id').isUUID(4).withMessage('Invalid exchange ID format'),
];

// Routes
router.get('/',
    exchangeController.getListings
);

router.get('/my-listings',
    authenticate,
    exchangeController.getMyListings
);

router.get('/matches',
    authenticate,
    exchangeController.getMatches
);

router.get('/stats',
    authenticate,
    exchangeController.getStats
);

router.get('/:id',
    exchangeIdValidation,
    exchangeController.getListingById
);

router.post('/',
    authenticate,
    isSeller,
    rateLimiter.listing,
    exchangeValidation,
    exchangeController.createListing
);

router.put('/:id',
    authenticate,
    exchangeIdValidation,
    exchangeValidation,
    exchangeController.updateListing
);

router.delete('/:id',
    authenticate,
    exchangeIdValidation,
    exchangeController.deleteListing
);

router.post('/matches/:id/accept',
    authenticate,
    exchangeIdValidation,
    exchangeController.acceptMatch
);

router.post('/matches/:id/decline',
    authenticate,
    exchangeIdValidation,
    exchangeController.declineMatch
);

module.exports = router;