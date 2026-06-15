// backend/src/routes/demandAlerts.js
const express = require('express');
const router = express.Router();
const DemandAlertService = require('../services/demandAlertService');
const { authenticateUser } = require('../middleware/auth');

const alertService = new DemandAlertService();

// Get seller's demand alert dashboard
router.get('/dashboard', authenticateUser, async (req, res) => {
    const dashboard = await alertService.getSellerDashboard(req.user.id);
    res.json(dashboard);
});

// Subscribe to demand alerts
router.post('/subscribe', authenticateUser, async (req, res) => {
    const { category_id, product_id, min_demand_score, alert_frequency } = req.body;

    const subscription = await db.query(`
        INSERT INTO seller_alert_subscriptions 
        (seller_id, category_id, product_id, min_demand_score, alert_frequency)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `, [req.user.id, category_id, product_id, min_demand_score, alert_frequency]);

    res.json(subscription.rows[0]);
});

// Mark alert as read
router.patch('/alerts/:alertId/read', authenticateUser, async (req, res) => {
    await db.query(`
        UPDATE demand_alerts 
        SET read = true 
        WHERE id = $1 AND seller_id = $2
    `, [req.params.alertId, req.user.id]);

    res.json({ success: true });
});

// Get trending products (public endpoint)
router.get('/trending', async (req, res) => {
    const trending = await db.query(`
        SELECT 
            p.id,
            p.name,
            p.demand_score,
            COUNT(DISTINCT sq.id) as searches_24h,
            COUNT(DISTINCT l.id) as active_sellers,
            MIN(l.price) as lowest_price
        FROM products p
        LEFT JOIN search_queries sq ON sq.query_text ILIKE '%' || p.name || '%'
            AND sq.created_at > NOW() - INTERVAL '24 hours'
        LEFT JOIN listings l ON l.product_id = p.id AND l.status = 'active'
        WHERE p.demand_score > 0.5
        GROUP BY p.id
        ORDER BY p.demand_score DESC
        LIMIT 50
    `);

    res.json(trending.rows);
});

module.exports = router;