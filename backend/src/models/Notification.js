// backend/src/models/Notification.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
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
    type: {
        type: DataTypes.ENUM(
            'demand_alert',
            'price_drop',
            'exchange_match',
            'exchange_accepted',
            'transaction_update',
            'payment_update',
            'shipping_update',
            'review_received',
            'offer_received',
            'offer_accepted',
            'system_announcement',
            'security_alert'
        ),
        allowNull: false,
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    read_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    data: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
    action_url: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    action_label: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    channel: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: ['in_app'],
        validate: {
            isValidChannel(value) {
                const valid = ['in_app', 'email', 'push', 'sms'];
                value.forEach(channel => {
                    if (!valid.includes(channel)) {
                        throw new Error(`Invalid channel: ${channel}`);
                    }
                });
            },
        },
    },
    sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    delivered_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
}, {
    tableName: 'notifications',
    underscored: true,
    indexes: [
        {
            fields: ['user_id', 'read'],
            where: { read: false },
        },
        {
            fields: ['user_id', 'created_at'],
        },
        {
            fields: ['type'],
        },
        {
            fields: ['created_at'],
        },
    ],
});

// Instance methods
Notification.prototype.markAsRead = async function () {
    this.read = true;
    this.read_at = new Date();
    await this.save();
    return this;
};

Notification.prototype.markAsSent = async function () {
    this.sent_at = new Date();
    await this.save();
    return this;
};

Notification.prototype.markAsDelivered = async function () {
    this.delivered_at = new Date();
    await this.save();
    return this;
};

Notification.prototype.toJSON = function () {
    const values = { ...this.get() };
    // Format timestamps
    if (values.sent_at) values.sent_at = values.sent_at.toISOString();
    if (values.delivered_at) values.delivered_at = values.delivered_at.toISOString();
    if (values.read_at) values.read_at = values.read_at.toISOString();
    return values;
};

// Scopes
Notification.addScope('unread', {
    where: { read: false },
});

Notification.addScope('forUser', (userId) => ({
    where: { user_id: userId },
}));

Notification.addScope('recent', {
    order: [['created_at', 'DESC']],
    limit: 50,
});

// Hooks
Notification.addHook('afterCreate', async (notification) => {
    // Send real-time notification via WebSocket
    const { getIO } = require('../socket');
    const io = getIO();
    if (io) {
        const room = `user_${notification.user_id}`;
        io.to(room).emit('notification', notification.toJSON());
    }

    // Send email/push notification based on channel
    // Email/Push logic here
});

module.exports = Notification;