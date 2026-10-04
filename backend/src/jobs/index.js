// backend/src/jobs/index.js
const cron = require('node-cron');
const { logger } = require('../config/logger');
const dailyDigest = require('./dailyDigest');
const weeklyReport = require('./weeklyReport');
const priceScraper = require('./priceScraper');
const demandAlertGenerator = require('./demandAlertGenerator');
const cleanupExpired = require('./cleanupExpired');
const exchangeMatchFinder = require('./exchangeMatchFinder');
const metricsAggregator = require('./metricsAggregator');

/**
 * Initialize all cron jobs
 */
const initJobs = async () => {
    try {
        logger.info('Initializing cron jobs...');

        // Schedule daily digest at 8 AM
        cron.schedule('0 8 * * *', async () => {
            await dailyDigest.run();
        });

        // Schedule weekly report on Monday at 9 AM
        cron.schedule('0 9 * * 1', async () => {
            await weeklyReport.run();
        });

        // Schedule price scraper every 6 hours
        cron.schedule('0 */6 * * *', async () => {
            await priceScraper.run();
        });

        // Schedule demand alert generation every hour
        cron.schedule('0 * * * *', async () => {
            await demandAlertGenerator.run();
        });

        // Schedule cleanup at 2 AM daily
        cron.schedule('0 2 * * *', async () => {
            await cleanupExpired.run();
        });

        // Schedule exchange match finder every 15 minutes
        cron.schedule('*/15 * * * *', async () => {
            await exchangeMatchFinder.run();
        });

        // Schedule metrics aggregation every 30 minutes
        cron.schedule('*/30 * * * *', async () => {
            await metricsAggregator.run();
        });

        logger.info('All cron jobs initialized successfully');
        return { success: true };
    } catch (error) {
        logger.error('Cron jobs initialization failed:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get job status
 */
const getJobStatus = () => {
    return {
        dailyDigest: dailyDigest.getStatus(),
        weeklyReport: weeklyReport.getStatus(),
        priceScraper: priceScraper.getStatus(),
        demandAlertGenerator: demandAlertGenerator.getStatus(),
        cleanupExpired: cleanupExpired.getStatus(),
        exchangeMatchFinder: exchangeMatchFinder.getStatus(),
        metricsAggregator: metricsAggregator.getStatus(),
    };
};

module.exports = {
    initJobs,
    getJobStatus,
};