// backend/scripts/cleanUploads.js
const fs = require('fs');
const path = require('path');
const { logger } = require('../src/config/logger');
const uploadService = require('../src/services/file/uploadService');

/**
 * Clean Uploads
 * Removes orphaned and old files
 */
async function cleanUploads() {
    try {
        const args = process.argv.slice(2);
        const daysToKeep = parseInt(args[0]) || 90;
        const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

        logger.info(`🧹 Cleaning uploads older than ${daysToKeep} days...`);

        const uploadDir = path.join(__dirname, '../uploads');
        let deletedCount = 0;
        let sizeFreed = 0;

        // Process each subdirectory
        const dirs = ['products', 'users', 'listings'];
        for (const dir of dirs) {
            const fullPath = path.join(uploadDir, dir);
            if (!fs.existsSync(fullPath)) continue;

            const result = await processDirectory(fullPath, cutoff);
            deletedCount += result.deletedCount;
            sizeFreed += result.sizeFreed;
        }

        // Clean temporary files
        const tempResult = await uploadService.cleanTempFiles();
        deletedCount += tempResult.deletedCount;

        logger.info(`✅ Cleanup complete: ${deletedCount} files deleted`);
        logger.info(`💾 Space freed: ${formatBytes(sizeFreed)}`);

        process.exit(0);
    } catch (error) {
        logger.error('❌ Upload cleanup failed:', error);
        process.exit(1);
    }
}

/**
 * Process directory
 */
async function processDirectory(dir, cutoff) {
    let deletedCount = 0;
    let sizeFreed = 0;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            const result = await processDirectory(filePath, cutoff);
            deletedCount += result.deletedCount;
            sizeFreed += result.sizeFreed;
        } else if (stats.mtimeMs < cutoff) {
            // Check if file is referenced in database
            const isReferenced = await checkDatabaseReference(file);
            if (!isReferenced) {
                const size = stats.size;
                fs.unlinkSync(filePath);
                deletedCount++;
                sizeFreed += size;
            }
        }
    }

    return { deletedCount, sizeFreed };
}

/**
 * Check database reference
 */
async function checkDatabaseReference(filename) {
    // This would check if the file is referenced in any database table
    // For now, return false to allow deletion
    return false;
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

// Run cleanup
cleanUploads();