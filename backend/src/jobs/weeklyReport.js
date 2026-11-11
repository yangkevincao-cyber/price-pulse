// backend/src/jobs/weeklyReport.js
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');
const { User, Product } = require('../models');
const emailService = require('../services/notification/emailService');
const reportService = require('../services/analytics/reportService');

class WeeklyReportJob {
    constructor() {
        this.name = 'weekly_report';
        this.isRunning = false;
        this.lastRun = null;
    }

    /**
     * Run the job
     */
    async run() {
        if (this.isRunning) {
            logger.warn('Weekly report job already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting weekly report job');

        try {
            // Generate platform report
            const platformReport = await reportService.generateMarketingReport('7d');

            // Send to admins
            await this.sendAdminReport(platformReport);

            // Generate seller reports
            await this.generateSellerReports();

            // Generate product reports
            await this.generateProductReports();

            logger.info('Weekly report job completed');
            this.lastRun = new Date();
        } catch (error) {
            logger.error('Weekly report job failed:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Send admin report
     */
    async sendAdminReport(report) {
        const admins = await User.findAll({
            where: { role: 'admin', is_active: true },
        });

        for (const admin of admins) {
            try {
                await emailService.sendAdminReport(admin, report);
            } catch (error) {
                logger.error(`Failed to send admin report to ${admin.email}:`, error);
            }
        }
    }

    /**
     * Generate seller reports
     */
    async generateSellerReports() {
        const sellers = await User.findAll({
            where: { role: 'seller', is_active: true },
            limit: 100,
        });

        for (const seller of sellers) {
            try {
                const report = await reportService.generateSellerReport(seller.id, '7d');
                await emailService.sendSellerReport(seller, report);
            } catch (error) {
                logger.error(`Failed to generate seller report for ${seller.id}:`, error);
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    /**
     * Generate product reports
     */
    async generateProductReports() {
        const products = await Product.findAll({
            where: { is_active: true, is_deleted: false },
            order: [['demand_score', 'DESC']],
            limit: 50,
        });

        for (const product of products) {
            try {
                const report = await reportService.generateProductReport(product.id, '7d');
                // Store report in database
                await this.storeProductReport(product.id, report);
            } catch (error) {
                logger.error(`Failed to generate product report for ${product.id}:`, error);
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * Store product report
     */
    async storeProductReport(productId, report) {
        await sequelize.query(`
            INSERT INTO product_reports (product_id, report_data, created_at)
            VALUES ($1, $2, NOW())
        `, {
            bind: [productId, JSON.stringify(report)],
        });
    }

    /**
     * Get job status
     */
    getStatus() {
        return {
            name: this.name,
            isRunning: this.isRunning,
            lastRun: this.lastRun,
        };
    }
}

module.exports = new WeeklyReportJob();