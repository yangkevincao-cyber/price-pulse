// backend/src/routes/listings.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');

const listingController = require('../controllers/listingController');   // ← MOVED HERE
const uploadService = require('../services/file/uploadService');          // ← MOVED HERE
const { authenticate, isSeller } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

const listingValidation = [
    body('product_id').isUUID(4).withMessage('Valid product ID is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be positive'),
    body('condition').isIn(['new', 'like-new', 'good', 'fair', 'poor']),
    body('quantity').optional().isInt({ min: 1 }),
];

const listingIdValidation = [
    param('id').isUUID(4).withMessage('Invalid listing ID format'),
];

// Public
router.get('/', listingController.getListings);
router.get('/seller/:sellerId', listingController.getSellerListings);

// Protected
router.get('/my-listings', authenticate, listingController.getMyListings);
router.get('/:id', listingIdValidation, listingController.getListingById);

router.post('/',
    authenticate,
    isSeller,
    rateLimiter.listing,
    listingValidation,
    listingController.createListing
);

router.put('/:id', authenticate, listingIdValidation, listingValidation, listingController.updateListing);
router.delete('/:id', authenticate, listingIdValidation, listingController.deleteListing);
router.patch('/:id/toggle-status', authenticate, listingIdValidation, listingController.toggleStatus);

// ✅ Listing image routes
router.post('/:id/images',
    authenticate,
    listingIdValidation,
    uploadService.getMulter('listings').array('images', 5),
    listingController.uploadListingImages
);

router.delete('/:id/images/:imageIndex',
    authenticate,
    listingIdValidation,
    listingController.deleteListingImage
);

module.exports = router;