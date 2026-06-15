// backend/src/scraping/scrapingManager.js
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra'); // For JS-heavy sites
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

class WebScraper {
    constructor() {
        this.sources = {
            amazon: {
                url: 'https://www.amazon.com/s?k=',
                selectors: {
                    product: '[data-component-type="s-search-result"]',
                    title: 'h2 a span',
                    price: '.a-price-whole',
                    shipping: '.a-color-secondary'
                },
                rate_limit: 1000 // ms between requests
            },
            ebay: {
                url: 'https://www.ebay.com/sch/i.html?_nkw=',
                selectors: {
                    product: '.s-item',
                    title: '.s-item__title',
                    price: '.s-item__price',
                    shipping: '.s-item__shipping'
                },
                rate_limit: 1500
            },
            aliexpress: {
                url: 'https://www.aliexpress.com/wholesale?SearchText=',
                selectors: {
                    product: '[data-product-id]',
                    title: '.product-title',
                    price: '.product-price-value'
                },
                rate_limit: 2000
            }
        };
    }

    async scrapeProduct(productName) {
        const results = [];

        for (const [sourceName, config] of Object.entries(this.sources)) {
            try {
                // Rotate user agents to avoid blocking
                const userAgent = this.getRandomUserAgent();
                const searchUrl = `${config.url}${encodeURIComponent(productName)}`;

                const response = await axios.get(searchUrl, {
                    headers: { 'User-Agent': userAgent },
                    timeout: 10000
                });

                const $ = cheerio.load(response.data);
                const products = [];

                $(config.selectors.product).each((i, elem) => {
                    if (i < 10) { // Limit to top 10 results
                        const title = $(elem).find(config.selectors.title).text().trim();
                        const priceText = $(elem).find(config.selectors.price).text();
                        const price = this.extractPrice(priceText);

                        if (title && price) {
                            products.push({
                                source: sourceName,
                                title,
                                price,
                                productUrl: $(elem).find('a').attr('href')
                            });
                        }
                    }
                });

                results.push(...products);

                // Respect rate limits
                await this.sleep(config.rate_limit);

            } catch (error) {
                console.error(`Error scraping ${sourceName}:`, error.message);
                // Continue with other sources
            }
        }

        return results;
    }

    async scrapeWithPuppeteer(productName) {
        // For JavaScript-heavy sites that need rendering
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        await page.setUserAgent(this.getRandomUserAgent());
        await page.goto(`https://www.walmart.com/search?q=${encodeURIComponent(productName)}`);

        // Wait for products to load
        await page.waitForSelector('[data-testid="product-title"]');

        const products = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll('[data-testid="product-title"]').forEach((el, i) => {
                if (i < 10) {
                    items.push({
                        title: el.innerText,
                        price: document.querySelector('[data-testid="price"]')?.innerText
                    });
                }
            });
            return items;
        });

        await browser.close();
        return products;
    }

    getRandomUserAgent() {
        const agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        ];
        return agents[Math.floor(Math.random() * agents.length)];
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    extractPrice(priceText) {
        // Extract numeric price from text like "$24.99" or "US $24.99"
        const match = priceText.match(/(\d+(?:\.\d{2})?)/);
        return match ? parseFloat(match[1]) : null;
    }
}

module.exports = WebScraper;