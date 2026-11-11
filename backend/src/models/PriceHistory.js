// backend/src/models/PriceHistory.js
const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const PriceHistory = sequelize.define('PriceHistory', {
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
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0,
        },
    },
    source: {
        type: DataTypes.ENUM('listing', 'external', 'manual', 'system'),
        defaultValue: 'listing',
    },
    source_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    marketplace: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'USD',
        validate: {
            len: [3, 3],
        },
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
    tableName: 'price_history',
    underscored: true,
    indexes: [
        {
            fields: ['product_id', 'created_at'],
        },
        {
            fields: ['product_id', 'source'],
        },
        {
            fields: ['created_at'],
        },
    ],
});

// Instance methods
PriceHistory.prototype.toJSON = function () {
    const values = { ...this.get() };
    values.price = parseFloat(values.price);
    return values;
};

// Scopes
PriceHistory.addScope('forProduct', (productId) => ({
    where: { product_id: productId },
    order: [['created_at', 'DESC']],
}));

PriceHistory.addScope('last30Days', {
    where: {
        created_at: { [Op.gt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
});

PriceHistory.addScope('last7Days', {
    where: {
        created_at: { [Op.gt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
});

// Hooks
PriceHistory.addHook('afterCreate', async (priceHistory) => {
    // Update product current price
    const { Product } = require('./index');
    const product = await Product.findByPk(priceHistory.product_id);
    if (product) {
        // Update demand score
        await product.updateDemandScore();
    }
});

module.exports = PriceHistory;
