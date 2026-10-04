// backend/src/services/file/uploadService.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');

class UploadService {
    constructor() {
        this.baseUploadDir = path.join(__dirname, '../../../uploads');
        this.maxSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024;
        this.allowedTypes = [
            'image/jpeg', 'image/png', 'image/webp',
            'image/svg+xml', 'application/pdf',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        // Ensure directories exist
        this.ensureDirectories();
    }

    /**
     * Ensure upload directories exist
     */
    ensureDirectories() {
        const dirs = [
            'products/originals',
            'products/thumbnails',
            'products/medium',
            'products/large',
            'users/avatars',
            'users/covers',
            'listings/originals',
            'listings/thumbnails',
            'temp/chunks',
            'temp/processing',
        ];

        for (const dir of dirs) {
            const fullPath = path.join(this.baseUploadDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                logger.info(`Created upload directory: ${fullPath}`);
            }
        }
    }

    /**
     * Configure multer storage
     */
    getStorage(subfolder = 'products') {
        return multer.diskStorage({
            destination: (req, file, cb) => {
                const dest = path.join(this.baseUploadDir, subfolder, 'originals');
                if (!fs.existsSync(dest)) {
                    fs.mkdirSync(dest, { recursive: true });
                }
                cb(null, dest);
            },
            filename: (req, file, cb) => {
                const ext = path.extname(file.originalname);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const uuid = uuidv4();
                const filename = `${subfolder}-${uuid}-${timestamp}${ext}`;
                cb(null, filename);
            },
        });
    }

    /**
     * Configure multer
     */
    getMulter(subfolder = 'products', maxSize = null) {
        const storage = this.getStorage(subfolder);
        const limits = {
            fileSize: maxSize || this.maxSize,
        };

        const fileFilter = (req, file, cb) => {
            if (this.allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error(`File type not allowed: ${file.mimetype}`));
            }
        };

        return multer({
            storage,
            limits,
            fileFilter,
        });
    }

    /**
     * Upload single file
     */
    async uploadFile(file, subfolder = 'products', options = {}) {
        try {
            if (!file) {
                throw new Error('No file provided');
            }

            const { process = true, generateThumbnails = true } = options;
            const filePath = file.path;
            const filename = file.filename;
            const fileUrl = `/uploads/${subfolder}/originals/${filename}`;

            // Process image if it's an image
            let processed = null;
            if (process && file.mimetype.startsWith('image/')) {
                processed = await this.processImage(filePath, filename, subfolder);
            }

            // Generate thumbnails
            let thumbnails = null;
            if (generateThumbnails && file.mimetype.startsWith('image/')) {
                thumbnails = await this.generateThumbnails(filePath, filename, subfolder);
            }

            // Store metadata in Redis
            const metadata = {
                filename,
                originalName: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
                path: filePath,
                url: fileUrl,
                processed: processed || null,
                thumbnails: thumbnails || null,
                uploadedAt: new Date().toISOString(),
            };

            const key = `file:${filename}`;
            await redis.setex(key, 86400 * 30, JSON.stringify(metadata));

            logger.info(`File uploaded: ${filename} (${file.size} bytes)`);

            return {
                success: true,
                filename,
                originalName: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
                url: fileUrl,
                processed,
                thumbnails,
                metadata,
            };
        } catch (error) {
            logger.error('File upload error:', error);
            throw error;
        }
    }

    /**
     * Process image (resize, optimize)
     */
    async processImage(filePath, filename, subfolder) {
        try {
            const sizes = [
                { width: 1920, quality: 80, suffix: 'large' },
                { width: 1200, quality: 85, suffix: 'medium' },
                { width: 600, quality: 90, suffix: 'small' },
            ];

            const processed = [];
            const baseName = path.parse(filename).name;

            for (const size of sizes) {
                const outputFilename = `${baseName}-${size.suffix}.webp`;
                const outputPath = path.join(
                    this.baseUploadDir,
                    subfolder,
                    size.suffix,
                    outputFilename
                );

                // Ensure output directory exists
                const outputDir = path.dirname(outputPath);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                await sharp(filePath)
                    .resize(size.width, null, {
                        withoutEnlargement: true,
                        fit: 'inside',
                    })
                    .webp({ quality: size.quality })
                    .toFile(outputPath);

                processed.push({
                    size: size.suffix,
                    width: size.width,
                    quality: size.quality,
                    url: `/uploads/${subfolder}/${size.suffix}/${outputFilename}`,
                    filename: outputFilename,
                    path: outputPath,
                });
            }

            return processed;
        } catch (error) {
            logger.error('Image processing error:', error);
            return null;
        }
    }

    /**
     * Generate thumbnails
     */
    async generateThumbnails(filePath, filename, subfolder) {
        try {
            const sizes = [
                { width: 200, height: 200, suffix: 'thumb' },
                { width: 100, height: 100, suffix: 'micro' },
            ];

            const thumbnails = [];
            const baseName = path.parse(filename).name;

            for (const size of sizes) {
                const outputFilename = `${baseName}-${size.suffix}.webp`;
                const outputPath = path.join(
                    this.baseUploadDir,
                    subfolder,
                    'thumbnails',
                    outputFilename
                );

                // Ensure output directory exists
                const outputDir = path.dirname(outputPath);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                await sharp(filePath)
                    .resize(size.width, size.height, {
                        fit: 'cover',
                        position: 'center',
                    })
                    .webp({ quality: 70 })
                    .toFile(outputPath);

                thumbnails.push({
                    size: size.suffix,
                    width: size.width,
                    height: size.height,
                    url: `/uploads/${subfolder}/thumbnails/${outputFilename}`,
                    filename: outputFilename,
                    path: outputPath,
                });
            }

            return thumbnails;
        } catch (error) {
            logger.error('Thumbnail generation error:', error);
            return null;
        }
    }

    /**
     * Upload multiple files
     */
    async uploadMultiple(files, subfolder = 'products', options = {}) {
        if (!files || files.length === 0) {
            throw new Error('No files provided');
        }

        const results = [];
        for (const file of files) {
            const result = await this.uploadFile(file, subfolder, options);
            results.push(result);
        }

        return results;
    }

    /**
     * Get file metadata
     */
    async getFileMetadata(filename) {
        try {
            const key = `file:${filename}`;
            const data = await redis.get(key);
            if (data) {
                return JSON.parse(data);
            }

            // Check if file exists
            const filePath = this.findFile(filename);
            if (filePath) {
                const stats = fs.statSync(filePath);
                const metadata = {
                    filename,
                    size: stats.size,
                    path: filePath,
                    url: `/uploads/${path.basename(path.dirname(filePath))}/${filename}`,
                    uploadedAt: stats.birthtime.toISOString(),
                };
                await redis.setex(key, 86400 * 7, JSON.stringify(metadata));
                return metadata;
            }

            return null;
        } catch (error) {
            logger.error('Get file metadata error:', error);
            return null;
        }
    }

    /**
     * Find file in upload directories
     */
    findFile(filename) {
        const dirs = [
            'products/originals', 'products/thumbnails', 'products/medium', 'products/large',
            'users/avatars', 'users/covers',
            'listings/originals', 'listings/thumbnails',
        ];

        for (const dir of dirs) {
            const filePath = path.join(this.baseUploadDir, dir, filename);
            if (fs.existsSync(filePath)) {
                return filePath;
            }
        }
        return null;
    }

    /**
     * Delete file
     */
    async deleteFile(filename) {
        try {
            // Delete all variants
            const baseName = path.parse(filename).name;
            const dirs = [
                'products/originals', 'products/thumbnails', 'products/medium', 'products/large',
                'users/avatars', 'users/covers',
                'listings/originals', 'listings/thumbnails',
            ];

            let deletedCount = 0;
            for (const dir of dirs) {
                const filePath = path.join(this.baseUploadDir, dir, filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }

                // Check for processed versions
                const processedFiles = fs.readdirSync(path.join(this.baseUploadDir, dir));
                for (const file of processedFiles) {
                    if (file.startsWith(baseName)) {
                        const fullPath = path.join(this.baseUploadDir, dir, file);
                        fs.unlinkSync(fullPath);
                        deletedCount++;
                    }
                }
            }

            // Delete metadata
            await redis.del(`file:${filename}`);

            logger.info(`File deleted: ${filename} (${deletedCount} files removed)`);
            return { success: true, deletedCount };
        } catch (error) {
            logger.error('File delete error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clean temporary files
     */
    async cleanTempFiles() {
        try {
            const tempDir = path.join(this.baseUploadDir, 'temp');
            const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
            let deletedCount = 0;

            const processDir = (dir) => {
                if (!fs.existsSync(dir)) return;
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    if (stats.mtimeMs < cutoff) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
            };

            // Clean temp directories
            processDir(path.join(tempDir, 'chunks'));
            processDir(path.join(tempDir, 'processing'));

            // Clean any other temp files
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile() && stats.mtimeMs < cutoff) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }

            logger.info(`Cleaned ${deletedCount} temporary files`);
            return { success: true, deletedCount };
        } catch (error) {
            logger.error('Clean temp files error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get storage statistics
     */
    async getStats() {
        try {
            const stats = {
                totalFiles: 0,
                totalSize: 0,
                byType: {},
                bySubfolder: {},
            };

            const dirs = ['products', 'users', 'listings', 'temp'];
            for (const dir of dirs) {
                const fullPath = path.join(this.baseUploadDir, dir);
                if (!fs.existsSync(fullPath)) continue;

                const subStats = this.getDirectoryStats(fullPath);
                stats.bySubfolder[dir] = subStats;
                stats.totalFiles += subStats.files;
                stats.totalSize += subStats.size;
            }

            // Get file type distribution
            const types = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'other'];
            for (const type of types) {
                stats.byType[type] = 0;
            }

            // Calculate size in MB
            stats.totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);

            return stats;
        } catch (error) {
            logger.error('Get stats error:', error);
            return null;
        }
    }

    /**
     * Get directory statistics
     */
    getDirectoryStats(dir) {
        let files = 0;
        let size = 0;

        const walk = (currentDir) => {
            const items = fs.readdirSync(currentDir);
            for (const item of items) {
                const itemPath = path.join(currentDir, item);
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory()) {
                    walk(itemPath);
                } else {
                    files++;
                    size += stat.size;
                }
            }
        };

        walk(dir);
        return { files, size };
    }

    /**
     * Get public URL for file
     */
    getPublicUrl(filename, subfolder = 'products', size = 'original') {
        const sizeMap = {
            original: 'originals',
            thumb: 'thumbnails',
            small: 'small',
            medium: 'medium',
            large: 'large',
        };

        const folder = sizeMap[size] || 'originals';
        return `/uploads/${subfolder}/${folder}/${filename}`;
    }
}

module.exports = new UploadService();