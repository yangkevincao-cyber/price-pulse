// backend/src/services/analyticsService.js
const db = require('../config/database');
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

class AnalyticsService {

    // Real-time analytics tracking
    async trackEvent(event) {
        const { type, userId, productId, data } = event;

        // Store in Redis for real-time analytics
        const key = `analytics:${type}:${new Date().toISOString().slice(0, 10)}`;
        await redis.hincrby(key, userId || 'anonymous', 1);

        // Store in ClickHouse or TimescaleDB for long-term analytics
        await db.query(`
            INSERT INTO analytics_events (event_type, user_id, product_id, data, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [type, userId, productId, JSON.stringify(data)]);

        // Update real-time dashboard
        await this.updateRealTimeDashboard(event);
    }

    // Seller analytics
    async getSellerAnalytics(sellerId, period = '30d') {
        const interval = this.getInterval(period);

        const analytics = await db.query(`
            WITH daily_stats AS (
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as views,
                    COUNT(DISTINCT user_id) as unique_visitors,
                    SUM(CASE WHEN clicked THEN 1 ELSE 0 END) as clicks
                FROM listing_views
                WHERE seller_id = $1
                    AND created_at > NOW() - INTERVAL '${interval}'
                GROUP BY DATE(created_at)
            ),
            sales_stats AS (
                SELECT 
                    DATE(completed_at) as date,
                    COUNT(*) as sales_count,
                    SUM(amount) as revenue,
                    AVG(amount) as avg_order_value
                FROM transactions
                WHERE seller_id = $1
                    AND status = 'completed'
                    AND completed_at > NOW() - INTERVAL '${interval}'
                GROUP BY DATE(completed_at)
            ),
            demand_alerts_stats AS (
                SELECT 
                    COUNT(*) as alerts_received,
                    COUNT(CASE WHEN clicked THEN 1 END) as alerts_clicked,
                    AVG(opportunity_score) as avg_opportunity_score
                FROM demand_alerts
                WHERE seller_id = $1
                    AND created_at > NOW() - INTERVAL '${interval}'
            )
            SELECT 
                COALESCE(ds.date, ss.date) as date,
                COALESCE(ds.views, 0) as views,
                COALESCE(ds.unique_visitors, 0) as unique_visitors,
                COALESCE(ds.clicks, 0) as clicks,
                COALESCE(ss.sales_count, 0) as sales,
                COALESCE(ss.revenue, 0) as revenue,
                COALESCE(ss.avg_order_value, 0) as avg_order_value,
                CASE 
                    WHEN ds.views > 0 THEN (ss.sales_count::float / ds.views) * 100
                    ELSE 0
                END as conversion_rate
            FROM daily_stats ds
            FULL OUTER JOIN sales_stats ss ON ds.date = ss.date
            ORDER BY date DESC
        `, [sellerId]);

        const summary = await db.query(`
            SELECT 
                COALESCE(SUM(views), 0) as total_views,
                COALESCE(SUM(sales_count), 0) as total_sales,
                COALESCE(SUM(revenue), 0) as total_revenue,
                AVG(avg_order_value) as avg_order_value,
                MAX(views) as peak_views_day,
                MAX(revenue) as peak_revenue_day
            FROM (
                SELECT 
                    COUNT(*) as views,
                    0 as sales_count,
                    0 as revenue,
                    0 as avg_order_value
                FROM listing_views
                WHERE seller_id = $1
                    AND created_at > NOW() - INTERVAL '${interval}'
                UNION ALL
                SELECT 
                    0 as views,
                    COUNT(*) as sales_count,
                    SUM(amount) as revenue,
                    AVG(amount) as avg_order_value
                FROM transactions
                WHERE seller_id = $1
                    AND status = 'completed'
                    AND completed_at > NOW() - INTERVAL '${interval}'
            ) combined
        `, [sellerId]);

        const demandAlerts = await db.query(`
            SELECT 
                alert_type,
                COUNT(*) as count,
                AVG(opportunity_score) as avg_score,
                AVG(CASE WHEN clicked THEN 1 ELSE 0 END) * 100 as click_through_rate
            FROM demand_alerts
            WHERE seller_id = $1
                AND created_at > NOW() - INTERVAL '${interval}'
            GROUP BY alert_type
        `, [sellerId]);

        const topProducts = await db.query(`
            SELECT 
                p.name,
                COUNT(DISTINCT lv.id) as views,
                COUNT(DISTINCT t.id) as sales,
                SUM(t.amount) as revenue,
                p.demand_score
            FROM products p
            JOIN listings l ON l.product_id = p.id
            LEFT JOIN listing_views lv ON lv.listing_id = l.id
            LEFT JOIN transactions t ON t.listing_id = l.id AND t.status = 'completed'
            WHERE l.seller_id = $1
                AND (lv.created_at > NOW() - INTERVAL '${interval}' OR t.completed_at > NOW() - INTERVAL '${interval}')
            GROUP BY p.id
            ORDER BY revenue DESC
            LIMIT 10
        `, [sellerId]);

        return {
            daily: analytics.rows,
            summary: summary.rows[0],
            demandAlerts: demandAlerts.rows,
            topProducts: topProducts.rows,
            period
        };
    }

    // Platform-wide analytics (admin)
    async getPlatformAnalytics(period = '30d') {
        const interval = this.getInterval(period);

        const metrics = await db.query(`
            WITH user_metrics AS (
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN role = 'seller' THEN 1 END) as total_sellers,
                    COUNT(CASE WHEN role = 'buyer' THEN 1 END) as total_buyers,
                    COUNT(CASE WHEN last_active > NOW() - INTERVAL '7 days' THEN 1 END) as active_users_7d,
                    AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) as avg_user_age_days
                FROM users
            ),
            transaction_metrics AS (
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(amount) as total_volume,
                    AVG(amount) as avg_transaction_value,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
                    SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_volume
                FROM transactions
                WHERE created_at > NOW() - INTERVAL '${interval}'
            ),
            listing_metrics AS (
                SELECT 
                    COUNT(*) as total_listings,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_listings,
                    AVG(price) as avg_listing_price,
                    AVG(views) as avg_views_per_listing
                FROM listings
                WHERE created_at > NOW() - INTERVAL '${interval}'
            ),
            demand_metrics AS (
                SELECT 
                    COUNT(*) as total_alerts_sent,
                    AVG(opportunity_score) as avg_opportunity_score,
                    AVG(CASE WHEN clicked THEN 1 ELSE 0 END) * 100 as alert_ctr
                FROM demand_alerts
                WHERE created_at > NOW() - INTERVAL '${interval}'
            )
            SELECT 
                row_to_json(um) as users,
                row_to_json(tm) as transactions,
                row_to_json(lm) as listings,
                row_to_json(dm) as demand_alerts
            FROM user_metrics um, transaction_metrics tm, listing_metrics lm, demand_metrics dm
        `);

        // Daily breakdown
        const daily = await db.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(DISTINCT user_id) as active_users,
                COUNT(*) as transactions,
                SUM(amount) as volume,
                COUNT(DISTINCT listing_id) as unique_products_sold
            FROM transactions
            WHERE created_at > NOW() - INTERVAL '${interval}'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);

        // Category performance
        const categories = await db.query(`
            SELECT 
                c.name,
                COUNT(DISTINCT t.id) as transactions,
                SUM(t.amount) as volume,
                COUNT(DISTINCT l.id) as listings,
                AVG(p.demand_score) as avg_demand
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id
            LEFT JOIN listings l ON l.product_id = p.id
            LEFT JOIN transactions t ON t.listing_id = l.id
            WHERE t.created_at > NOW() - INTERVAL '${interval}'
            GROUP BY c.id
            ORDER BY volume DESC
            LIMIT 10
        `);

        // Geographic distribution
        const geography = await db.query(`
            SELECT 
                location_country,
                COUNT(*) as users,
                SUM(t.amount) as transaction_volume
            FROM users u
            LEFT JOIN transactions t ON t.buyer_id = u.id OR t.seller_id = u.id
            WHERE t.created_at > NOW() - INTERVAL '${interval}'
            GROUP BY location_country
            ORDER BY transaction_volume DESC
            LIMIT 20
        `);

        return {
            metrics: metrics.rows[0],
            daily: daily.rows,
            topCategories: categories.rows,
            geography: geography.rows,
            period
        };
    }

    // Real-time dashboard updates via WebSocket
    async updateRealTimeDashboard(event) {
        const stats = await this.getRealTimeStats();

        // Broadcast to all admin clients
        const io = require('../socket').getIO();
        io.to('admin_room').emit('realtime_stats', stats);
    }

    async getRealTimeStats() {
        const now = new Date();
        const hourAgo = new Date(now - 3600000);

        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE last_active > NOW() - INTERVAL '5 minutes') as online_users,
                (SELECT COUNT(*) FROM search_queries WHERE created_at > NOW() - INTERVAL '1 hour') as searches_last_hour,
                (SELECT COUNT(*) FROM transactions WHERE created_at > NOW() - INTERVAL '1 hour') as transactions_last_hour,
                (SELECT SUM(amount) FROM transactions WHERE created_at > NOW() - INTERVAL '1 hour') as volume_last_hour,
                (SELECT COUNT(*) FROM demand_alerts WHERE created_at > NOW() - INTERVAL '1 hour') as alerts_sent_last_hour,
                (SELECT AVG(response_time_ms) FROM api_logs WHERE created_at > NOW() - INTERVAL '5 minutes') as avg_response_time
        `);

        // Get top trending products in real-time
        const trending = await db.query(`
            SELECT 
                p.name,
                COUNT(*) as search_count,
                p.demand_score
            FROM search_queries sq
            JOIN products p ON sq.query_text ILIKE '%' || p.name || '%'
            WHERE sq.created_at > NOW() - INTERVAL '15 minutes'
            GROUP BY p.id
            ORDER BY search_count DESC
            LIMIT 10
        `);

        return {
            ...stats.rows[0],
            trending: trending.rows,
            timestamp: now
        };
    }

    // Funnel analysis
    async getConversionFunnel(period = '30d') {
        const interval = this.getInterval(period);

        const funnel = await db.query(`
            WITH 
            visitors AS (
                SELECT COUNT(DISTINCT user_id) as count
                FROM page_views
                WHERE created_at > NOW() - INTERVAL '${interval}'
                    AND page_type = 'home'
            ),
            searchers AS (
                SELECT COUNT(DISTINCT user_id) as count
                FROM search_queries
                WHERE created_at > NOW() - INTERVAL '${interval}'
            ),
            viewers AS (
                SELECT COUNT(DISTINCT user_id) as count
                FROM product_views
                WHERE viewed_at > NOW() - INTERVAL '${interval}'
            ),
            added_to_cart AS (
                SELECT COUNT(DISTINCT user_id) as count
                FROM carts
                WHERE created_at > NOW() - INTERVAL '${interval}'
                    AND status = 'active'
            ),
            initiated_checkout AS (
                SELECT COUNT(DISTINCT user_id) as count
                FROM checkouts
                WHERE created_at > NOW() - INTERVAL '${interval}'
            ),
            completed_purchase AS (
                SELECT COUNT(DISTINCT user_id) as count
                FROM transactions
                WHERE completed_at > NOW() - INTERVAL '${interval}'
            )
            SELECT 
                (SELECT count FROM visitors) as visitors,
                (SELECT count FROM searchers) as searchers,
                (SELECT count FROM viewers) as viewers,
                (SELECT count FROM added_to_cart) as added_to_cart,
                (SELECT count FROM initiated_checkout) as initiated_checkout,
                (SELECT count FROM completed_purchase) as completed_purchase,
                ROUND((SELECT count FROM searchers)::float / NULLIF((SELECT count FROM visitors), 0) * 100, 2) as search_conversion,
                ROUND((SELECT count FROM viewers)::float / NULLIF((SELECT count FROM searchers), 0) * 100, 2) as view_conversion,
                ROUND((SELECT count FROM added_to_cart)::float / NULLIF((SELECT count FROM viewers), 0) * 100, 2) as cart_conversion,
                ROUND((SELECT count FROM completed_purchase)::float / NULLIF((SELECT count FROM initiated_checkout), 0) * 100, 2) as checkout_conversion,
                ROUND((SELECT count FROM completed_purchase)::float / NULLIF((SELECT count FROM visitors), 0) * 100, 2) as overall_conversion
        `);

        return funnel.rows[0];
    }

    // Export analytics for reporting
    async exportAnalytics(sellerId, format = 'csv', period = '30d') {
        const data = await this.getSellerAnalytics(sellerId, period);

        if (format === 'csv') {
            return this.convertToCSV(data.daily);
        } else if (format === 'json') {
            return data;
        } else if (format === 'pdf') {
            return await this.generatePDFReport(data);
        }
    }

    convertToCSV(data) {
        if (!data.length) return '';

        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        for (const row of data) {
            const values = headers.map(header => {
                const value = row[header];
                return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    }

    async generatePDFReport(data) {
        // Use puppeteer or pdfkit to generate PDF
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument();

        doc.fontSize(25).text('PricePulse Analytics Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text(`Generated: ${new Date().toLocaleDateString()}`);
        doc.moveDown();

        // Add summary
        doc.fontSize(18).text('Summary');
        doc.fontSize(12).text(`Total Revenue: $${data.summary.total_revenue}`);
        doc.text(`Total Sales: ${data.summary.total_sales}`);
        doc.text(`Conversion Rate: ${data.summary.conversion_rate}%`);

        return doc;
    }

    getInterval(period) {
        const intervals = {
            '7d': '7 days',
            '30d': '30 days',
            '90d': '90 days',
            '1y': '1 year'
        };
        return intervals[period] || '30 days';
    }
}
