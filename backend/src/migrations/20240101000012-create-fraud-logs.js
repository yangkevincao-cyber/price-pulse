// backend/src/migrations/20240101000012-create-fraud-logs.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('fraud_logs', {
            id: {
                type: Sequelize.BIGINT,
                autoIncrement: true,
                primaryKey: true,
            },
            user_id: {
                type: Sequelize.UUID,
                allowNull: true,
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
            listing_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'listings',
                    key: 'id',
                },
            },
            type: {
                type: Sequelize.ENUM(
                    'price_anomaly',
                    'velocity_exceeded',
                    'ip_mismatch',
                    'device_mismatch',
                    'suspicious_keywords',
                    'payment_risk',
                    'unusual_pattern',
                    'chargeback',
                    'account_takeover',
                    'fake_listing',
                    'review_manipulation',
                    'exchange_fraud'
                ),
                allowNull: false,
            },
            severity: {
                type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
                defaultValue: 'medium',
            },
            risk_score: {
                type: Sequelize.DECIMAL(3, 2),
                allowNull: false,
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            details: {
                type: Sequelize.JSONB,
                defaultValue: {},
            },
            indicators: {
                type: Sequelize.ARRAY(Sequelize.STRING),
                defaultValue: [],
            },
            ip_address: {
                type: Sequelize.STRING(45),
                allowNull: true,
            },
            user_agent: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            device_fingerprint: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            location: {
                type: Sequelize.JSONB,
                allowNull: true,
            },
            action_taken: {
                type: Sequelize.ENUM('none', 'flagged', 'blocked', 'reviewed', 'user_suspended', 'user_banned'),
                defaultValue: 'none',
            },
            action_details: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            reviewed_by: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            reviewed_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            resolved: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            resolved_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            resolution_notes: {
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
        });

        await queryInterface.addIndex('fraud_logs', ['user_id']);
        await queryInterface.addIndex('fraud_logs', ['transaction_id']);
        await queryInterface.addIndex('fraud_logs', ['type', 'severity']);
        await queryInterface.addIndex('fraud_logs', ['ip_address']);
        await queryInterface.addIndex('fraud_logs', ['device_fingerprint']);
        await queryInterface.addIndex('fraud_logs', ['resolved']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('fraud_logs');
    },
};