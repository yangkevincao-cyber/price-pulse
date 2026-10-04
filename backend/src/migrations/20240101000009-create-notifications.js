// backend/src/migrations/20240101000009-create-notifications.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('notifications', {
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
            type: {
                type: Sequelize.ENUM(
                    'demand_alert',
                    'price_drop',
                    'exchange_match',
                    'exchange_accepted',
                    'transaction_update',
                    'payment_update',
                    'shipping_update',
                    'review_received',
                    'offer_received',
                    'offer_accepted',
                    'system_announcement',
                    'security_alert'
                ),
                allowNull: false,
            },
            title: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            message: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            read: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            read_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            data: {
                type: Sequelize.JSONB,
                defaultValue: {},
            },
            action_url: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            action_label: {
                type: Sequelize.STRING(50),
                allowNull: true,
            },
            channel: {
                type: Sequelize.ARRAY(Sequelize.STRING),
                defaultValue: ['in_app'],
            },
            sent_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            delivered_at: {
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

        await queryInterface.addIndex('notifications', ['user_id', 'read']);
        await queryInterface.addIndex('notifications', ['user_id', 'created_at']);
        await queryInterface.addIndex('notifications', ['type']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('notifications');
    },
};