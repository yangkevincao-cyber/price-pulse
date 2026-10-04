// backend/src/migrations/20240101000002-create-products.js
'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('products', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
            },
            name: {
                type: Sequelize.STRING(500),
                allowNull: false,
            },
            slug: {
                type: Sequelize.STRING(500),
                allowNull: false,
                unique: true,
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            brand: {
                type: Sequelize.STRING(200),
                allowNull: true,
            },
            sku: {
                type: Sequelize.STRING(100),
                allowNull: true,
                unique: true,
            },
            barcode: {
                type: Sequelize.STRING(50),
                allowNull: true,
            },
            category_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'categories',
                    key: 'id',
                },
            },
            images: {
                type: Sequelize.ARRAY(Sequelize.TEXT),
                defaultValue: [],
            },
            main_image: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            weight: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: true,
            },
            dimensions: {
                type: Sequelize.JSONB,
                allowNull: true,
            },
            demand_score: {
                type: Sequelize.DECIMAL(3, 2),
                defaultValue: 0,
            },
            average_rating: {
                type: Sequelize.DECIMAL(3, 2),
                defaultValue: 0,
            },
            review_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            wishlist_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            view_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            search_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            metadata: {
                type: Sequelize.JSONB,
                defaultValue: {},
            },
            tags: {
                type: Sequelize.ARRAY(Sequelize.STRING),
                defaultValue: [],
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
            },
            is_featured: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            is_deleted: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            deleted_at: {
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
        });

        await queryInterface.addIndex('products', ['name']);
        await queryInterface.addIndex('products', ['slug']);
        await queryInterface.addIndex('products', ['category_id']);
        await queryInterface.addIndex('products', ['demand_score']);
        await queryInterface.addIndex('products', ['is_active']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('products');
    },
};