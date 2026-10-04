// backend/src/controllers/uploadController.js
const uploadService = require('../services/file/uploadService');
const { logger } = require('../config/logger');

class UploadController {
    /**
     * Upload single file
     */
    async uploadFile(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded',
                });
            }

            const subfolder = req.params.subfolder || 'products';
            const result = await uploadService.uploadFile(req.file, subfolder);

            return res.status(201).json({
                success: true,
                message: 'File uploaded successfully',
                data: result,
            });
        } catch (error) {
            logger.error('Upload file error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to upload file',
            });
        }
    }

    /**
     * Upload multiple files
     */
    async uploadMultiple(req, res) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No files uploaded',
                });
            }

            const subfolder = req.params.subfolder || 'products';
            const results = await uploadService.uploadMultiple(req.files, subfolder);

            return res.status(201).json({
                success: true,
                message: 'Files uploaded successfully',
                data: results,
            });
        } catch (error) {
            logger.error('Upload multiple error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to upload files',
            });
        }
    }

    /**
     * Delete file
     */
    async deleteFile(req, res) {
        try {
            const { filename } = req.params;
            const result = await uploadService.deleteFile(filename);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found',
                });
            }

            return res.json({
                success: true,
                message: 'File deleted successfully',
                data: result,
            });
        } catch (error) {
            logger.error('Delete file error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to delete file',
            });
        }
    }

    /**
     * Get file metadata
     */
    async getFileMetadata(req, res) {
        try {
            const { filename } = req.params;
            const metadata = await uploadService.getFileMetadata(filename);

            if (!metadata) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found',
                });
            }

            return res.json({
                success: true,
                data: metadata,
            });
        } catch (error) {
            logger.error('Get file metadata error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to get file metadata',
            });
        }
    }

    /**
     * Get storage statistics
     */
    async getStats(req, res) {
        try {
            const stats = await uploadService.getStats();
            return res.json({
                success: true,
                data: stats,
            });
        } catch (error) {
            logger.error('Get stats error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to get storage stats',
            });
        }
    }

    /**
     * Clean temporary files
     */
    async cleanTemp(req, res) {
        try {
            const result = await uploadService.cleanTempFiles();
            return res.json({
                success: true,
                message: 'Temporary files cleaned',
                data: result,
            });
        } catch (error) {
            logger.error('Clean temp error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to clean temporary files',
            });
        }
    }
}

module.exports = new UploadController();