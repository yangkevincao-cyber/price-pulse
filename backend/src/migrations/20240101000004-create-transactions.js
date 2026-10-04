// backend/src/migrations/20240101000004-create-transactions.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('transactions', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },
            listing_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'listings',
                    key: 'id',
                },
            },
            buyer_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            seller_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            amount: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
            },
            platform_fee: {
                type: Sequelize.DECIMAL(10, 2),
                defaultValue: 0,
            },
            shipping_cost: {
                type: Sequelize.DECIMAL(10, 2),
                defaultValue: 0,
            },
            tax_amount: {
                type: Sequelize.DECIMAL(10, 2),
                defaultValue: 0,
            },
            total_amount: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
            },
            status: {
                type: Sequelize.ENUM(
                    'pending',
                    'payment_pending',
                    'payment_processing',
                    'payment_completed',
                    'shipping',
                    'delivered',
                    'completed',
                    'cancelled',
                    'refunded',
                    'disputed'
                ),
                defaultValue: 'pending',
            },
            payment_method: {
                type: Sequelize.ENUM('stripe', 'paypal', 'crypto', 'bank_transfer'),
                allowNull: true,
            },
            payment_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            payment_intent_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            shipping_address: {
                type: Sequelize.JSONB,
                allowNull: true,
            },
            shipping_tracking_number: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            shipping_carrier: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            estimated_delivery_date: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            delivered_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            completed_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            cancelled_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            refunded_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            refund_reason: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            dispute_reason: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            dispute_resolved_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            dispute_resolution: {
                type: Sequelize.TEXT,
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

        await queryInterface.addIndex('transactions', ['buyer_id']);
        await queryInterface.addIndex('transactions', ['seller_id']);
        await queryInterface.addIndex('transactions', ['listing_id']);
        await queryInterface.addIndex('transactions', ['status']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('transactions');
    },
};