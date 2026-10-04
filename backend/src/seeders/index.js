// backend/src/seeders/index.js
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');
const fs = require('fs');
const path = require('path');

/**
 * Seeder Runner
 * Executes all seeder files
 */
class SeederRunner {
    constructor() {
        this.seeders = [];
        this.seederTable = 'SequelizeData';
    }

    /**
     * Load all seeder files
     */
    loadSeeders() {
        const seederDir = __dirname;
        const files = fs.readdirSync(seederDir)
            .filter(file => file.endsWith('.js') && file !== 'index.js')
            .sort();

        this.seeders = files.map(file => ({
            name: file,
            path: path.join(seederDir, file),
        }));

        logger.info(`Loaded ${this.seeders.length} seeders`);
        return this.seeders;
    }

    /**
     * Run all seeders
     */
    async seed() {
        try {
            // Ensure seeder table exists
            await this.ensureSeederTable();

            // Load seeders
            this.loadSeeders();

            // Get executed seeders
            const executed = await this.getExecutedSeeders();
            const pending = this.seeders.filter(s => !executed.includes(s.name));

            if (pending.length === 0) {
                logger.info('No pending seeders');
                return { success: true, seeded: 0 };
            }

            logger.info(`Running ${pending.length} seeders...`);

            let seededCount = 0;
            for (const seeder of pending) {
                try {
                    await this.runSeeder(seeder);
                    seededCount++;
                    logger.info(`✅ Seeder ${seeder.name} executed successfully`);
                } catch (error) {
                    logger.error(`❌ Seeder ${seeder.name} failed:`, error);
                    throw error;
                }
            }

            logger.info(`✅ ${seededCount} seeders executed successfully`);
            return { success: true, seeded: seededCount };
        } catch (error) {
            logger.error('Seeding failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Run a single seeder
     */
    async runSeeder(seeder) {
        const seederModule = require(seeder.path);
        const queryInterface = sequelize.getQueryInterface();

        // Run up method
        if (seederModule.up) {
            await seederModule.up(queryInterface, sequelize);
        }

        // Record seeder
        await sequelize.query(
            `INSERT INTO "${this.seederTable}" (name) VALUES ($1)`,
            { bind: [seeder.name] }
        );
    }

    /**
     * Ensure seeder table exists
     */
    async ensureSeederTable() {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "${this.seederTable}" (
                name VARCHAR(255) PRIMARY KEY,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
    }

    /**
     * Get executed seeders
     */
    async getExecutedSeeders() {
        const result = await sequelize.query(
            `SELECT name FROM "${this.seederTable}" ORDER BY created_at ASC`,
            { type: sequelize.QueryTypes.SELECT }
        );
        return result.map(r => r.name);
    }

    /**
     * Get seeder status
     */
    async getStatus() {
        await this.ensureSeederTable();
        this.loadSeeders();

        const executed = await this.getExecutedSeeders();
        const pending = this.seeders.filter(s => !executed.includes(s.name));

        return {
            total: this.seeders.length,
            executed: executed.length,
            pending: pending.length,
            executedList: executed,
            pendingList: pending.map(s => s.name),
        };
    }
}

module.exports = new SeederRunner();