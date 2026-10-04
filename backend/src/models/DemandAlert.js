// backend/src/models/DemandAlert.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DemandAlert = sequelize.define('DemandAlert', {
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
        allowNull: true,
        references: {
            model: 'products',
            key: 'id',
        },
    },
    product_name: {
        type: DataTypes.STRING(500),
        allowNull: false,
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'categories',
            key: 'id',
        },
    },
    category_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    alert_type: {
        type: DataTypes.ENUM('spike', 'trending', 'price_opportunity', 'inventory_gap', 'seasonal'),
        allowNull: false,
    },
    demand_score: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        validate: {
            min: 0,
            max: 1,
        },
    },
    search_volume_7d: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    search_volume_change_pct: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
    },
    avg_listing_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
            min: 0,
        },
    },
    suggested_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
            min: 0,
        },
    },
    active_listings: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    opportunity_score: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        validate: {
            min: 0,
            max: 1,
        },
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    recommendations: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        defaultValue: [],
    },
    read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    clicked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    clicked_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    dismissed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    dismissed_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    source: {
        type: DataTypes.ENUM('system', 'manual', 'scheduled'),
        defaultValue: 'system',
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
}, {
    tableName: 'demand_alerts',
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
            fields: ['product_id'],
        },
        {
            fields: ['alert_type'],
        },
    ],
});

// Instance methods
DemandAlert.prototype.markAsRead = async function () {
    this.read = true;
    await this.save();
    return this;
};

DemandAlert.prototype.markAsClicked = async function () {
    this.clicked = true;
    this.clicked_at = new Date();
    await this.save();
    return this;
};

DemandAlert.prototype.markAsDismissed = async function () {
    this.dismissed = true;
    this.dismissed_at = new Date();
    await this.save();
    return this;
};

DemandAlert.prototype.getActionUrl = function () {
    if (this.product_id) {
        return `/product/${this.product_id}`;
    }
    if (this.category_id) {
        return `/category/${this.category_id}`;
    }
    return '/search';
};

DemandAlert.prototype.toJSON = function () {
    const values = { ...this.get() };
    values.action_url = this.getActionUrl();
    values.demand_score = parseFloat(values.demand_score);
    values.opportunity_score = parseFloat(values.opportunity_score);
    return values;
};

// Scopes
DemandAlert.addScope('unread', {
    where: { read: false, dismissed: false },
});

DemandAlert.addScope('recent', {
    order: [['created_at', 'DESC']],
    limit: 20,
});

DemandAlert.addScope('highOpportunity', {
    where: { opportunity_score: { [sequelize.Op.gt]: 0.7 } },
    order: [['opportunity_score', 'DESC']],
});

// Hooks
DemandAlert.addHook('afterCreate', async (alert) => {
    // Send notification to user
    const { Notification } = require('./index');
    await Notification.create({
        user_id: alert.user_id,
        type: 'demand_alert',
        title: `Demand Alert: ${alert.product_name}`,
        message: alert.message,
        data: {
            alert_id: alert.id,
            product_id: alert.product_id,
            opportunity_score: alert.opportunity_score,
        },
    });
});

module.exports = DemandAlert;