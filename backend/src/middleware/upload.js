// backend/src/middleware/upload.js
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../config/logger');

/**
 * Configure multer storage
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const subfolder = req.params.subfolder || 'products';
        const uploadPath = path.join(__dirname, '../../uploads', subfolder);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${uuidv4()}${ext}`;
        cb(null, filename);
    },
});

/**
 * File filter
 */
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/svg+xml',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
};

/**
 * Configure multer
 */
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
        files: 5,
    },
});

/**
 * Single file upload middleware
 */
const uploadSingle = (fieldName = 'file', subfolder = 'products') => {
    return (req, res, next) => {
        upload.single(fieldName)(req, res, (err) => {
            if (err) {
                logger.error('Upload error:', err);
                return res.status(400).json({
                    success: false,
                    error: err.message,
                    code: 'UPLOAD_ERROR',
                });
            }
            req.uploadSubfolder = subfolder;
            next();
        });
    };
};

/**
 * Multiple files upload middleware
 */
const uploadMultiple = (fieldName = 'files', maxCount = 5, subfolder = 'products') => {
    return (req, res, next) => {
        upload.array(fieldName, maxCount)(req, res, (err) => {
            if (err) {
                logger.error('Upload error:', err);
                return res.status(400).json({
                    success: false,
                    error: err.message,
                    code: 'UPLOAD_ERROR',
                });
            }
            req.uploadSubfolder = subfolder;
            next();
        });
    };
};

/**
 * Upload error handler
 */
const uploadErrorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large',
                code: 'FILE_TOO_LARGE',
                maxSize: process.env.MAX_FILE_SIZE || '5MB',
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Too many files',
                code: 'TOO_MANY_FILES',
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                error: 'Unexpected file field',
                code: 'UNEXPECTED_FILE',
            });
        }
        return res.status(400).json({
            success: false,
            error: err.message,
            code: 'MULTER_ERROR',
        });
    }
    next(err);
};

module.exports = {
    upload,
    uploadSingle,
    uploadMultiple,
    uploadErrorHandler,
};