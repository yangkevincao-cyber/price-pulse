// backend/src/routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

// Get system metrics
router.get('/metrics', authenticateUser, requireAdmin, async (req, res) => {
    const { range = 'week' } = req.query;

    let interval;
    switch (range) {
        case 'week': interval = '7 days'; break;
        case 'month': interval = '30 days'; break;
        case 'quarter': interval = '90 days'; break;
        default: interval = '7 days';
    }

    const metrics = await db.query(`
        WITH daily_searches AS (
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM search_queries
            WHERE created_at > NOW() - INTERVAL '${interval}'
            GROUP BY DATE(created_at)
        ),
        scraping_performance AS (
            SELECT 
                DATE(scraped_at) as date,
                COUNT(*) as count,
                AVG(CASE WHEN price IS NOT NULL THEN 1 ELSE 0 END) * 100 as success_rate
            FROM external_prices
            WHERE scraped_at > NOW() - INTERVAL '${interval}'
            GROUP BY DATE(scraped_at)
        ),
        price_trends AS (
            SELECT 
                DATE(scraped_at) as date,
                AVG(price) as avg_price
            FROM external_prices
            WHERE scraped_at > NOW() - INTERVAL '${interval}'
            GROUP BY DATE(scraped_at)
        )
        SELECT 
            (SELECT SUM(count) FROM daily_searches) as daily_searches,
            (SELECT json_agg(row_to_json(ds)) FROM daily_searches ds) as search_trends,
            (SELECT json_agg(row_to_json(sp)) FROM scraping_performance sp) as scraping_performance,
            (SELECT json_agg(row_to_json(pt)) FROM price_trends pt) as price_trends
    `);

    // Get additional metrics
    const additionalMetrics = await db.query(`
        SELECT 
            (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days') as new_users_week,
            (SELECT COUNT(*) FROM listings WHERE created_at > NOW() - INTERVAL '7 days') as new_listings_week,
            (SELECT COUNT(*) FROM exchanges WHERE created_at > NOW() - INTERVAL '7 days') as exchanges_week,
            (SELECT COALESCE(SUM(price), 0) FROM listings WHERE status = 'sold' AND sold_at > NOW() - INTERVAL '30 days') as total_sales_month
    `);

    res.json({
        ...metrics.rows[0],
        ...additionalMetrics.rows[0]
    });
});

// Get scraping status
router.get('/scraping/status', authenticateUser, requireAdmin, async (req, res) => {
    const scrapers = await db.query(`
        SELECT 
            s.*,
            (
                SELECT COUNT(*) 
                FROM external_prices ep 
                WHERE ep.source_id = s.id 
                    AND ep.scraped_at > NOW() - INTERVAL '24 hours'
            ) as products_today,
            (
                SELECT AVG(EXTRACT(EPOCH FROM (NOW() - ep.scraped_at))) 
                FROM external_prices ep 
                WHERE ep.source_id = s.id 
                    AND ep.scraped_at > NOW() - INTERVAL '1 hour'
            ) as avg_response_time
        FROM external_sources s
        ORDER BY s.source_name
    `);

    res.json({
        active_scrapers: scrapers.rows.filter(s => s.scraping_enabled).length,
        total_scrapers: scrapers.rows.length,
        scrapers: scrapers.rows
    });
});

// Toggle scraper
router.post('/scraping/:scraperId/toggle', authenticateUser, requireAdmin, async (req, res) => {
    const { scraperId } = req.params;

    const scraper = await db.query(
        'SELECT scraping_enabled FROM external_sources WHERE id = $1',
        [scraperId]
    );

    const newStatus = !scraper.rows[0].scraping_enabled;

    await db.query(
        'UPDATE external_sources SET scraping_enabled = $1 WHERE id = $2',
        [newStatus, scraperId]
    );

    // Log activity
    await db.query(
        `INSERT INTO system_logs (action, status, details, created_at)
         VALUES ($1, $2, $3, NOW())`,
        ['toggle_scraper', 'success', JSON.stringify({ scraper_id: scraperId, new_status: newStatus })]
    );

    res.json({ success: true, enabled: newStatus });
});

// Trigger manual scrape
router.post('/scraping/trigger', authenticateUser, requireAdmin, async (req, res) => {
    const { source } = req.body;

    // Trigger scraping job (implement based on your scraping architecture)
    // This would typically queue a job in Redis/Bull

    await db.query(
        `INSERT INTO system_logs (action, status, details, created_at)
         VALUES ($1, $2, $3, NOW())`,
        ['manual_scrape', 'triggered', JSON.stringify({ source, triggered_by: req.user.id })]
    );

    res.json({ success: true, message: 'Scraping triggered' });
});

// Get user statistics
router.get('/users/stats', authenticateUser, requireAdmin, async (req, res) => {
    const stats = await db.query(`
        SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN role = 'seller' THEN 1 END) as total_sellers,
            COUNT(CASE WHEN role = 'buyer' THEN 1 END) as total_buyers,
            COUNT(CASE WHEN last_active > NOW() - INTERVAL '7 days' THEN 1 END) as active_users_7d,
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_users_7d,
            AVG(seller_rating) as avg_seller_rating
        FROM users
    `);

    res.json(stats.rows[0]);
});

// Get product statistics
router.get('/products/stats', authenticateUser, requireAdmin, async (req, res) => {
    const stats = await db.query(`
        SELECT 
            COUNT(*) as total_products,
            COUNT(DISTINCT category_id) as total_categories,
            (SELECT COUNT(*) FROM listings WHERE status = 'active') as active_listings,
            (SELECT COUNT(*) FROM listings WHERE status = 'sold' AND sold_at > NOW() - INTERVAL '30 days') as sales_30d,
            AVG(demand_score) as avg_demand_score
        FROM products
    `);

    // Get top categories
    const topCategories = await db.query(`
        SELECT 
            c.name,
            COUNT(DISTINCT p.id) as product_count,
            COUNT(DISTINCT l.id) as listing_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id
        LEFT JOIN listings l ON l.product_id = p.id AND l.status = 'active'
        GROUP BY c.id
        ORDER BY listing_count DESC
        LIMIT 10
    `);

    res.json({
        ...stats.rows[0],
        top_categories: topCategories.rows
    });
});

// Get recent system activity
router.get('/activity', authenticateUser, requireAdmin, async (req, res) => {
    const { limit = 50 } = req.query;

    const activity = await db.query(`
        SELECT 
            action,
            status,
            details,
            created_at as timestamp
        FROM system_logs
        ORDER BY created_at DESC
        LIMIT $1
    `, [limit]);

    res.json(activity.rows);
});

module.exports = router;