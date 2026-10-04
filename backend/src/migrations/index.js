// backend/src/migrations/index.js
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');
const fs = require('fs');
const path = require('path');

/**
 * Migration Runner
 * Executes all migration files in order
 */
class MigrationRunner {
    constructor() {
        this.migrations = [];
        this.migrationTable = 'SequelizeMeta';
    }

    /**
     * Load all migration files
     */
    loadMigrations() {
        const migrationDir = __dirname;
        const files = fs.readdirSync(migrationDir)
            .filter(file => file.endsWith('.js') && file !== 'index.js')
            .sort();

        this.migrations = files.map(file => ({
            name: file,
            path: path.join(migrationDir, file),
            timestamp: parseInt(file.split('-')[0]),
        }));

        logger.info(`Loaded ${this.migrations.length} migrations`);
        return this.migrations;
    }

    /**
     * Run all pending migrations
     */
    async migrate() {
        try {
            // Ensure migration table exists
            await this.ensureMigrationTable();

            // Load migrations
            this.loadMigrations();

            // Get executed migrations
            const executed = await this.getExecutedMigrations();
            const pending = this.migrations.filter(m => !executed.includes(m.name));

            if (pending.length === 0) {
                logger.info('No pending migrations');
                return { success: true, executed: 0 };
            }

            logger.info(`Running ${pending.length} migrations...`);

            let executedCount = 0;
            for (const migration of pending) {
                try {
                    await this.runMigration(migration);
                    executedCount++;
                    logger.info(`✅ Migration ${migration.name} executed successfully`);
                } catch (error) {
                    logger.error(`❌ Migration ${migration.name} failed:`, error);
                    throw error;
                }
            }

            logger.info(`✅ ${executedCount} migrations executed successfully`);
            return { success: true, executed: executedCount };
        } catch (error) {
            logger.error('Migration failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Run a single migration
     */
    async runMigration(migration) {
        const migrationModule = require(migration.path);
        const queryInterface = sequelize.getQueryInterface();

        // Run up method
        if (migrationModule.up) {
            await migrationModule.up(queryInterface, sequelize);
        }

        // Record migration
        await sequelize.query(
            `INSERT INTO "${this.migrationTable}" (name) VALUES ($1)`,
            { bind: [migration.name] }
        );
    }

    /**
     * Rollback last migration
     */
    async rollback() {
        try {
            await this.ensureMigrationTable();

            // Get executed migrations
            const executed = await this.getExecutedMigrations();

            if (executed.length === 0) {
                logger.info('No migrations to rollback');
                return { success: true, rolledBack: 0 };
            }

            const lastMigration = executed[executed.length - 1];
            const migrationFile = this.migrations.find(m => m.name === lastMigration);

            if (!migrationFile) {
                logger.error(`Migration file ${lastMigration} not found`);
                return { success: false, error: 'Migration file not found' };
            }

            const migrationModule = require(migrationFile.path);

            // Run down method
            if (migrationModule.down) {
                const queryInterface = sequelize.getQueryInterface();
                await migrationModule.down(queryInterface, sequelize);
            }

            // Remove from migration table
            await sequelize.query(
                `DELETE FROM "${this.migrationTable}" WHERE name = $1`,
                { bind: [lastMigration] }
            );

            logger.info(`✅ Rollback ${lastMigration} completed`);
            return { success: true, rolledBack: 1 };
        } catch (error) {
            logger.error('Rollback failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Ensure migration table exists
     */
    async ensureMigrationTable() {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "${this.migrationTable}" (
                name VARCHAR(255) PRIMARY KEY,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
    }

    /**
     * Get executed migrations
     */
    async getExecutedMigrations() {
        const result = await sequelize.query(
            `SELECT name FROM "${this.migrationTable}" ORDER BY created_at ASC`,
            { type: sequelize.QueryTypes.SELECT }
        );
        return result.map(r => r.name);
    }

    /**
     * Get migration status
     */
    async getStatus() {
        await this.ensureMigrationTable();
        this.loadMigrations();

        const executed = await this.getExecutedMigrations();
        const pending = this.migrations.filter(m => !executed.includes(m.name));

        return {
            total: this.migrations.length,
            executed: executed.length,
            pending: pending.length,
            executedList: executed,
            pendingList: pending.map(m => m.name),
        };
    }
}

module.exports = new MigrationRunner();