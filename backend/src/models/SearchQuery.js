// backend/src/models/SearchQuery.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SearchQuery = sequelize.define('SearchQuery', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    },
    query_text: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
            notEmpty: true,
        },
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    ip_hash: {
        type: DataTypes.STRING(64),
        allowNull: true,
    },
    session_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    product_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'products',
            key: 'id',
        },
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'categories',
            key: 'id',
        },
    },
    search_type: {
        type: DataTypes.ENUM('product', 'category', 'brand', 'general'),
        defaultValue: 'product',
    },
    filters: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
    results_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    click_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    clicked_products: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        defaultValue: [],
    },
    converted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    converted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    search_duration_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 0,
        },
    },
    source: {
        type: DataTypes.ENUM('web', 'mobile', 'api', 'suggestions'),
        defaultValue: 'web',
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
}, {
    tableName: 'search_queries',
    underscored: true,
    indexes: [
        {
            fields: ['query_text'],
            using: 'gin',
            operator: 'gin_trgm_ops',
        },
        {
            fields: ['user_id'],
        },
        {
            fields: ['product_id'],
        },
        {
            fields: ['category_id'],
        },
        {
            fields: ['created_at'],
        },
        {
            fields: ['search_type'],
        },
    ],
});

// Instance methods
SearchQuery.prototype.recordClick = async function (productId) {
    this.click_count += 1;
    if (productId && !this.clicked_products.includes(productId)) {
        this.clicked_products.push(productId);
    }
    await this.save();
    return this;
};

SearchQuery.prototype.recordConversion = async function () {
    this.converted = true;
    this.converted_at = new Date();
    await this.save();
    return this;
};

SearchQuery.prototype.toJSON = function () {
    const values = { ...this.get() };
    // Remove sensitive data
    delete values.ip_hash;
    delete values.session_id;
    return values;
};

// Scopes
SearchQuery.addScope('recent', {
    order: [['created_at', 'DESC']],
    limit: 100,
});

SearchQuery.addScope('forUser', (userId) => ({
    where: { user_id: userId },
}));

SearchQuery.addScope('popular', {
    attributes: [
        'query_text',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    group: ['query_text'],
    order: [[sequelize.literal('count'), 'DESC']],
    limit: 50,
});

// Hooks
SearchQuery.addHook('afterCreate', async (searchQuery) => {
    // Update product search counts
    if (searchQuery.product_id) {
        const { Product } = require('./index');
        const product = await Product.findByPk(searchQuery.product_id);
        if (product) {
            product.search_count += 1;
            await product.save();
        }
    }

    // Update demand scores if many searches
    const { sequelize } = require('../config/database');
    const [result] = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM search_queries
        WHERE product_id = $1
            AND created_at > NOW() - INTERVAL '1 hour'
    `, {
        bind: [searchQuery.product_id],
        type: sequelize.QueryTypes.SELECT,
    });

    if (result && result.count > 50) {
        // Trigger demand alert generation
        const { DemandAlert } = require('./index');
        // Demand alert logic here
    }
});

module.exports = SearchQuery;