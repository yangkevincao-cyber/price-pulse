// backend/src/models/FraudLog.js
const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const FraudLog = sequelize.define('FraudLog', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: true,
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
    listing_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'listings',
            key: 'id',
        },
    },
    type: {
        type: DataTypes.ENUM(
            'price_anomaly',
            'velocity_exceeded',
            'ip_mismatch',
            'device_mismatch',
            'suspicious_keywords',
            'payment_risk',
            'unusual_pattern',
            'chargeback',
            'account_takeover',
            'fake_listing',
            'review_manipulation',
            'exchange_fraud'
        ),
        allowNull: false,
    },
    severity: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'medium',
    },
    risk_score: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        validate: {
            min: 0,
            max: 1,
        },
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    details: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
    indicators: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    device_fingerprint: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    location: {
        type: DataTypes.JSONB,
        allowNull: true,
    },
    action_taken: {
        type: DataTypes.ENUM('none', 'flagged', 'blocked', 'reviewed', 'user_suspended', 'user_banned'),
        defaultValue: 'none',
    },
    action_details: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    reviewed_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    resolved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    resolution_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
}, {
    tableName: 'fraud_logs',
    underscored: true,
    indexes: [
        {
            fields: ['user_id'],
        },
        {
            fields: ['transaction_id'],
        },
        {
            fields: ['type', 'severity'],
        },
        {
            fields: ['ip_address'],
        },
        {
            fields: ['device_fingerprint'],
        },
        {
            fields: ['created_at'],
        },
        {
            fields: ['resolved'],
        },
    ],
});

// Instance methods
FraudLog.prototype.resolve = async function (resolutionNotes, actionTaken, reviewerId) {
    this.resolved = true;
    this.resolved_at = new Date();
    this.resolution_notes = resolutionNotes;
    this.action_taken = actionTaken;
    this.reviewed_by = reviewerId;
    this.reviewed_at = new Date();
    await this.save();
    return this;
};

FraudLog.prototype.blockUser = async function () {
    const { User } = require('./index');
    await User.update(
        { is_active: false },
        { where: { id: this.user_id } }
    );
    this.action_taken = 'user_suspended';
    await this.save();
    return this;
};

FraudLog.prototype.getSeverityLevel = function () {
    const levels = {
        low: 1,
        medium: 2,
        high: 3,
        critical: 4,
    };
    return levels[this.severity] || 0;
};

FraudLog.prototype.toJSON = function () {
    const values = { ...this.get() };
    values.risk_score = parseFloat(values.risk_score);
    return values;
};

// Scopes
FraudLog.addScope('unresolved', {
    where: { resolved: false },
});

FraudLog.addScope('highRisk', {
    where: {
        severity: { [Op.in]: ['high', 'critical'] },
    },
});

FraudLog.addScope('forUser', (userId) => ({
    where: { user_id: userId },
}));

FraudLog.addScope('recent', {
    order: [['created_at', 'DESC']],
    limit: 100,
});

// Hooks
FraudLog.addHook('afterCreate', async (fraudLog) => {
    const { logger } = require('../config/logger');

    logger.warn('Fraud detected', {
        type: fraudLog.type,
        severity: fraudLog.severity,
        user_id: fraudLog.user_id,
        risk_score: fraudLog.risk_score,
        description: fraudLog.description,
    });

    // Send admin notification for high/critical severity
    if (['high', 'critical'].includes(fraudLog.severity)) {
        const { Notification } = require('./index');
        const admins = await require('./index').User.findAll({
            where: { role: 'admin', is_active: true },
        });

        for (const admin of admins) {
            await Notification.create({
                user_id: admin.id,
                type: 'security_alert',
                title: `⚠️ Fraud Alert: ${fraudLog.type}`,
                message: `Severity: ${fraudLog.severity}. Risk Score: ${fraudLog.risk_score}. ${fraudLog.description}`,
                data: {
                    fraud_log_id: fraudLog.id,
                    type: fraudLog.type,
                    severity: fraudLog.severity,
                },
                action_url: `/admin/fraud/${fraudLog.id}`,
                action_label: 'Review',
                channel: ['in_app', 'email'],
            });
        }
    }
});

module.exports = FraudLog;
