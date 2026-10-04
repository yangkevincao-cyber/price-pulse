// backend/src/services/scraping/parsers/amazonParser.js

/**
 * Amazon Product Parser
 * Extracts product data from Amazon search results
 */
class AmazonParser {
    constructor() {
        this.sourceName = 'amazon';
        this.baseUrl = 'https://www.amazon.com/s?k=';
        this.requiresBrowser = true; // Amazon requires JavaScript rendering

        // CSS selectors for Amazon
        this.selectors = {
            product: '[data-component-type="s-search-result"]',
            title: 'h2 a span',
            price: '.a-price-whole',
            priceFraction: '.a-price-fraction',
            image: '.s-image',
            rating: '.a-icon-alt',
            reviewCount: '.a-size-base',
            shipping: '.a-color-secondary',
            seller: '.a-link-normal .a-size-base',
            productUrl: 'a.a-link-normal',
        };
    }

    /**
     * Parse Amazon search results
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
                const priceWhole = $(element).find(this.selectors.price).first().text().trim();
                const priceFraction = $(element).find(this.selectors.priceFraction).first().text().trim();
                let price = 0;
                if (priceWhole) {
                    price = parseFloat(priceWhole.replace(/,/g, ''));
                    if (priceFraction) {
                        price += parseFloat(priceFraction) / 100;
                    }
                }

                // Extract image
                const image = $(element).find(this.selectors.image).attr('src');

                // Extract rating
                const ratingText = $(element).find(this.selectors.rating).text().trim();
                const rating = ratingText ? parseFloat(ratingText.match(/\d+\.?\d*/)?.[0]) : null;

                // Extract review count
                const reviewText = $(element).find(this.selectors.reviewCount).first().text().trim();
                const reviewCount = reviewText ? parseInt(reviewText.replace(/,/g, '')) : 0;

                // Extract product URL
                const productUrlElement = $(element).find(this.selectors.productUrl).first();
                let productUrl = productUrlElement.attr('href');
                if (productUrl && !productUrl.startsWith('http')) {
                    productUrl = `https://www.amazon.com${productUrl}`;
                }

                // Extract seller
                const seller = $(element).find(this.selectors.seller).first().text().trim();

                if (title && price > 0) {
                    products.push({
                        title,
                        price,
                        original_price: price,
                        image,
                        rating,
                        review_count: reviewCount,
                        seller_name: seller || 'Amazon',
                        product_url: productUrl,
                        is_available: true,
                        currency: 'USD',
                        condition: 'new',
                        source: this.sourceName,
                    });
                }
            } catch (error) {
                // Skip this product if parsing fails
                console.error('Amazon parsing error:', error);
            }
        });

        return products;
    }

    /**
     * Parse product detail page (for additional data)
     */
    parseProductDetail($, productUrl) {
        try {
            const title = $('h1#title').text().trim() || $('#productTitle').text().trim();
            const price = $('.a-price .a-offscreen').first().text().trim() ||
                $('.priceToPay .a-price-whole').text().trim();
            const description = $('#productDescription p').text().trim() ||
                $('#feature-bullets ul li').text().trim();
            const images = [];
            $('#altImages img').each((i, el) => {
                images.push($(el).attr('src'));
            });
            const brand = $('#bylineInfo .a-link-normal').text().trim() ||
                $('#brand .a-link-normal').text().trim();
            const availability = $('#availability span').text().trim();

            return {
                title,
                price: parseFloat(price.replace(/[^0-9.]/g, '')),
                description,
                images: images.filter(Boolean),
                brand,
                is_available: !availability.includes('out of stock'),
                details: {
                    asin: $('#ASIN').val(),
                    dimensions: $('#productDimensions .a-size-base').text().trim(),
                    weight: $('#productWeight .a-size-base').text().trim(),
                    manufacturer: $('#manufacturer .a-size-base').text().trim(),
                },
            };
        } catch (error) {
            console.error('Amazon product detail parsing error:', error);
            return null;
        }
    }

    /**
     * Parse category page
     */
    parseCategory($) {
        const products = this.parse($, '');
        const categories = [];

        $('#wayfinding-breadcrumbs_feature_div ul li').each((i, el) => {
            const name = $(el).text().trim();
            const url = $(el).find('a').attr('href');
            categories.push({ name, url });
        });

        return {
            products,
            categories,
        };
    }
}

module.exports = new AmazonParser();