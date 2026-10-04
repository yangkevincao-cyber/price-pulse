// backend/src/routes/users.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const multer = require('multer');

const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Configure multer for avatar upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
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
const profileUpdateValidation = [
    body('first_name').optional().isString(),
    body('last_name').optional().isString(),
    body('bio').optional().isString(),
    body('phone').optional().isString(),
    body('location_country').optional().isString(),
    body('location_city').optional().isString(),
    body('location_lat').optional().isFloat(),
    body('location_lng').optional().isFloat(),
    body('preferences').optional().isObject(),
];

const settingsUpdateValidation = [
    body('preferences').optional().isObject(),
    body('phone').optional().isString(),
    body('location_country').optional().isString(),
];

const userIdValidation = [
    param('id').isUUID(4).withMessage('Invalid user ID format'),
];

// Routes
router.get('/profile',
    authenticate,
    userController.getMyProfile
);

router.get('/profile/:id',
    userIdValidation,
    userController.getUserProfile
);

router.get('/seller/:id',
    userIdValidation,
    userController.getSellerProfile
);

router.put('/profile',
    authenticate,
    profileUpdateValidation,
    userController.updateProfile
);

router.post('/avatar',
    authenticate,
    upload.single('avatar'),
    userController.uploadAvatar
);

router.get('/settings',
    authenticate,
    userController.getSettings
);

router.put('/settings',
    authenticate,
    settingsUpdateValidation,
    userController.updateSettings
);

router.get('/stats',
    authenticate,
    userController.getUserStats
);

// Notification routes
router.get('/notifications',
    authenticate,
    userController.getNotifications
);

router.patch('/notifications/:id/read',
    authenticate,
    userController.markNotificationRead
);

router.patch('/notifications/read-all',
    authenticate,
    userController.markAllNotificationsRead
);

module.exports = router;