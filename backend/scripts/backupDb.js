// backend/scripts/backupDb.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { sequelize } = require('../src/config/database');
const { logger } = require('../src/config/logger');
const { redis } = require('../src/config/redis');

const execAsync = promisify(exec);

/**
 * Backup Database
 * Creates a backup of the PostgreSQL database and Redis data
 */
async function backupDatabase() {
    try {
        logger.info('💾 Starting database backup...');

        // Create backup directory
        const backupDir = path.join(__dirname, '../../backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Generate timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

        // 1. PostgreSQL backup
        logger.info('📦 Backing up PostgreSQL...');
        await backupPostgreSQL(backupFile);

        // 2. Redis backup
        logger.info('🔴 Backing up Redis...');
        await backupRedis(backupDir, timestamp);

        // 3. Uploads backup
        logger.info('📁 Backing up uploads...');
        await backupUploads(backupDir, timestamp);

        // 4. Generate backup metadata
        const metadata = {
            timestamp: new Date().toISOString(),
            database: process.env.DB_NAME,
            environment: process.env.NODE_ENV,
            files: {
                postgres: `backup-${timestamp}.sql`,
                redis: `redis-backup-${timestamp}.rdb`,
                uploads: `uploads-${timestamp}.tar.gz`,
            },
            size: await getBackupSize(backupDir, timestamp),
        };

        fs.writeFileSync(
            path.join(backupDir, `metadata-${timestamp}.json`),
            JSON.stringify(metadata, null, 2)
        );

        // 5. Clean old backups (keep last 7 days)
        await cleanOldBackups(backupDir, 7);

        logger.info(`✅ Backup completed successfully!`);
        logger.info(`📁 Backup location: ${backupDir}`);
        logger.info(`📄 Backup file: ${backupFile}`);

        process.exit(0);
    } catch (error) {
        logger.error('❌ Backup failed:', error);
        process.exit(1);
    }
}

/**
 * Backup PostgreSQL
 */
async function backupPostgreSQL(backupFile) {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'pricepulse',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    };

    const command = `PGPASSWORD=${config.password} pg_dump \
        -h ${config.host} \
        -p ${config.port} \
        -U ${config.user} \
        -d ${config.database} \
        --format=custom \
        --verbose \
        --file=${backupFile}`;

    try {
        await execAsync(command);
        logger.info(`✅ PostgreSQL backup: ${backupFile}`);
    } catch (error) {
        logger.error('❌ PostgreSQL backup failed:', error);
        throw error;
    }
}

/**
 * Backup Redis
 */
async function backupRedis(backupDir, timestamp) {
    try {
        // Save Redis data to disk
        await redis.bgsave();

        // Wait for save to complete
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Get Redis config
        const config = await redis.config('GET', 'dir');
        const dir = config[1];
        const filename = await redis.config('GET', 'dbfilename');
        const rdbPath = path.join(dir, filename[1]);

        // Copy RDB file
        const backupPath = path.join(backupDir, `redis-backup-${timestamp}.rdb`);
        if (fs.existsSync(rdbPath)) {
            fs.copyFileSync(rdbPath, backupPath);
            logger.info(`✅ Redis backup: ${backupPath}`);
        } else {
            logger.warn('⚠️ Redis RDB file not found');
        }
    } catch (error) {
        logger.error('❌ Redis backup failed:', error);
        throw error;
    }
}

/**
 * Backup uploads directory
 */
async function backupUploads(backupDir, timestamp) {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
        logger.warn('⚠️ Uploads directory not found');
        return;
    }

    const backupFile = path.join(backupDir, `uploads-${timestamp}.tar.gz`);
    const command = `tar -czf ${backupFile} -C ${path.dirname(uploadsDir)} ${path.basename(uploadsDir)}`;

    try {
        await execAsync(command);
        logger.info(`✅ Uploads backup: ${backupFile}`);
    } catch (error) {
        logger.error('❌ Uploads backup failed:', error);
        throw error;
    }
}

/**
 * Get backup size
 */
async function getBackupSize(backupDir, timestamp) {
    const files = [
        `backup-${timestamp}.sql`,
        `redis-backup-${timestamp}.rdb`,
        `uploads-${timestamp}.tar.gz`,
    ];

    let totalSize = 0;
    for (const file of files) {
        const filePath = path.join(backupDir, file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            totalSize += stats.size;
        }
    }

    return formatBytes(totalSize);
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Clean old backups
 */
async function cleanOldBackups(backupDir, daysToKeep) {
    const files = fs.readdirSync(backupDir);
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs < cutoff && !file.startsWith('metadata')) {
            fs.unlinkSync(filePath);
            deletedCount++;
        }
    }

    if (deletedCount > 0) {
        logger.info(`🧹 Cleaned up ${deletedCount} old backups`);
    }
}

// Run backup
backupDatabase();