// backend/src/models/Category.js
const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const Category = sequelize.define('Category', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            len: [2, 100],
        },
    },
    slug: {
        type: DataTypes.STRING(100),
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
    parent_category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'categories',
            key: 'id',
        },
    },
    icon: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    image: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
            isUrl: true,
        },
    },
    color: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            is: /^#[0-9a-fA-F]{6}$/,
        },
    },
    demand_multiplier: {
        type: DataTypes.DECIMAL(3, 2),
        defaultValue: 1,
        validate: {
            min: 0,
            max: 2,
        },
    },
    product_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    active_listings_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0,
        },
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    display_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    seo_title: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    seo_description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    seo_keywords: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
    },
}, {
    tableName: 'categories',
    underscored: true,
    paranoid: true,
    indexes: [
        {
            fields: ['parent_category_id'],
        },
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
            fields: ['display_order'],
        },
    ],
});

// Instance methods
Category.prototype.getFullPath = async function () {
    const path = [this.name];
    let current = this;
    while (current.parent_category_id) {
        const parent = await Category.findByPk(current.parent_category_id);
        if (parent) {
            path.unshift(parent.name);
            current = parent;
        } else {
            break;
        }
    }
    return path;
};

Category.prototype.getFullSlug = async function () {
    const slugs = [this.slug];
    let current = this;
    while (current.parent_category_id) {
        const parent = await Category.findByPk(current.parent_category_id);
        if (parent) {
            slugs.unshift(parent.slug);
            current = parent;
        } else {
            break;
        }
    }
    return slugs.join('/');
};

Category.prototype.updateCounts = async function () {
    const { Product, Listing } = require('./index');

    const productCount = await Product.count({
        where: { category_id: this.id, is_active: true, is_deleted: false },
    });

    const listingCount = await Listing.count({
        where: {
            category_id: this.id,
            status: 'active',
            available_quantity: { [Op.gt]: 0 },
        },
    });

    this.product_count = productCount;
    this.active_listings_count = listingCount;
    await this.save();

    return { product_count: productCount, active_listings_count: listingCount };
};

Category.prototype.getSubcategories = async function () {
    return Category.findAll({
        where: { parent_category_id: this.id, is_active: true },
        order: [['display_order', 'ASC']],
    });
};

Category.prototype.getTree = async function (includeSelf = false) {
    const result = [];
    if (includeSelf) {
        result.push(this);
    }
    const subcategories = await this.getSubcategories();
    for (const sub of subcategories) {
        result.push(sub);
        const subTree = await sub.getTree();
        result.push(...subTree);
    }
    return result;
};

Category.prototype.toJSON = function () {
    const values = { ...this.get() };
    if (values.demand_multiplier) {
        values.demand_multiplier = parseFloat(values.demand_multiplier);
    }
    return values;
};

// Scopes
Category.addScope('active', {
    where: { is_active: true },
});

Category.addScope('root', {
    where: { parent_category_id: null },
});

Category.addScope('withCounts', {
    attributes: {
        include: [
            [sequelize.literal('(SELECT COUNT(*) FROM products WHERE products.category_id = Category.id)'), 'product_count'],
            [sequelize.literal('(SELECT COUNT(*) FROM listings WHERE listings.category_id = Category.id AND listings.status = \'active\')'), 'active_listings_count'],
        ],
    },
});

// Hooks
Category.addHook('beforeValidate', (category) => {
    if (category.name && !category.slug) {
        category.slug = category.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
});

Category.addHook('afterCreate', async (category) => {
    const { logger } = require('../config/logger');
    logger.info(`Category created: ${category.name} (${category.id})`);
});

Category.addHook('afterUpdate', async (category) => {
    if (category.changed('parent_category_id')) {
        // Update child categories
        await Category.update(
            { parent_category_id: category.parent_category_id },
            { where: { parent_category_id: category.id } }
        );
    }
});

module.exports = Category;
