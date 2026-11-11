// backend/src/services/analytics/reportService.js
const { sequelize } = require('../../config/database');
const { redis } = require('../../config/redis');
const PDFDocument = require('pdfkit');

class ReportService {
    /**
     * Generate sales report
     */
    async generateSalesReport(period = '30d') {
        const interval = this.getInterval(period);

        const report = await sequelize.query(`
            WITH daily_sales AS (
                SELECT 
                    DATE(completed_at) as date,
                    COUNT(*) as transactions,
                    SUM(amount) as revenue,
                    AVG(amount) as avg_order_value,
                    COUNT(DISTINCT buyer_id) as unique_buyers
                FROM transactions
                WHERE status = 'completed'
                    AND completed_at > NOW() - INTERVAL '${interval}'
                GROUP BY DATE(completed_at)
            ),
            category_sales AS (
                SELECT 
                    c.name as category,
                    COUNT(*) as transactions,
                    SUM(t.amount) as revenue
                FROM transactions t
                JOIN listings l ON l.id = t.listing_id
                JOIN products p ON p.id = l.product_id
                JOIN categories c ON c.id = p.category_id
                WHERE t.status = 'completed'
                    AND t.completed_at > NOW() - INTERVAL '${interval}'
                GROUP BY c.id
                ORDER BY revenue DESC
                LIMIT 10
            ),
            top_sellers AS (
                SELECT 
                    u.username,
                    COUNT(*) as sales,
                    SUM(t.amount) as revenue,
                    u.seller_rating
                FROM transactions t
                JOIN users u ON u.id = t.seller_id
                WHERE t.status = 'completed'
                    AND t.completed_at > NOW() - INTERVAL '${interval}'
                GROUP BY u.id
                ORDER BY revenue DESC
                LIMIT 10
            ),
            summary AS (
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(amount) as total_revenue,
                    AVG(amount) as avg_order_value,
                    COUNT(DISTINCT buyer_id) as unique_buyers,
                    COUNT(DISTINCT seller_id) as unique_sellers
                FROM transactions
                WHERE status = 'completed'
                    AND completed_at > NOW() - INTERVAL '${interval}'
            )
            SELECT 
                (SELECT row_to_json(summary) FROM summary) as summary,
                (SELECT json_agg(row_to_json(daily_sales) ORDER BY date DESC) FROM daily_sales) as daily_sales,
                (SELECT json_agg(row_to_json(category_sales)) FROM category_sales) as top_categories,
                (SELECT json_agg(row_to_json(top_sellers)) FROM top_sellers) as top_sellers
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        const result = {
            period,
            generated_at: new Date().toISOString(),
            ...report[0],
        };

        // Cache report
        await redis.setex(`report:sales:${period}`, 3600, JSON.stringify(result));

        return result;
    }

    /**
     * Generate seller performance report
     */
    async generateSellerReport(sellerId, period = '30d') {
        const interval = this.getInterval(period);

        const report = await sequelize.query(`
            WITH seller_stats AS (
                SELECT 
                    u.username,
                    u.seller_rating,
                    u.total_sales,
                    COUNT(DISTINCT l.id) as active_listings,
                    AVG(l.price) as avg_listing_price
                FROM users u
                LEFT JOIN listings l ON l.user_id = u.id AND l.status = 'active'
                WHERE u.id = $1
                GROUP BY u.id
            ),
            sales_history AS (
                SELECT 
                    DATE(completed_at) as date,
                    COUNT(*) as sales,
                    SUM(amount) as revenue,
                    AVG(amount) as avg_order_value
                FROM transactions
                WHERE seller_id = $1
                    AND status = 'completed'
                    AND completed_at > NOW() - INTERVAL '${interval}'
                GROUP BY DATE(completed_at)
                ORDER BY date DESC
            ),
            top_products AS (
                SELECT 
                    p.name,
                    COUNT(*) as sales,
                    SUM(t.amount) as revenue
                FROM transactions t
                JOIN listings l ON l.id = t.listing_id
                JOIN products p ON p.id = l.product_id
                WHERE t.seller_id = $1
                    AND t.status = 'completed'
                    AND t.completed_at > NOW() - INTERVAL '${interval}'
                GROUP BY p.id
                ORDER BY revenue DESC
                LIMIT 5
            ),
            alert_performance AS (
                SELECT 
                    COUNT(*) as total_alerts,
                    SUM(CASE WHEN clicked THEN 1 ELSE 0 END) as clicked_alerts,
                    AVG(opportunity_score) as avg_opportunity_score
                FROM demand_alerts
                WHERE user_id = $1
                    AND created_at > NOW() - INTERVAL '${interval}'
            )
            SELECT 
                (SELECT row_to_json(seller_stats) FROM seller_stats) as seller,
                (SELECT json_agg(row_to_json(sales_history)) FROM sales_history) as sales_history,
                (SELECT json_agg(row_to_json(top_products)) FROM top_products) as top_products,
                (SELECT row_to_json(alert_performance) FROM alert_performance) as alert_performance
        `, {
            bind: [sellerId],
            type: sequelize.QueryTypes.SELECT,
        });

        return {
            seller_id: sellerId,
            period,
            generated_at: new Date().toISOString(),
            ...report[0],
        };
    }

    /**
     * Generate product performance report
     */
    async generateProductReport(productId, period = '30d') {
        const interval = this.getInterval(period);

        const report = await sequelize.query(`
            WITH product_stats AS (
                SELECT 
                    p.name,
                    p.brand,
                    p.category_id,
                    c.name as category_name,
                    p.demand_score,
                    p.average_rating,
                    p.review_count,
                    p.wishlist_count,
                    p.view_count,
                    p.search_count
                FROM products p
                JOIN categories c ON c.id = p.category_id
                WHERE p.id = $1
            ),
            price_history AS (
                SELECT 
                    DATE(created_at) as date,
                    AVG(price) as avg_price,
                    MIN(price) as min_price,
                    MAX(price) as max_price
                FROM price_history
                WHERE product_id = $1
                    AND created_at > NOW() - INTERVAL '${interval}'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            ),
            sales_stats AS (
                SELECT 
                    COUNT(*) as total_sales,
                    SUM(t.amount) as total_revenue,
                    AVG(t.amount) as avg_price
                FROM transactions t
                JOIN listings l ON l.id = t.listing_id
                WHERE l.product_id = $1
                    AND t.status = 'completed'
                    AND t.completed_at > NOW() - INTERVAL '${interval}'
            ),
            seller_stats AS (
                SELECT 
                    u.username,
                    COUNT(*) as sales,
                    SUM(t.amount) as revenue
                FROM transactions t
                JOIN listings l ON l.id = t.listing_id
                JOIN users u ON u.id = t.seller_id
                WHERE l.product_id = $1
                    AND t.status = 'completed'
                    AND t.completed_at > NOW() - INTERVAL '${interval}'
                GROUP BY u.id
                ORDER BY revenue DESC
                LIMIT 5
            )
            SELECT 
                (SELECT row_to_json(product_stats) FROM product_stats) as product,
                (SELECT json_agg(row_to_json(price_history)) FROM price_history) as price_history,
                (SELECT row_to_json(sales_stats) FROM sales_stats) as sales_stats,
                (SELECT json_agg(row_to_json(seller_stats)) FROM seller_stats) as seller_stats
        `, {
            bind: [productId],
            type: sequelize.QueryTypes.SELECT,
        });

        return {
            product_id: productId,
            period,
            generated_at: new Date().toISOString(),
            ...report[0],
        };
    }

    /**
     * Generate user report
     */
    async generateUserReport(userId) {
        const user = await sequelize.query(`
            WITH user_stats AS (
                SELECT 
                    u.username,
                    u.email,
                    u.role,
                    u.seller_rating,
                    u.total_sales,
                    u.total_reviews,
                    DATE(u.created_at) as joined_date
                FROM users u
                WHERE u.id = $1
            ),
            transaction_stats AS (
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(amount) as total_spent,
                    AVG(amount) as avg_transaction,
                    COUNT(CASE WHEN role = 'buyer' THEN 1 END) as purchases,
                    COUNT(CASE WHEN role = 'seller' THEN 1 END) as sales
                FROM (
                    SELECT amount, 'buyer' as role
                    FROM transactions
                    WHERE buyer_id = $1 AND status = 'completed'
                    UNION ALL
                    SELECT amount, 'seller' as role
                    FROM transactions
                    WHERE seller_id = $1 AND status = 'completed'
                ) t
            ),
            listing_stats AS (
                SELECT 
                    COUNT(*) as total_listings,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_listings,
                    COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_listings
                FROM listings
                WHERE user_id = $1
            ),
            review_stats AS (
                SELECT 
                    COUNT(*) as received_reviews,
                    AVG(rating) as avg_received_rating,
                    COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_reviews
                FROM reviews
                WHERE reviewed_id = $1
                    AND status = 'approved'
            )
            SELECT 
                (SELECT row_to_json(user_stats) FROM user_stats) as user,
                (SELECT row_to_json(transaction_stats) FROM transaction_stats) as transactions,
                (SELECT row_to_json(listing_stats) FROM listing_stats) as listings,
                (SELECT row_to_json(review_stats) FROM review_stats) as reviews
        `, {
            bind: [userId],
            type: sequelize.QueryTypes.SELECT,
        });

        return {
            user_id: userId,
            generated_at: new Date().toISOString(),
            ...user[0],
        };
    }

    /**
     * Generate marketing report
     */
    async generateMarketingReport(period = '30d') {
        const interval = this.getInterval(period);

        const report = await sequelize.query(`
            WITH channel_stats AS (
                SELECT 
                    source,
                    COUNT(*) as visits,
                    COUNT(DISTINCT user_id) as unique_visitors,
                    COUNT(DISTINCT CASE WHEN converted THEN user_id END) as conversions
                FROM analytics_events
                WHERE event_type = 'page_view'
                    AND created_at > NOW() - INTERVAL '${interval}'
                GROUP BY source
            ),
            acquisition_stats AS (
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as new_users,
                    COUNT(CASE WHEN role = 'seller' THEN 1 END) as new_sellers
                FROM users
                WHERE created_at > NOW() - INTERVAL '${interval}'
                GROUP BY DATE(created_at)
            ),
            funnel_stats AS (
                SELECT 
                    COUNT(DISTINCT user_id) as total_visitors,
                    COUNT(DISTINCT CASE WHEN event_type = 'search' THEN user_id END) as searchers,
                    COUNT(DISTINCT CASE WHEN event_type = 'product_view' THEN user_id END) as viewers,
                    COUNT(DISTINCT CASE WHEN event_type = 'add_to_cart' THEN user_id END) as cart_adds,
                    COUNT(DISTINCT CASE WHEN event_type = 'purchase' THEN user_id END) as purchasers
                FROM analytics_events
                WHERE created_at > NOW() - INTERVAL '${interval}'
            )
            SELECT 
                (SELECT json_agg(row_to_json(channel_stats)) FROM channel_stats) as channels,
                (SELECT json_agg(row_to_json(acquisition_stats) ORDER BY date DESC) FROM acquisition_stats) as acquisition,
                (SELECT row_to_json(funnel_stats) FROM funnel_stats) as funnel
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        return {
            period,
            generated_at: new Date().toISOString(),
            ...report[0],
        };
    }

    /**
     * Export report as PDF
     */
    async exportReportPDF(reportData, title) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Header
                doc.fontSize(24)
                    .font('Helvetica-Bold')
                    .text(title, { align: 'center' })
                    .moveDown();

                doc.fontSize(10)
                    .font('Helvetica')
                    .text(`Generated: ${new Date().toISOString()}`, { align: 'center' })
                    .moveDown();

                // Add content based on report type
                this.addReportContent(doc, reportData);

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Add report content to PDF
     */
    addReportContent(doc, reportData) {
        // Add summary section
        if (reportData.summary) {
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Summary', { underline: true })
                .moveDown();

            const summary = reportData.summary;
            doc.fontSize(12)
                .font('Helvetica')
                .text(`Total Transactions: ${summary.total_transactions || 0}`)
                .text(`Total Revenue: $${(summary.total_revenue || 0).toFixed(2)}`)
                .text(`Average Order Value: $${(summary.avg_order_value || 0).toFixed(2)}`)
                .text(`Unique Buyers: ${summary.unique_buyers || 0}`)
                .text(`Unique Sellers: ${summary.unique_sellers || 0}`)
                .moveDown();
        }

        // Add daily sales chart (placeholder)
        if (reportData.daily_sales) {
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Daily Sales', { underline: true })
                .moveDown();

            const table = this.formatTable(reportData.daily_sales.slice(0, 10), [
                { key: 'date', label: 'Date' },
                { key: 'transactions', label: 'Transactions' },
                { key: 'revenue', label: 'Revenue' },
            ]);

            doc.fontSize(10).font('Helvetica').text(table);
            doc.moveDown();
        }

        // Add top categories
        if (reportData.top_categories) {
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Top Categories', { underline: true })
                .moveDown();

            const categories = reportData.top_categories.slice(0, 5);
            categories.forEach((cat, i) => {
                doc.fontSize(12)
                    .font('Helvetica')
                    .text(`${i + 1}. ${cat.category}: ${cat.transactions} transactions, $${(cat.revenue || 0).toFixed(2)}`)
                    .moveDown(0.5);
            });
        }

        // Add top sellers
        if (reportData.top_sellers) {
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('Top Sellers', { underline: true })
                .moveDown();

            const sellers = reportData.top_sellers.slice(0, 5);
            sellers.forEach((seller, i) => {
                doc.fontSize(12)
                    .font('Helvetica')
                    .text(`${i + 1}. ${seller.username}: ${seller.sales} sales, $${(seller.revenue || 0).toFixed(2)}`)
                    .moveDown(0.5);
            });
        }

        // Footer
        doc.moveDown()
            .fontSize(10)
            .font('Helvetica')
            .text('Confidential - For internal use only', { align: 'center' })
            .text('© PricePulse', { align: 'center' });
    }

    /**
     * Format table for PDF
     */
    formatTable(data, columns) {
        if (!data || data.length === 0) return 'No data available';

        // Calculate column widths
        const widths = columns.map(col => Math.max(
            col.label.length * 2,
            ...data.map(row => String(row[col.key] || '').length)
        ));

        let table = '';

        // Header
        table += columns.map((col, i) => String(col.label).padEnd(widths[i])).join(' | ') + '\n';
        table += columns.map((_, i) => '-'.repeat(widths[i])).join(' | ') + '\n';

        // Data
        data.forEach(row => {
            table += columns.map((col, i) => String(row[col.key] || '').padEnd(widths[i])).join(' | ') + '\n';
        });

        return table;
    }

    /**
     * Get interval
     */
    getInterval(period) {
        const intervals = {
            '7d': '7 days',
            '30d': '30 days',
            '90d': '90 days',
            '1y': '1 year',
        };
        return intervals[period] || '30 days';
    }
}

module.exports = new ReportService();