// backend/src/seeders/20240101000003-demo-listings.js
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

        // Get user IDs
        const users = await queryInterface.sequelize.query(
            `SELECT id, username FROM users WHERE role = 'seller';`
        );
        const userMap = users[0].reduce((acc, user) => {
            acc[user.username] = user.id;
            return acc;
        }, {});

        const listings = [
            {
                id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
                user_id: userMap['seller'],
                product_id: productMap['iPhone 15 Pro Max'],
                title: 'iPhone 15 Pro Max - Like New',
                description: 'Selling my iPhone 15 Pro Max, used for 2 months. Perfect condition, no scratches.',
                price: 1099.99,
                original_price: 1199.99,
                condition: 'like-new',
                quantity: 1,
                available_quantity: 1,
                status: 'active',
                shipping_cost: 10.00,
                accepts_offers: true,
                min_offer_price: 999.99,
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
                user_id: userMap['seller'],
                product_id: productMap['Samsung Galaxy S24 Ultra'],
                title: 'Samsung Galaxy S24 Ultra - Brand New',
                description: 'Brand new Samsung Galaxy S24 Ultra, sealed in box. 512GB storage.',
                price: 899.99,
                original_price: 999.99,
                condition: 'new',
                quantity: 1,
                available_quantity: 1,
                status: 'active',
                shipping_cost: 10.00,
                accepts_offers: false,
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
                user_id: userMap['seller'],
                product_id: productMap['MacBook Pro 16-inch'],
                title: 'MacBook Pro 16-inch - M3 Max',
                description: 'Powerful MacBook Pro with M3 Max chip, 36GB RAM, 1TB SSD. Excellent condition.',
                price: 2499.99,
                original_price: 2999.99,
                condition: 'good',
                quantity: 1,
                available_quantity: 1,
                status: 'active',
                shipping_cost: 15.00,
                accepts_offers: true,
                min_offer_price: 2299.99,
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                user_id: userMap['seller'],
                product_id: productMap['Nike Air Max 270'],
                title: 'Nike Air Max 270 - White/Black',
                description: 'Comfortable Nike Air Max 270 running shoes. Size 10, lightly used.',
                price: 129.99,
                original_price: 159.99,
                condition: 'good',
                quantity: 1,
                available_quantity: 1,
                status: 'active',
                shipping_cost: 8.00,
                accepts_offers: true,
                min_offer_price: 109.99,
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                user_id: userMap['seller'],
                product_id: productMap['Sony WH-1000XM5'],
                title: 'Sony WH-1000XM5 - Excellent Condition',
                description: 'Premium noise-canceling headphones. Used for 6 months, perfect condition.',
                price: 249.99,
                original_price: 349.99,
                condition: 'good',
                quantity: 1,
                available_quantity: 1,
                status: 'active',
                shipping_cost: 8.00,
                accepts_offers: true,
                min_offer_price: 219.99,
                created_at: new Date(),
                updated_at: new Date(),
            },
        ];

        await queryInterface.bulkInsert('listings', listings);
    },

    down: async (queryInterface) => {
        await queryInterface.bulkDelete('listings', null, {});
    },
};