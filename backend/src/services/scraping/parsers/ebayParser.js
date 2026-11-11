// backend/src/services/scraping/parsers/ebayParser.js

/**
 * eBay Product Parser
 * Extracts product data from eBay search results
 */
class EbayParser {
    constructor() {
        this.sourceName = 'ebay';
        this.baseUrl = 'https://www.ebay.com/sch/i.html?_nkw=';
        this.requiresBrowser = false;

        // CSS selectors for eBay
        this.selectors = {
            product: '.s-item',
            title: '.s-item__title',
            price: '.s-item__price',
            image: '.s-item__image-img',
            rating: '.s-item__reviews-count',
            shipping: '.s-item__shipping',
            seller: '.s-item__seller-info-text',
            productUrl: '.s-item__link',
        };
    }

    /**
     * Parse eBay search results
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
                let originalPrice = null;

                if (priceText) {
                    // Handle price ranges and special formats
                    const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
                    if (priceMatch) {
                        price = parseFloat(priceMatch[1].replace(/,/g, ''));
                    }

                    // Check for original price (crossed out)
                    if (priceText.includes('was')) {
                        const wasMatch = priceText.match(/was\s*\$?([\d,]+\.?\d*)/);
                        if (wasMatch) {
                            originalPrice = parseFloat(wasMatch[1].replace(/,/g, ''));
                        }
                    }
                }

                // Extract image
                const image = $(element).find(this.selectors.image).attr('src');

                // Extract shipping
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
                    productUrl = `https://www.ebay.com${productUrl}`;
                }

                if (title && price > 0) {
                    products.push({
                        title,
                        price,
                        original_price: originalPrice || price,
                        image,
                        shipping_cost: shippingCost,
                        seller_name: seller || 'eBay Seller',
                        product_url: productUrl,
                        is_available: true,
                        currency: 'USD',
                        condition: this.detectCondition(title),
                        source: this.sourceName,
                        is_promotion: originalPrice !== null && originalPrice > price,
                    });
                }
            } catch (error) {
                console.error('eBay parsing error:', error);
            }
        });

        return products;
    }

    /**
     * Detect condition from title
     */
    detectCondition(title) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('new') || lowerTitle.includes('sealed')) {
            return 'new';
        }
        if (lowerTitle.includes('like new') || lowerTitle.includes('open box')) {
            return 'like-new';
        }
        if (lowerTitle.includes('good') || lowerTitle.includes('used')) {
            return 'good';
        }
        if (lowerTitle.includes('fair') || lowerTitle.includes('acceptable')) {
            return 'fair';
        }
        return 'good';
    }

    /**
     * Parse product detail page
     */
    parseProductDetail($) {
        try {
            const title = $('.it-ttl').text().trim() || $('#itemTitle').text().trim();
            const price = $('.vi-price').text().trim() || $('.notranslate .vi-price').text().trim();
            const description = $('.item-description').text().trim() ||
                $('#desc_div').text().trim();
            const images = [];
            $('.vi-image-gallery img').each((i, el) => {
                images.push($(el).attr('src'));
            });
            const seller = $('.mbg-nw').text().trim() ||
                $('#sellerInfo .mbg-nw').text().trim();

            return {
                title,
                price: parseFloat(price.replace(/[^0-9.]/g, '')),
                description,
                images: images.filter(Boolean),
                seller,
                condition: $('.u-flL.condText').text().trim() || 'Used',
                details: {
                    itemId: $('#itemId').val(),
                    views: $('.vi-lbl-views .vi-value').text().trim(),
                    watchCount: $('#watchCount').text().trim(),
                },
            };
        } catch (error) {
            console.error('eBay product detail parsing error:', error);
            return null;
        }
    }
}

module.exports = new EbayParser();