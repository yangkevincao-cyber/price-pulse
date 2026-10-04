// backend/src/migrations/20240101000000-create-users.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('users', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },
            email: {
                type: Sequelize.STRING(255),
                allowNull: false,
                unique: true,
            },
            username: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true,
            },
            password: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            first_name: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            last_name: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            role: {
                type: Sequelize.ENUM('buyer', 'seller', 'admin'),
                defaultValue: 'buyer',
            },
            avatar: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            bio: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            phone: {
                type: Sequelize.STRING(20),
                allowNull: true,
            },
            location_country: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            location_city: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            location_lat: {
                type: Sequelize.DECIMAL(10, 8),
                allowNull: true,
            },
            location_lng: {
                type: Sequelize.DECIMAL(11, 8),
                allowNull: true,
            },
            seller_rating: {
                type: Sequelize.DECIMAL(3, 2),
                defaultValue: 0,
            },
            total_sales: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            total_reviews: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            is_verified: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
            },
            last_active: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW,
            },
            email_verified: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            email_verified_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            verification_token: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            reset_token: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            reset_token_expiry: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            stripe_account_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            paypal_account_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            preferences: {
                type: Sequelize.JSONB,
                defaultValue: {},
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            deleted_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
        });

        // Add indexes
        await queryInterface.addIndex('users', ['email']);
        await queryInterface.addIndex('users', ['username']);
        await queryInterface.addIndex('users', ['role']);
        await queryInterface.addIndex('users', ['is_active']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('users');
    },
};