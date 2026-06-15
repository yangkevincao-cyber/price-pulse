// backend/src/scraping/scheduler.js
const cron = require('node-cron');
const WebScraper = require('./webScraper');
const db = require('../config/database');

class ScrapingScheduler {
    constructor() {
        this.scraper = new WebScraper();
    }

    start() {
        // Scrape top 100 most searched products daily at 2 AM
        cron.schedule('0 2 * * *', async () => {
            console.log('Starting daily price scraping...');

            const topProducts = await db.query(`
                SELECT p.id, p.name, COUNT(DISTINCT sq.id) as search_count
                FROM products p
                JOIN search_queries sq ON sq.query_text ILIKE '%' || p.name || '%'
                WHERE sq.created_at > NOW() - INTERVAL '7 days'
                GROUP BY p.id
                ORDER BY search_count DESC
                LIMIT 100
            `);

            for (const product of topProducts.rows) {
                const prices = await this.scraper.scrapeProduct(product.name);

                // Store prices in database
                for (const price of prices) {
                    await db.query(`
                        INSERT INTO external_prices (product_id, source_id, price, product_url)
                        SELECT $1, s.id, $2, $3
                        FROM external_sources s
                        WHERE s.source_name = $4
                        ON CONFLICT (product_id, source_id, scraped_at::date) 
                        DO UPDATE SET price = EXCLUDED.price
                    `, [product.id, price.price, price.productUrl, price.source]);
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log('Daily scraping completed');
        });

        // Update demand scores hourly
        cron.schedule('0 * * * *', async () => {
            await this.updateDemandScores();
        });
    }

    async updateDemandScores() {
        await db.query(`
            -- Calculate 7-day demand score for each product
            WITH demand_metrics AS (
                SELECT 
                    p.id,
                    -- Search volume (40% weight)
                    (COUNT(DISTINCT sq.id) / 100.0) * 0.4 as search_score,
                    -- View volume (30% weight)
                    (COUNT(DISTINCT pv.id) / 500.0) * 0.3 as view_score,
                    -- Wishlist volume (30% weight)
                    (COUNT(DISTINCT w.id) / 50.0) * 0.3 as wishlist_score
                FROM products p
                LEFT JOIN search_queries sq ON sq.query_text ILIKE '%' || p.name || '%' 
                    AND sq.created_at > NOW() - INTERVAL '7 days'
                LEFT JOIN product_views pv ON pv.product_id = p.id 
                    AND pv.viewed_at > NOW() - INTERVAL '7 days'
                LEFT JOIN wishlists w ON w.product_id = p.id 
                    AND w.created_at > NOW() - INTERVAL '7 days'
                GROUP BY p.id
            )
            UPDATE products p
            SET demand_score = LEAST(1.0, 
                dm.search_score + dm.view_score + dm.wishlist_score
            )
            FROM demand_metrics dm
            WHERE p.id = dm.id;
        `);
    }
}

module.exports = ScrapingScheduler;