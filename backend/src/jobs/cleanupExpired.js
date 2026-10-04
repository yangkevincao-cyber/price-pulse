// backend/src/jobs/cleanupExpired.js
const { sequelize } = require('../config/database');
const { logger } = require('../config/logger');
const { Listing, Exchange, Session, Token } = require('../models');

class CleanupExpiredJob {
    constructor() {
        this.name = 'cleanup_expired';
        this.isRunning = false;
        this.lastRun = null;
    }

    /**
     * Run the job
     */
    async run() {
        if (this.isRunning) {
            logger.warn('Cleanup expired job already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting cleanup expired job');

        try {
            // Clean expired listings
            const expiredListings = await this.cleanExpiredListings();

            // Clean expired exchanges
            const expiredExchanges = await this.cleanExpiredExchanges();

            // Clean old sessions
            const cleanedSessions = await this.cleanOldSessions();

            // Clean old tokens
            const cleanedTokens = await this.cleanOldTokens();

            // Clean old logs
            const cleanedLogs = await this.cleanOldLogs();

            // Clean temporary files
            const cleanedFiles = await this.cleanTemporaryFiles();

            logger.info(`Cleanup expired job completed`, {
                expiredListings,
                expiredExchanges,
                cleanedSessions,
                cleanedTokens,
                cleanedLogs,
                cleanedFiles,
            });
            this.lastRun = new Date();
        } catch (error) {
            logger.error('Cleanup expired job failed:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Clean expired listings
     */
    async cleanExpiredListings() {
        const count = await Listing.update(
            { status: 'expired' },
            {
                where: {
                    status: 'active',
                    expires_at: { [sequelize.Op.lt]: new Date() },
                },
            }
        );

        logger.info(`Cleaned ${count} expired listings`);
        return count;
    }

    /**
     * Clean expired exchanges
     */
    async cleanExpiredExchanges() {
        const count = await Exchange.update(
            { status: 'expired' },
            {
                where: {
                    status: 'active',
                    expires_at: { [sequelize.Op.lt]: new Date() },
                },
            }
        );

        logger.info(`Cleaned ${count} expired exchanges`);
        return count;
    }

    /**
     * Clean old sessions
     */
    async cleanOldSessions() {
        // Delete sessions older than 30 days
        const count = await Session.destroy({
            where: {
                updated_at: { [sequelize.Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
        });

        logger.info(`Cleaned ${count} old sessions`);
        return count;
    }

    /**
     * Clean old tokens
     */
    async cleanOldTokens() {
        // Delete tokens older than 30 days
        const count = await Token.destroy({
            where: {
                updated_at: { [sequelize.Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
        });

        logger.info(`Cleaned ${count} old tokens`);
        return count;
    }

    /**
     * Clean old logs
     */
    async cleanOldLogs() {
        // Delete logs older than 90 days
        const tables = [
            'activity_logs',
            'scraping_logs',
            'email_logs',
            'sms_logs',
            'fraud_logs',
        ];

        let totalCount = 0;

        for (const table of tables) {
            const [result] = await sequelize.query(`
                DELETE FROM ${table}
                WHERE created_at < NOW() - INTERVAL '90 days'
                RETURNING *
            `);
            totalCount += result.length;
        }

        logger.info(`Cleaned ${totalCount} old logs`);
        return totalCount;
    }

    /**
     * Clean temporary files
     */
    async cleanTemporaryFiles() {
        const fs = require('fs');
        const path = require('path');
        const uploadDir = path.join(__dirname, '../../uploads/temp');

        if (!fs.existsSync(uploadDir)) {
            return 0;
        }

        const files = fs.readdirSync(uploadDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        let count = 0;

        for (const file of files) {
            const filePath = path.join(uploadDir, file);
            const stats = fs.statSync(filePath);
            const age = now - stats.mtimeMs;

            if (age > maxAge) {
                fs.unlinkSync(filePath);
                count++;
            }
        }

        logger.info(`Cleaned ${count} temporary files`);
        return count;
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

module.exports = new CleanupExpiredJob();