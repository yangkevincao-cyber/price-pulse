// backend/src/migrations/20240101000007-create-external-prices.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('external_prices', {
            id: {
                type: Sequelize.BIGINT,
                autoIncrement: true,
                primaryKey: true,
            },
            product_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'products',
                    key: 'id',
                },
            },
            source_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            source_name: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
            },
            original_price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: true,
            },
            shipping_cost: {
                type: Sequelize.DECIMAL(10, 2),
                defaultValue: 0,
            },
            total_price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
            },
            currency: {
                type: Sequelize.STRING(3),
                defaultValue: 'USD',
            },
            condition: {
                type: Sequelize.STRING(50),
                defaultValue: 'new',
            },
            seller_name: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            seller_rating: {
                type: Sequelize.DECIMAL(3, 2),
                allowNull: true,
            },
            product_url: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            product_title: {
                type: Sequelize.STRING(500),
                allowNull: true,
            },
            is_available: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
            },
            is_promotion: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            promotion_end_date: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            metadata: {
                type: Sequelize.JSONB,
                defaultValue: {},
            },
            scraped_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await queryInterface.addIndex('external_prices', ['product_id', 'source_id', 'scraped_at']);
        await queryInterface.addIndex('external_prices', ['product_id', 'scraped_at']);
        await queryInterface.addIndex('external_prices', ['source_id']);
        await queryInterface.addIndex('external_prices', ['scraped_at']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('external_prices');
    },
};