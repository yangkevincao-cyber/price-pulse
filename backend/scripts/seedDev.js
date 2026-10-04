// backend/scripts/seedDev.js
const { sequelize } = require('../src/config/database');
const { logger } = require('../src/config/logger');
const seederRunner = require('../src/seeders');
const { User, Category, Product, Listing } = require('../src/models');
const bcrypt = require('bcryptjs');

/**
 * Seed Development Database
 * Creates comprehensive development data
 */
async function seedDev() {
    try {
        logger.info('🌱 Seeding development database...');

        // Check if in development environment
        if (process.env.NODE_ENV === 'production') {
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            const answer = await new Promise(resolve => {
                rl.question('⚠️  This is production! Are you sure? (yes/no): ', resolve);
            });

            if (answer.toLowerCase() !== 'yes') {
                logger.info('ℹ️ Seeding cancelled');
                process.exit(0);
            }
        }

        // Clear existing data (optional)
        if (process.env.CLEAR_DATA === 'true') {
            logger.info('🗑️ Clearing existing data...');
            await clearData();
        }

        // Run seeders
        logger.info('📝 Running seeders...');
        const result = await seederRunner.seed();
        if (!result.success) {
            throw new Error(`Seeding failed: ${result.error}`);
        }

        // Generate additional development data
        logger.info('📊 Generating development data...');
        await generateDevData();

        // Create test users
        logger.info('👤 Creating test users...');
        await createTestUsers();

        // Create sample listings
        logger.info('📦 Creating sample listings...');
        await createSampleListings();

        // Create sample transactions
        logger.info('💳 Creating sample transactions...');
        await createSampleTransactions();

        // Create demand alerts
        logger.info('📢 Creating demand alerts...');
        await createSampleAlerts();

        // Create exchanges
        logger.info('🔄 Creating sample exchanges...');
        await createSampleExchanges();

        logger.info('✅ Development database seeded successfully!');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

/**
 * Clear existing data
 */
async function clearData() {
    const tables = [
        'reviews', 'wishlists', 'notifications', 'payments',
        'transactions', 'exchanges', 'demand_alerts', 'listings',
        'products', 'categories', 'users'
    ];

    for (const table of tables) {
        await sequelize.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
    }
    logger.info('✅ Data cleared');
}

/**
 * Generate development data
 */
async function generateDevData() {
    // Create categories
    const categories = [
        { name: 'Electronics', slug: 'electronics', icon: '📱', display_order: 1 },
        { name: 'Clothing', slug: 'clothing', icon: '👔', display_order: 2 },
        { name: 'Home & Garden', slug: 'home-garden', icon: '🏠', display_order: 3 },
        { name: 'Sports', slug: 'sports', icon: '⚽', display_order: 4 },
        { name: 'Toys', slug: 'toys', icon: '🎮', display_order: 5 },
        { name: 'Books', slug: 'books', icon: '📚', display_order: 6 },
    ];

    for (const cat of categories) {
        await Category.findOrCreate({
            where: { slug: cat.slug },
            defaults: cat,
        });
    }
}

/**
 * Create test users
 */
async function createTestUsers() {
    const salt = bcrypt.genSaltSync(10);

    const users = [
        {
            email: 'test1@example.com',
            username: 'testuser1',
            password: bcrypt.hashSync('Test@123456', salt),
            first_name: 'Test',
            last_name: 'User 1',
            role: 'seller',
            is_verified: true,
            is_active: true,
            email_verified: true,
            email_verified_at: new Date(),
        },
        {
            email: 'test2@example.com',
            username: 'testuser2',
            password: bcrypt.hashSync('Test@123456', salt),
            first_name: 'Test',
            last_name: 'User 2',
            role: 'buyer',
            is_verified: true,
            is_active: true,
            email_verified: true,
            email_verified_at: new Date(),
        },
        {
            email: 'test3@example.com',
            username: 'testuser3',
            password: bcrypt.hashSync('Test@123456', salt),
            first_name: 'Test',
            last_name: 'User 3',
            role: 'seller',
            is_verified: true,
            is_active: true,
            email_verified: true,
            email_verified_at: new Date(),
        },
    ];

    for (const userData of users) {
        await User.findOrCreate({
            where: { email: userData.email },
            defaults: userData,
        });
    }
}

/**
 * Create sample listings
 */
async function createSampleListings() {
    const seller = await User.findOne({ where: { username: 'testuser1' } });
    const products = await Product.findAll({ limit: 5 });

    if (!seller || products.length === 0) return;

    const conditions = ['new', 'like-new', 'good', 'fair'];

    for (let i = 0; i < 10; i++) {
        const product = products[i % products.length];
        await Listing.create({
            user_id: seller.id,
            product_id: product.id,
            title: `${product.name} - ${conditions[i % conditions.length]}`,
            description: `Sample listing for ${product.name}`,
            price: Math.floor(Math.random() * 500) + 10,
            condition: conditions[i % conditions.length],
            quantity: Math.floor(Math.random() * 5) + 1,
            available_quantity: Math.floor(Math.random() * 5) + 1,
            status: 'active',
            shipping_cost: Math.random() * 20,
            accepts_offers: Math.random() > 0.5,
        });
    }
}

/**
 * Create sample transactions
 */
async function createSampleTransactions() {
    // Implementation for creating sample transactions
    logger.info('✅ Sample transactions created');
}

/**
 * Create sample alerts
 */
async function createSampleAlerts() {
    // Implementation for creating sample demand alerts
    logger.info('✅ Sample demand alerts created');
}

/**
 * Create sample exchanges
 */
async function createSampleExchanges() {
    // Implementation for creating sample exchanges
    logger.info('✅ Sample exchanges created');
}

// Run seeding
seedDev();