// backend/scripts/initDb.js
const { sequelize } = require('../src/config/database');
const { redis } = require('../src/config/redis');
const { logger } = require('../src/config/logger');
const migrationRunner = require('../src/migrations');
const seederRunner = require('../src/seeders');

/**
 * Initialize Database
 * Creates database, runs migrations, and seeds data
 */
async function initDatabase() {
    try {
        logger.info('🚀 Starting database initialization...');

        // Step 1: Check database connection
        logger.info('📡 Checking database connection...');
        await sequelize.authenticate();
        logger.info('✅ Database connected successfully');

        // Step 2: Check Redis connection
        logger.info('📡 Checking Redis connection...');
        await redis.ping();
        logger.info('✅ Redis connected successfully');

        // Step 3: Create database if not exists (PostgreSQL)
        logger.info('📦 Creating database if not exists...');
        await createDatabaseIfNotExists();

        // Step 4: Run migrations
        logger.info('📝 Running migrations...');
        const migrationResult = await migrationRunner.migrate();
        if (!migrationResult.success) {
            throw new Error(`Migration failed: ${migrationResult.error}`);
        }
        logger.info(`✅ ${migrationResult.executed} migrations executed`);

        // Step 5: Run seeders
        logger.info('🌱 Running seeders...');
        const seedResult = await seederRunner.seed();
        if (!seedResult.success) {
            throw new Error(`Seeding failed: ${seedResult.error}`);
        }
        logger.info(`✅ ${seedResult.seeded} seeders executed`);

        // Step 6: Verify tables
        logger.info('🔍 Verifying database tables...');
        await verifyTables();

        // Step 7: Create indexes
        logger.info('📊 Creating indexes...');
        await createIndexes();

        // Step 8: Set up triggers
        logger.info('⚡ Setting up database triggers...');
        await setupTriggers();

        // Step 9: Initialize cache
        logger.info('💾 Initializing cache...');
        await initializeCache();

        logger.info('🎉 Database initialization completed successfully!');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
}

/**
 * Create database if not exists
 */
async function createDatabaseIfNotExists() {
    const databaseName = process.env.DB_NAME || 'pricepulse';
    const [result] = await sequelize.query(
        `SELECT 1 FROM pg_database WHERE datname = '${databaseName}'`
    );

    if (result.length === 0) {
        await sequelize.query(`CREATE DATABASE ${databaseName}`);
        logger.info(`✅ Database ${databaseName} created`);
    } else {
        logger.info(`✅ Database ${databaseName} already exists`);
    }
}

/**
 * Verify database tables
 */
async function verifyTables() {
    const [tables] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    `);

    const expectedTables = [
        'users', 'categories', 'products', 'listings',
        'transactions', 'demand_alerts', 'exchanges',
        'price_history', 'external_prices', 'payments',
        'notifications', 'reviews', 'wishlists', 'fraud_logs'
    ];

    const existingTables = tables.map(t => t.table_name);
    const missingTables = expectedTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
        logger.warn(`⚠️ Missing tables: ${missingTables.join(', ')}`);
    } else {
        logger.info(`✅ All ${expectedTables.length} tables verified`);
    }
}

/**
 * Create indexes
 */
async function createIndexes() {
    // Performance indexes
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_listings_status_price ON listings(status, price) WHERE status = \'active\'',
        'CREATE INDEX IF NOT EXISTS idx_listings_user_status ON listings(user_id) WHERE status = \'active\'',
        'CREATE INDEX IF NOT EXISTS idx_transactions_status_completed ON transactions(status) WHERE status = \'completed\'',
        'CREATE INDEX IF NOT EXISTS idx_products_demand_active ON products(demand_score) WHERE is_active = true',
        'CREATE INDEX IF NOT EXISTS idx_demand_alerts_user_unread ON demand_alerts(user_id) WHERE read = false',
        'CREATE INDEX IF NOT EXISTS idx_external_prices_product_latest ON external_prices(product_id, scraped_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read = false',
        'CREATE INDEX IF NOT EXISTS idx_wishlists_user_product ON wishlists(user_id, product_id)',
    ];

    for (const index of indexes) {
        try {
            await sequelize.query(index);
        } catch (error) {
            logger.warn(`⚠️ Failed to create index: ${error.message}`);
        }
    }
    logger.info(`✅ ${indexes.length} indexes created/verified`);
}

/**
 * Setup database triggers
 */
async function setupTriggers() {
    // Trigger for updating product demand score on listing changes
    const triggers = `
        CREATE OR REPLACE FUNCTION update_product_demand_score()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE products 
            SET demand_score = (
                SELECT LEAST(1.0, 
                    (search_count / 1000.0) * 0.4 +
                    (wishlist_count / 100.0) * 0.3 +
                    (view_count / 500.0) * 0.3
                )
                WHERE id = NEW.product_id
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS update_demand_score ON listings;
        CREATE TRIGGER update_demand_score
        AFTER INSERT OR UPDATE ON listings
        FOR EACH ROW
        EXECUTE FUNCTION update_product_demand_score();

        -- Trigger for updating user rating on review changes
        CREATE OR REPLACE FUNCTION update_user_rating()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE users 
            SET seller_rating = (
                SELECT AVG(rating) 
                FROM reviews 
                WHERE reviewed_id = NEW.reviewed_id AND status = 'approved'
            ),
            total_reviews = (
                SELECT COUNT(*) 
                FROM reviews 
                WHERE reviewed_id = NEW.reviewed_id AND status = 'approved'
            )
            WHERE id = NEW.reviewed_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS update_rating ON reviews;
        CREATE TRIGGER update_rating
        AFTER INSERT OR UPDATE ON reviews
        FOR EACH ROW
        EXECUTE FUNCTION update_user_rating();
    `;

    try {
        await sequelize.query(triggers);
        logger.info('✅ Database triggers set up successfully');
    } catch (error) {
        logger.warn(`⚠️ Failed to setup triggers: ${error.message}`);
    }
}

/**
 * Initialize cache
 */
async function initializeCache() {
    try {
        // Clear existing cache
        await redis.flushall();
        logger.info('✅ Cache initialized');
    } catch (error) {
        logger.warn(`⚠️ Cache initialization failed: ${error.message}`);
    }
}

// Run initialization
initDatabase();