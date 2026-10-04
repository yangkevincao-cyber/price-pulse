// backend/src/models/Payment.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
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
    transaction_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'transactions',
            key: 'id',
        },
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0.01,
        },
    },
    currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'USD',
        validate: {
            len: [3, 3],
        },
    },
    payment_method: {
        type: DataTypes.ENUM('stripe', 'paypal', 'crypto', 'bank_transfer'),
        allowNull: false,
    },
    payment_provider: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    provider_payment_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    provider_customer_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM(
            'pending',
            'processing',
            'succeeded',
            'failed',
            'refunded',
            'partially_refunded',
            'disputed'
        ),
        defaultValue: 'pending',
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
    payment_intent: {
        type: DataTypes.JSONB,
        allowNull: true,
    },
    receipt_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
            isUrl: true,
        },
    },
    failure_message: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    refund_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    refund_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    refunded_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    paid_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'payments',
    underscored: true,
    paranoid: true,
    indexes: [
        {
            fields: ['user_id'],
        },
        {
            fields: ['transaction_id'],
        },
        {
            fields: ['status'],
        },
        {
            fields: ['provider_payment_id'],
        },
        {
            fields: ['created_at'],
        },
    ],
});

// Instance methods
Payment.prototype.markAsProcessing = async function () {
    this.status = 'processing';
    await this.save();
    return this;
};

Payment.prototype.markAsSucceeded = async function (providerPaymentId) {
    this.status = 'succeeded';
    this.provider_payment_id = providerPaymentId;
    this.paid_at = new Date();
    await this.save();
    return this;
};

Payment.prototype.markAsFailed = async function (failureMessage) {
    this.status = 'failed';
    this.failure_message = failureMessage;
    await this.save();
    return this;
};

Payment.prototype.markAsRefunded = async function (amount, reason) {
    this.status = 'refunded';
    this.refund_amount = amount || this.amount;
    this.refund_reason = reason;
    this.refunded_at = new Date();
    await this.save();
    return this;
};

Payment.prototype.toJSON = function () {
    const values = { ...this.get() };
    values.amount = parseFloat(values.amount);
    if (values.refund_amount) {
        values.refund_amount = parseFloat(values.refund_amount);
    }
    // Remove sensitive data
    delete values.payment_intent;
    return values;
};

// Scopes
Payment.addScope('forUser', (userId) => ({
    where: { user_id: userId },
}));

Payment.addScope('succeeded', {
    where: { status: 'succeeded' },
});

Payment.addScope('pending', {
    where: { status: 'pending' },
});

// Hooks
Payment.addHook('afterCreate', async (payment) => {
    const { logger } = require('../config/logger');
    logger.info(`Payment created: ${payment.id} - Amount: ${payment.amount}`);
});

module.exports = Payment;