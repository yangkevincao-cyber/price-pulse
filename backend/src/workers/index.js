// backend/src/workers/index.js
const { logger } = require('../config/logger');
const emailWorker = require('./emailWorker');
const scrapingWorker = require('./scrapingWorker');
const analyticsWorker = require('./analyticsWorker');
const notificationWorker = require('./notificationWorker');
const priceUpdateWorker = require('./priceUpdateWorker');
const fraudDetectionWorker = require('./fraudDetectionWorker');

/**
 * Initialize all workers
 */
const initWorkers = async () => {
    try {
        logger.info('Initializing workers...');

        // Initialize each worker
        await emailWorker.start();
        await scrapingWorker.start();
        await analyticsWorker.start();
        await notificationWorker.start();
        await priceUpdateWorker.start();
        await fraudDetectionWorker.start();

        logger.info('All workers initialized successfully');
        return { success: true };
    } catch (error) {
        logger.error('Worker initialization failed:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Stop all workers
 */
const stopWorkers = async () => {
    try {
        logger.info('Stopping workers...');

        await emailWorker.stop();
        await scrapingWorker.stop();
        await analyticsWorker.stop();
        await notificationWorker.stop();
        await priceUpdateWorker.stop();
        await fraudDetectionWorker.stop();

        logger.info('All workers stopped successfully');
        return { success: true };
    } catch (error) {
        logger.error('Worker stop failed:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get worker status
 */
const getWorkerStatus = async () => {
    return {
        email: await emailWorker.getStatus(),
        scraping: await scrapingWorker.getStatus(),
        analytics: await analyticsWorker.getStatus(),
        notification: await notificationWorker.getStatus(),
        priceUpdate: await priceUpdateWorker.getStatus(),
        fraudDetection: await fraudDetectionWorker.getStatus(),
    };
};

module.exports = {
    initWorkers,
    stopWorkers,
    getWorkerStatus,
};

