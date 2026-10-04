// backend/src/migrations/20240101000011-create-wishlists.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('wishlists', {
            id: {
                type: Sequelize.BIGINT,
                autoIncrement: true,
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
            target_price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: true,
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            priority: {
                type: Sequelize.ENUM('low', 'medium', 'high'),
                defaultValue: 'medium',
            },
            notified: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            notified_at: {
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

        await queryInterface.addIndex('wishlists', ['user_id', 'product_id'], { unique: true });
        await queryInterface.addIndex('wishlists', ['user_id']);
        await queryInterface.addIndex('wishlists', ['product_id']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('wishlists');
    },
};