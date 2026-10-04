// backend/src/migrations/20240101000010-create-reviews.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('reviews', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },
            reviewer_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            reviewed_id: {
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
            listing_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'listings',
                    key: 'id',
                },
            },
            rating: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            title: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            pros: {
                type: Sequelize.ARRAY(Sequelize.TEXT),
                defaultValue: [],
            },
            cons: {
                type: Sequelize.ARRAY(Sequelize.TEXT),
                defaultValue: [],
            },
            images: {
                type: Sequelize.ARRAY(Sequelize.TEXT),
                defaultValue: [],
            },
            is_verified_purchase: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            helpful_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            is_public: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
            },
            status: {
                type: Sequelize.ENUM('pending', 'approved', 'rejected', 'reported'),
                defaultValue: 'pending',
            },
            moderation_notes: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            reply: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            reply_at: {
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

        await queryInterface.addIndex('reviews', ['reviewer_id']);
        await queryInterface.addIndex('reviews', ['reviewed_id']);
        await queryInterface.addIndex('reviews', ['transaction_id']);
        await queryInterface.addIndex('reviews', ['rating']);
        await queryInterface.addIndex('reviews', ['status']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('reviews');
    },
};