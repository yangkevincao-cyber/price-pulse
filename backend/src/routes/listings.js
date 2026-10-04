// backend/src/routes/listings.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const multer = require('multer');

const listingController = require('../controllers/listingController');
const { authenticate, isSeller, isAdmin } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Configure multer for image uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WEBP are allowed.'));
        }
    },
});

// Validation rules
const listingValidation = [
    body('product_id').isUUID(4).withMessage('Valid product ID is required'),
    body('title').notEmpty().withMessage('Title is required').isLength({ min: 5, max: 500 }),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('condition').isIn(['new', 'like-new', 'good', 'fair', 'poor']).withMessage('Invalid condition'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('description').optional().isString(),
    body('shipping_cost').optional().isFloat({ min: 0 }),
    body('accepts_offers').optional().isBoolean(),
];

const listingIdValidation = [
    param('id').isUUID(4).withMessage('Invalid listing ID format'),
];

// Public routes
router.get('/', listingController.getListings);
router.get('/seller/:sellerId', listingController.getSellerListings);

// Protected routes
router.get('/my-listings',
    authenticate,
    listingController.getMyListings
);

router.get('/:id',
    listingIdValidation,
    listingController.getListingById
);

router.post('/',
    authenticate,
    isSeller,
    rateLimiter.listing,
    listingValidation,
    listingController.createListing
);

router.put('/:id',
    authenticate,
    listingIdValidation,
    listingValidation,
    listingController.updateListing
);

router.delete('/:id',
    authenticate,
    listingIdValidation,
    listingController.deleteListing
);

router.patch('/:id/toggle-status',
    authenticate,
    listingIdValidation,
    listingController.toggleStatus
);

// Image upload routes
router.post('/:id/images',
    authenticate,
    listingIdValidation,
    upload.array('images', 5),
    listingController.uploadImages
);

router.delete('/:id/images/:imageIndex',
    authenticate,
    listingIdValidation,
    listingController.deleteImage
);

module.exports = router;