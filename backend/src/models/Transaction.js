// backend/src/models/Transaction.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    listing_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'listings',
            key: 'id',
        },
    },
    buyer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    seller_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0,
        },
    },
    platform_fee: {
        type: DataTypes.DECIMAL(10, 2),
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
    tax_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0,
        },
    },
    status: {
        type: DataTypes.ENUM(
            'pending',
            'payment_pending',
            'payment_processing',
            'payment_completed',
            'shipping',
            'delivered',
            'completed',
            'cancelled',
            'refunded',
            'disputed'
        ),
        defaultValue: 'pending',
        allowNull: false,
    },
    payment_method: {
        type: DataTypes.ENUM('stripe', 'paypal', 'crypto', 'bank_transfer'),
        allowNull: true,
    },
    payment_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    payment_intent_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    shipping_address: {
        type: DataTypes.JSONB,
        allowNull: true,
        validate: {
            isValidAddress(value) {
                if (!value) return;
                const required = ['street', 'city', 'country', 'postal_code'];
                for (const field of required) {
                    if (!value[field]) {
                        throw new Error(`Missing required shipping field: ${field}`);
                    }
                }
            },
        },
    },
    shipping_tracking_number: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    shipping_carrier: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    estimated_delivery_date: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    delivered_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    cancelled_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    refunded_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    refund_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    dispute_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    dispute_resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    dispute_resolution: {
        type: DataTypes.TEXT,
        allowNull: true,
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
    tableName: 'transactions',
    underscored: true,
    paranoid: true,
    indexes: [
        {
            fields: ['buyer_id'],
        },
        {
            fields: ['seller_id'],
        },
        {
            fields: ['listing_id'],
            unique: true,
        },
        {
            fields: ['status'],
        },
        {
            fields: ['created_at'],
        },
        {
            fields: ['payment_id'],
        },
    ],
});

// Instance methods
Transaction.prototype.markAsPaymentProcessing = async function () {
    this.status = 'payment_processing';
    await this.save();
    return this;
};

Transaction.prototype.markAsPaymentCompleted = async function (paymentId) {
    this.status = 'payment_completed';
    this.payment_id = paymentId;
    await this.save();

    // Update listing status
    const listing = await this.getListing();
    if (listing) {
        await listing.markAsSold(this.buyer_id);
    }

    return this;
};

Transaction.prototype.markAsShipped = async function (trackingNumber, carrier) {
    this.status = 'shipping';
    this.shipping_tracking_number = trackingNumber;
    this.shipping_carrier = carrier;
    await this.save();
    return this;
};

Transaction.prototype.markAsDelivered = async function () {
    this.status = 'delivered';
    this.delivered_at = new Date();
    await this.save();
    return this;
};

Transaction.prototype.markAsCompleted = async function () {
    this.status = 'completed';
    this.completed_at = new Date();
    await this.save();

    // Update seller stats
    const seller = await this.getSeller();
    if (seller) {
        seller.total_sales += 1;
        await seller.save();
    }

    // Release escrow funds
    // Payment release logic here

    return this;
};

Transaction.prototype.markAsRefunded = async function (reason) {
    this.status = 'refunded';
    this.refunded_at = new Date();
    this.refund_reason = reason;
    await this.save();
    return this;
};

Transaction.prototype.markAsDisputed = async function (reason) {
    this.status = 'disputed';
    this.dispute_reason = reason;
    await this.save();
    return this;
};

Transaction.prototype.calculateTotal = function () {
    this.total_amount = parseFloat(this.amount) +
        parseFloat(this.platform_fee) +
        parseFloat(this.shipping_cost) +
        parseFloat(this.tax_amount);
    return this.total_amount;
};

Transaction.prototype.toJSON = function () {
    const values = { ...this.get() };
    // Format amounts
    if (values.amount) values.amount = parseFloat(values.amount);
    if (values.platform_fee) values.platform_fee = parseFloat(values.platform_fee);
    if (values.shipping_cost) values.shipping_cost = parseFloat(values.shipping_cost);
    if (values.tax_amount) values.tax_amount = parseFloat(values.tax_amount);
    if (values.total_amount) values.total_amount = parseFloat(values.total_amount);
    return values;
};

// Scopes
Transaction.addScope('forBuyer', (buyerId) => ({
    where: { buyer_id: buyerId },
}));

Transaction.addScope('forSeller', (sellerId) => ({
    where: { seller_id: sellerId },
}));

Transaction.addScope('completed', {
    where: { status: 'completed' },
});

Transaction.addScope('pending', {
    where: { status: { [sequelize.Op.in]: ['pending', 'payment_pending', 'payment_processing'] } },
});

// Hooks
Transaction.addHook('beforeValidate', (transaction) => {
    if (!transaction.total_amount && transaction.amount !== undefined) {
        transaction.total_amount = transaction.amount;
    }
});

Transaction.addHook('afterCreate', async (transaction) => {
    // Log transaction creation
    const { logger } = require('../config/logger');
    logger.info(`Transaction created: ${transaction.id} - Amount: ${transaction.amount}`);
});

module.exports = Transaction;