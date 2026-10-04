// backend/src/controllers/categoryController.js
const { Category, Product } = require('../models');
const { logger } = require('../config/logger');
const { sequelize } = require('../config/database');
const { validationResult } = require('express-validator');
const cacheService = require('../services/cache/cacheService');

class CategoryController {
    /**
     * Get all categories
     */
    async getAllCategories(req, res) {
        try {
            const { includeProducts = false, parentOnly = false } = req.query;

            const cacheKey = `categories:all:${includeProducts}:${parentOnly}`;
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return res.json({
                    success: true,
                    data: cached,
                });
            }

            const where = { is_active: true };
            if (parentOnly === 'true') {
                where.parent_category_id = null;
            }

            const include = [];
            if (includeProducts === 'true') {
                include.push({
                    model: Product,
                    as: 'products',
                    where: { is_active: true, is_deleted: false },
                    required: false,
                    attributes: ['id', 'name', 'price'],
                    limit: 5,
                });
            }

            // Include subcategories
            const categories = await Category.findAll({
                where,
                include: [
                    ...include,
                    {
                        model: Category,
                        as: 'subcategories',
                        where: { is_active: true },
                        required: false,
                    },
                ],
                order: [['display_order', 'ASC'], ['name', 'ASC']],
            });

            await cacheService.set(cacheKey, categories, 3600);

            return res.json({
                success: true,
                data: categories,
            });
        } catch (error) {
            logger.error('Get categories error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch categories',
            });
        }
    }

    /**
     * Get category by ID
     */
    async getCategoryById(req, res) {
        try {
            const { id } = req.params;

            const category = await Category.findByPk(id, {
                include: [
                    {
                        model: Category,
                        as: 'parent',
                        attributes: ['id', 'name', 'slug'],
                    },
                    {
                        model: Category,
                        as: 'subcategories',
                        where: { is_active: true },
                        required: false,
                        attributes: ['id', 'name', 'slug', 'icon', 'product_count'],
                    },
                    {
                        model: Product,
                        as: 'products',
                        where: { is_active: true, is_deleted: false },
                        required: false,
                        limit: 10,
                        order: [['demand_score', 'DESC']],
                    },
                ],
            });

            if (!category) {
                return res.status(404).json({
                    success: false,
                    error: 'Category not found',
                });
            }

            // Get category path
            const path = await category.getFullPath();

            return res.json({
                success: true,
                data: {
                    category,
                    path,
                    full_slug: await category.getFullSlug(),
                },
            });
        } catch (error) {
            logger.error('Get category error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch category',
            });
        }
    }

    /**
     * Get category by slug
     */
    async getCategoryBySlug(req, res) {
        try {
            const { slug } = req.params;

            const category = await Category.findOne({
                where: { slug, is_active: true },
                include: [
                    {
                        model: Category,
                        as: 'parent',
                        attributes: ['id', 'name', 'slug'],
                    },
                    {
                        model: Category,
                        as: 'subcategories',
                        where: { is_active: true },
                        required: false,
                        attributes: ['id', 'name', 'slug', 'icon', 'product_count'],
                    },
                ],
            });

            if (!category) {
                return res.status(404).json({
                    success: false,
                    error: 'Category not found',
                });
            }

            return res.json({
                success: true,
                data: category,
            });
        } catch (error) {
            logger.error('Get category by slug error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch category',
            });
        }
    }

    /**
     * Create category (admin only)
     */
    async createCategory(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array(),
                });
            }

            const categoryData = req.body;

            // Generate slug if not provided
            if (!categoryData.slug) {
                categoryData.slug = categoryData.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '');
            }

            const category = await Category.create(categoryData);

            // Clear cache
            await cacheService.deletePattern('categories:*');

            logger.info(`Category created: ${category.name} (${category.id})`);

            return res.status(201).json({
                success: true,
                message: 'Category created successfully',
                data: { category },
            });
        } catch (error) {
            logger.error('Create category error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to create category',
            });
        }
    }

    /**
     * Update category (admin only)
     */
    async updateCategory(req, res) {
        try {
            const { id } = req.params;
            const category = await Category.findByPk(id);

            if (!category) {
                return res.status(404).json({
                    success: false,
                    error: 'Category not found',
                });
            }

            await category.update(req.body);

            // Clear cache
            await cacheService.deletePattern('categories:*');

            logger.info(`Category updated: ${category.name} (${category.id})`);

            return res.json({
                success: true,
                message: 'Category updated successfully',
                data: { category },
            });
        } catch (error) {
            logger.error('Update category error:', error);
            return res.status(400).json({
                success: false,
                error: error.message || 'Failed to update category',
            });
        }
    }

    /**
     * Delete category (admin only)
     */
    async deleteCategory(req, res) {
        try {
            const { id } = req.params;
            const category = await Category.findByPk(id);

            if (!category) {
                return res.status(404).json({
                    success: false,
                    error: 'Category not found',
                });
            }

            // Check if category has products
            const productCount = await Product.count({
                where: { category_id: id, is_deleted: false },
            });

            if (productCount > 0) {
                return res.status(400).json({
                    success: false,
                    error: `Cannot delete category with ${productCount} products. Reassign or delete products first.`,
                });
            }

            await category.destroy();

            // Clear cache
            await cacheService.deletePattern('categories:*');

            logger.info(`Category deleted: ${category.name} (${category.id})`);

            return res.json({
                success: true,
                message: 'Category deleted successfully',
            });
        } catch (error) {
            logger.error('Delete category error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete category',
            });
        }
    }

    /**
     * Get category tree
     */
    async getCategoryTree(req, res) {
        try {
            const cacheKey = 'categories:tree';
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return res.json({
                    success: true,
                    data: cached,
                });
            }

            const categories = await Category.findAll({
                where: { is_active: true },
                order: [['display_order', 'ASC'], ['name', 'ASC']],
            });

            const tree = this.buildTree(categories);

            await cacheService.set(cacheKey, tree, 3600);

            return res.json({
                success: true,
                data: tree,
            });
        } catch (error) {
            logger.error('Get category tree error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch category tree',
            });
        }
    }

    /**
     * Build category tree from flat list
     */
    buildTree(categories, parentId = null) {
        const result = [];
        const children = categories.filter(c => c.parent_category_id === parentId);

        for (const child of children) {
            const node = child.toJSON();
            const subChildren = this.buildTree(categories, child.id);
            if (subChildren.length > 0) {
                node.subcategories = subChildren;
            }
            result.push(node);
        }

        return result;
    }

    /**
     * Get category stats
     */
    async getCategoryStats(req, res) {
        try {
            const stats = await Category.findAll({
                attributes: [
                    'id',
                    'name',
                    'product_count',
                    'active_listings_count',
                    [sequelize.literal('(SELECT COUNT(*) FROM products WHERE category_id = Category.id AND is_deleted = false)'), 'total_products'],
                    [sequelize.literal('(SELECT AVG(demand_score) FROM products WHERE category_id = Category.id AND is_active = true)'), 'avg_demand_score'],
                ],
                where: { is_active: true },
                order: [['product_count', 'DESC']],
                limit: 20,
            });

            // Get total stats
            const totalStats = await sequelize.query(`
                SELECT 
                    COUNT(*) as total_categories,
                    (SELECT COUNT(*) FROM products WHERE is_deleted = false) as total_products,
                    (SELECT COUNT(*) FROM listings WHERE status = 'active') as total_listings
                FROM categories
                WHERE is_active = true
            `, {
                type: sequelize.QueryTypes.SELECT,
            });

            return res.json({
                success: true,
                data: {
                    top_categories: stats,
                    totals: totalStats[0],
                },
            });
        } catch (error) {
            logger.error('Get category stats error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch category stats',
            });
        }
    }
}

module.exports = new CategoryController();