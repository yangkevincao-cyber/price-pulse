// backend/src/models/Review.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Review = sequelize.define('Review', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    reviewer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    reviewed_id: {
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
    listing_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'listings',
            key: 'id',
        },
    },
    rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 5,
        },
    },
    title: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [10, 5000],
        },
    },
    pros: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        defaultValue: [],
    },
    cons: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        defaultValue: [],
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
    is_verified_purchase: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    helpful_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'reported'),
        defaultValue: 'pending',
    },
    moderation_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    reply: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    reply_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
}, {
    tableName: 'reviews',
    underscored: true,
    indexes: [
        {
            fields: ['reviewer_id'],
        },
        {
            fields: ['reviewed_id'],
        },
        {
            fields: ['transaction_id'],
            unique: true,
        },
        {
            fields: ['listing_id'],
        },
        {
            fields: ['rating'],
        },
        {
            fields: ['status'],
        },
        {
            fields: ['created_at'],
        },
    ],
});

// Instance methods
Review.prototype.markAsHelpful = async function () {
    this.helpful_count += 1;
    await this.save();
    return this.helpful_count;
};

Review.prototype.approve = async function () {
    this.status = 'approved';
    await this.save();
    await this.updateUserRating();
    return this;
};

Review.prototype.reject = async function (notes) {
    this.status = 'rejected';
    this.moderation_notes = notes;
    await this.save();
    return this;
};

Review.prototype.updateUserRating = async function () {
    const { User } = require('./index');
    const [result] = await sequelize.query(`
        SELECT 
            AVG(rating) as avg_rating,
            COUNT(*) as review_count
        FROM reviews
        WHERE reviewed_id = $1 AND status = 'approved'
    `, {
        bind: [this.reviewed_id],
        type: sequelize.QueryTypes.SELECT,
    });

    if (result) {
        await User.update({
            seller_rating: result.avg_rating || 0,
            total_reviews: result.review_count || 0,
        }, {
            where: { id: this.reviewed_id },
        });
    }
};

Review.prototype.toJSON = function () {
    const values = { ...this.get() };
    // Remove moderation notes for non-admins
    if (!this._showModeration) {
        delete values.moderation_notes;
    }
    return values;
};

// Scopes
Review.addScope('approved', {
    where: { status: 'approved' },
});

Review.addScope('forUser', (userId) => ({
    where: { reviewed_id: userId },
}));

Review.addScope('byRating', (rating) => ({
    where: { rating },
}));

// Hooks
Review.addHook('afterCreate', async (review) => {
    // Update user rating
    await review.updateUserRating();

    // Send notification to reviewed user
    const { Notification } = require('./index');
    await Notification.create({
        user_id: review.reviewed_id,
        type: 'review_received',
        title: 'You received a new review!',
        message: `${review.rating}★ rating from a recent transaction.`,
        data: {
            review_id: review.id,
            rating: review.rating,
        },
        action_url: `/profile/${review.reviewed_id}`,
        action_label: 'View Review',
    });
});

Review.addHook('afterUpdate', async (review) => {
    if (review.changed('status') && review.status === 'approved') {
        await review.updateUserRating();
    }
});

module.exports = Review;