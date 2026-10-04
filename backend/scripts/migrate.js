// backend/scripts/migrate.js
const { sequelize } = require('../src/config/database');
const { logger } = require('../src/config/logger');
const migrationRunner = require('../src/migrations');

/**
 * Run Migrations
 * Executes database migrations with options
 */
async function runMigrations() {
    try {
        const args = process.argv.slice(2);
        const command = args[0] || 'up';

        // Connect to database
        await sequelize.authenticate();
        logger.info('✅ Connected to database');

        switch (command) {
            case 'up':
                await migrateUp();
                break;
            case 'down':
                await migrateDown();
                break;
            case 'status':
                await getMigrationStatus();
                break;
            case 'redo':
                await migrateRedo();
                break;
            default:
                logger.info('Usage: node migrate.js [up|down|status|redo]');
                process.exit(0);
        }

        process.exit(0);
    } catch (error) {
        logger.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

/**
 * Run migrations up
 */
async function migrateUp() {
    logger.info('📝 Running migrations...');
    const result = await migrationRunner.migrate();

    if (result.success) {
        logger.info(`✅ ${result.executed} migrations executed successfully`);
    } else {
        throw new Error(`Migration failed: ${result.error}`);
    }
}

/**
 * Rollback last migration
 */
async function migrateDown() {
    logger.info('↩️ Rolling back migration...');
    const result = await migrationRunner.rollback();

    if (result.success) {
        logger.info(`✅ ${result.rolledBack} migration rolled back`);
    } else {
        throw new Error(`Rollback failed: ${result.error}`);
    }
}

/**
 * Get migration status
 */
async function getMigrationStatus() {
    const status = await migrationRunner.getStatus();

    console.log('\n📊 Migration Status');
    console.log('-------------------');
    console.log(`Total migrations: ${status.total}`);
    console.log(`Executed: ${status.executed}`);
    console.log(`Pending: ${status.pending}`);

    if (status.executedList.length > 0) {
        console.log('\n✅ Executed migrations:');
        status.executedList.forEach(name => console.log(`  - ${name}`));
    }

    if (status.pendingList.length > 0) {
        console.log('\n⏳ Pending migrations:');
        status.pendingList.forEach(name => console.log(`  - ${name}`));
    }
}

/**
 * Redo last migration
 */
async function migrateRedo() {
    logger.info('🔄 Redoing migration...');
    await migrateDown();
    await migrateUp();
}

// Run migrations
runMigrations();