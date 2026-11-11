// backend/src/controllers/exchangeController.js
const { Exchange, User, Product, Notification } = require('../models');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const { validationResult } = require('express-validator');
const exchangeMatchingService = require('../services/intelligence/exchangeMatchingService');
const fraudDetectionService = require('../services/intelligence/fraudDetectionService');

class ExchangeController {
    /**
     * Create exchange listing
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

            // Check if user is seller
            if (req.user.role !== 'seller' && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only sellers can create exchange listings',
                });
            }

            // Validate offered product exists
            const offeredProduct = await Product.findByPk(listingData.offered_product_id);
            if (!offeredProduct) {
                return res.status(404).json({
                    success: false,
                    error: 'Offered product not found',
                });
            }

            // Validate wanted product if provided
            if (listingData.wanted_product_id) {
                const wantedProduct = await Product.findByPk(listingData.wanted_product_id);
                if (!wantedProduct) {
                    return res.status(404).json({
                        success: false,
                        error: 'Wanted product not found',
                    });
                }
            }

            // Fraud detection
            const fraudCheck = await fraudDetectionService.detectFraud({
                userId,
                productId: listingData.offered_product_id,
                amount: listingData.cash_adjustment || 0,
                title: `Exchange: ${offeredProduct.name}`,
                description: listingData.notes || '',
                ipAddress: req.ip,
                deviceFingerprint: req.headers['device-fingerprint'],
                listingId: null,
            });

            if (fraudCheck.isFraudulent) {
                logger.warn(`Fraudulent exchange listing attempt by user ${userId}`, fraudCheck);
                return res.status(403).json({
                    success: false,
                    error: 'Listing blocked due to fraud detection',
                    riskScore: fraudCheck.riskScore,
                });
            }

            // Create exchange listing
            const exchange = await Exchange.create({
                ...listingData,
                user_id: userId,
                offered_product_name: offeredProduct.name,
                status: 'active',
            });

            // Queue for matching
            await exchangeMatchingService.findMatches(exchange.id);

            // Send notification
            await Notification.create({
                user_id: userId,
                type: 'system_announcement',
                title: 'Exchange Listing Created',
                message: `Your exchange listing for "${offeredProduct.name}" is now live!`,
                data: { exchange_id: exchange.id },
                action_url: `/exchanges/${exchange.id}`,
                action_label: 'View Listing',
            });

            logger.info(`Exchange listing created: ${exchange.id} by user ${userId}`);

            return res.status(201).json({
                success: true,
                message: 'Exchange listing created successfully',
                data: { exchange },
            });
        } catch (error) {
            logger.error('Create exchange listing error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to create exchange listing',
            });
        }
    }

    /**
     * Get exchange listings
     */
    async getListings(req, res) {
        try {
            const {
                page = 1,
                limit = 20,
                categoryId,
                search,
                condition,
                sortBy = 'created_at',
                sortOrder = 'DESC',
            } = req.query;

            const offset = (page - 1) * limit;

            const where = { status: 'active' };

            if (condition) {
                where.offered_condition = condition;
            }

            if (search) {
                where.offered_product_name = { [sequelize.Op.iLike]: `%${search}%` };
            }

            const include = [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'username', 'seller_rating', 'avatar'],
                },
                {
                    model: Product,
                    as: 'offeredProduct',
                    include: ['category'],
                },
            ];

            if (categoryId) {
                include.push({
                    model: Product,
                    as: 'offeredProduct',
                    where: { category_id: categoryId },
                    include: ['category'],
                });
            }

            const { count, rows } = await Exchange.findAndCountAll({
                where,
                include,
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
            logger.error('Get exchange listings error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch exchange listings',
            });
        }
    }

    /**
     * Get exchange listing by ID
     */
    async getListingById(req, res) {
        try {
            const { id } = req.params;

            const exchange = await Exchange.findByPk(id, {
                include: [
                    {
                        model: User,
                        as: 'user',
                        attributes: ['id', 'username', 'seller_rating', 'avatar', 'bio'],
                    },
                    {
                        model: Product,
                        as: 'offeredProduct',
                        include: ['category'],
                    },
                    {
                        model: Product,
                        as: 'wantedProduct',
                        include: ['category'],
                    },
                ],
            });

            if (!exchange) {
                return res.status(404).json({
                    success: false,
                    error: 'Exchange listing not found',
                });
            }

            // Get matches if user is the owner
            let matches = null;
            if (req.user && exchange.user_id === req.user.id) {
                matches = await exchangeMatchingService.getMatchesForUser(req.user.id);
            }

            return res.json({
                success: true,
                data: {
                    exchange,
                    matches: matches || [],
                },
            });
        } catch (error) {
            logger.error('Get exchange listing error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch exchange listing',
            });
        }
    }

    /**
     * Update exchange listing
     */
    async updateListing(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const exchange = await Exchange.findByPk(id);

            if (!exchange) {
                return res.status(404).json({
                    success: false,
                    error: 'Exchange listing not found',
                });
            }

            // Check ownership
            if (exchange.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this listing',
                });
            }

            if (exchange.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update a listing that is not active',
                });
            }

            await exchange.update(req.body);

            logger.info(`Exchange listing updated: ${exchange.id}`);

            return res.json({
                success: true,
                message: 'Exchange listing updated successfully',
                data: { exchange },
            });
        } catch (error) {
            logger.error('Update exchange listing error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to update exchange listing',
            });
        }
    }

    /**
     * Delete exchange listing
     */
    async deleteListing(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const exchange = await Exchange.findByPk(id);

            if (!exchange) {
                return res.status(404).json({
                    success: false,
                    error: 'Exchange listing not found',
                });
            }

            // Check ownership
            if (exchange.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this listing',
                });
            }

            await exchange.update({ status: 'cancelled' });

            logger.info(`Exchange listing deleted: ${exchange.id}`);

            return res.json({
                success: true,
                message: 'Exchange listing deleted successfully',
            });
        } catch (error) {
            logger.error('Delete exchange listing error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete exchange listing',
            });
        }
    }

    /**
     * Get user's exchange listings
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

            const { count, rows } = await Exchange.findAndCountAll({
                where,
                include: [
                    {
                        model: Product,
                        as: 'offeredProduct',
                        include: ['category'],
                    },
                    {
                        model: Product,
                        as: 'wantedProduct',
                        include: ['category'],
                    },
                ],
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
            logger.error('Get my exchange listings error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch exchange listings',
            });
        }
    }

    /**
     * Get exchange matches
     */
    async getMatches(req, res) {
        try {
            const userId = req.user.id;

            // Get user's active exchange listings
            const listings = await Exchange.findAll({
                where: {
                    user_id: userId,
                    status: 'active',
                },
                attributes: ['id'],
            });

            if (listings.length === 0) {
                return res.json({
                    success: true,
                    data: [],
                });
            }

            const listingIds = listings.map(l => l.id);

            // Get matches
            const matches = await sequelize.query(`
                SELECT 
                    em.*,
                    el1.offered_product_name as your_offered_product,
                    el1.offered_condition as your_offered_condition,
                    el2.offered_product_name as their_offered_product,
                    el2.offered_condition as their_offered_condition,
                    u.username as matched_username,
                    u.seller_rating as matched_rating
                FROM exchange_matches em
                JOIN exchange_listings el1 ON el1.id = em.listing1_id
                JOIN exchange_listings el2 ON el2.id = em.listing2_id
                JOIN users u ON u.id = el2.user_id
                WHERE em.listing1_id IN (${listingIds.join(',')})
                   OR em.listing2_id IN (${listingIds.join(',')})
                ORDER BY em.match_score DESC
            `, {
                type: sequelize.QueryTypes.SELECT,
            });

            return res.json({
                success: true,
                data: matches,
            });
        } catch (error) {
            logger.error('Get exchange matches error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch exchange matches',
            });
        }
    }

    /**
     * Accept exchange match
     */
    async acceptMatch(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const match = await Exchange.findByPk(id);

            if (!match) {
                return res.status(404).json({
                    success: false,
                    error: 'Match not found',
                });
            }

            if (match.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not the owner of this listing',
                });
            }

            const result = await exchangeMatchingService.acceptMatch(id, userId);

            return res.json({
                success: true,
                message: result.message,
                data: result,
            });
        } catch (error) {
            logger.error('Accept match error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to accept match',
            });
        }
    }

    /**
     * Decline exchange match
     */
    async declineMatch(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const match = await Exchange.findByPk(id);

            if (!match) {
                return res.status(404).json({
                    success: false,
                    error: 'Match not found',
                });
            }

            if (match.user_id !== userId) {
                return res.status(403).json({
                    success: false,
                    error: 'You are not the owner of this listing',
                });
            }

            const result = await exchangeMatchingService.declineMatch(id, userId);

            return res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Decline match error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to decline match',
            });
        }
    }

    /**
     * Get exchange statistics
     */
    async getStats(req, res) {
        try {
            const userId = req.user.id;

            const stats = await Exchange.findAll({
                where: { user_id: userId },
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total_listings'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = \'active\' THEN 1 ELSE 0 END')), 'active_listings'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = \'matched\' THEN 1 ELSE 0 END')), 'matched_listings'],
                    [sequelize.fn('SUM', sequelize.literal('CASE WHEN status = \'completed\' THEN 1 ELSE 0 END')), 'completed_exchanges'],
                ],
            });

            return res.json({
                success: true,
                data: stats[0] || {
                    total_listings: 0,
                    active_listings: 0,
                    matched_listings: 0,
                    completed_exchanges: 0,
                },
            });
        } catch (error) {
            logger.error('Get exchange stats error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch exchange statistics',
            });
        }
    }
}

module.exports = new ExchangeController();