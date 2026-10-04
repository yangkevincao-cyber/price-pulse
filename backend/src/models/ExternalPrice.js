// backend/src/models/ExternalPrice.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ExternalPrice = sequelize.define('ExternalPrice', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    },
    product_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'products',
            key: 'id',
        },
    },
    source_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'external_sources',
            key: 'id',
        },
    },
    source_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0,
        },
    },
    original_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
            min: 0,
        },
    },
    shipping_cost: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    total_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0,
        },
    },
    currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'USD',
        validate: {
            len: [3, 3],
        },
    },
    condition: {
        type: DataTypes.STRING(50),
        defaultValue: 'new',
    },
    seller_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    seller_rating: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        validate: {
            min: 0,
            max: 5,
        },
    },
    product_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
            isUrl: true,
        },
    },
    product_title: {
        type: DataTypes.STRING(500),
        allowNull: true,
    },
    is_available: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    is_promotion: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    promotion_end_date: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
}, {
    tableName: 'external_prices',
    underscored: true,
    indexes: [
        {
            fields: ['product_id', 'source_id', 'scraped_at'],
        },
        {
            fields: ['product_id', 'scraped_at'],
        },
        {
            fields: ['source_id'],
        },
        {
            fields: ['scraped_at'],
        },
        {
            fields: ['price'],
        },
    ],
});

// Instance methods
ExternalPrice.prototype.calculateTotal = function () {
    this.total_price = parseFloat(this.price) + parseFloat(this.shipping_cost);
    return this.total_price;
};

ExternalPrice.prototype.toJSON = function () {
    const values = { ...this.get() };
    values.price = parseFloat(values.price);
    values.shipping_cost = parseFloat(values.shipping_cost);
    values.total_price = parseFloat(values.total_price);
    if (values.original_price) {
        values.original_price = parseFloat(values.original_price);
    }
    return values;
};

// Scopes
ExternalPrice.addScope('latest', {
    order: [['scraped_at', 'DESC']],
});

ExternalPrice.addScope('forProduct', (productId) => ({
    where: { product_id: productId },
}));

ExternalPrice.addScope('forSource', (sourceId) => ({
    where: { source_id: sourceId },
}));

// Hooks
ExternalPrice.addHook('beforeValidate', (externalPrice) => {
    if (externalPrice.price !== undefined && externalPrice.shipping_cost !== undefined) {
        externalPrice.total_price = parseFloat(externalPrice.price) + parseFloat(externalPrice.shipping_cost);
    }
});

ExternalPrice.addHook('afterCreate', async (externalPrice) => {
    // Update price history
    const { PriceHistory } = require('./index');
    await PriceHistory.create({
        product_id: externalPrice.product_id,
        price: externalPrice.price,
        source: 'external',
        source_id: externalPrice.source_id,
        marketplace: externalPrice.source_name,
        is_promotion: externalPrice.is_promotion,
        promotion_end_date: externalPrice.promotion_end_date,
    });

    // Update product demand score
    const { Product } = require('./index');
    const product = await Product.findByPk(externalPrice.product_id);
    if (product) {
        await product.updateDemandScore();
    }
});

module.exports = ExternalPrice;