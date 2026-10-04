// backend/src/migrations/20240101000013-create-search-queries.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('search_queries', {
            id: {
                type: Sequelize.BIGINT,
                autoIncrement: true,
                primaryKey: true,
            },
            query_text: {
                type: Sequelize.STRING(500),
                allowNull: false,
            },
            user_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            ip_hash: {
                type: Sequelize.STRING(64),
                allowNull: true,
            },
            session_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            product_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'products',
                    key: 'id',
                },
            },
            category_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'categories',
                    key: 'id',
                },
            },
            search_type: {
                type: Sequelize.ENUM('product', 'category', 'brand', 'general'),
                defaultValue: 'product',
            },
            filters: {
                type: Sequelize.JSONB,
                defaultValue: {},
            },
            results_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            click_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            clicked_products: {
                type: Sequelize.ARRAY(Sequelize.UUID),
                defaultValue: [],
            },
            converted: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            converted_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            search_duration_ms: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            source: {
                type: Sequelize.ENUM('web', 'mobile', 'api', 'suggestions'),
                defaultValue: 'web',
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

        await queryInterface.addIndex('search_queries', ['query_text']);
        await queryInterface.addIndex('search_queries', ['user_id']);
        await queryInterface.addIndex('search_queries', ['product_id']);
        await queryInterface.addIndex('search_queries', ['category_id']);
        await queryInterface.addIndex('search_queries', ['created_at']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('search_queries');
    },
};