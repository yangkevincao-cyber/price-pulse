// backend/src/migrations/20240101000005-create-exchanges.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('exchanges', {
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
            offered_product_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'products',
                    key: 'id',
                },
            },
            offered_product_name: {
                type: Sequelize.STRING(500),
                allowNull: false,
            },
            offered_condition: {
                type: Sequelize.ENUM('new', 'like-new', 'good', 'fair', 'poor'),
                defaultValue: 'good',
            },
            offered_quantity: {
                type: Sequelize.INTEGER,
                defaultValue: 1,
            },
            offered_images: {
                type: Sequelize.ARRAY(Sequelize.TEXT),
                defaultValue: [],
            },
            wanted_product_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'products',
                    key: 'id',
                },
            },
            wanted_product_name: {
                type: Sequelize.STRING(500),
                allowNull: true,
            },
            wanted_condition: {
                type: Sequelize.ENUM('new', 'like-new', 'good', 'fair', 'poor', 'any'),
                defaultValue: 'any',
            },
            wanted_category_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'categories',
                    key: 'id',
                },
            },
            cash_adjustment: {
                type: Sequelize.DECIMAL(10, 2),
                defaultValue: 0,
            },
            status: {
                type: Sequelize.ENUM('active', 'pending', 'matched', 'accepted', 'completed', 'expired', 'cancelled'),
                defaultValue: 'active',
            },
            match_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            matched_with_user_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            matched_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            accepted_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            completed_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            notes: {
                type: Sequelize.TEXT,
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
            deleted_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
        });

        await queryInterface.addIndex('exchanges', ['user_id']);
        await queryInterface.addIndex('exchanges', ['status']);
        await queryInterface.addIndex('exchanges', ['offered_product_id']);
        await queryInterface.addIndex('exchanges', ['wanted_product_id']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('exchanges');
    },
};