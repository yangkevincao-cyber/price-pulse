// backend/src/models/User.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../services/auth/jwtService');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
            notEmpty: true,
        },
        set(value) {
            this.setDataValue('email', value.toLowerCase().trim());
        },
    },
    username: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            len: [3, 100],
            notEmpty: true,
            is: /^[a-zA-Z0-9_]+$/,
        },
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            len: [8, 255],
            notEmpty: true,
        },
        set(value) {
            const salt = bcrypt.genSaltSync(10);
            this.setDataValue('password', bcrypt.hashSync(value, salt));
        },
    },
    first_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    last_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    role: {
        type: DataTypes.ENUM('buyer', 'seller', 'admin'),
        defaultValue: 'buyer',
    },
    avatar: {
        type: DataTypes.STRING(255),
        validate: {
            isUrl: true,
        },
    },
    bio: {
        type: DataTypes.TEXT,
    },
    phone: {
        type: DataTypes.STRING(20),
    },
    location_country: {
        type: DataTypes.STRING(100),
    },
    location_city: {
        type: DataTypes.STRING(100),
    },
    location_lat: {
        type: DataTypes.DECIMAL(10, 8),
    },
    location_lng: {
        type: DataTypes.DECIMAL(11, 8),
    },
    seller_rating: {
        type: DataTypes.DECIMAL(3, 2),
        defaultValue: 0,
        validate: {
            min: 0,
            max: 5,
        },
    },
    total_sales: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    total_reviews: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    last_active: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    email_verified_at: {
        type: DataTypes.DATE,
    },
    verification_token: {
        type: DataTypes.STRING(255),
    },
    reset_token: {
        type: DataTypes.STRING(255),
    },
    reset_token_expiry: {
        type: DataTypes.DATE,
    },
    stripe_account_id: {
        type: DataTypes.STRING(255),
    },
    paypal_account_id: {
        type: DataTypes.STRING(255),
    },
    preferences: {
        type: DataTypes.JSONB,
        defaultValue: {
            notifications: {
                email: true,
                push: true,
                sms: false,
            },
            privacy: {
                show_email: false,
                show_phone: false,
            },
            alert_frequency: 'daily',
            min_demand_score: 0.7,
        },
    },
}, {
    tableName: 'users',
    underscored: true,
    paranoid: true,
});

// Instance methods
User.prototype.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

User.prototype.generateAuthToken = function () {
    return generateToken({ id: this.id, role: this.role });
};

User.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.password;
    delete values.verification_token;
    delete values.reset_token;
    delete values.reset_token_expiry;
    return values;
};

// Virtual fields
User.prototype.getFullName = function () {
    return `${this.first_name} ${this.last_name}`;
};

User.prototype.getShortName = function () {
    return `${this.first_name} ${this.last_name.charAt(0)}.`;
};

// Scopes
User.addScope('active', {
    where: { is_active: true },
});

User.addScope('seller', {
    where: { role: 'seller' },
});

User.addScope('verified', {
    where: { is_verified: true },
});

// Hooks
User.addHook('beforeValidate', (user) => {
    if (user.email) {
        user.email = user.email.toLowerCase().trim();
    }
    if (user.username) {
        user.username = user.username.toLowerCase().trim();
    }
});

User.addHook('beforeCreate', (user) => {
    if (!user.avatar) {
        user.avatar = `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&size=200&background=1E3A8A&color=FFFFFF`;
    }
});

module.exports = User;