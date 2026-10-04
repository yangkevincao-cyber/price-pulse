// backend/src/migrations/20240101000004-create-demand-alerts.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('demand_alerts', {
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
                allowNull: true,
                references: {
                    model: 'products',
                    key: 'id',
                },
            },
            product_name: {
                type: Sequelize.STRING(500),
                allowNull: false,
            },
            category_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'categories',
                    key: 'id',
                },
            },
            category_name: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            alert_type: {
                type: Sequelize.ENUM('spike', 'trending', 'price_opportunity', 'inventory_gap', 'seasonal'),
                allowNull: false,
            },
            demand_score: {
                type: Sequelize.DECIMAL(3, 2),
                allowNull: false,
            },
            search_volume_7d: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            search_volume_change_pct: {
                type: Sequelize.DECIMAL(5, 2),
                defaultValue: 0,
            },
            avg_listing_price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: true,
            },
            suggested_price: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: true,
            },
            active_listings: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            opportunity_score: {
                type: Sequelize.DECIMAL(3, 2),
                allowNull: false,
            },
            message: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            recommendations: {
                type: Sequelize.ARRAY(Sequelize.TEXT),
                defaultValue: [],
            },
            read: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            clicked: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            clicked_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            dismissed: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            dismissed_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            source: {
                type: Sequelize.ENUM('system', 'manual', 'scheduled'),
                defaultValue: 'system',
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

        await queryInterface.addIndex('demand_alerts', ['user_id', 'read']);
        await queryInterface.addIndex('demand_alerts', ['user_id', 'created_at']);
        await queryInterface.addIndex('demand_alerts', ['product_id']);
        await queryInterface.addIndex('demand_alerts', ['alert_type']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('demand_alerts');
    },
};