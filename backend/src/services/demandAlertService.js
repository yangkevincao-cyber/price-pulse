// backend/src/services/demandAlertService.js
const db = require('../config/database');
const nodemailer = require('nodemailer');

class DemandAlertService {

    // Generate alerts for all subscribed sellers
    async generateAlerts() {
        // Find products with significant demand spikes
        const opportunities = await db.query(`
            WITH weekly_demand AS (
                SELECT 
                    p.id,
                    p.name,
                    c.name as category_name,
                    COUNT(DISTINCT sq.id) as searches_this_week,
                    LAG(COUNT(DISTINCT sq.id), 1) OVER (PARTITION BY p.id ORDER BY DATE_TRUNC('week', sq.created_at)) as searches_last_week,
                    COUNT(DISTINCT w.id) as wishlists,
                    AVG(l.price) as avg_listing_price,
                    COUNT(DISTINCT l.id) as active_listings
                FROM products p
                JOIN categories c ON p.category_id = c.id
                LEFT JOIN search_queries sq ON sq.query_text ILIKE '%' || p.name || '%'
                    AND sq.created_at > NOW() - INTERVAL '7 days'
                LEFT JOIN wishlists w ON w.product_id = p.id
                    AND w.created_at > NOW() - INTERVAL '7 days'
                LEFT JOIN listings l ON l.product_id = p.id
                    AND l.status = 'active'
                GROUP BY p.id, c.name, DATE_TRUNC('week', sq.created_at)
            )
            SELECT 
                *,
                CASE 
                    WHEN searches_this_week > searches_last_week * 1.5 THEN 'spike'
                    WHEN wishlists > 10 AND active_listings < 5 THEN 'inventory_gap'
                    WHEN avg_listing_price > 0 AND searches_this_week > 100 THEN 'trending'
                    ELSE NULL
                END as alert_type,
                -- Opportunity score calculation
                LEAST(1.0, 
                    (searches_this_week / 500.0) * 0.4 +
                    (wishlists / 20.0) * 0.3 +
                    (CASE WHEN active_listings < 10 THEN 0.3 ELSE 0 END)
                ) as opportunity_score
            FROM weekly_demand
            WHERE searches_this_week > 50  -- Minimum search threshold
              AND (searches_this_week > searches_last_week * 1.3 OR wishlists > 5)
        `);

        for (const opp of opportunities.rows) {
            if (opp.alert_type) {
                await this.notifySellers(opp);
            }
        }
    }

    async notifySellers(opportunity) {
        // Find sellers who have subscribed to this category
        const subscribers = await db.query(`
            SELECT sas.*, u.email, u.username
            FROM seller_alert_subscriptions sas
            JOIN users u ON sas.seller_id = u.id
            WHERE (sas.category_id = $1 OR sas.product_id = $2)
              AND sas.is_active = true
              AND (sas.min_demand_score <= $3 OR sas.min_demand_score IS NULL)
        `, [opportunity.category_id, opportunity.id, opportunity.opportunity_score]);

        for (const subscriber of subscribers.rows) {
            // Create alert record
            const alert = await db.query(`
                INSERT INTO demand_alerts (
                    seller_id, alert_type, product_id, product_name, 
                    category_name, demand_score, search_volume_7d,
                    search_volume_change_pct, avg_listing_price, 
                    suggested_price, opportunity_score, message
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *
            `, [
                subscriber.seller_id,
                opportunity.alert_type,
                opportunity.id,
                opportunity.name,
                opportunity.category_name,
                opportunity.opportunity_score,
                opportunity.searches_this_week,
                ((opportunity.searches_this_week - opportunity.searches_last_week) /
                    opportunity.searches_last_week) * 100,
                opportunity.avg_listing_price,
                this.calculateSuggestedPrice(opportunity),
                opportunity.opportunity_score,
                this.generateAlertMessage(opportunity)
            ]);

            // Send notification based on frequency preference
            if (subscriber.alert_frequency === 'instant') {
                await this.sendEmailAlert(subscriber.email, alert.rows[0]);
            }
        }
    }

    calculateSuggestedPrice(opportunity) {
        // Dynamic pricing based on demand
        const basePrice = opportunity.avg_listing_price || 0;
        const demandMultiplier = 1 + (opportunity.opportunity_score * 0.3);

        // If few sellers, can price higher
        if (opportunity.active_listings < 5) {
            return basePrice * demandMultiplier * 1.2;
        }

        // If high competition, price lower
        if (opportunity.active_listings > 20) {
            return basePrice * 0.9;
        }

        return basePrice * demandMultiplier;
    }

    generateAlertMessage(opportunity) {
        const messages = {
            spike: `🚀 HUGE OPPORTUNITY! Searches for "${opportunity.name}" are up ${Math.round((opportunity.searches_this_week - opportunity.searches_last_week) / opportunity.searches_last_week * 100)}% this week! Only ${opportunity.active_listings} active sellers. List now before competition grows!`,

            inventory_gap: `📈 HIGH DEMAND, LOW SUPPLY! ${opportunity.wishlists} people want "${opportunity.name}" but only ${opportunity.active_listings} sellers. You could capture this market!`,

            trending: `🔥 TRENDING PRODUCT! "${opportunity.name}" has ${opportunity.searches_this_week} searches this week. Suggested price: $${this.calculateSuggestedPrice(opportunity)}`
        };

        return messages[opportunity.alert_type] || `📊 Demand alert for ${opportunity.name}`;
    }

    async sendEmailAlert(email, alert) {
        // Configure your email service
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: '"Smart Marketplace" <alerts@smartmarketplace.com>',
            to: email,
            subject: `📊 Demand Alert: ${alert.product_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                    <h2>🎯 Selling Opportunity Detected!</h2>
                    <p>${alert.message}</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 10px;">
                        <h3>Key Metrics:</h3>
                        <ul>
                            <li>📈 Demand Score: ${(alert.demand_score * 100).toFixed(0)}%</li>
                            <li>🔍 Weekly Searches: ${alert.search_volume_7d}</li>
                            <li>💰 Suggested Price: $${alert.suggested_price}</li>
                        </ul>
                    </div>
                    <a href="https://yourplatform.com/sell?product=${alert.product_id}" 
                       style="background: #4CAF50; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        List This Product Now →
                    </a>
                </div>
            `
        });
    }

    // API endpoint for sellers to see their dashboard
    async getSellerDashboard(sellerId) {
        const dashboard = await db.query(`
            SELECT 
                -- Unread alerts count
                (SELECT COUNT(*) FROM demand_alerts 
                 WHERE seller_id = $1 AND read = false) as unread_alerts,
                
                -- Recent alerts (last 7 days)
                (SELECT json_agg(row_to_json(a)) FROM (
                    SELECT * FROM demand_alerts 
                    WHERE seller_id = $1 
                    ORDER BY created_at DESC LIMIT 10
                ) a) as recent_alerts,
                
                -- Their active listings with demand scores
                (SELECT json_agg(row_to_json(l)) FROM (
                    SELECT 
                        l.*,
                        p.demand_score,
                        p.searches_last_7_days,
                        CASE 
                            WHEN p.demand_score > 0.7 THEN 'HIGH DEMAND - Consider raising price'
                            WHEN p.demand_score < 0.3 THEN 'LOW DEMAND - Consider discount'
                            ELSE 'Normal demand'
                        END as recommendation
                    FROM listings l
                    JOIN products p ON l.product_id = p.id
                    WHERE l.seller_id = $1 AND l.status = 'active'
                    LIMIT 20
                ) l) as active_listings,
                
                -- Top opportunity categories for this seller
                (SELECT json_agg(row_to_json(c)) FROM (
                    SELECT 
                        c.name,
                        COUNT(DISTINCT sq.id) as searches,
                        AVG(p.demand_score) as avg_demand
                    FROM categories c
                    JOIN products p ON p.category_id = c.id
                    JOIN search_queries sq ON sq.query_text ILIKE '%' || p.name || '%'
                    WHERE sq.created_at > NOW() - INTERVAL '7 days'
                    GROUP BY c.id
                    ORDER BY avg_demand DESC
                    LIMIT 5
                ) c) as top_opportunities
                
            FROM users u
            WHERE u.id = $1
        `, [sellerId]);

        return dashboard.rows[0];
    }
}

module.exports = DemandAlertService;