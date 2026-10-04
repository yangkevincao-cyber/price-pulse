// backend/src/seeders/20240101000003-demo-products.js
'use strict';

module.exports = {
    up: async (queryInterface) => {
        // Get category IDs
        const categories = await queryInterface.sequelize.query(
            `SELECT id, name FROM categories;`
        );
        const categoryMap = categories[0].reduce((acc, cat) => {
            acc[cat.name] = cat.id;
            return acc;
        }, {});

        const products = [
            {
                id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                name: 'iPhone 15 Pro Max',
                slug: 'iphone-15-pro-max',
                description: 'The latest iPhone with advanced camera system and A17 Pro chip',
                brand: 'Apple',
                category_id: categoryMap['Electronics'],
                demand_score: 0.95,
                average_rating: 4.8,
                review_count: 150,
                wishlist_count: 200,
                view_count: 5000,
                search_count: 3000,
                tags: ['apple', 'iphone', 'smartphone', '5g'],
                is_active: true,
                is_featured: true,
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                name: 'Samsung Galaxy S24 Ultra',
                slug: 'samsung-galaxy-s24-ultra',
                description: 'Premium Android smartphone with S Pen and advanced AI features',
                brand: 'Samsung',
                category_id: categoryMap['Electronics'],
                demand_score: 0.92,
                average_rating: 4.7,
                review_count: 120,
                wishlist_count: 150,
                view_count: 4000,
                search_count: 2500,
                tags: ['samsung', 'android', 'smartphone', '5g'],
                is_active: true,
                is_featured: true,
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                name: 'MacBook Pro 16-inch',
                slug: 'macbook-pro-16-inch',
                description: 'Professional laptop with M3 Max chip for creative professionals',
                brand: 'Apple',
                category_id: categoryMap['Electronics'],
                demand_score: 0.88,
                average_rating: 4.9,
                review_count: 100,
                wishlist_count: 120,
                view_count: 3500,
                search_count: 2000,
                tags: ['apple', 'laptop', 'macbook', 'pro'],
                is_active: true,
                is_featured: true,
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
                name: 'Nike Air Max 270',
                slug: 'nike-air-max-270',
                description: 'Comfortable running shoes with Air Max cushioning technology',
                brand: 'Nike',
                category_id: categoryMap['Clothing & Fashion'],
                demand_score: 0.85,
                average_rating: 4.6,
                review_count: 80,
                wishlist_count: 100,
                view_count: 3000,
                search_count: 1800,
                tags: ['nike', 'shoes', 'running', 'sports'],
                is_active: true,
                is_featured: false,
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
                name: 'Sony WH-1000XM5',
                slug: 'sony-wh-1000xm5',
                description: 'Premium noise-canceling headphones with exceptional sound quality',
                brand: 'Sony',
                category_id: categoryMap['Electronics'],
                demand_score: 0.82,
                average_rating: 4.7,
                review_count: 90,
                wishlist_count: 110,
                view_count: 2800,
                search_count: 1600,
                tags: ['sony', 'headphones', 'audio', 'noise-canceling'],
                is_active: true,
                is_featured: false,
                created_at: new Date(),
                updated_at: new Date(),
            },
        ];

        await queryInterface.bulkInsert('products', products);
    },

    down: async (queryInterface) => {
        await queryInterface.bulkDelete('products', null, {});
    },
};