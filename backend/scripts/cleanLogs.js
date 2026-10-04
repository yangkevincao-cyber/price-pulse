// backend/scripts/cleanLogs.js
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { logger } = require('../src/config/logger');

const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const unlinkAsync = promisify(fs.unlink);

/**
 * Clean Old Logs
 * Removes logs older than specified days
 */
async function cleanLogs() {
    try {
        const logDir = path.join(__dirname, '../logs');
        const args = process.argv.slice(2);
        const daysToKeep = parseInt(args[0]) || 30;
        const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

        if (!fs.existsSync(logDir)) {
            logger.info('ℹ️ Logs directory not found');
            process.exit(0);
        }

        logger.info(`🧹 Cleaning logs older than ${daysToKeep} days...`);

        const files = await readdirAsync(logDir);
        let deletedCount = 0;
        let sizeFreed = 0;

        for (const file of files) {
            // Skip .gitkeep and README.md
            if (file === '.gitkeep' || file === 'README.md') {
                continue;
            }

            const filePath = path.join(logDir, file);
            const stats = await statAsync(filePath);

            // Check if file is a regular file and older than cutoff
            if (stats.isFile() && stats.mtimeMs < cutoff) {
                const size = stats.size;
                await unlinkAsync(filePath);
                deletedCount++;
                sizeFreed += size;
                logger.debug(`Deleted: ${file} (${formatBytes(size)})`);
            }
        }

        logger.info(`✅ Cleanup complete: ${deletedCount} files deleted`);
        logger.info(`💾 Space freed: ${formatBytes(sizeFreed)}`);

        process.exit(0);
    } catch (error) {
        logger.error('❌ Log cleanup failed:', error);
        process.exit(1);
    }
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

// Run cleanup
cleanLogs();