// backend/src/services/intelligence/exchangeMatchingService.js
const { sequelize } = require('../../config/database');
const { Exchange, Product, User, Notification } = require('../../models');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');

class ExchangeMatchingService {
    /**
     * Find matches for an exchange listing
     */
    async findMatches(listingId) {
        const listing = await Exchange.findByPk(listingId, {
            include: ['user', 'offeredProduct', 'wantedProduct'],
        });

        if (!listing) {
            throw new Error('Exchange listing not found');
        }

        if (listing.status !== 'active') {
            throw new Error('Listing is not active');
        }

        // Check cache
        const cacheKey = `exchange_matches:${listingId}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        // Find potential matches
        const matches = await this.findPotentialMatches(listing);

        // Score and rank matches
        const rankedMatches = this.scoreMatches(matches, listing);

        // Store matches
        for (const match of rankedMatches) {
            await this.storeMatch(listingId, match);
        }

        // Cache for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(rankedMatches));

        logger.info(`Found ${rankedMatches.length} exchange matches for listing ${listingId}`);

        return rankedMatches;
    }

    /**
     * Find potential matches
     */
    async findPotentialMatches(listing) {
        const matches = await Exchange.findAll({
            where: {
                id: { [sequelize.Op.ne]: listing.id },
                status: 'active',
                user_id: { [sequelize.Op.ne]: listing.user_id },
                [sequelize.Op.or]: [
                    {
                        offered_product_id: listing.wanted_product_id || sequelize.col('wanted_product_id'),
                    },
                    {
                        wanted_product_id: listing.offered_product_id,
                    },
                ],
            },
            include: ['user', 'offeredProduct', 'wantedProduct'],
        });

        return matches;
    }

    /**
     * Score and rank matches
     */
    scoreMatches(matches, listing) {
        return matches.map(match => {
            const score = this.calculateMatchScore(match, listing);
            const suggestedCashAdjustment = this.calculateCashAdjustment(match, listing);

            return {
                match_id: match.id,
                match_score: score,
                offered_product_id: match.offered_product_id,
                offered_product_name: match.offered_product_name,
                wanted_product_id: match.wanted_product_id,
                wanted_product_name: match.wanted_product_name,
                user_id: match.user_id,
                username: match.user.username,
                user_rating: match.user.seller_rating,
                suggested_cash_adjustment: suggestedCashAdjustment,
                distance: this.calculateDistance(listing.user, match.user),
                timestamp: match.created_at,
            };
        }).sort((a, b) => b.match_score - a.match_score);
    }

    /**
     * Calculate match score
     */
    calculateMatchScore(match, listing) {
        let score = 0;

        // Exact product match (60%)
        if (match.offered_product_id === listing.wanted_product_id) {
            score += 0.6;
        }
        if (match.wanted_product_id === listing.offered_product_id) {
            score += 0.4;
        }

        // Category match (20%)
        if (match.offeredProduct?.category_id === listing.wantedProduct?.category_id) {
            score += 0.1;
        }
        if (match.wantedProduct?.category_id === listing.offeredProduct?.category_id) {
            score += 0.1;
        }

        // Condition match (10%)
        if (this.isConditionCompatible(match.offered_condition, listing.wanted_condition)) {
            score += 0.05;
        }
        if (this.isConditionCompatible(match.wanted_condition, listing.offered_condition)) {
            score += 0.05;
        }

        // User reputation (10%)
        const userRating = match.user.seller_rating || 0;
        score += userRating / 5 * 0.1;

        // Cash adjustment compatibility
        const cashAdjustment = Math.abs(match.cash_adjustment - listing.cash_adjustment);
        if (cashAdjustment < 10) {
            score += 0.05;
        } else if (cashAdjustment < 50) {
            score += 0.02;
        }

        return Math.min(score, 1);
    }

    /**
     * Check condition compatibility
     */
    isConditionCompatible(offeredCondition, wantedCondition) {
        if (!wantedCondition || wantedCondition === 'any') return true;
        if (offeredCondition === wantedCondition) return true;

        const conditionRank = {
            'new': 5,
            'like-new': 4,
            'good': 3,
            'fair': 2,
            'poor': 1,
        };

        const offeredRank = conditionRank[offeredCondition] || 0;
        const wantedRank = conditionRank[wantedCondition] || 0;

        return offeredRank >= wantedRank;
    }

    /**
     * Calculate suggested cash adjustment
     */
    calculateCashAdjustment(match) {
        // Get market prices for both products
        const offeredPrice = match.offeredProduct?.estimated_value || 0;
        const wantedPrice = match.wantedProduct?.estimated_value || 0;

        // Calculate value difference
        //const valueDifference = offeredPrice - wantedPrice;

        // Adjust based on conditions
        const conditionMultiplier = {
            'new': 1.0,
            'like-new': 0.9,
            'good': 0.75,
            'fair': 0.6,
            'poor': 0.4,
        };

        const offeredMultiplier = conditionMultiplier[match.offered_condition] || 0.7;
        const wantedMultiplier = conditionMultiplier[match.wanted_condition] || 0.7;

        const adjustedDifference = (offeredPrice * offeredMultiplier) - (wantedPrice * wantedMultiplier);

        // Round to nearest 5
        return Math.round(adjustedDifference / 5) * 5;
    }

    /**
     * Calculate distance between users
     */
    calculateDistance(user1, user2) {
        if (!user1.location_lat || !user1.location_lng ||
            !user2.location_lat || !user2.location_lng) {
            return null;
        }

        const lat1 = parseFloat(user1.location_lat);
        const lon1 = parseFloat(user1.location_lng);
        const lat2 = parseFloat(user2.location_lat);
        const lon2 = parseFloat(user2.location_lng);

        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Store match in database
     */
    async storeMatch(listingId, match) {
        await sequelize.query(`
            INSERT INTO exchange_matches (
                listing1_id, listing2_id, match_score, 
                suggested_cash_adjustment, status, created_at
            ) VALUES ($1, $2, $3, $4, 'pending', NOW())
            ON CONFLICT (listing1_id, listing2_id) DO UPDATE
            SET match_score = $3, suggested_cash_adjustment = $4, updated_at = NOW()
        `, {
            bind: [
                listingId,
                match.match_id,
                match.match_score,
                match.suggested_cash_adjustment,
            ],
        });
    }

    /**
     * Accept exchange match
     */
    async acceptMatch(matchId, userId) {
        const match = await Exchange.findByPk(matchId);

        if (!match) {
            throw new Error('Match not found');
        }

        if (match.user_id !== userId) {
            throw new Error('Unauthorized to accept this match');
        }

        // Get the matched listing
        const otherListing = await Exchange.findByPk(match.matched_with_user_id);

        // Update both listings
        await match.update({
            status: 'accepted',
            accepted_at: new Date(),
        });

        await otherListing.update({
            status: 'accepted',
            matched_with_user_id: match.user_id,
            accepted_at: new Date(),
        });

        // Create notifications for both users
        const user = await User.findByPk(userId);
        const otherUser = await User.findByPk(otherListing.user_id);

        await Notification.create({
            user_id: otherUser.id,
            type: 'exchange_accepted',
            title: 'Exchange Accepted!',
            message: `${user.username} accepted your exchange match for ${match.offered_product_name}`,
            data: {
                match_id: matchId,
                exchange_id: otherListing.id,
            },
            action_url: `/exchanges/matches/${matchId}`,
            action_label: 'View Exchange',
        });

        await Notification.create({
            user_id: userId,
            type: 'exchange_accepted',
            title: 'Exchange Accepted!',
            message: `You accepted the exchange match for ${match.offered_product_name}`,
            data: {
                match_id: matchId,
                exchange_id: match.id,
            },
            action_url: `/exchanges/matches/${matchId}`,
            action_label: 'View Exchange',
        });

        logger.info(`Exchange match ${matchId} accepted by user ${userId}`);

        return {
            success: true,
            message: 'Exchange match accepted successfully',
            match,
        };
    }

    /**
     * Decline exchange match
     */
    async declineMatch(matchId, userId) {
        const match = await Exchange.findByPk(matchId);

        if (!match) {
            throw new Error('Match not found');
        }

        if (match.user_id !== userId) {
            throw new Error('Unauthorized to decline this match');
        }

        await match.update({
            status: 'cancelled',
        });

        logger.info(`Exchange match ${matchId} declined by user ${userId}`);

        return {
            success: true,
            message: 'Exchange match declined',
        };
    }

    /**
     * Get matches for a user
     */
    async getMatchesForUser(userId) {
        const matches = await Exchange.findAll({
            where: {
                user_id: userId,
                status: 'matched',
            },
            include: [
                {
                    model: User,
                    as: 'matched_user',
                    attributes: ['id', 'username', 'seller_rating'],
                },
                {
                    model: Product,
                    as: 'offeredProduct',
                    attributes: ['id', 'name', 'images'],
                },
                {
                    model: Product,
                    as: 'wantedProduct',
                    attributes: ['id', 'name', 'images'],
                },
            ],
            order: [['matched_at', 'DESC']],
        });

        return matches;
    }

    /**
     * Process pending matches (background job)
     */
    async processPendingMatches() {
        // Find listings that need matching
        const listings = await Exchange.findAll({
            where: {
                status: 'active',
                created_at: { [sequelize.Op.lt]: new Date(Date.now() - 3600000) }, // Older than 1 hour
            },
            include: ['user'],
        });

        let processedCount = 0;
        for (const listing of listings) {
            try {
                await this.findMatches(listing.id);
                processedCount++;
            } catch (error) {
                logger.error(`Failed to process matches for listing ${listing.id}:`, error);
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        logger.info(`Processed matches for ${processedCount} listings`);

        return processedCount;
    }
}

module.exports = new ExchangeMatchingService();