// backend/src/models/Listing.js
const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');

const Listing = sequelize.define('Listing', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
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
    title: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [5, 500],
        },
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0,
            isDecimal: true,
        },
    },
    original_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
            min: 0,
            isDecimal: true,
        },
    },
    condition: {
        type: DataTypes.ENUM('new', 'like-new', 'good', 'fair', 'poor'),
        defaultValue: 'good',
        allowNull: false,
    },
    quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            min: 1,
        },
    },
    available_quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            min: 0,
        },
    },
    images: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        defaultValue: [],
        validate: {
            isValidUrls(value) {
                if (!Array.isArray(value)) return;
                const urlRegex = /^https?:\/\/.+\..+/;
                value.forEach(url => {
                    if (!urlRegex.test(url)) {
                        throw new Error(`Invalid image URL: ${url}`);
                    }
                });
            },
        },
    },
    main_image: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
            isUrl: true,
        },
    },
    status: {
        type: DataTypes.ENUM('draft', 'active', 'sold', 'expired', 'paused', 'deleted'),
        defaultValue: 'draft',
        allowNull: false,
    },
    views: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    clicks: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
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
    shipping_from_country: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    shipping_from_city: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    shipping_options: {
        type: DataTypes.JSONB,
        defaultValue: [],
        validate: {
            isValidShipping(value) {
                if (!Array.isArray(value)) return;
                value.forEach(option => {
                    if (!option.method || typeof option.cost !== 'number') {
                        throw new Error('Invalid shipping option format');
                    }
                });
            },
        },
    },
    accepts_offers: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    min_offer_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
            min: 0,
        },
    },
    offer_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    sold_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    buyer_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
}, {
    tableName: 'listings',
    underscored: true,
    paranoid: true,
    indexes: [
        {
            fields: ['user_id'],
        },
        {
            fields: ['product_id'],
        },
        {
            fields: ['status'],
        },
        {
            fields: ['price'],
        },
        {
            fields: ['condition'],
        },
        {
            fields: ['created_at'],
        },
        {
            fields: ['status', 'price'],
            where: { status: 'active' },
        },
    ],
});

// Instance methods
Listing.prototype.incrementView = async function () {
    this.views += 1;
    await this.save();
    return this.views;
};

Listing.prototype.incrementClick = async function () {
    this.clicks += 1;
    await this.save();
    return this.clicks;
};

Listing.prototype.markAsSold = async function (buyerId) {
    this.status = 'sold';
    this.sold_at = new Date();
    this.buyer_id = buyerId;
    await this.save();

    // Update product stats
    const product = await this.getProduct();
    if (product) {
        // Trigger product demand score update
        await product.updateDemandScore();
    }

    return this;
};

Listing.prototype.isAvailable = function () {
    return this.status === 'active' &&
        this.available_quantity > 0 &&
        (!this.expires_at || new Date(this.expires_at) > new Date());
};

Listing.prototype.getDiscountedPrice = function () {
    if (this.original_price && this.original_price > this.price) {
        return {
            price: this.price,
            discount: this.original_price - this.price,
            discount_percentage: ((this.original_price - this.price) / this.original_price * 100),
        };
    }
    return {
        price: this.price,
        discount: 0,
        discount_percentage: 0,
    };
};

Listing.prototype.toJSON = function () {
    const values = { ...this.get() };
    // Add computed fields
    values.discount_info = this.getDiscountedPrice();
    values.is_available = this.isAvailable();
    return values;
};

// Scopes
Listing.addScope('active', {
    where: {
        status: 'active',
        available_quantity: { [Op.gt]: 0 },
        expires_at: { [Op.gt]: new Date() },
    },
});

Listing.addScope('forUser', (userId) => ({
    where: { user_id: userId },
}));

Listing.addScope('byCondition', (condition) => ({
    where: { condition },
}));

// Hooks
Listing.addHook('beforeValidate', (listing) => {
    if (!listing.available_quantity) {
        listing.available_quantity = listing.quantity || 1;
    }
});

Listing.addHook('afterCreate', async (listing) => {
    // Update product listing count
    const product = await listing.getProduct();
    if (product) {
        await product.updateDemandScore();
    }

    logger.info(`Listing created: ${listing.title} (${listing.id}) by user ${listing.user_id}`);
});

Listing.addHook('afterUpdate', async (listing) => {
    if (listing.changed('status') && listing.status === 'active') {
        // Send notification to seller
        // Notification logic here
    }
});

module.exports = Listing;
