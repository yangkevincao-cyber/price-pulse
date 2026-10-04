// backend/src/seeders/20240101000005-demo-external-prices.js
'use strict';

module.exports = {
    up: async (queryInterface) => {
        // Get product IDs
        const products = await queryInterface.sequelize.query(
            `SELECT id, name FROM products WHERE is_active = true;`
        );
        const productMap = products[0].reduce((acc, product) => {
            acc[product.name] = product.id;
            return acc;
        }, {});

        // Get source IDs
        const sources = await queryInterface.sequelize.query(
            `SELECT id, name FROM external_sources;`
        );
        const sourceMap = sources[0].reduce((acc, source) => {
            acc[source.name] = source.id;
            return acc;
        }, {});

        const externalPrices = [
            {
                product_id: productMap['iPhone 15 Pro Max'],
                source_id: sourceMap['Amazon'],
                source_name: 'Amazon',
                price: 1099.99,
                original_price: 1099.99,
                shipping_cost: 0,
                total_price: 1099.99,
                condition: 'new',
                seller_name: 'Amazon Direct',
                seller_rating: 4.9,
                product_url: 'https://amazon.com/iphone15promax',
                product_title: 'iPhone 15 Pro Max - 256GB',
                is_available: true,
                scraped_at: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                product_id: productMap['iPhone 15 Pro Max'],
                source_id: sourceMap['Walmart'],
                source_name: 'Walmart',
                price: 1099.99,
                original_price: 1099.99,
                shipping_cost: 0,
                total_price: 1099.99,
                condition: 'new',
                seller_name: 'Walmart',
                seller_rating: 4.8,
                product_url: 'https://walmart.com/iphone15promax',
                product_title: 'iPhone 15 Pro Max - 256GB',
                is_available: true,
                scraped_at: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                product_id: productMap['Samsung Galaxy S24 Ultra'],
                source_id: sourceMap['Amazon'],
                source_name: 'Amazon',
                price: 899.99,
                original_price: 899.99,
                shipping_cost: 0,
                total_price: 899.99,
                condition: 'new',
                seller_name: 'Amazon Direct',
                seller_rating: 4.9,
                product_url: 'https://amazon.com/galaxys24ultra',
                product_title: 'Samsung Galaxy S24 Ultra - 512GB',
                is_available: true,
                scraped_at: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                product_id: productMap['Samsung Galaxy S24 Ultra'],
                source_id: sourceMap['eBay'],
                source_name: 'eBay',
                price: 849.99,
                original_price: 899.99,
                shipping_cost: 9.99,
                total_price: 859.98,
                condition: 'new',
                seller_name: 'TechSeller',
                seller_rating: 4.7,
                product_url: 'https://ebay.com/galaxys24ultra',
                product_title: 'Samsung Galaxy S24 Ultra - 512GB',
                is_available: true,
                scraped_at: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                product_id: productMap['MacBook Pro 16-inch'],
                source_id: sourceMap['Amazon'],
                source_name: 'Amazon',
                price: 2499.99,
                original_price: 2999.99,
                shipping_cost: 0,
                total_price: 2499.99,
                condition: 'new',
                seller_name: 'Amazon Direct',
                seller_rating: 4.8,
                product_url: 'https://amazon.com/macbookpro16',
                product_title: 'MacBook Pro 16-inch - M3 Max',
                is_available: true,
                scraped_at: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                product_id: productMap['Nike Air Max 270'],
                source_id: sourceMap['Amazon'],
                source_name: 'Amazon',
                price: 129.99,
                original_price: 159.99,
                shipping_cost: 0,
                total_price: 129.99,
                condition: 'new',
                seller_name: 'Nike Store',
                seller_rating: 4.8,
                product_url: 'https://amazon.com/nikeairmax270',
                product_title: 'Nike Air Max 270 - White/Black',
                is_available: true,
                scraped_at: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                product_id: productMap['Sony WH-1000XM5'],
                source_id: sourceMap['Amazon'],
                source_name: 'Amazon',
                price: 249.99,
                original_price: 349.99,
                shipping_cost: 0,
                total_price: 249.99,
                condition: 'new',
                seller_name: 'Sony Store',
                seller_rating: 4.7,
                product_url: 'https://amazon.com/sonywh1000xm5',
                product_title: 'Sony WH-1000XM5 - Noise Canceling',
                is_available: true,
                scraped_at: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                product_id: productMap['Sony WH-1000XM5'],
                source_id: sourceMap['Best Buy'],
                source_name: 'Best Buy',
                price: 239.99,
                original_price: 349.99,
                shipping_cost: 0,
                total_price: 239.99,
                condition: 'new',
                seller_name: 'Best Buy',
                seller_rating: 4.8,
                product_url: 'https://bestbuy.com/sonywh1000xm5',
                product_title: 'Sony WH-1000XM5 - Noise Canceling',
                is_available: true,
                scraped_at: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            },
        ];

        await queryInterface.bulkInsert('external_prices', externalPrices);
    },

    down: async (queryInterface) => {
        await queryInterface.bulkDelete('external_prices', null, {});
    },
};