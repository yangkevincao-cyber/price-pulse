// backend/src/migrations/20240101000003-create-listings.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('listings', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },
            user_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            product_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'products',
                    key: 'id',
                },
            },
            title: {
                type: Sequelize.STRING(500),
                allowNull: false,
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
            },
            original_price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: true,
            },
            condition: {
                type: Sequelize.ENUM('new', 'like-new', 'good', 'fair', 'poor'),
                defaultValue: 'good',
            },
            quantity: {
                type: Sequelize.INTEGER,
                defaultValue: 1,
            },
            available_quantity: {
                type: Sequelize.INTEGER,
                defaultValue: 1,
            },
            images: {
                type: Sequelize.ARRAY(Sequelize.TEXT),
                defaultValue: [],
            },
            main_image: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            status: {
                type: Sequelize.ENUM('draft', 'active', 'sold', 'expired', 'paused', 'deleted'),
                defaultValue: 'draft',
            },
            views: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            clicks: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            shipping_cost: {
                type: Sequelize.DECIMAL(10, 2),
                defaultValue: 0,
            },
            shipping_from_country: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            shipping_from_city: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            shipping_options: {
                type: Sequelize.JSONB,
                defaultValue: [],
            },
            accepts_offers: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            min_offer_price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: true,
            },
            offer_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            sold_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            buyer_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            metadata: {
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

        await queryInterface.addIndex('listings', ['user_id']);
        await queryInterface.addIndex('listings', ['product_id']);
        await queryInterface.addIndex('listings', ['status']);
        await queryInterface.addIndex('listings', ['price']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('listings');
    },
};