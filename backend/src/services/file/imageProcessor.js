// backend/src/services/file/imageProcessor.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { logger } = require('../../config/logger');

class ImageProcessor {
    /**
     * Process image with multiple sizes
     */
    async processImage(inputPath, outputBasePath, options = {}) {
        try {
            const {
                sizes = [
                    { width: 1920, quality: 80, suffix: 'large' },
                    { width: 1200, quality: 85, suffix: 'medium' },
                    { width: 600, quality: 90, suffix: 'small' },
                    { width: 200, height: 200, quality: 70, suffix: 'thumb' }
                ],
                format = 'webp',
            } = options;

            const results = [];
            const image = sharp(inputPath);
            const metadata = await image.metadata();

            for (const size of sizes) {
                const outputPath = `${outputBasePath}-${size.suffix}.${format}`;

                let processor = sharp(inputPath);

                if (size.width && size.height) {
                    // Square crop
                    processor = processor.resize(size.width, size.height, {
                        fit: 'cover',
                        position: 'center'
                    });
                } else if (size.width) {
                    // Width constrained
                    processor = processor.resize(size.width, null, {
                        withoutEnlargement: true,
                        fit: 'inside'
                    });
                }

                await processor
                [format]({ quality: size.quality })
                    .toFile(outputPath);

                const stats = fs.statSync(outputPath);
                results.push({
                    path: outputPath,
                    filename: path.basename(outputPath),
                    width: size.width || metadata.width,
                    height: size.height || metadata.height,
                    size: stats.size,
                    suffix: size.suffix,
                    url: `/uploads/${path.basename(path.dirname(outputPath))}/${path.basename(outputPath)}`
                });
            }

            return results;
        } catch (error) {
            logger.error('Image processing error:', error);
            throw error;
        }
    }

    /**
     * Optimize image for web
     */
    async optimizeForWeb(inputPath, outputPath, options = {}) {
        const {
            quality = 80,
            format = 'webp',
            width = null,
            height = null
        } = options;

        let processor = sharp(inputPath);

        if (width && height) {
            processor = processor.resize(width, height, {
                fit: 'cover',
                position: 'center'
            });
        } else if (width) {
            processor = processor.resize(width, null, {
                withoutEnlargement: true,
                fit: 'inside'
            });
        }

        await processor
        [format]({ quality })
            .toFile(outputPath);

        return outputPath;
    }

    /**
     * Generate thumbnail
     */
    async generateThumbnail(inputPath, outputPath, size = 200) {
        await sharp(inputPath)
            .resize(size, size, {
                fit: 'cover',
                position: 'center'
            })
            .webp({ quality: 70 })
            .toFile(outputPath);

        return outputPath;
    }

    /**
     * Add watermark
     */
    async addWatermark(inputPath, outputPath, watermarkPath, position = 'bottom-right') {
        const positions = {
            'top-left': { gravity: 'northwest' },
            'top-center': { gravity: 'north' },
            'top-right': { gravity: 'northeast' },
            'center': { gravity: 'center' },
            'bottom-left': { gravity: 'southwest' },
            'bottom-center': { gravity: 'south' },
            'bottom-right': { gravity: 'southeast' }
        };

        await sharp(inputPath)
            .composite([{
                input: watermarkPath,
                ...positions[position],
                opacity: 0.3
            }])
            .webp({ quality: 80 })
            .toFile(outputPath);

        return outputPath;
    }

    /**
     * Get image metadata
     */
    async getMetadata(inputPath) {
        return sharp(inputPath).metadata();
    }

    /**
     * Convert image format
     */
    async convertFormat(inputPath, outputPath, format = 'webp', quality = 80) {
        await sharp(inputPath)
        [format]({ quality })
            .toFile(outputPath);

        return outputPath;
    }

    /**
     * Resize image
     */
    async resize(inputPath, outputPath, width, height, options = {}) {
        const { fit = 'cover', position = 'center' } = options;

        await sharp(inputPath)
            .resize(width, height, { fit, position })
            .toFile(outputPath);

        return outputPath;
    }
}

module.exports = new ImageProcessor();