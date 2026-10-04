// backend/src/services/scraping/parsers/aliexpressParser.js

/**
 * AliExpress Product Parser
 * Extracts product data from AliExpress search results
 */
class AliexpressParser {
    constructor() {
        this.sourceName = 'aliexpress';
        this.baseUrl = 'https://www.aliexpress.com/wholesale?SearchText=';
        this.requiresBrowser = true; // AliExpress requires JavaScript

        // CSS selectors for AliExpress
        this.selectors = {
            product: '[data-product-id]',
            title: '.product-title',
            price: '.product-price-value',
            image: '.product-image img',
            rating: '.product-rating',
            orders: '.product-orders',
            shipping: '.shipping-cost',
            seller: '.store-name',
            productUrl: '.product-link',
        };
    }

    /**
     * Parse AliExpress search results
     */
    parse($, searchQuery) {
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
                    // Handle currency conversion (USD, EUR, etc.)
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

                // Extract orders count
                const ordersText = $(element).find(this.selectors.orders).text().trim();
                const orders = ordersText ? parseInt(ordersText.replace(/[^0-9]/g, '')) : 0;

                // Extract shipping cost
                const shippingText = $(element).find(this.selectors.shipping).text().trim();
                let shippingCost = 0;
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
                    productUrl = `https://www.aliexpress.com${productUrl}`;
                }

                if (title && price > 0) {
                    products.push({
                        title,
                        price,
                        original_price: price,
                        image,
                        rating,
                        orders,
                        shipping_cost: shippingCost,
                        seller_name: seller || 'AliExpress Seller',
                        product_url: productUrl,
                        is_available: true,
                        currency: 'USD',
                        condition: 'new',
                        source: this.sourceName,
                    });
                }
            } catch (error) {
                console.error('AliExpress parsing error:', error);
            }
        });

        return products;
    }

    /**
     * Parse product detail page
     */
    parseProductDetail($, productUrl) {
        try {
            const title = $('.product-title-text').text().trim() ||
                $('#product-title').text().trim();
            const price = $('.product-price-value').text().trim() ||
                $('.product-price .price').text().trim();
            const description = $('.product-description').text().trim() ||
                $('#product-description').text().trim();
            const images = [];
            $('.product-image img').each((i, el) => {
                images.push($(el).attr('src'));
            });
            const seller = $('.store-name').text().trim() ||
                $('.seller-name').text().trim();

            // Extract specifications
            const specs = {};
            $('.product-property-list .property-item').each((i, el) => {
                const key = $(el).find('.property-key').text().trim();
                const value = $(el).find('.property-value').text().trim();
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
                    productId: $('#product-id').val(),
                    sku: $('.sku-value').text().trim(),
                    weight: specs['Weight'] || null,
                    dimensions: specs['Dimensions'] || null,
                },
            };
        } catch (error) {
            console.error('AliExpress product detail parsing error:', error);
            return null;
        }
    }
}

module.exports = new AliexpressParser();