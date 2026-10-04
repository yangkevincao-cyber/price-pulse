// backend/src/routes/products.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

const productController = require('../controllers/productController');
const { authenticate, isAdmin } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Validation rules
const productValidation = [
    body('name').notEmpty().withMessage('Product name is required'),
    body('category_id').isInt().withMessage('Valid category ID is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('description').optional().isString(),
    body('brand').optional().isString(),
    body('sku').optional().isString(),
    body('images').optional().isArray(),
];

const productIdValidation = [
    param('id').isUUID(4).withMessage('Invalid product ID format'),
];

// Public routes
router.get('/', productController.getAllProducts);
router.get('/trending', productController.getTrendingProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/search', productController.searchProducts);
router.get('/category/:categoryId', productController.getProductsByCategory);
router.get('/slug/:slug', productController.getProductBySlug);

// Protected product routes
router.get('/:id',
    productIdValidation,
    productController.getProductById
);

router.get('/:id/price-history',
    productIdValidation,
    productController.getPriceHistory
);

router.get('/:id/price-prediction',
    productIdValidation,
    productController.getPricePrediction
);

// Wishlist routes
router.post('/:id/wishlist',
    authenticate,
    productIdValidation,
    productController.toggleWishlist
);

router.get('/wishlist',
    authenticate,
    productController.getWishlist
);

// Admin routes
router.post('/',
    authenticate,
    isAdmin,
    rateLimiter.product,
    productValidation,
    productController.createProduct
);

router.put('/:id',
    authenticate,
    isAdmin,
    productIdValidation,
    productValidation,
    productController.updateProduct
);

router.delete('/:id',
    authenticate,
    isAdmin,
    productIdValidation,
    productController.deleteProduct
);

// backend/src/routes/products.js
router.post('/:id/images',
    authenticate,
    uploadService.getMulter('products').array('images', 5),
    productController.uploadProductImages
);

router.patch('/:id/images/:imageIndex/main',
    authenticate,
    productController.setMainProductImage
);

router.delete('/:id/images/:imageIndex',
    authenticate,
    productController.deleteProductImage
);

// backend/src/routes/users.js
router.post('/avatar',
    authenticate,
    uploadService.getMulter('users', 2 * 1024 * 1024).single('avatar'),
    userController.uploadAvatar
);

router.post('/cover',
    authenticate,
    uploadService.getMulter('users', 5 * 1024 * 1024).single('cover'),
    userController.uploadCoverImage
);

router.get('/:id/avatar',
    userController.generateDefaultAvatar
);

// backend/src/routes/listings.js
router.post('/:id/images',
    authenticate,
    uploadService.getMulter('listings').array('images', 5),
    listingController.uploadListingImages
);

router.patch('/:id/images/:imageIndex/main',
    authenticate,
    listingController.setMainListingImage
);

router.delete('/:id/images/:imageIndex',
    authenticate,
    listingController.deleteListingImage
);
module.exports = router;