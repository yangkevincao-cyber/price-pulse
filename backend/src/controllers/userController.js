// backend/src/controllers/userController.js
const { User, Listing, Transaction, Review, Wishlist } = require('../models');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const { validationResult } = require('express-validator');
const uploadService = require('../services/file/uploadService');
const cacheService = require('../services/cache/cacheService');

class UserController {
    /**
     * Get user profile by ID
     */
    async getUserProfile(req, res) {
        try {
            const { id } = req.params;

            const user = await User.findByPk(id, {
                attributes: {
                    exclude: ['password', 'verification_token', 'reset_token', 'reset_token_expiry'],
                },
                include: [
                    {
                        model: Listing,
                        as: 'listings',
                        where: { status: 'active' },
                        required: false,
                        limit: 5,
                        include: ['product'],
                    },
                    {
                        model: Review,
                        as: 'reviews_received',
                        where: { status: 'approved' },
                        required: false,
                        limit: 5,
                        include: ['reviewer'],
                    },
                ],
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found',
                });
            }

            // Get user stats
            const stats = await sequelize.query(`
                SELECT 
                    (SELECT COUNT(*) FROM listings WHERE user_id = $1 AND status = 'active') as active_listings,
                    (SELECT COUNT(*) FROM transactions WHERE seller_id = $1 AND status = 'completed') as total_sales,
                    (SELECT COUNT(*) FROM transactions WHERE buyer_id = $1 AND status = 'completed') as total_purchases,
                    (SELECT AVG(rating) FROM reviews WHERE reviewed_id = $1 AND status = 'approved') as avg_rating,
                    (SELECT COUNT(*) FROM reviews WHERE reviewed_id = $1 AND status = 'approved') as total_reviews
            `, {
                bind: [id],
                type: sequelize.QueryTypes.SELECT,
            });

            return res.json({
                success: true,
                data: {
                    user,
                    stats: stats[0],
                },
            });
        } catch (error) {
            logger.error('Get user profile error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch user profile',
            });
        }
    }

    /**
     * Get current user profile
     */
    async getMyProfile(req, res) {
        try {
            const user = await User.findByPk(req.user.id, {
                attributes: {
                    exclude: ['password', 'verification_token', 'reset_token', 'reset_token_expiry'],
                },
                include: [
                    {
                        model: Listing,
                        as: 'listings',
                        where: { status: 'active' },
                        required: false,
                        limit: 10,
                        include: ['product'],
                    },
                    {
                        model: Transaction,
                        as: 'purchases',
                        where: { status: 'completed' },
                        required: false,
                        limit: 10,
                    },
                    {
                        model: Transaction,
                        as: 'sales',
                        where: { status: 'completed' },
                        required: false,
                        limit: 10,
                    },
                ],
            });

            return res.json({
                success: true,
                data: { user },
            });
        } catch (error) {
            logger.error('Get my profile error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch profile',
            });
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const updateData = req.body;

            // Remove sensitive fields
            const allowedFields = [
                'first_name', 'last_name', 'bio', 'phone',
                'location_country', 'location_city', 'location_lat', 'location_lng',
                'avatar', 'preferences',
            ];

            const filteredData = {};
            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    filteredData[field] = updateData[field];
                }
            }

            const user = await User.findByPk(userId);
            await user.update(filteredData);

            // Clear cache
            await cacheService.deletePattern(`user:${userId}`);

            logger.info(`User profile updated: ${userId}`);

            return res.json({
                success: true,
                message: 'Profile updated successfully',
                data: { user: user.toJSON() },
            });
        } catch (error) {
            logger.error('Update profile error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to update profile',
            });
        }
    }

    /**
     * Upload user avatar
     */
    async uploadAvatar(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No image uploaded',
                });
            }

            const result = await uploadService.uploadFile(req.file, 'users');

            // Update user avatar
            const user = await User.findByPk(req.user.id);
            await user.update({ avatar: result.url });

            // Clear cache
            await cacheService.deletePattern(`user:${req.user.id}`);

            return res.json({
                success: true,
                message: 'Avatar uploaded successfully',
                data: { avatar: result.url },
            });
        } catch (error) {
            logger.error('Upload avatar error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload avatar',
            });
        }
    }

    /**
     * Get user settings
     */
    async getSettings(req, res) {
        try {
            const user = await User.findByPk(req.user.id, {
                attributes: ['preferences', 'email', 'phone', 'location_country'],
            });

            return res.json({
                success: true,
                data: {
                    settings: user.preferences || {},
                    email: user.email,
                    phone: user.phone,
                    location: user.location_country,
                },
            });
        } catch (error) {
            logger.error('Get settings error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch settings',
            });
        }
    }

    /**
     * Update user settings
     */
    async updateSettings(req, res) {
        try {
            const userId = req.user.id;
            const { preferences, phone, location_country } = req.body;

            const user = await User.findByPk(userId);

            const updates = {};
            if (preferences) {
                updates.preferences = {
                    ...user.preferences,
                    ...preferences,
                };
            }
            if (phone !== undefined) updates.phone = phone;
            if (location_country !== undefined) updates.location_country = location_country;

            await user.update(updates);

            return res.json({
                success: true,
                message: 'Settings updated successfully',
                data: { preferences: user.preferences },
            });
        } catch (error) {
            logger.error('Update settings error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to update settings',
            });
        }
    }

    /**
     * Get user stats (dashboard)
     */
    async getUserStats(req, res) {
        try {
            const userId = req.user.id;

            const stats = await sequelize.query(`
                WITH listing_stats AS (
                    SELECT 
                        COUNT(*) as total_listings,
                        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_listings,
                        COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_listings,
                        COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_listings
                    FROM listings
                    WHERE user_id = $1
                ),
                transaction_stats AS (
                    SELECT 
                        COUNT(*) as total_transactions,
                        SUM(amount) as total_revenue,
                        AVG(amount) as avg_order_value,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions
                    FROM transactions
                    WHERE seller_id = $1 AND status IN ('completed', 'shipping', 'delivered')
                ),
                alert_stats AS (
                    SELECT 
                        COUNT(*) as total_alerts,
                        COUNT(CASE WHEN read THEN 1 END) as read_alerts,
                        AVG(opportunity_score) as avg_opportunity_score
                    FROM demand_alerts
                    WHERE user_id = $1
                )
                SELECT 
                    (SELECT row_to_json(listing_stats) FROM listing_stats) as listings,
                    (SELECT row_to_json(transaction_stats) FROM transaction_stats) as transactions,
                    (SELECT row_to_json(alert_stats) FROM alert_stats) as alerts
            `, {
                bind: [userId],
                type: sequelize.QueryTypes.SELECT,
            });

            return res.json({
                success: true,
                data: stats[0],
            });
        } catch (error) {
            logger.error('Get user stats error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch user stats',
            });
        }
    }

    /**
     * Get seller profile for public view
     */
    async getSellerProfile(req, res) {
        try {
            const { id } = req.params;

            const seller = await User.findByPk(id, {
                attributes: [
                    'id', 'username', 'first_name', 'last_name', 'avatar',
                    'bio', 'seller_rating', 'total_sales', 'total_reviews',
                    'location_country', 'location_city', 'created_at',
                ],
            });

            if (!seller) {
                return res.status(404).json({
                    success: false,
                    error: 'Seller not found',
                });
            }

            // Get seller's active listings
            const listings = await Listing.findAll({
                where: {
                    user_id: id,
                    status: 'active',
                    available_quantity: { [sequelize.Op.gt]: 0 },
                },
                include: ['product'],
                limit: 10,
                order: [['created_at', 'DESC']],
            });

            // Get recent reviews
            const reviews = await Review.findAll({
                where: {
                    reviewed_id: id,
                    status: 'approved',
                },
                include: ['reviewer'],
                limit: 10,
                order: [['created_at', 'DESC']],
            });

            return res.json({
                success: true,
                data: {
                    seller,
                    listings,
                    reviews,
                    listing_count: listings.length,
                },
            });
        } catch (error) {
            logger.error('Get seller profile error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch seller profile',
            });
        }
    }

    /**
     * Get user notifications
     */
    async getNotifications(req, res) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, unreadOnly = false } = req.query;

            const offset = (page - 1) * limit;

            const where = { user_id: userId };
            if (unreadOnly === 'true') {
                where.read = false;
            }

            const { Notification } = require('../models');
            const { count, rows } = await Notification.findAndCountAll({
                where,
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            const unreadCount = await Notification.count({
                where: { user_id: userId, read: false },
            });

            return res.json({
                success: true,
                data: {
                    notifications: rows,
                    pagination: {
                        total: count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(count / limit),
                    },
                    unread_count: unreadCount,
                },
            });
        } catch (error) {
            logger.error('Get notifications error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch notifications',
            });
        }
    }

    /**
     * Mark notification as read
     */
    async markNotificationRead(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const { Notification } = require('../models');
            const notification = await Notification.findOne({
                where: { id, user_id: userId },
            });

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found',
                });
            }

            await notification.markAsRead();

            return res.json({
                success: true,
                message: 'Notification marked as read',
            });
        } catch (error) {
            logger.error('Mark notification read error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to mark notification as read',
            });
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllNotificationsRead(req, res) {
        try {
            const userId = req.user.id;

            const { Notification } = require('../models');
            await Notification.update(
                { read: true, read_at: new Date() },
                { where: { user_id: userId, read: false } }
            );

            return res.json({
                success: true,
                message: 'All notifications marked as read',
            });
        } catch (error) {
            logger.error('Mark all notifications read error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to mark notifications as read',
            });
        }
    }

    /**
     * Upload user avatar
     */
    async uploadAvatar(req, res) {
        try {
            const userId = req.user.id;

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No image uploaded'
                });
            }

            // Get user
            const user = await User.findByPk(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Delete old avatar if exists
            if (user.avatar) {
                const oldFilename = user.avatar.split('/').pop();
                await uploadService.deleteFile(oldFilename);
            }

            // Upload and process avatar
            const result = await uploadService.uploadFile(req.file, 'users', {
                process: true,
                generateThumbnails: true
            });

            // Get thumbnail URL (prefer square crop)
            const avatarUrl = result.thumbnails?.find(t => t.size === 'thumb')?.url || result.url;

            // Update user
            await user.update({ avatar: avatarUrl });

            // Clear cache
            await cacheService.deletePattern(`user:${userId}`);

            return res.json({
                success: true,
                message: 'Avatar uploaded successfully',
                data: {
                    avatar: avatarUrl,
                    original: result.url,
                    thumbnails: result.thumbnails
                }
            });

        } catch (error) {
            logger.error('Upload avatar error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload avatar'
            });
        }
    }

    /**
     * Generate default avatar using initials
     */
    async generateDefaultAvatar(req, res) {
        try {
            const { id } = req.params;

            const user = await User.findByPk(id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Get initials
            const initials = `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`.toUpperCase();

            // Generate avatar URL using UI Avatars API
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=200&background=1E3A8A&color=FFFFFF&bold=true`;

            // Update user
            await user.update({ avatar: avatarUrl });

            return res.json({
                success: true,
                data: { avatar: avatarUrl }
            });

        } catch (error) {
            logger.error('Generate default avatar error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to generate avatar'
            });
        }
    }

    /**
     * Upload user cover image
     */
    async uploadCoverImage(req, res) {
        try {
            const userId = req.user.id;

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No image uploaded'
                });
            }

            const user = await User.findByPk(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Delete old cover if exists
            if (user.cover_image) {
                const oldFilename = user.cover_image.split('/').pop();
                await uploadService.deleteFile(oldFilename);
            }

            // Upload and process cover image (wider format)
            const result = await uploadService.uploadFile(req.file, 'users', {
                process: true,
                generateThumbnails: true
            });

            // Update user
            await user.update({ cover_image: result.url });

            return res.json({
                success: true,
                message: 'Cover image uploaded successfully',
                data: { cover_image: result.url }
            });

        } catch (error) {
            logger.error('Upload cover image error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to upload cover image'
            });
        }
    }
}

module.exports = new UserController();