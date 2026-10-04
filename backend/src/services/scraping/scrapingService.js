// backend/src/services/scraping/scrapingService.js
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');
const { Product, ExternalPrice, ExternalSource } = require('../../models');
const { sequelize } = require('../../config/database');
const ProxyManager = require('./proxyManager');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

class ScrapingService {
    constructor() {
        this.proxyManager = new ProxyManager();
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
        ];
        this.parsers = {};
        this.isRunning = false;
        this.browser = null;
    }

    /**
     * Initialize scraping service
     */
    async initialize() {
        try {
            // Load parsers
            this.parsers = {
                amazon: require('./parsers/amazonParser'),
                ebay: require('./parsers/ebayParser'),
                aliexpress: require('./parsers/aliexpressParser'),
                walmart: require('./parsers/walmartParser'),
            };

            // Get enabled sources
            const sources = await ExternalSource.findAll({
                where: { scraping_enabled: true },
            });

            this.sources = sources.reduce((acc, source) => {
                acc[source.source_name.toLowerCase()] = {
                    id: source.id,
                    name: source.source_name,
                    baseUrl: source.base_url,
                    parser: this.parsers[source.source_name.toLowerCase()],
                };
                return acc;
            }, {});

            // Initialize browser for JavaScript-heavy sites
            if (process.env.SCRAPING_USE_BROWSER === 'true') {
                this.browser = await puppeteer.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--window-size=1920,1080',
                    ],
                });
            }

            logger.info('Scraping service initialized');
            return true;
        } catch (error) {
            logger.error('Scraping service initialization failed:', error);
            return false;
        }
    }

    /**
     * Scrape a product from all sources
     */
    async scrapeProduct(productName, sources = null) {
        const results = [];
        const sourcesToScrape = sources || Object.keys(this.sources);

        for (const sourceName of sourcesToScrape) {
            try {
                const source = this.sources[sourceName];
                if (!source || !source.parser) {
                    logger.warn(`Source ${sourceName} not configured`);
                    continue;
                }

                // Check rate limiting
                const canScrape = await this.checkRateLimit(sourceName);
                if (!canScrape) {
                    logger.warn(`Rate limit exceeded for ${sourceName}`);
                    continue;
                }

                // Get proxy
                const proxy = await this.proxyManager.getProxy();
                const userAgent = this.getRandomUserAgent();

                let result;
                if (source.parser.requiresBrowser) {
                    result = await this.scrapeWithBrowser(source, productName, proxy);
                } else {
                    result = await this.scrapeWithHttp(source, productName, proxy, userAgent);
                }

                if (result && result.length > 0) {
                    // Store results
                    await this.storeScrapedResults(result, source);
                    results.push({
                        source: sourceName,
                        count: result.length,
                        products: result,
                    });
                }

                // Log success
                await this.logScrapingActivity(sourceName, productName, result?.length || 0, 'success');

                // Respect rate limits
                await this.sleep(this.getRateLimitDelay(sourceName));

            } catch (error) {
                logger.error(`Scraping ${sourceName} failed:`, error);
                await this.logScrapingActivity(sourceName, productName, 0, 'error', error.message);

                // Continue with other sources
                continue;
            }
        }

        return results;
    }

    /**
     * Scrape with HTTP (cheerio)
     */
    async scrapeWithHttp(source, productName, proxy, userAgent) {
        const searchUrl = `${source.baseUrl}${encodeURIComponent(productName)}`;

        const config = {
            headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            },
            timeout: 30000,
        };

        if (proxy) {
            config.proxy = {
                host: proxy.host,
                port: proxy.port,
                auth: proxy.auth,
            };
        }

        const response = await axios.get(searchUrl, config);
        const $ = cheerio.load(response.data);

        return source.parser.parse($, productName);
    }

    /**
     * Scrape with browser (puppeteer)
     */
    async scrapeWithBrowser(source, productName, proxy) {
        let page = null;
        try {
            page = await this.browser.newPage();

            // Set user agent
            await page.setUserAgent(this.getRandomUserAgent());

            // Set viewport
            await page.setViewport({ width: 1920, height: 1080 });

            // Set proxy if provided
            if (proxy) {
                await page.authenticate({
                    username: proxy.auth?.username || '',
                    password: proxy.auth?.password || '',
                });
            }

            // Navigate to search URL
            const searchUrl = `${source.baseUrl}${encodeURIComponent(productName)}`;
            await page.goto(searchUrl, {
                waitUntil: 'networkidle2',
                timeout: 30000,
            });

            // Wait for results
            await page.waitForSelector(source.parser.selectors.product, {
                timeout: 10000,
            });

            // Extract data
            const results = await page.evaluate((selectors) => {
                const products = [];
                document.querySelectorAll(selectors.product).forEach((el, index) => {
                    if (index < 10) { // Limit to 10 results
                        const title = el.querySelector(selectors.title)?.textContent?.trim() || '';
                        const priceText = el.querySelector(selectors.price)?.textContent?.trim() || '';
                        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
                        const image = el.querySelector(selectors.image)?.src || '';
                        const productUrl = el.querySelector('a')?.href || '';

                        if (title && price) {
                            products.push({ title, price, image, productUrl });
                        }
                    }
                });
                return products;
            }, source.parser.selectors);

            await page.close();
            return results;

        } catch (error) {
            if (page) {
                await page.close();
            }
            throw error;
        }
    }

    /**
     * Store scraped results
     */
    async storeScrapedResults(results, source) {
        const transaction = await sequelize.transaction();

        try {
            for (const result of results) {
                // Find or create product
                let product = await Product.findOne({
                    where: {
                        name: result.title,
                    },
                    transaction,
                });

                if (!product) {
                    product = await Product.create({
                        name: result.title,
                        slug: result.title
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, ''),
                        description: result.description || '',
                        brand: result.brand || '',
                        images: result.images || [],
                        main_image: result.image || '',
                    }, { transaction });
                }

                // Store external price
                await ExternalPrice.create({
                    product_id: product.id,
                    source_id: source.id,
                    source_name: source.name,
                    price: result.price,
                    original_price: result.original_price || result.price,
                    shipping_cost: result.shipping_cost || 0,
                    total_price: (result.price || 0) + (result.shipping_cost || 0),
                    currency: result.currency || 'USD',
                    condition: result.condition || 'new',
                    seller_name: result.seller_name || '',
                    seller_rating: result.seller_rating || null,
                    product_url: result.product_url || '',
                    product_title: result.title,
                    is_available: result.is_available !== false,
                    is_promotion: result.is_promotion || false,
                    promotion_end_date: result.promotion_end_date || null,
                }, { transaction });
            }

            await transaction.commit();
            logger.info(`Stored ${results.length} scraped results`);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Check rate limit for source
     */
    async checkRateLimit(sourceName) {
        const key = `scraping:rate:${sourceName}`;
        const count = await redis.incr(key);
        if (count === 1) {
            await redis.expire(key, 60); // 1 minute window
        }
        const maxRequests = 30; // 30 requests per minute
        return count <= maxRequests;
    }

    /**
     * Get rate limit delay
     */
    getRateLimitDelay(sourceName) {
        const delays = {
            amazon: 2000,
            ebay: 1500,
            aliexpress: 3000,
            walmart: 1000,
        };
        return delays[sourceName] || 2000;
    }

    /**
     * Log scraping activity
     */
    async logScrapingActivity(source, query, count, status, error = null) {
        await sequelize.query(`
            INSERT INTO scraping_logs (source, query, count, status, error, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
        `, {
            bind: [source, query, count, status, error],
        });
    }

    /**
     * Get random user agent
     */
    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Close browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    /**
     * Get scraping status
     */
    async getStatus() {
        const sources = await ExternalSource.findAll();
        const logs = await sequelize.query(`
            SELECT source, COUNT(*) as total,
                   SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                   SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
                   AVG(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100 as success_rate
            FROM scraping_logs
            WHERE created_at > NOW() - INTERVAL '24 hours'
            GROUP BY source
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        return {
            sources: sources.map(source => {
                const log = logs.find(l => l.source === source.source_name);
                return {
                    ...source.toJSON(),
                    stats: log || { total: 0, successful: 0, failed: 0, success_rate: 0 },
                };
            }),
            isRunning: this.isRunning,
        };
    }
}

module.exports = new ScrapingService();