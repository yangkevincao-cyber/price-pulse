// backend/src/migrations/20240101000008-create-payments.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('payments', {
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
            transaction_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'transactions',
                    key: 'id',
                },
            },
            amount: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false,
            },
            currency: {
                type: Sequelize.STRING(3),
                defaultValue: 'USD',
            },
            payment_method: {
                type: Sequelize.ENUM('stripe', 'paypal', 'crypto', 'bank_transfer'),
                allowNull: false,
            },
            payment_provider: {
                type: Sequelize.STRING(50),
                allowNull: false,
            },
            provider_payment_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            provider_customer_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            status: {
                type: Sequelize.ENUM('pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'disputed'),
                defaultValue: 'pending',
            },
            description: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            metadata: {
                type: Sequelize.JSONB,
                defaultValue: {},
            },
            payment_intent: {
                type: Sequelize.JSONB,
                allowNull: true,
            },
            receipt_url: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            failure_message: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            refund_amount: {
                type: Sequelize.DECIMAL(10, 2),
                defaultValue: 0,
            },
            refund_reason: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            refunded_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            paid_at: {
                type: Sequelize.DATE,
                allowNull: true,
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

        await queryInterface.addIndex('payments', ['user_id']);
        await queryInterface.addIndex('payments', ['transaction_id']);
        await queryInterface.addIndex('payments', ['status']);
        await queryInterface.addIndex('payments', ['provider_payment_id']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('payments');
    },
};