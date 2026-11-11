// backend/src/services/intelligence/fraudDetectionService.js
const { sequelize } = require('../../config/database');
const { FraudLog, User, Transaction, Listing } = require('../../models');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');

class FraudDetectionService {
    constructor() {
        this.thresholds = {
            priceAnomaly: 3, // Standard deviations
            rapidTransactions: 10, // Per hour
            suspiciousKeywords: ['free', 'hack', 'bitcoin', 'crypto', 'wallet', 'hacked'],
            minAccountAge: 7, // Days
            maxListingsPerHour: 20,
        };
    }

    /**
     * Main fraud detection pipeline
     */
    async detectFraud(transaction) {
        const checks = await Promise.all([
            this.checkPriceAnomaly(transaction),
            this.checkVelocity(transaction),
            this.checkUserReputation(transaction),
            this.checkIPReputation(transaction),
            this.checkDeviceFingerprint(transaction),
            this.checkKeywordFlags(transaction),
            this.checkPaymentRisk(transaction),
            this.checkUnusualPattern(transaction),
            this.checkAccountAge(transaction),
            this.checkListingHistory(transaction),
        ]);

        const riskScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
        const flags = checks.filter(c => c.flagged).map(c => c.reason);

        const result = {
            isFraudulent: riskScore > 0.7,
            riskScore: riskScore,
            flags: flags,
            recommendations: this.generateRecommendations(riskScore, flags),
            requiresReview: riskScore > 0.4 && riskScore <= 0.7,
        };

        // Log for ML training
        await this.logFraudDetection(transaction, result);

        if (result.isFraudulent) {
            await this.blockTransaction(transaction);
        }

        return result;
    }

    /**
     * Check price anomaly
     */
    async checkPriceAnomaly(transaction) {
        const stats = await sequelize.query(`
            SELECT 
                AVG(price) as avg_price,
                STDDEV(price) as stddev_price
            FROM listings
            WHERE product_id = $1
                AND status = 'sold'
                AND sold_at > NOW() - INTERVAL '30 days'
        `, {
            bind: [transaction.productId],
            type: sequelize.QueryTypes.SELECT,
        });

        if (!stats.length || !stats[0].avg_price) {
            return { score: 0, flagged: false };
        }

        const avgPrice = parseFloat(stats[0].avg_price);
        const stddev = parseFloat(stats[0].stddev_price) || 1;
        const zScore = Math.abs((transaction.amount - avgPrice) / stddev);

        if (zScore > this.thresholds.priceAnomaly) {
            return {
                score: Math.min(zScore / 10, 1),
                flagged: true,
                reason: `Price anomaly: ${zScore.toFixed(2)} standard deviations from mean`,
                data: { avgPrice, stddev, zScore },
            };
        }

        return { score: zScore / 10, flagged: false };
    }

    /**
     * Check transaction velocity
     */
    async checkVelocity(transaction) {
        const userTransactions = await sequelize.query(`
            SELECT COUNT(*) as count
            FROM transactions
            WHERE (buyer_id = $1 OR seller_id = $1)
                AND created_at > NOW() - INTERVAL '1 hour'
        `, {
            bind: [transaction.userId],
            type: sequelize.QueryTypes.SELECT,
        });

        const rate = parseInt(userTransactions[0]?.count || 0);

        if (rate > this.thresholds.rapidTransactions) {
            return {
                score: Math.min(rate / 20, 1),
                flagged: true,
                reason: `Rapid transactions: ${rate} in last hour`,
                data: { rate, threshold: this.thresholds.rapidTransactions },
            };
        }

        return { score: rate / 20, flagged: false };
    }

    /**
     * Check user reputation
     */
    async checkUserReputation(transaction) {
        const user = await User.findByPk(transaction.userId);

        if (!user) {
            return { score: 0.5, flagged: true, reason: 'Unknown user' };
        }

        let score = 0;
        const flags = [];

        // Low seller rating
        if (user.seller_rating && user.seller_rating < 2) {
            score += 0.3;
            flags.push('Low seller rating');
        }

        // New account with few sales
        const accountAge = Math.floor((Date.now() - new Date(user.created_at)) / (86400000));
        const totalSales = user.total_sales || 0;

        if (accountAge < 30 && totalSales < 5) {
            score += 0.2;
            flags.push('New account with few sales');
        }

        // Multiple reports
        const reports = await FraudLog.count({
            where: { user_id: user.id, resolved: false },
        });

        if (reports > 3) {
            score += 0.3;
            flags.push('Multiple unresolved reports');
        }

        // Inactive account
        if (accountAge > 30 && user.last_active &&
            new Date(user.last_active) < new Date(Date.now() - 30 * 86400000)) {
            score += 0.1;
            flags.push('Inactive account recently active');
        }

        return {
            score: Math.min(score, 1),
            flagged: score > 0.4,
            reason: flags.join(', '),
            data: { accountAge, totalSales, reports },
        };
    }

    /**
     * Check IP reputation
     */
    async checkIPReputation(transaction) {
        const ip = transaction.ipAddress;

        // Check Redis blacklist
        const isBlacklisted = await redis.sismember('blacklisted_ips', ip);
        if (isBlacklisted) {
            return {
                score: 1,
                flagged: true,
                reason: 'IP address blacklisted',
            };
        }

        // Check for multiple accounts from same IP
        const accountsFromIP = await sequelize.query(`
            SELECT COUNT(DISTINCT user_id) as count
            FROM user_sessions
            WHERE ip_address = $1
                AND created_at > NOW() - INTERVAL '24 hours'
        `, {
            bind: [ip],
            type: sequelize.QueryTypes.SELECT,
        });

        if (accountsFromIP[0]?.count > 5) {
            return {
                score: 0.7,
                flagged: true,
                reason: `Too many accounts from same IP: ${accountsFromIP[0].count}`,
            };
        }

        return { score: 0, flagged: false };
    }

    /**
     * Check device fingerprint
     */
    async checkDeviceFingerprint(transaction) {
        const fingerprint = transaction.deviceFingerprint;
        if (!fingerprint) return { score: 0, flagged: false };

        const previousDevices = await sequelize.query(`
            SELECT COUNT(DISTINCT device_fingerprint) as count
            FROM user_sessions
            WHERE user_id = $1
                AND created_at > NOW() - INTERVAL '7 days'
        `, {
            bind: [transaction.userId],
            type: sequelize.QueryTypes.SELECT,
        });

        if (previousDevices[0]?.count > 3) {
            return {
                score: 0.4,
                flagged: true,
                reason: 'Multiple devices used recently',
            };
        }

        return { score: 0, flagged: false };
    }

    /**
     * Check suspicious keywords
     */
    async checkKeywordFlags(transaction) {
        const { title, description } = transaction;
        const text = `${title || ''} ${description || ''}`.toLowerCase();

        const foundKeywords = this.thresholds.suspiciousKeywords.filter(
            keyword => text.includes(keyword.toLowerCase())
        );

        if (foundKeywords.length > 0) {
            return {
                score: Math.min(foundKeywords.length / 3, 1),
                flagged: true,
                reason: `Suspicious keywords: ${foundKeywords.join(', ')}`,
                data: { foundKeywords },
            };
        }

        return { score: 0, flagged: false };
    }

    /**
     * Check payment risk
     */
    async checkPaymentRisk(transaction) {
        const { cardBrand, paymentMethod, billingCountry, shippingCountry } = transaction;

        let score = 0;
        const flags = [];

        // High-risk card types
        if (['prepaid', 'gift', 'virtual'].includes(cardBrand?.toLowerCase())) {
            score += 0.3;
            flags.push('Prepaid/gift card detected');
        }

        // High-risk payment methods
        if (['cryptocurrency', 'crypto', 'bitcoin'].includes(paymentMethod?.toLowerCase())) {
            score += 0.4;
            flags.push('Cryptocurrency payment');
        }

        // Country mismatch
        if (billingCountry && shippingCountry && billingCountry !== shippingCountry) {
            score += 0.2;
            flags.push('Billing and shipping country mismatch');
        }

        return {
            score: Math.min(score, 1),
            flagged: score > 0.4,
            reason: flags.join(', '),
        };
    }

    /**
     * Check unusual pattern
     */
    async checkUnusualPattern(transaction) {
        const hour = new Date().getHours();
        const userHistory = await sequelize.query(`
            SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
            FROM transactions
            WHERE user_id = $1
                AND status = 'completed'
            GROUP BY EXTRACT(HOUR FROM created_at)
        `, {
            bind: [transaction.userId],
            type: sequelize.QueryTypes.SELECT,
        });

        if (userHistory.length > 0) {
            const userTypicalHours = userHistory.map(r => parseInt(r.hour));
            const isTypical = userTypicalHours.some(h => Math.abs(h - hour) <= 2);

            if (!isTypical) {
                return {
                    score: 0.3,
                    flagged: true,
                    reason: 'Transaction at unusual time for this user',
                };
            }
        }

        return { score: 0, flagged: false };
    }

    /**
     * Check account age
     */
    async checkAccountAge(transaction) {
        const user = await User.findByPk(transaction.userId);
        if (!user) return { score: 0, flagged: false };

        const accountAge = Math.floor((Date.now() - new Date(user.created_at)) / 86400000);

        if (accountAge < this.thresholds.minAccountAge) {
            return {
                score: 0.3 * (1 - accountAge / this.thresholds.minAccountAge),
                flagged: accountAge < 1,
                reason: `New account (${accountAge} days old)`,
            };
        }

        return { score: 0, flagged: false };
    }

    /**
     * Check listing history
     */
    async checkListingHistory(transaction) {
        if (!transaction.listingId) return { score: 0, flagged: false };

        const listingCount = await Listing.count({
            where: {
                user_id: transaction.userId,
                created_at: { [sequelize.Op.gt]: new Date(Date.now() - 3600000) },
            },
        });

        if (listingCount > this.thresholds.maxListingsPerHour) {
            return {
                score: Math.min(listingCount / 30, 1),
                flagged: true,
                reason: `Too many listings: ${listingCount} in last hour`,
            };
        }

        return { score: listingCount / 30, flagged: false };
    }

    /**
     * Generate recommendations
     */
    generateRecommendations(riskScore) {
        if (riskScore > 0.8) {
            return ['BLOCK_TRANSACTION', 'FLAG_USER', 'NOTIFY_ADMIN', 'REVIEW_ACCOUNT'];
        }

        if (riskScore > 0.6) {
            return ['HOLD_FOR_REVIEW', 'REQUEST_ADDITIONAL_VERIFICATION', 'MONITOR_ACCOUNT'];
        }

        if (riskScore > 0.4) {
            return ['MONITOR_FUTURE_TRANSACTIONS', 'FLAG_FOR_REVIEW'];
        }

        if (riskScore > 0.2) {
            return ['LOG_SUSPICIOUS_ACTIVITY'];
        }

        return ['ALLOW_TRANSACTION'];
    }

    /**
     * Block transaction
     */
    async blockTransaction(transaction) {
        await Transaction.update({
            status: 'blocked',
            fraud_risk_score: transaction.riskScore,
            fraud_flags: transaction.flags,
            blocked_at: new Date(),
        }, {
            where: { id: transaction.id },
        });

        // Create fraud log
        await FraudLog.create({
            user_id: transaction.userId,
            transaction_id: transaction.id,
            listing_id: transaction.listingId,
            type: 'unusual_pattern',
            severity: 'high',
            risk_score: transaction.riskScore,
            description: transaction.flags.join(', '),
            details: { flags: transaction.flags },
            indicators: transaction.flags,
            ip_address: transaction.ipAddress,
            device_fingerprint: transaction.deviceFingerprint,
            action_taken: 'blocked',
        });

        // Notify admin
        await this.notifyAdmin(transaction);

        logger.warn(`Transaction blocked due to fraud: ${transaction.id}`);
    }

    /**
     * Log fraud detection
     */
    async logFraudDetection(transaction, result) {
        await FraudLog.create({
            user_id: transaction.userId,
            transaction_id: transaction.id,
            listing_id: transaction.listingId,
            type: 'unusual_pattern',
            severity: result.riskScore > 0.6 ? 'high' : 'medium',
            risk_score: result.riskScore,
            description: result.flags.join(', '),
            details: { flags: result.flags },
            indicators: result.flags,
            ip_address: transaction.ipAddress,
            device_fingerprint: transaction.deviceFingerprint,
            action_taken: result.isFraudulent ? 'blocked' : 'flagged',
        });

        // Update ML model (async)
        await redis.lpush('fraud_training_queue', JSON.stringify({
            transaction,
            result,
            timestamp: new Date().toISOString(),
        }));
    }

    /**
     * Notify admin
     */
    async notifyAdmin(transaction) {
        const { Notification } = require('../../models');
        const admins = await User.findAll({
            where: { role: 'admin', is_active: true },
        });

        for (const admin of admins) {
            await Notification.create({
                user_id: admin.id,
                type: 'security_alert',
                title: '🚨 Fraud Detected!',
                message: `Transaction blocked. User: ${transaction.userId}. Risk Score: ${transaction.riskScore}. Reason: ${transaction.flags.join(', ')}`,
                data: {
                    transaction_id: transaction.id,
                    user_id: transaction.userId,
                    risk_score: transaction.riskScore,
                    flags: transaction.flags,
                },
                action_url: `/admin/fraud/${transaction.id}`,
                action_label: 'Review',
                channel: ['in_app', 'email'],
            });
        }
    }

    /**
     * Get fraud statistics
     */
    async getFraudStats() {
        const stats = await sequelize.query(`
            SELECT 
                COUNT(*) as total_fraud_cases,
                COUNT(CASE WHEN resolved THEN 1 END) as resolved_cases,
                AVG(risk_score) as avg_risk_score,
                COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_cases,
                COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_cases,
                COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_cases,
                COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_cases
            FROM fraud_logs
            WHERE created_at > NOW() - INTERVAL '30 days'
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        const topTypes = await sequelize.query(`
            SELECT type, COUNT(*) as count
            FROM fraud_logs
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY type
            ORDER BY count DESC
            LIMIT 5
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        return {
            ...stats[0],
            topTypes,
        };
    }

    /**
     * Review fraud case
     */
    async reviewFraudCase(fraudId, reviewerId, resolution, notes) {
        const fraudLog = await FraudLog.findByPk(fraudId);

        if (!fraudLog) {
            throw new Error('Fraud case not found');
        }

        const resolved = await fraudLog.resolve(notes, resolution, reviewerId);

        // If resolution is 'block', block the user
        if (resolution === 'user_banned') {
            await User.update(
                { is_active: false },
                { where: { id: fraudLog.user_id } }
            );
        }

        logger.info(`Fraud case ${fraudId} reviewed by ${reviewerId}: ${resolution}`);

        return resolved;
    }
}

module.exports = new FraudDetectionService();