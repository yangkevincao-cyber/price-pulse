// backend/src/controllers/listingController.js
const { Listing, Product, User, Notification } = require('../models');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const { validationResult } = require('express-validator');
const cacheService = require('../services/cache/cacheService');
const uploadService = require('../services/file/uploadService');
const fraudDetectionService = require('../services/intelligence/fraudDetectionService');

class ListingController {
    /**
     * Create a new listing
     */
    async createListing(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array(),
                });
            }

            const userId = req.user.id;
            const listingData = req.body;

            // Check if user is seller or admin
            if (!['seller', 'admin'].includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    error: 'Only sellers can create listings',
                });
            }

            // Check product exists
            const product = await Product.findByPk(listingData.product_id);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    error: 'Product not found',
                });
            }

            // Fraud detection
            const fraudCheck = await fraudDetectionService.detectFraud({
                userId,
                productId: listingData.product_id,
                amount: listingData.price,
                title: listingData.title,
                description: listingData.description,
                ipAddress: req.ip,
                deviceFingerprint: req.headers['device-fingerprint'],
                listingId: null,
            });

            if (fraudCheck.isFraudulent) {
                logger.warn(`Fraudulent listing attempt by user ${userId}`, fraudCheck);
                return res.status(403).json({
                    success: false,
                    error: 'Listing blocked due to fraud detection',
                    riskScore: fraudCheck.riskScore,
                });
            }

            // Create listing
            const listing = await Listing.create({
                ...listingData,
                user_id: userId,
                status: 'active',
                available_quantity: listingData.quantity || 1,
            });

            // Update product demand score
            await product.updateDemandScore();

            // Clear cache
            await cacheService.deletePattern(`listings:*`);
            await cacheService.deletePattern(`products:list:*`);

            // Send notification to seller (optional, for confirmation)
            await Notification.create({
                user_id: userId,
                type: 'system_announcement',
                title: 'Listing Created',
                message: `Your listing "${listing.title}" is now live!`,
                data: { listing_id: listing.id },
                action_url: `/listings/${listing.id}`,
                action_label: 'View Listing',
            });

            logger.info(`Listing created: ${listing.title} by user ${userId}`);

            return res.status(201).json({
                success: true,
                message: 'Listing created successfully',
                data: { listing },
            });
        } catch (error) {
            logger.error('Create listing error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to create listing',
            });
        }
    }

    /**
     * Get all listings with filters
     */
    async getListings(req, res) {
        try {
            const {
                page = 1,
                limit = 20,
                categoryId,
                productId,
                sellerId,
                search,
                minPrice,
                maxPrice,
                condition,
                sortBy = 'created_at',
                sortOrder = 'DESC',
                inStock,
            } = req.query;

            const offset = (page - 1) * limit;

            const where = { status: 'active' };

            // Filters
            if (productId) {
                where.product_id = productId;
            }

            if (sellerId) {
                where.user_id = sellerId;
            }

            if (categoryId) {
                where.category_id = categoryId;
            }

            if (search) {
                where.title = { [sequelize.Op.iLike]: `%${search}%` };
            }

            if (minPrice) {
                where.price = { [sequelize.Op.gte]: minPrice };
            }

            if (maxPrice) {
                where.price = {
                    ...where.price,
                    [sequelize.Op.lte]: maxPrice
                };
            }

            if (condition) {
                where.condition = condition;
            }

            if (inStock === 'true') {
                where.available_quantity = { [sequelize.Op.gt]: 0 };
            }

            const { count, rows } = await Listing.findAndCountAll({
                where,
                include: [
                    {
                        model: Product,
                        as: 'product',
                        include: ['category'],
                    },
                    {
                        model: User,
                        as: 'seller',
                        attributes: ['id', 'username', 'seller_rating', 'total_sales', 'avatar'],
                    },
                ],
                order: [[sortBy, sortOrder]],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            return res.json({
                success: true,
                data: {
                    listings: rows,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                },
            });
        } catch (error) {
            logger.error('Get listings error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch listings',
            });
        }
    }

    /**
     * Get listing by ID
     */
    async getListingById(req, res) {
        try {
            const { id } = req.params;

            const listing = await Listing.findByPk(id, {
                include: [
                    {
                        model: Product,
                        as: 'product',
                        include: ['category'],
                    },
                    {
                        model: User,
                        as: 'seller',
                        attributes: ['id', 'username', 'seller_rating', 'total_sales', 'avatar', 'bio'],
                    },
                ],
            });

            if (!listing) {
                return res.status(404).json({
                    success: false,
                    error: 'Listing not found',
                });
            }

            // Increment view count
            await listing.incrementView();

            return res.json({
                success: true,
                data: { listing },
            });
        } catch (error) {
            logger.error('Get listing error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch listing',
            });
        }
    }

    /**
     * Update listing
     */
    async updateListing(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const listing = await Listing.findByPk(id);

            if (!listing) {
                return res.status(404).json({
                    success: false,
                    error: 'Listing not found',
                });
            }

            // Check ownership
            if (listing.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this listing',
                });
            }

            // Prevent updating sold listings
            if (listing.status === 'sold') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update a sold listing',
                });
            }

            // Update listing
            await listing.update(req.body);

            // Clear cache
            await cacheService.deletePattern(`listings:${id}`);
            await cacheService.deletePattern(`listings:*`);

            logger.info(`Listing updated: ${listing.title} (${listing.id})`);

            return res.json({
                success: true,
                message: 'Listing updated successfully',
                data: { listing },
            });
        } catch (error) {
            logger.error('Update listing error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to update listing',
            });
        }
    }

    /**
     * Delete listing
     */
    async deleteListing(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const listing = await Listing.findByPk(id);

            if (!listing) {
                return res.status(404).json({
                    success: false,
                    error: 'Listing not found',
                });
            }

            // Check ownership
            if (listing.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this listing',
                });
            }

            // Soft delete
            await listing.update({
                status: 'deleted',
            });

            // Clear cache
            await cacheService.deletePattern(`listings:${id}`);
            await cacheService.deletePattern(`listings:*`);

            logger.info(`Listing deleted: ${listing.title} (${listing.id})`);

            return res.json({
                success: true,
                message: 'Listing deleted successfully',
            });
        } catch (error) {
            logger.error('Delete listing error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete listing',
            });
        }
    }

    /**
     * Get user's listings
     */
    async getMyListings(req, res) {
        try {
            const userId = req.user.id;
            const { status, page = 1, limit = 20 } = req.query;

            const offset = (page - 1) * limit;

            const where = { user_id: userId };
            if (status) {
                where.status = status;
            }

            const { count, rows } = await Listing.findAndCountAll({
                where,
                include: [{
                    model: Product,
                    as: 'product',
                    include: ['category'],
                }],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            return res.json({
                success: true,
                data: {
                    listings: rows,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                },
            });
        } catch (error) {
            logger.error('Get my listings error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch listings',
            });
        }
    }

    /**
     * Toggle listing status (active/paused)
     */
    async toggleStatus(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const listing = await Listing.findByPk(id);

            if (!listing) {
                return res.status(404).json({
                    success: false,
                    error: 'Listing not found',
                });
            }

            // Check ownership
            if (listing.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this listing',
                });
            }

            const newStatus = listing.status === 'active' ? 'paused' : 'active';
            await listing.update({ status: newStatus });

            // Clear cache
            await cacheService.deletePattern(`listings:${id}`);
            await cacheService.deletePattern(`listings:*`);

            return res.json({
                success: true,
                message: `Listing ${newStatus === 'active' ? 'activated' : 'paused'}`,
                data: { listing },
            });
        } catch (error) {
            logger.error('Toggle listing status error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to update listing status',
            });
        }
    }

    /**
     * Get seller's listings
     */
    async getSellerListings(req, res) {
        try {
            const { sellerId } = req.params;
            const { page = 1, limit = 20, status = 'active' } = req.query;

            const offset = (page - 1) * limit;

            const { count, rows } = await Listing.findAndCountAll({
                where: {
                    user_id: sellerId,
                    status,
                    available_quantity: { [sequelize.Op.gt]: 0 },
                },
                include: [{
                    model: Product,
                    as: 'product',
                    include: ['category'],
                }],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            return res.json({
                success: true,
                data: {
                    listings: rows,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                },
            });
        } catch (error) {
            logger.error('Get seller listings error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch seller listings',
            });
        }
    }

    /**
     * Upload listing images
     */
    async uploadImages(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const listing = await Listing.findByPk(id);

            if (!listing) {
                return res.status(404).json({
                    success: false,
                    error: 'Listing not found',
                });
            }

            // Check ownership
            if (listing.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this listing',
                });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No images uploaded',
                });
            }

            // Upload images
            const uploadPromises = req.files.map(file =>
                uploadService.uploadFile(file, 'listings')
            );
            const uploadResults = await Promise.all(uploadPromises);

            const imageUrls = uploadResults.map(result => result.url);

            // Update listing images
            const currentImages = listing.images || [];
            const newImages = [...currentImages, ...imageUrls];
            await listing.update({ images: newImages });

            logger.info(`Uploaded ${imageUrls.length} images for listing ${id}`);

            return res.json({
                success: true,
                message: 'Images uploaded successfully',
                data: {
                    images: imageUrls,
                    total: newImages.length,
                },
            });
        } catch (error) {
            logger.error('Upload listing images error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload images',
            });
        }
    }

    /**
     * Delete listing image
     */
    async deleteImage(req, res) {
        try {
            const { id, imageIndex } = req.params;
            const userId = req.user.id;

            const listing = await Listing.findByPk(id);

            if (!listing) {
                return res.status(404).json({
                    success: false,
                    error: 'Listing not found',
                });
            }

            // Check ownership
            if (listing.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this listing',
                });
            }

            const images = listing.images || [];
            const index = parseInt(imageIndex);

            if (index < 0 || index >= images.length) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid image index',
                });
            }

            const deletedImage = images[index];
            images.splice(index, 1);
            await listing.update({ images });

            // Delete from storage
            const filename = deletedImage.split('/').pop();
            await uploadService.deleteFile(filename);

            return res.json({
                success: true,
                message: 'Image deleted successfully',
                data: { images },
            });
        } catch (error) {
            logger.error('Delete listing image error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete image',
            });
        }
    }

    /**
     * Upload listing images
     */
    async uploadListingImages(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Verify listing exists and user owns it
            const listing = await Listing.findByPk(id);
            if (!listing) {
                return res.status(404).json({
                    success: false,
                    error: 'Listing not found'
                });
            }

            if (listing.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this listing'
                });
            }

            if (listing.status === 'sold') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot add images to a sold listing'
                });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No images uploaded'
                });
            }

            // Process images
            const processedImages = [];
            for (const file of req.files) {
                const result = await uploadService.uploadFile(file, 'listings', {
                    process: true,
                    generateThumbnails: true
                });

                processedImages.push({
                    original: result.url,
                    thumbnail: result.thumbnails?.find(t => t.size === 'thumb')?.url,
                    medium: result.processed?.find(p => p.size === 'medium')?.url,
                    metadata: result.metadata
                });
            }

            // Update listing
            const currentImages = listing.images || [];
            const newImages = processedImages.map(img => img.original);
            await listing.update({
                images: [...currentImages, ...newImages],
                main_image: currentImages.length === 0 ? newImages[0] : listing.main_image
            });

            // Clear cache
            await cacheService.deletePattern(`listing:${id}`);

            return res.status(201).json({
                success: true,
                message: 'Listing images uploaded successfully',
                data: {
                    images: processedImages,
                    listing: listing.toJSON()
                }
            });

        } catch (error) {
            logger.error('Upload listing images error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload listing images'
            });
        }
    }

    /**
     * Set main listing image
     */
    async setMainListingImage(req, res) {
        try {
            const { id, imageIndex } = req.params;
            const userId = req.user.id;

            const listing = await Listing.findByPk(id);
            if (!listing) {
                return res.status(404).json({
                    success: false,
                    error: 'Listing not found'
                });
            }

            if (listing.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this listing'
                });
            }

            const images = listing.images || [];
            const index = parseInt(imageIndex);

            if (index < 0 || index >= images.length) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid image index'
                });
            }

            await listing.update({ main_image: images[index] });

            // Clear cache
            await cacheService.deletePattern(`listing:${id}`);

            return res.json({
                success: true,
                message: 'Main image updated successfully',
                data: { main_image: images[index] }
            });

        } catch (error) {
            logger.error('Set main listing image error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to set main image'
            });
        }
    }

    /**
     * Delete listing image
     */
    async deleteListingImage(req, res) {
        try {
            const { id, imageIndex } = req.params;
            const userId = req.user.id;

            const listing = await Listing.findByPk(id);
            if (!listing) {
                return res.status(404).json({
                    success: false,
                    error: 'Listing not found'
                });
            }

            if (listing.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this listing'
                });
            }

            const images = listing.images || [];
            const index = parseInt(imageIndex);

            if (index < 0 || index >= images.length) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid image index'
                });
            }

            // Delete file from storage
            const imageUrl = images[index];
            const filename = imageUrl.split('/').pop();
            await uploadService.deleteFile(filename);

            // Remove from listing
            images.splice(index, 1);
            await listing.update({
                images,
                main_image: images.length > 0 && listing.main_image === imageUrl
                    ? images[0]
                    : listing.main_image
            });

            // Clear cache
            await cacheService.deletePattern(`listing:${id}`);

            return res.json({
                success: true,
                message: 'Listing image deleted successfully',
                data: { images }
            });

        } catch (error) {
            logger.error('Delete listing image error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete listing image'
            });
        }
    }
}

module.exports = new ListingController();