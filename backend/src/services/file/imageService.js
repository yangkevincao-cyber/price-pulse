// backend/src/services/file/imageService.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');

class ImageService {
    constructor() {
        this.uploadDir = path.join(__dirname, '../../../uploads/products');
        this.thumbDir = path.join(this.uploadDir, 'thumbnails');
        this.cdnUrl = process.env.CDN_URL || '/uploads/products';
        this.maxWidth = 2000;
        this.maxHeight = 2000;
        this.quality = 80;

        // Ensure directories exist
        this.ensureDirectories();
    }

    /**
     * Ensure directories exist
     */
    ensureDirectories() {
        const dirs = [this.uploadDir, this.thumbDir];
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logger.info(`Created image directory: ${dir}`);
            }
        }
    }

    /**
     * Process and optimize image
     */
    async processImage(file, options = {}) {
        try {
            const {
                width = 800,
                height = 800,
                fit = 'cover',
                quality = 80,
                format = 'webp',
            } = options;

            const filename = `${uuidv4()}.${format}`;
            const filepath = path.join(this.uploadDir, filename);
            const thumbpath = path.join(this.thumbDir, filename);

            // Read image buffer
            const image = sharp(file.buffer);

            // Get metadata
            const metadata = await image.metadata();

            // Resize image
            const resized = image
                .resize(width, height, {
                    fit: fit,
                    position: 'center',
                    withoutEnlargement: true,
                })
                .webp({ quality })
                .toFile(filepath);

            // Create thumbnail
            const thumbnail = sharp(file.buffer)
                .resize(200, 200, {
                    fit: 'cover',
                    position: 'center',
                })
                .webp({ quality: 60 })
                .toFile(thumbpath);

            await Promise.all([resized, thumbnail]);

            // Store metadata in Redis
            const metadataKey = `image:${filename}`;
            const imageMetadata = {
                filename,
                originalName: file.originalname,
                size: file.size,
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                created_at: new Date().toISOString(),
                processed_size: (await fs.promises.stat(filepath)).size,
                thumb_size: (await fs.promises.stat(thumbpath)).size,
            };

            await redis.setex(metadataKey, 86400 * 30, JSON.stringify(imageMetadata));

            logger.info(`Image processed: ${filename}`);

            return {
                filename,
                url: `${this.cdnUrl}/${filename}`,
                thumbnail: `${this.cdnUrl}/thumbnails/${filename}`,
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: file.size,
                processed_size: imageMetadata.processed_size,
            };
        } catch (error) {
            logger.error('Image processing error:', error);
            throw error;
        }
    }

    /**
     * Process multiple images
     */
    async processMultiple(files, options = {}) {
        const results = [];
        for (const file of files) {
            const result = await this.processImage(file, options);
            results.push(result);
        }
        return results;
    }

    /**
     * Generate image variants (multiple sizes)
     */
    async generateVariants(file) {
        const sizes = [
            { width: 100, height: 100, suffix: 'thumb', quality: 60 },
            { width: 300, height: 300, suffix: 'small', quality: 70 },
            { width: 600, height: 600, suffix: 'medium', quality: 80 },
            { width: 1200, height: 1200, suffix: 'large', quality: 85 },
        ];

        const results = [];
        const baseName = uuidv4();

        for (const size of sizes) {
            const filename = `${baseName}_${size.suffix}.webp`;
            const filepath = path.join(this.uploadDir, filename);

            await sharp(file.buffer)
                .resize(size.width, size.height, {
                    fit: 'cover',
                    position: 'center',
                    withoutEnlargement: true,
                })
                .webp({ quality: size.quality })
                .toFile(filepath);

            results.push({
                filename,
                url: `${this.cdnUrl}/${filename}`,
                width: size.width,
                height: size.height,
                suffix: size.suffix,
            });
        }

        return results;
    }

    /**
     * Delete image
     */
    async deleteImage(filename) {
        try {
            const filepath = path.join(this.uploadDir, filename);
            const thumbpath = path.join(this.thumbDir, filename);

            // Delete main image
            if (fs.existsSync(filepath)) {
                await fs.promises.unlink(filepath);
            }

            // Delete thumbnail
            if (fs.existsSync(thumbpath)) {
                await fs.promises.unlink(thumbpath);
            }

            // Delete metadata
            const metadataKey = `image:${filename}`;
            await redis.del(metadataKey);

            logger.info(`Image deleted: ${filename}`);
            return { success: true };
        } catch (error) {
            logger.error('Image delete error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get image metadata
     */
    async getImageMetadata(filename) {
        const metadataKey = `image:${filename}`;
        const metadata = await redis.get(metadataKey);
        if (metadata) {
            return JSON.parse(metadata);
        }

        // Check if file exists
        const filepath = path.join(this.uploadDir, filename);
        if (fs.existsSync(filepath)) {
            const stats = await fs.promises.stat(filepath);
            return {
                filename,
                size: stats.size,
                created_at: stats.birthtime.toISOString(),
                url: `${this.cdnUrl}/${filename}`,
                thumbnail: `${this.cdnUrl}/thumbnails/${filename}`,
            };
        }

        return null;
    }

    /**
     * Convert image format
     */
    async convertFormat(file, targetFormat = 'webp') {
        const filename = `${uuidv4()}.${targetFormat}`;
        const filepath = path.join(this.uploadDir, filename);

        await sharp(file.buffer)
            .toFormat(targetFormat)
            .toFile(filepath);

        return {
            filename,
            url: `${this.cdnUrl}/${filename}`,
            format: targetFormat,
            size: (await fs.promises.stat(filepath)).size,
        };
    }

    /**
     * Watermark image
     */
    async addWatermark(file, watermarkPath, position = 'center') {
        const filename = `${uuidv4()}.webp`;
        const filepath = path.join(this.uploadDir, filename);

        const positions = {
            'top-left': { gravity: 'northwest' },
            'top-center': { gravity: 'north' },
            'top-right': { gravity: 'northeast' },
            'center': { gravity: 'center' },
            'bottom-left': { gravity: 'southwest' },
            'bottom-center': { gravity: 'south' },
            'bottom-right': { gravity: 'southeast' },
        };

        await sharp(file.buffer)
            .composite([
                {
                    input: watermarkPath,
                    ...positions[position],
                    opacity: 0.3,
                },
            ])
            .webp({ quality: 80 })
            .toFile(filepath);

        return {
            filename,
            url: `${this.cdnUrl}/${filename}`,
        };
    }

    /**
     * Get image stats
     */
    async getStats() {
        const files = await fs.promises.readdir(this.uploadDir);
        const thumbnails = await fs.promises.readdir(this.thumbDir);

        let totalSize = 0;
        for (const file of files) {
            const filepath = path.join(this.uploadDir, file);
            const stats = await fs.promises.stat(filepath);
            totalSize += stats.size;
        }

        return {
            totalImages: files.length,
            totalThumbnails: thumbnails.length,
            totalSize: totalSize,
            totalSizeFormatted: this.formatBytes(totalSize),
            averageSize: files.length > 0 ? totalSize / files.length : 0,
        };
    }

    /**
     * Format bytes to human-readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Clean up old images
     */
    async cleanupOldImages(days = 30) {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        let deletedCount = 0;

        try {
            // Get image metadata keys
            const keys = await redis.keys('image:*');
            const metadataMap = new Map();

            for (const key of keys) {
                const data = await redis.get(key);
                if (data) {
                    const metadata = JSON.parse(data);
                    metadataMap.set(metadata.filename, metadata);
                }
            }

            // Check files
            const files = await fs.promises.readdir(this.uploadDir);
            for (const file of files) {
                const metadata = metadataMap.get(file);
                if (metadata) {
                    const created = new Date(metadata.created_at).getTime();
                    if (created < cutoff) {
                        await this.deleteImage(file);
                        deletedCount++;
                    }
                } else {
                    // File not in metadata, delete
                    await this.deleteImage(file);
                    deletedCount++;
                }
            }

            logger.info(`Cleaned up ${deletedCount} old images`);
            return { success: true, deletedCount };
        } catch (error) {
            logger.error('Image cleanup error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new ImageService();