// backend/src/migrations/20240101000001-create-categories.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('categories', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true,
            },
            slug: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true,
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            parent_category_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'categories',
                    key: 'id',
                },
            },
            icon: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            image: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            color: {
                type: Sequelize.STRING(20),
                allowNull: true,
            },
            demand_multiplier: {
                type: Sequelize.DECIMAL(3, 2),
                defaultValue: 1,
            },
            product_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            active_listings_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
            },
            display_order: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            seo_title: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            seo_description: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            seo_keywords: {
                type: Sequelize.ARRAY(Sequelize.STRING),
                defaultValue: [],
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

        await queryInterface.addIndex('categories', ['name']);
        await queryInterface.addIndex('categories', ['slug']);
        await queryInterface.addIndex('categories', ['parent_category_id']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('categories');
    },
};