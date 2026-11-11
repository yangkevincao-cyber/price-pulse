// backend/src/services/intelligence/demandAlertService.js
const { sequelize } = require('../../config/database');
const { DemandAlert, User, Notification } = require('../../models');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');

class DemandAlertService {
    /**
     * Generate demand alerts for all products
     */
    async generateAlerts() {
        const opportunities = await this.findDemandOpportunities();

        let generatedCount = 0;
        for (const opp of opportunities) {
            const alerted = await this.createAlertForOpportunity(opp);
            if (alerted) generatedCount++;
        }

        logger.info(`Generated ${generatedCount} demand alerts`);

        return { generatedCount, opportunities };
    }

    /**
     * Find demand opportunities
     */
    async findDemandOpportunities() {
        const [opportunities] = await sequelize.query(`
            WITH weekly_demand AS (
                SELECT 
                    p.id as product_id,
                    p.name as product_name,
                    p.category_id,
                    c.name as category_name,
                    p.demand_score,
                    COUNT(DISTINCT sq.id) as searches_this_week,
                    LAG(COUNT(DISTINCT sq.id), 1) OVER (PARTITION BY p.id ORDER BY DATE_TRUNC('week', sq.created_at)) as searches_last_week,
                    COUNT(DISTINCT w.id) as wishlists,
                    AVG(l.price) as avg_listing_price,
                    COUNT(DISTINCT l.id) as active_listings,
                    COUNT(DISTINCT l.user_id) as active_sellers
                FROM products p
                JOIN categories c ON p.category_id = c.id
                LEFT JOIN search_queries sq ON sq.query_text ILIKE '%' || p.name || '%'
                    AND sq.created_at > NOW() - INTERVAL '7 days'
                LEFT JOIN wishlists w ON w.product_id = p.id
                    AND w.created_at > NOW() - INTERVAL '7 days'
                LEFT JOIN listings l ON l.product_id = p.id
                    AND l.status = 'active'
                    AND l.available_quantity > 0
                WHERE p.is_active = true
                    AND p.is_deleted = false
                GROUP BY p.id, c.name, DATE_TRUNC('week', sq.created_at)
                HAVING COUNT(DISTINCT sq.id) > 10
            )
            SELECT 
                *,
                CASE 
                    WHEN searches_this_week > searches_last_week * 1.5 THEN 'spike'
                    WHEN wishlists > 20 AND active_listings < 5 THEN 'inventory_gap'
                    WHEN avg_listing_price > 0 AND searches_this_week > 100 THEN 'trending'
                    WHEN p.demand_score > 0.8 AND active_listings < 10 THEN 'price_opportunity'
                    ELSE NULL
                END as alert_type,
                LEAST(1.0, 
                    (searches_this_week / 500.0) * 0.4 +
                    (wishlists / 20.0) * 0.3 +
                    (CASE WHEN active_listings < 10 THEN 0.3 ELSE 0 END)
                ) as opportunity_score,
                CASE 
                    WHEN searches_last_week > 0 
                    THEN ((searches_this_week - searches_last_week)::float / searches_last_week) * 100
                    ELSE 100
                END as search_volume_change_pct
            FROM weekly_demand wd
            LEFT JOIN products p ON p.id = wd.product_id
            WHERE (searches_this_week > searches_last_week * 1.3 OR wishlists > 10)
              AND p.demand_score < 0.95
        `);

        return opportunities;
    }

    /**
     * Create alert for a single opportunity
     */
    async createAlertForOpportunity(opportunity) {
        const {
            product_id, product_name, category_id, category_name,
            alert_type, opportunity_score, searches_this_week,
            search_volume_change_pct, avg_listing_price, active_listings,
            demand_score
        } = opportunity;

        // Check if alert already exists for this product in the last 24 hours
        const existingAlert = await DemandAlert.findOne({
            where: {
                product_id,
                created_at: { [sequelize.Op.gt]: new Date(Date.now() - 86400000) },
            },
        });

        if (existingAlert) {
            return false;
        }

        // Calculate suggested price
        const suggestedPrice = this.calculateSuggestedPrice(opportunity);

        // Generate message
        const message = this.generateAlertMessage(opportunity);

        // Create alert for all subscribed sellers
        const subscribers = await this.getSubscribedSellers(category_id, product_id);

        let alertCount = 0;
        for (const subscriber of subscribers) {
            try {
                const alert = await DemandAlert.create({
                    user_id: subscriber.id,
                    product_id,
                    product_name,
                    category_id,
                    category_name,
                    alert_type,
                    demand_score,
                    search_volume_7d: searches_this_week,
                    search_volume_change_pct,
                    avg_listing_price,
                    suggestedPrice,
                    active_listings,
                    opportunity_score,
                    message,
                    recommendations: this.generateRecommendations(opportunity),
                });

                // Send notification
                await Notification.create({
                    user_id: subscriber.id,
                    type: 'demand_alert',
                    title: `📊 Demand Alert: ${product_name}`,
                    message: message,
                    data: {
                        alert_id: alert.id,
                        product_id,
                        opportunity_score,
                    },
                    action_url: `/seller/alerts?alert=${alert.id}`,
                    action_label: 'View Alert',
                });

                alertCount++;
            } catch (error) {
                logger.error('Failed to create demand alert for user:', error);
            }
        }

        // Store in Redis for real-time analytics
        await redis.lpush('alerts:recent', JSON.stringify({
            product_name,
            opportunity_score,
            alert_type,
            timestamp: new Date().toISOString(),
        }));
        await redis.ltrim('alerts:recent', 0, 99);

        logger.info(`Demand alert created for ${product_name} (${alertCount} subscribers notified)`);

        return alertCount > 0;
    }

    /**
     * Get subscribed sellers
     */
    async getSubscribedSellers(categoryId, productId) {
        const users = await User.findAll({
            where: {
                role: 'seller',
                is_active: true,
                preferences: {
                    [sequelize.Op.contains]: {
                        alert_frequency: { [sequelize.Op.ne]: 'none' },
                    },
                },
            },
            include: [{
                model: DemandAlert,
                as: 'subscriptions',
                where: {
                    [sequelize.Op.or]: [
                        { category_id: categoryId },
                        { product_id: productId },
                    ],
                },
                required: false,
            }],
        });

        return users;
    }

    /**
     * Calculate suggested price
     */
    calculateSuggestedPrice(opportunity) {
        const { avg_listing_price, demand_score, active_listings } = opportunity;
        const basePrice = avg_listing_price || 0;
        const demandMultiplier = 1 + (parseFloat(demand_score || 0) * 0.5);

        let suggestedPrice = basePrice * demandMultiplier;

        // Adjust based on competition
        if (active_listings < 5) {
            suggestedPrice *= 1.2; // Low competition, price higher
        } else if (active_listings > 20) {
            suggestedPrice *= 0.9; // High competition, price lower
        }

        // Ensure minimum price
        if (suggestedPrice < 1) suggestedPrice = 1;

        return Math.round(suggestedPrice * 100) / 100;
    }

    /**
     * Generate alert message
     */
    generateAlertMessage(opportunity) {
        const { product_name, alert_type, searches_this_week, active_listings } = opportunity;

        const messages = {
            spike: `🚀 HUGE OPPORTUNITY! Searches for "${product_name}" are up ${Math.round(opportunity.search_volume_change_pct)}% this week! Only ${active_listings || 0} active sellers. List now before competition grows!`,

            inventory_gap: `📈 HIGH DEMAND, LOW SUPPLY! ${opportunity.wishlists || 0} people want "${product_name}" but only ${active_listings || 0} sellers. You could capture this market!`,

            trending: `🔥 TRENDING PRODUCT! "${product_name}" has ${searches_this_week || 0} searches this week. Demand score: ${Math.round((opportunity.demand_score || 0) * 100)}%. Great time to list!`,

            price_opportunity: `💰 PRICE OPPORTUNITY! "${product_name}" has high demand (${Math.round((opportunity.demand_score || 0) * 100)}%) but limited sellers (${active_listings || 0}). Suggested price: $${this.calculateSuggestedPrice(opportunity)}`,

            seasonal: `🎯 SEASONAL DEMAND! "${product_name}" is trending due to seasonal demand. Searches up ${Math.round(opportunity.search_volume_change_pct)}% this week.`
        };

        return messages[alert_type] || `📊 Demand alert for ${product_name}`;
    }

    /**
     * Generate recommendations
     */
    generateRecommendations(opportunity) {
        const recommendations = [];

        if (opportunity.alert_type === 'spike') {
            recommendations.push('List your item immediately to capture early demand');
            recommendations.push('Use high-quality photos to stand out');
            recommendations.push(`Price at $${this.calculateSuggestedPrice(opportunity)} for optimal sell-through`);
        }

        if (opportunity.alert_type === 'inventory_gap') {
            recommendations.push('Consider listing even if you have limited stock');
            recommendations.push('Add "High Demand" label to your listing');
            recommendations.push('Offer fast shipping to beat competition');
        }

        if (opportunity.alert_type === 'trending') {
            recommendations.push('Create a featured listing for maximum visibility');
            recommendations.push('Bundle with complementary items');
            recommendations.push('Share on social media to capitalize on trend');
        }

        if (opportunity.active_listings < 5) {
            recommendations.push('You can price 10-20% higher due to limited competition');
        }

        recommendations.push(`Search interest increased ${Math.round(opportunity.search_volume_change_pct)}% - act fast!`);

        return recommendations.slice(0, 5);
    }

    /**
     * Get alerts for seller
     */
    async getAlertsForUser(userId, filters = {}) {
        const { unreadOnly, limit = 20, offset = 0 } = filters;

        const where = { user_id: userId };
        if (unreadOnly) {
            where.read = false;
        }

        const alerts = await DemandAlert.findAll({
            where,
            order: [['created_at', 'DESC']],
            limit,
            offset,
        });

        const total = await DemandAlert.count({ where });

        return {
            alerts,
            total,
            unreadCount: await DemandAlert.count({
                where: { user_id: userId, read: false },
            }),
        };
    }

    /**
     * Mark alert as read
     */
    async markAlertAsRead(alertId, userId) {
        const alert = await DemandAlert.findOne({
            where: { id: alertId, user_id: userId },
        });

        if (!alert) {
            throw new Error('Alert not found');
        }

        await alert.markAsRead();
        return alert;
    }

    /**
     * Mark all alerts as read
     */
    async markAllAlertsAsRead(userId) {
        await DemandAlert.update(
            { read: true },
            { where: { user_id: userId, read: false } }
        );
        return { success: true };
    }

    /**
     * Subscribe to demand alerts
     */
    async subscribeToAlerts(userId, subscriptionData) {
        const { category_id, product_id, min_demand_score, alert_frequency } = subscriptionData;

        // Store subscription in user preferences
        const user = await User.findByPk(userId);
        const preferences = user.preferences || {};

        preferences.alerts = preferences.alerts || {};
        preferences.alerts.category_subscriptions = preferences.alerts.category_subscriptions || [];
        preferences.alerts.product_subscriptions = preferences.alerts.product_subscriptions || [];
        preferences.alerts.min_demand_score = min_demand_score || 0.7;
        preferences.alerts.frequency = alert_frequency || 'daily';

        if (category_id && !preferences.alerts.category_subscriptions.includes(category_id)) {
            preferences.alerts.category_subscriptions.push(category_id);
        }

        if (product_id && !preferences.alerts.product_subscriptions.includes(product_id)) {
            preferences.alerts.product_subscriptions.push(product_id);
        }

        await user.update({ preferences });

        logger.info(`User ${userId} subscribed to demand alerts`);

        return { success: true, preferences };
    }

    /**
     * Unsubscribe from demand alerts
     */
    async unsubscribeFromAlerts(userId, categoryId = null, productId = null) {
        const user = await User.findByPk(userId);
        const preferences = user.preferences || {};

        if (categoryId) {
            preferences.alerts.category_subscriptions =
                preferences.alerts.category_subscriptions.filter(id => id !== categoryId);
        }

        if (productId) {
            preferences.alerts.product_subscriptions =
                preferences.alerts.product_subscriptions.filter(id => id !== productId);
        }

        await user.update({ preferences });

        logger.info(`User ${userId} unsubscribed from demand alerts`);

        return { success: true, preferences };
    }
}

module.exports = new DemandAlertService();