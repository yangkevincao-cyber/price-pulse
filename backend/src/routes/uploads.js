// backend/src/routes/uploads.js
const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const uploadService = require('../services/file/uploadService');
const { authenticate, isAdmin } = require('../middleware/auth');

// Public routes
router.get('/metadata/:filename', uploadController.getFileMetadata);

// Protected routes
router.post('/:subfolder',
    authenticate,
    uploadService.getMulter().single('file'),
    uploadController.uploadFile
);

router.post('/:subfolder/multiple',
    authenticate,
    uploadService.getMulter().array('files', 5),
    uploadController.uploadMultiple
);

router.delete('/:filename',
    authenticate,
    uploadController.deleteFile
);

// Admin routes
router.get('/admin/stats',
    authenticate,
    isAdmin,
    uploadController.getStats
);

router.post('/admin/clean-temp',
    authenticate,
    isAdmin,
    uploadController.cleanTemp
);

module.exports = router;