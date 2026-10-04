// backend/src/models/Wishlist.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Wishlist = sequelize.define('Wishlist', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    product_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'products',
            key: 'id',
        },
    },
    target_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
            min: 0,
        },
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    priority: {
        type: DataTypes.ENUM('low', 'medium', 'high'),
        defaultValue: 'medium',
    },
    notified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    notified_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
}, {
    tableName: 'wishlists',
    underscored: true,
    indexes: [
        {
            fields: ['user_id', 'product_id'],
            unique: true,
        },
        {
            fields: ['user_id'],
        },
        {
            fields: ['product_id'],
        },
        {
            fields: ['notified', 'created_at'],
        },
        {
            fields: ['target_price'],
        },
    ],
});

// Instance methods
Wishlist.prototype.markAsNotified = async function () {
    this.notified = true;
    this.notified_at = new Date();
    await this.save();
    return this;
};

Wishlist.prototype.checkPriceAlert = async function (currentPrice) {
    if (this.target_price && currentPrice <= this.target_price && !this.notified) {
        // Send price alert notification
        const { Notification } = require('./index');
        const { Product } = require('./index');
        const product = await Product.findByPk(this.product_id);

        if (product) {
            await Notification.create({
                user_id: this.user_id,
                type: 'price_drop',
                title: `Price Alert: ${product.name}`,
                message: `Price dropped to $${currentPrice}! Your target price was $${this.target_price}.`,
                data: {
                    product_id: this.product_id,
                    current_price: currentPrice,
                    target_price: this.target_price,
                },
                action_url: `/product/${product.slug}`,
                action_label: 'View Product',
            });

            await this.markAsNotified();
        }
    }
};

Wishlist.prototype.toJSON = function () {
    const values = { ...this.get() };
    if (values.target_price) {
        values.target_price = parseFloat(values.target_price);
    }
    return values;
};

// Scopes
Wishlist.addScope('forUser', (userId) => ({
    where: { user_id: userId },
}));

Wishlist.addScope('withProduct', {
    include: ['product'],
});

Wishlist.addScope('highPriority', {
    where: { priority: 'high' },
});

// Hooks
Wishlist.addHook('afterCreate', async (wishlist) => {
    // Update product wishlist count
    const { Product } = require('./index');
    const product = await Product.findByPk(wishlist.product_id);
    if (product) {
        product.wishlist_count += 1;
        await product.save();
        await product.updateDemandScore();
    }
});

Wishlist.addHook('afterDestroy', async (wishlist) => {
    // Update product wishlist count
    const { Product } = require('./index');
    const product = await Product.findByPk(wishlist.product_id);
    if (product) {
        product.wishlist_count = Math.max(0, product.wishlist_count - 1);
        await product.save();
        await product.updateDemandScore();
    }
});

module.exports = Wishlist;