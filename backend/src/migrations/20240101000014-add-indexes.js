// backend/src/migrations/20240101000014-add-indexes.js
'use strict';

module.exports = {
    up: async (queryInterface) => {
        // Add composite indexes for performance

        // Listings: active listings with price
        await queryInterface.addIndex('listings', ['status', 'price'], {
            name: 'idx_listings_status_price',
            where: { status: 'active' },
        });

        // Listings: seller with active status
        await queryInterface.addIndex('listings', ['user_id'], {
            name: 'idx_listings_user_status',
            where: { status: 'active' },
        });

        // Transactions: completed with date
        await queryInterface.addIndex('transactions', ['status', 'completed_at'], {
            name: 'idx_transactions_status_completed',
            where: { status: 'completed' },
        });

        // Transactions: buyer with date
        await queryInterface.addIndex('transactions', ['buyer_id', 'created_at'], {
            name: 'idx_transactions_buyer_date',
        });

        // Products: demand score with active
        await queryInterface.addIndex('products', ['demand_score'], {
            name: 'idx_products_demand_active',
            where: { is_active: true },
        });

        // Products: category with active
        await queryInterface.addIndex('products', ['category_id', 'is_active'], {
            name: 'idx_products_category_active',
        });

        // Demand alerts: unread for user
        await queryInterface.addIndex('demand_alerts', ['user_id', 'read'], {
            name: 'idx_demand_alerts_user_unread',
            where: { read: false },
        });

        // External prices: latest per product
        await queryInterface.addIndex('external_prices', ['product_id', 'scraped_at'], {
            name: 'idx_external_prices_product_latest',
            order: [['scraped_at', 'DESC']],
        });

        // Notifications: unread for user
        await queryInterface.addIndex('notifications', ['user_id', 'read'], {
            name: 'idx_notifications_user_unread',
            where: { read: false },
        });

        // Wishlists: user with product
        await queryInterface.addIndex('wishlists', ['user_id', 'product_id'], {
            name: 'idx_wishlists_user_product',
            unique: true,
        });

        // Reviews: reviewed with rating
        await queryInterface.addIndex('reviews', ['reviewed_id', 'rating'], {
            name: 'idx_reviews_reviewed_rating',
            where: { status: 'approved' },
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeIndex('listings', 'idx_listings_status_price');
        await queryInterface.removeIndex('listings', 'idx_listings_user_status');
        await queryInterface.removeIndex('transactions', 'idx_transactions_status_completed');
        await queryInterface.removeIndex('transactions', 'idx_transactions_buyer_date');
        await queryInterface.removeIndex('products', 'idx_products_demand_active');
        await queryInterface.removeIndex('products', 'idx_products_category_active');
        await queryInterface.removeIndex('demand_alerts', 'idx_demand_alerts_user_unread');
        await queryInterface.removeIndex('external_prices', 'idx_external_prices_product_latest');
        await queryInterface.removeIndex('notifications', 'idx_notifications_user_unread');
        await queryInterface.removeIndex('wishlists', 'idx_wishlists_user_product');
        await queryInterface.removeIndex('reviews', 'idx_reviews_reviewed_rating');
    },
};