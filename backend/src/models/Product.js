// backend/src/models/Product.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');

const Product = sequelize.define('Product', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING(500),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [3, 500],
        },
    },
    slug: {
        type: DataTypes.STRING(500),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            is: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        },
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    brand: {
        type: DataTypes.STRING(200),
        allowNull: true,
    },
    sku: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
    },
    barcode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        validate: {
            is: /^[0-9]*$/,
        },
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'categories',
            key: 'id',
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
    weight: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
            min: 0,
        },
    },
    dimensions: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
        validate: {
            isValidDimensions(value) {
                if (!value) return;
                const { length, width, height } = value;
                if (length !== undefined && (isNaN(length) || length < 0)) {
                    throw new Error('Invalid length dimension');
                }
                if (width !== undefined && (isNaN(width) || width < 0)) {
                    throw new Error('Invalid width dimension');
                }
                if (height !== undefined && (isNaN(height) || height < 0)) {
                    throw new Error('Invalid height dimension');
                }
            },
        },
    },
    demand_score: {
        type: DataTypes.DECIMAL(3, 2),
        defaultValue: 0,
        validate: {
            min: 0,
            max: 1,
        },
    },
    average_rating: {
        type: DataTypes.DECIMAL(3, 2),
        defaultValue: 0,
        validate: {
            min: 0,
            max: 5,
        },
    },
    review_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    wishlist_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    view_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    search_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        validate: {
            isValidMetadata(value) {
                if (value && typeof value !== 'object') {
                    throw new Error('Metadata must be an object');
                }
            },
        },
    },
    tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    is_featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'products',
    underscored: true,
    paranoid: true,
    indexes: [
        {
            fields: ['name'],
            using: 'gin',
            operator: 'gin_trgm_ops',
        },
        {
            fields: ['slug'],
            unique: true,
        },
        {
            fields: ['category_id'],
        },
        {
            fields: ['demand_score'],
        },
        {
            fields: ['is_active'],
        },
        {
            fields: ['created_at'],
        },
    ],
});

// Instance methods
Product.prototype.incrementViewCount = async function () {
    this.view_count += 1;
    await this.save();
    return this.view_count;
};

Product.prototype.incrementSearchCount = async function () {
    this.search_count += 1;
    await this.save();
    return this.search_count;
};

Product.prototype.updateDemandScore = async function () {
    const { sequelize } = require('../config/database');
    const [result] = await sequelize.query(`
        WITH daily_stats AS (
            SELECT 
                COUNT(DISTINCT sq.id) as searches_7d,
                COUNT(DISTINCT pv.id) as views_7d,
                COUNT(DISTINCT w.id) as wishlists_7d,
                COUNT(DISTINCT l.id) as listings_count
            FROM products p
            LEFT JOIN search_queries sq ON sq.product_id = p.id 
                AND sq.created_at > NOW() - INTERVAL '7 days'
            LEFT JOIN product_views pv ON pv.product_id = p.id 
                AND pv.viewed_at > NOW() - INTERVAL '7 days'
            LEFT JOIN wishlists w ON w.product_id = p.id 
                AND w.created_at > NOW() - INTERVAL '7 days'
            LEFT JOIN listings l ON l.product_id = p.id AND l.status = 'active'
            WHERE p.id = $1
            GROUP BY p.id
        )
        SELECT 
            COALESCE(searches_7d, 0) as searches_7d,
            COALESCE(views_7d, 0) as views_7d,
            COALESCE(wishlists_7d, 0) as wishlists_7d,
            COALESCE(listings_count, 0) as listings_count
        FROM daily_stats
    `, {
        bind: [this.id],
        type: sequelize.QueryTypes.SELECT,
    });

    if (result) {
        const score = Math.min(1,
            (result.searches_7d * 0.4) / 100 +
            (result.views_7d * 0.3) / 500 +
            (result.wishlists_7d * 0.3) / 50
        );
        this.demand_score = score;
        await this.save();
    }

    return this.demand_score;
};

Product.prototype.getPriceRange = async function () {
    const { sequelize } = require('../config/database');
    const [result] = await sequelize.query(`
        SELECT 
            MIN(price) as min_price,
            MAX(price) as max_price,
            AVG(price) as avg_price,
            COUNT(*) as seller_count
        FROM listings
        WHERE product_id = $1 AND status = 'active'
    `, {
        bind: [this.id],
        type: sequelize.QueryTypes.SELECT,
    });

    return result || { min_price: null, max_price: null, avg_price: null, seller_count: 0 };
};

Product.prototype.toJSON = function () {
    const values = { ...this.get() };
    // Remove sensitive or internal fields
    delete values.is_deleted;
    delete values.deleted_at;
    return values;
};

// Scopes
Product.addScope('active', {
    where: { is_active: true, is_deleted: false },
});

Product.addScope('featured', {
    where: { is_featured: true, is_active: true, is_deleted: false },
});

Product.addScope('trending', {
    where: { is_active: true, is_deleted: false },
    order: [['demand_score', 'DESC']],
    limit: 50,
});

Product.addScope('withCategory', {
    include: ['category'],
});

// Hooks
Product.addHook('beforeValidate', (product) => {
    if (product.name) {
        // Generate slug from name if not provided
        if (!product.slug) {
            product.slug = product.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
        }
    }
});

Product.addHook('afterCreate', async (product) => {
    // Create initial price history entry
    const { PriceHistory } = require('./index');
    await PriceHistory.create({
        product_id: product.id,
        price: 0,
        source: 'system',
    });

    // Log product creation
    logger.info(`Product created: ${product.name} (${product.id})`);
});

Product.addHook('afterUpdate', async (product) => {
    if (product.changed('demand_score')) {
        logger.debug(`Demand score updated for product ${product.id}: ${product.demand_score}`);
    }
});

module.exports = Product;