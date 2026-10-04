// backend/src/seeders/20240101000001-demo-categories.js
'use strict';

module.exports = {
    up: async (queryInterface) => {
        const categories = [
            {
                name: 'Electronics',
                slug: 'electronics',
                description: 'Latest gadgets, computers, phones, and electronic devices',
                icon: '📱',
                color: '#3B82F6',
                display_order: 1,
                is_active: true,
                seo_title: 'Electronics - PricePulse',
                seo_description: 'Compare prices for electronics, gadgets, and tech devices',
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                name: 'Clothing & Fashion',
                slug: 'clothing-fashion',
                description: 'Men and women clothing, accessories, and fashion items',
                icon: '👔',
                color: '#8B5CF6',
                display_order: 2,
                is_active: true,
                seo_title: 'Clothing & Fashion - PricePulse',
                seo_description: 'Compare prices for clothing, accessories, and fashion items',
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                name: 'Home & Garden',
                slug: 'home-garden',
                description: 'Furniture, decor, gardening tools, and home improvement',
                icon: '🏠',
                color: '#10B981',
                display_order: 3,
                is_active: true,
                seo_title: 'Home & Garden - PricePulse',
                seo_description: 'Compare prices for furniture, decor, and home improvement',
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                name: 'Sports & Outdoors',
                slug: 'sports-outdoors',
                description: 'Sporting goods, outdoor gear, and fitness equipment',
                icon: '⚽',
                color: '#EF4444',
                display_order: 4,
                is_active: true,
                seo_title: 'Sports & Outdoors - PricePulse',
                seo_description: 'Compare prices for sports equipment and outdoor gear',
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                name: 'Toys & Games',
                slug: 'toys-games',
                description: 'Toys, board games, video games, and collectibles',
                icon: '🎮',
                color: '#F59E0B',
                display_order: 5,
                is_active: true,
                seo_title: 'Toys & Games - PricePulse',
                seo_description: 'Compare prices for toys, games, and collectibles',
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                name: 'Books & Media',
                slug: 'books-media',
                description: 'Books, movies, music, and media content',
                icon: '📚',
                color: '#8B5CF6',
                display_order: 6,
                is_active: true,
                seo_title: 'Books & Media - PricePulse',
                seo_description: 'Compare prices for books, movies, and music',
                created_at: new Date(),
                updated_at: new Date(),
            },
        ];

        await queryInterface.bulkInsert('categories', categories);
    },

    down: async (queryInterface) => {
        await queryInterface.bulkDelete('categories', null, {});
    },
};