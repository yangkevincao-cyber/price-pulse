// backend/scripts/restoreDb.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { sequelize } = require('../src/config/database');
const { logger } = require('../src/config/logger');

const execAsync = promisify(exec);
const readdirAsync = promisify(fs.readdir);

/**
 * Restore Database from Backup
 */
async function restoreDatabase() {
    try {
        const backupDir = path.join(__dirname, '../../backups');
        const args = process.argv.slice(2);
        let backupFile = args[0];

        // Check if backup directory exists
        if (!fs.existsSync(backupDir)) {
            logger.error('❌ Backup directory not found');
            process.exit(1);
        }

        // If no backup file specified, list available backups
        if (!backupFile) {
            await listBackups(backupDir);
            return;
        }

        // Check if backup file exists
        const backupPath = path.join(backupDir, backupFile);
        if (!fs.existsSync(backupPath)) {
            logger.error(`❌ Backup file not found: ${backupFile}`);
            await listBackups(backupDir);
            process.exit(1);
        }

        // Confirm restore
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const confirm = await new Promise(resolve => {
            rl.question(`⚠️  This will overwrite your current database! Are you sure? (yes/no): `, resolve);
        });

        if (confirm.toLowerCase() !== 'yes') {
            logger.info('ℹ️ Restore cancelled');
            process.exit(0);
        }

        // Restore PostgreSQL
        logger.info(`📦 Restoring PostgreSQL from ${backupFile}...`);
        await restorePostgreSQL(backupPath);

        // Restore Redis
        const redisBackup = backupFile.replace('backup-', 'redis-backup-').replace('.sql', '.rdb');
        const redisPath = path.join(backupDir, redisBackup);
        if (fs.existsSync(redisPath)) {
            logger.info('🔴 Restoring Redis...');
            await restoreRedis(redisPath);
        }

        // Restore Uploads
        const uploadsBackup = backupFile.replace('backup-', 'uploads-').replace('.sql', '.tar.gz');
        const uploadsPath = path.join(backupDir, uploadsBackup);
        if (fs.existsSync(uploadsPath)) {
            logger.info('📁 Restoring uploads...');
            await restoreUploads(uploadsPath);
        }

        logger.info('✅ Database restore completed successfully!');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Restore failed:', error);
        process.exit(1);
    }
}

/**
 * List available backups
 */
async function listBackups(backupDir) {
    const files = await readdirAsync(backupDir);
    const backups = files.filter(f => f.startsWith('backup-') && f.endsWith('.sql'));

    if (backups.length === 0) {
        logger.info('ℹ️ No backups found');
        return;
    }

    console.log('\n📋 Available Backups:');
    console.log('═'.repeat(50));
    backups.sort().reverse().forEach((file, index) => {
        const stats = fs.statSync(path.join(backupDir, file));
        const size = formatBytes(stats.size);
        const date = stats.mtime.toISOString().replace('T', ' ').slice(0, 19);
        console.log(`  ${index + 1}. ${file} (${size}) - ${date}`);
    });
    console.log('\n💡 Usage: node scripts/restoreDb.js <backup-file>');
}

/**
 * Restore PostgreSQL
 */
async function restorePostgreSQL(backupPath) {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'pricepulse',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    };

    // Drop and recreate database
    await sequelize.query(`DROP DATABASE IF EXISTS ${config.database}`);
    await sequelize.query(`CREATE DATABASE ${config.database}`);

    // Restore from backup
    const command = `PGPASSWORD=${config.password} pg_restore \
        -h ${config.host} \
        -p ${config.port} \
        -U ${config.user} \
        -d ${config.database} \
        --verbose \
        --clean \
        --if-exists \
        ${backupPath}`;

    try {
        await execAsync(command);
        logger.info(`✅ PostgreSQL restored: ${backupPath}`);
    } catch (error) {
        logger.error('❌ PostgreSQL restore failed:', error);
        throw error;
    }
}

/**
 * Restore Redis
 */
async function restoreRedis(redisPath) {
    try {
        // Stop Redis
        await execAsync('redis-cli shutdown nosave');

        // Copy RDB file
        const config = await execAsync('redis-cli CONFIG GET dir');
        const dir = config.stdout.split('\n')[1].trim();
        await execAsync(`cp ${redisPath} ${dir}/dump.rdb`);

        // Start Redis
        await execAsync('redis-server --daemonize yes');

        logger.info(`✅ Redis restored: ${redisPath}`);
    } catch (error) {
        logger.error('❌ Redis restore failed:', error);
        throw error;
    }
}

/**
 * Restore Uploads
 */
async function restoreUploads(uploadsPath) {
    const uploadsDir = path.join(__dirname, '../../uploads');

    // Remove existing uploads
    if (fs.existsSync(uploadsDir)) {
        await execAsync(`rm -rf ${uploadsDir}`);
    }

    // Extract backup
    await execAsync(`tar -xzf ${uploadsPath} -C ${path.dirname(uploadsDir)}`);

    logger.info(`✅ Uploads restored: ${uploadsPath}`);
}

/**
 * Format bytes
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run restore
restoreDatabase();