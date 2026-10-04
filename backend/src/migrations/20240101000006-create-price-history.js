// backend/src/migrations/20240101000006-create-price-history.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('price_history', {
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
            price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
            },
            source: {
                type: Sequelize.ENUM('listing', 'external', 'manual', 'system'),
                defaultValue: 'listing',
            },
            source_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            marketplace: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            currency: {
                type: Sequelize.STRING(3),
                defaultValue: 'USD',
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
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await queryInterface.addIndex('price_history', ['product_id', 'created_at']);
        await queryInterface.addIndex('price_history', ['product_id', 'source']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('price_history');
    },
};