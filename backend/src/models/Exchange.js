// backend/src/models/Exchange.js
const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const Exchange = sequelize.define('Exchange', {
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
    offered_product_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'products',
            key: 'id',
        },
    },
    offered_product_name: {
        type: DataTypes.STRING(500),
        allowNull: false,
    },
    offered_condition: {
        type: DataTypes.ENUM('new', 'like-new', 'good', 'fair', 'poor'),
        defaultValue: 'good',
    },
    offered_quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        validate: {
            min: 1,
        },
    },
    offered_images: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        defaultValue: [],
    },
    wanted_product_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'products',
            key: 'id',
        },
    },
    wanted_product_name: {
        type: DataTypes.STRING(500),
        allowNull: true,
    },
    wanted_condition: {
        type: DataTypes.ENUM('new', 'like-new', 'good', 'fair', 'poor', 'any'),
        defaultValue: 'any',
    },
    wanted_category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'categories',
            key: 'id',
        },
    },
    cash_adjustment: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        validate: {
            min: -999999,
            max: 999999,
        },
    },
    status: {
        type: DataTypes.ENUM('active', 'pending', 'matched', 'accepted', 'completed', 'expired', 'cancelled'),
        defaultValue: 'active',
    },
    match_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    matched_with_user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    matched_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    accepted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
}, {
    tableName: 'exchanges',
    underscored: true,
    indexes: [
        {
            fields: ['user_id'],
        },
        {
            fields: ['status'],
        },
        {
            fields: ['offered_product_id'],
        },
        {
            fields: ['wanted_product_id'],
        },
        {
            fields: ['created_at'],
        },
    ],
});

// Instance methods
Exchange.prototype.match = async function (matchedWithUserId, matchId) {
    this.status = 'matched';
    this.matched_with_user_id = matchedWithUserId;
    this.match_id = matchId;
    this.matched_at = new Date();
    await this.save();
    return this;
};

Exchange.prototype.accept = async function () {
    this.status = 'accepted';
    this.accepted_at = new Date();
    await this.save();

    // Create notifications for both parties
    const { Notification } = require('./index');
    await Notification.create({
        user_id: this.user_id,
        type: 'exchange_accepted',
        title: 'Exchange Accepted!',
        message: `Your exchange for ${this.offered_product_name} has been accepted.`,
        data: { exchange_id: this.id },
    });

    return this;
};

Exchange.prototype.complete = async function () {
    this.status = 'completed';
    this.completed_at = new Date();
    await this.save();
    return this;
};

Exchange.prototype.cancel = async function () {
    this.status = 'cancelled';
    await this.save();
    return this;
};

Exchange.prototype.toJSON = function () {
    const values = { ...this.get() };
    values.cash_adjustment = parseFloat(values.cash_adjustment);
    return values;
};

// Scopes
Exchange.addScope('active', {
    where: {
        status: 'active',
        expires_at: { [Op.gt]: new Date() },
    },
});

Exchange.addScope('forUser', (userId) => ({
    where: { user_id: userId },
}));

// Hooks
Exchange.addHook('afterCreate', async (exchange) => {
    // Add to exchange matching queue
    const { redis } = require('../config/redis');
    await redis.lpush('exchange:queue', JSON.stringify({
        exchange_id: exchange.id,
        user_id: exchange.user_id,
        offered_product_id: exchange.offered_product_id,
        wanted_product_id: exchange.wanted_product_id,
        created_at: exchange.created_at,
    }));
});

module.exports = Exchange;
