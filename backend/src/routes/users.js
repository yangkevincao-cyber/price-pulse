// backend/src/routes/users.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const multer = require('multer');

const userController = require('../controllers/userController');   // ← MOVED HERE
const { authenticate } = require('../middleware/auth');

// Avatar upload config
const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Invalid file type'));
    },
});

const profileUpdateValidation = [
    body('first_name').optional().isString(),
    body('last_name').optional().isString(),
    body('bio').optional().isString(),
    body('phone').optional().isString(),
    body('location_country').optional().isString(),
    body('location_city').optional().isString(),
    body('preferences').optional().isObject(),
];

const userIdValidation = [
    param('id').isUUID(4).withMessage('Invalid user ID format'),
];

// Profile routes
router.get('/profile', authenticate, userController.getMyProfile);
router.get('/profile/:id', userIdValidation, userController.getUserProfile);
router.get('/seller/:id', userIdValidation, userController.getSellerProfile);
router.put('/profile', authenticate, profileUpdateValidation, userController.updateProfile);

// Avatar upload
router.post('/avatar',
    authenticate,
    avatarUpload.single('avatar'),
    userController.uploadAvatar
);

// Settings
router.get('/settings', authenticate, userController.getSettings);
router.put('/settings', authenticate, userController.updateSettings);

// Stats
router.get('/stats', authenticate, userController.getUserStats);

// Notifications
router.get('/notifications', authenticate, userController.getNotifications);
router.patch('/notifications/:id/read', authenticate, userController.markNotificationRead);
router.patch('/notifications/read-all', authenticate, userController.markAllNotificationsRead);

module.exports = router;