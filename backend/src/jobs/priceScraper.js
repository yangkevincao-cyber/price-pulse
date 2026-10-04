// backend/src/jobs/priceScraper.js
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');
const { Product, ExternalPrice } = require('../models');
const scrapingService = require('../services/scraping/scrapingService');
const pricePredictionService = require('../services/intelligence/pricePredictionService');

class PriceScraperJob {
    constructor() {
        this.name = 'price_scraper';
        this.isRunning = false;
        this.lastRun = null;
    }

    /**
     * Run the job
     */
    async run() {
        if (this.isRunning) {
            logger.warn('Price scraper job already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting price scraper job');

        try {
            // Get products to scrape
            const products = await this.getProductsToScrape();

            let scrapedCount = 0;

            for (const product of products) {
                try {
                    // Scrape product prices
                    const results = await scrapingService.scrapeProduct(product.name);

                    // Store results
                    await this.storeScrapedResults(results);

                    // Update price prediction
                    await pricePredictionService.predictPrice(product.id);

                    scrapedCount++;
                } catch (error) {
                    logger.error(`Failed to scrape product ${product.id}:`, error);
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            logger.info(`Price scraper job completed: ${scrapedCount} products scraped`);
            this.lastRun = new Date();
        } catch (error) {
            logger.error('Price scraper job failed:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Get products to scrape
     */
    async getProductsToScrape() {
        // Get products with high demand or recently created
        const products = await Product.findAll({
            where: {
                is_active: true,
                is_deleted: false,
            },
            order: [
                ['demand_score', 'DESC'],
                ['created_at', 'DESC'],
            ],
            limit: 100,
        });

        // Filter products that haven't been scraped recently
        const productIds = products.map(p => p.id);
        const recentScrapes = await ExternalPrice.findAll({
            where: {
                product_id: productIds,
                scraped_at: { [sequelize.Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
            attributes: ['product_id'],
            group: ['product_id'],
        });

        const recentProductIds = recentScrapes.map(r => r.product_id);

        return products.filter(p => !recentProductIds.includes(p.id));
    }

    /**
     * Store scraped results
     */
    async storeScrapedResults(results) {
        for (const sourceResult of results) {
            for (const product of sourceResult.products) {
                await ExternalPrice.create({
                    product_id: product.id,
                    source_id: sourceResult.sourceId,
                    source_name: sourceResult.source,
                    price: product.price,
                    original_price: product.original_price || product.price,
                    shipping_cost: product.shipping_cost || 0,
                    total_price: product.price + (product.shipping_cost || 0),
                    currency: 'USD',
                    condition: product.condition || 'new',
                    seller_name: product.seller_name || '',
                    seller_rating: product.seller_rating || null,
                    product_url: product.product_url || '',
                    product_title: product.title,
                    is_available: true,
                });
            }
        }
    }

    /**
     * Get job status
     */
    getStatus() {
        return {
            name: this.name,
            isRunning: this.isRunning,
            lastRun: this.lastRun,
        };
    }
}

module.exports = new PriceScraperJob();