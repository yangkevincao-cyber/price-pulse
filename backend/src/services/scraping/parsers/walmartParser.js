// backend/src/services/scraping/parsers/walmartParser.js

/**
 * Walmart Product Parser
 * Extracts product data from Walmart search results
 */
class WalmartParser {
    constructor() {
        this.sourceName = 'walmart';
        this.baseUrl = 'https://www.walmart.com/search?q=';
        this.requiresBrowser = true; // Walmart requires JavaScript

        // CSS selectors for Walmart
        this.selectors = {
            product: '[data-testid="product-item"]',
            title: '[data-testid="product-title"]',
            price: '[data-testid="price"]',
            image: '[data-testid="product-image"]',
            rating: '[data-testid="product-rating"]',
            reviewCount: '[data-testid="review-count"]',
            shipping: '[data-testid="shipping-info"]',
            seller: '[data-testid="seller-info"]',
            productUrl: '[data-testid="product-link"]',
        };
    }

    /**
     * Parse Walmart search results
     */
    parse($) {
        const products = [];

        $(this.selectors.product).each((index, element) => {
            if (index >= 10) return; // Limit to 10 results

            try {
                // Extract title
                const titleElement = $(element).find(this.selectors.title);
                const title = titleElement.text().trim();

                // Extract price
                const priceText = $(element).find(this.selectors.price).first().text().trim();
                let price = 0;
                if (priceText) {
                    const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
                    if (priceMatch) {
                        price = parseFloat(priceMatch[1].replace(/,/g, ''));
                    }
                }

                // Extract image
                const image = $(element).find(this.selectors.image).attr('src');

                // Extract rating
                const ratingText = $(element).find(this.selectors.rating).text().trim();
                const rating = ratingText ? parseFloat(ratingText) : null;

                // Extract review count
                const reviewText = $(element).find(this.selectors.reviewCount).text().trim();
                const reviewCount = reviewText ? parseInt(reviewText.replace(/[^0-9]/g, '')) : 0;

                // Extract shipping
                const shippingText = $(element).find(this.selectors.shipping).text().trim();
                let shippingCost = null;
                if (shippingText.includes('Free')) {
                    shippingCost = 0;
                } else if (shippingText.includes('$')) {
                    const shipMatch = shippingText.match(/\$?([\d,]+\.?\d*)/);
                    if (shipMatch) {
                        shippingCost = parseFloat(shipMatch[1].replace(/,/g, ''));
                    }
                }

                // Extract seller
                const seller = $(element).find(this.selectors.seller).text().trim();

                // Extract product URL
                const productUrlElement = $(element).find(this.selectors.productUrl).first();
                let productUrl = productUrlElement.attr('href');
                if (productUrl && !productUrl.startsWith('http')) {
                    productUrl = `https://www.walmart.com${productUrl}`;
                }

                if (title && price > 0) {
                    products.push({
                        title,
                        price,
                        original_price: price,
                        image,
                        rating,
                        review_count: reviewCount,
                        shipping_cost: shippingCost,
                        seller_name: seller || 'Walmart',
                        product_url: productUrl,
                        is_available: true,
                        currency: 'USD',
                        condition: 'new',
                        source: this.sourceName,
                    });
                }
            } catch (error) {
                console.error('Walmart parsing error:', error);
            }
        });

        return products;
    }

    /**
     * Parse product detail page
     */
    parseProductDetail($) {
        try {
            const title = $('[data-testid="product-title"]').text().trim() ||
                $('.prod-title').text().trim();
            const price = $('[data-testid="price"]').text().trim() ||
                $('.price-main').text().trim();
            const description = $('[data-testid="product-description"]').text().trim() ||
                $('.product-description').text().trim();
            const images = [];
            $('.product-image img').each((i, el) => {
                images.push($(el).attr('src'));
            });
            const seller = $('[data-testid="seller-name"]').text().trim() ||
                $('.seller-name').text().trim();

            // Extract specifications
            const specs = {};
            $('.product-specs .spec-item').each((i, el) => {
                const key = $(el).find('.spec-label').text().trim();
                const value = $(el).find('.spec-value').text().trim();
                if (key && value) {
                    specs[key] = value;
                }
            });

            return {
                title,
                price: parseFloat(price.replace(/[^0-9.]/g, '')),
                description,
                images: images.filter(Boolean),
                seller,
                specifications: specs,
                details: {
                    productId: $('[data-testid="product-id"]').text().trim(),
                    sku: $('[data-testid="sku"]').text().trim(),
                    weight: specs['Weight'] || null,
                    dimensions: specs['Dimensions'] || null,
                    upc: $('[data-testid="upc"]').text().trim(),
                },
            };
        } catch (error) {
            console.error('Walmart product detail parsing error:', error);
            return null;
        }
    }
}

module.exports = new WalmartParser();