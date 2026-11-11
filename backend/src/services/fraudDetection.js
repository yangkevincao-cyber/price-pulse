// backend/src/services/fraudDetection.js
const db = require('../config/database');
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

class FraudDetectionService {

    constructor() {
        this.fraudRules = {
            priceAnomaly: { threshold: 3, window: 24 }, // 3x standard deviation
            rapidTransactions: { maxPerHour: 10, window: 60 },
            suspiciousKeywords: ['free', 'hack', 'bitcoin', 'wallet'],
            ipReputation: true,
            deviceFingerprinting: true,
            velocityChecking: true
        };
    }

    // Main fraud detection pipeline
    async detectFraud(transaction) {
        const checks = await Promise.all([
            this.checkPriceAnomaly(transaction),
            this.checkVelocity(transaction),
            this.checkUserReputation(transaction),
            this.checkIPReputation(transaction),
            this.checkDeviceFingerprint(transaction),
            this.checkKeywordFlags(transaction),
            this.checkPaymentRisk(transaction),
            this.checkUnusualPattern(transaction)
        ]);

        const riskScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
        const flags = checks.filter(c => c.flagged).map(c => c.reason);

        const result = {
            isFraudulent: riskScore > 0.7,
            riskScore: riskScore,
            flags: flags,
            recommendations: this.generateRecommendations(riskScore, flags),
            requiresReview: riskScore > 0.4 && riskScore <= 0.7
        };

        // Log for ML training
        await this.logFraudDetection(transaction, result);

        if (result.isFraudulent) {
            await this.blockTransaction(transaction);
        }

        return result;
    }

    async checkPriceAnomaly(transaction) {
        const stats = await db.query(`
            SELECT 
                AVG(price) as avg_price,
                STDDEV(price) as stddev_price
            FROM listings
            WHERE product_id = $1
                AND status = 'sold'
                AND sold_at > NOW() - INTERVAL '30 days'
        `, [transaction.productId]);

        if (!stats.rows[0].avg_price) {
            return { score: 0, flagged: false };
        }

        const zScore = Math.abs(
            (transaction.amount - stats.rows[0].avg_price) / stats.rows[0].stddev_price
        );

        if (zScore > this.fraudRules.priceAnomaly.threshold) {
            return {
                score: Math.min(zScore / 10, 1),
                flagged: true,
                reason: `Price anomaly: ${zScore.toFixed(2)} standard deviations from mean`
            };
        }

        return { score: zScore / 10, flagged: false };
    }

    async checkVelocity(transaction) {
        const userTransactions = await db.query(`
            SELECT COUNT(*) as count
            FROM transactions
            WHERE (buyer_id = $1 OR seller_id = $1)
                AND completed_at > NOW() - INTERVAL '1 hour'
        `, [transaction.userId]);

        const rate = userTransactions.rows[0].count;

        if (rate > this.fraudRules.rapidTransactions.maxPerHour) {
            return {
                score: Math.min(rate / 20, 1),
                flagged: true,
                reason: `Rapid transactions: ${rate} in last hour`
            };
        }

        return { score: rate / 20, flagged: false };
    }

    async checkUserReputation(transaction) {
        const user = await db.query(`
            SELECT 
                seller_rating,
                total_sales,
                reports_count,
                account_age_days
            FROM users
            WHERE id = $1
        `, [transaction.userId]);

        if (!user.rows.length) {
            return { score: 0.5, flagged: true, reason: 'Unknown user' };
        }

        let score = 0;
        const flags = [];

        if (user.rows[0].seller_rating < 2) {
            score += 0.3;
            flags.push('Low seller rating');
        }

        if (user.rows[0].total_sales < 5 && user.rows[0].account_age_days < 30) {
            score += 0.2;
            flags.push('New account with few sales');
        }

        if (user.rows[0].reports_count > 3) {
            score += 0.4;
            flags.push('Multiple user reports');
        }

        return {
            score: Math.min(score, 1),
            flagged: score > 0.4,
            reason: flags.join(', ')
        };
    }

    async checkIPReputation(transaction) {
        const ip = transaction.ipAddress;

        // Check against known bad IPs in Redis
        const isBlacklisted = await redis.sismember('blacklisted_ips', ip);
        if (isBlacklisted) {
            return {
                score: 1,
                flagged: true,
                reason: 'IP address blacklisted'
            };
        }

        // Check for multiple accounts from same IP
        const accountsFromIP = await db.query(`
            SELECT COUNT(DISTINCT user_id) as count
            FROM user_sessions
            WHERE ip_address = $1
                AND created_at > NOW() - INTERVAL '24 hours'
        `, [ip]);

        if (accountsFromIP.rows[0].count > 5) {
            return {
                score: 0.7,
                flagged: true,
                reason: `Too many accounts from same IP: ${accountsFromIP.rows[0].count}`
            };
        }

        // Check geolocation mismatch
        const userLocation = await db.query(
            'SELECT location_country FROM users WHERE id = $1',
            [transaction.userId]
        );

        const ipLocation = await this.getIPLocation(ip);

        if (userLocation.rows[0]?.location_country !== ipLocation.country) {
            return {
                score: 0.5,
                flagged: true,
                reason: 'IP location mismatch with user profile'
            };
        }

        return { score: 0, flagged: false };
    }

    async checkDeviceFingerprint(transaction) {
        const fingerprint = transaction.deviceFingerprint;

        if (!fingerprint) return { score: 0, flagged: false };

        // Check for device switching
        const previousDevices = await db.query(`
            SELECT COUNT(DISTINCT device_fingerprint) as count
            FROM user_sessions
            WHERE user_id = $1
                AND created_at > NOW() - INTERVAL '7 days'
        `, [transaction.userId]);

        if (previousDevices.rows[0].count > 3) {
            return {
                score: 0.4,
                flagged: true,
                reason: 'Multiple devices used recently'
            };
        }

        return { score: 0, flagged: false };
    }

    async checkKeywordFlags(transaction) {
        const { title, description } = transaction;
        const text = `${title} ${description}`.toLowerCase();

        const foundKeywords = this.fraudRules.suspiciousKeywords.filter(
            keyword => text.includes(keyword)
        );

        if (foundKeywords.length > 0) {
            return {
                score: Math.min(foundKeywords.length / 3, 1),
                flagged: true,
                reason: `Suspicious keywords: ${foundKeywords.join(', ')}`
            };
        }

        return { score: 0, flagged: false };
    }

    async checkPaymentRisk(transaction) {
        const { cardBrand, paymentMethod, billingCountry, shippingCountry } = transaction;

        let score = 0;
        const flags = [];

        // High-risk card types
        if (cardBrand === 'prepaid' || cardBrand === 'gift') {
            score += 0.3;
            flags.push('Prepaid/gift card detected');
        }

        // High-risk payment methods
        if (paymentMethod === 'cryptocurrency') {
            score += 0.4;
            flags.push('Cryptocurrency payment');
        }

        // Country mismatch
        if (billingCountry !== shippingCountry) {
            score += 0.2;
            flags.push('Billing and shipping country mismatch');
        }

        return {
            score: Math.min(score, 1),
            flagged: score > 0.4,
            reason: flags.join(', ')
        };
    }

    async checkUnusualPattern(transaction) {
        // Check for unusual time of day
        const hour = new Date().getHours();
        const userHistory = await db.query(`
            SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
            FROM transactions
            WHERE user_id = $1
            GROUP BY EXTRACT(HOUR FROM created_at)
        `, [transaction.userId]);

        const userTypicalHours = userHistory.rows.map(r => parseInt(r.hour));
        if (!userTypicalHours.includes(hour) && userTypicalHours.length > 0) {
            return {
                score: 0.3,
                flagged: true,
                reason: 'Transaction at unusual time for this user'
            };
        }

        return { score: 0, flagged: false };
    }

    generateRecommendations(riskScore) {
        if (riskScore > 0.8) {
            return ['BLOCK_TRANSACTION', 'FLAG_USER', 'NOTIFY_ADMIN'];
        } else if (riskScore > 0.5) {
            return ['HOLD_FOR_REVIEW', 'REQUEST_ADDITIONAL_VERIFICATION'];
        } else if (riskScore > 0.3) {
            return ['MONITOR_FUTURE_TRANSACTIONS'];
        }
        return ['ALLOW_TRANSACTION'];
    }

    async blockTransaction(transaction) {
        await db.query(`
            UPDATE transactions 
            SET status = 'blocked',
                fraud_risk_score = $1,
                fraud_flags = $2,
                blocked_at = NOW()
            WHERE id = $3
        `, [transaction.riskScore, transaction.flags, transaction.id]);

        // Notify admin
        await this.notifyAdmin({
            type: 'FRAUD_ALERT',
            transaction: transaction,
            riskScore: transaction.riskScore,
            flags: transaction.flags
        });
    }

    async logFraudDetection(transaction, result) {
        await db.query(`
            INSERT INTO fraud_detection_logs (
                transaction_id, user_id, risk_score, flags, 
                recommendations, created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
            transaction.id, transaction.userId, result.riskScore,
            result.flags, result.recommendations
        ]);

        // Update ML model (async)
        await this.updateMLModel(transaction, result);
    }

    async getIPLocation(ip) {
        // Use IP geolocation service (ipapi.co, ipinfo.io, etc.)
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await response.json();
        return {
            country: data.countryCode,
            city: data.city,
            lat: data.lat,
            lon: data.lon
        };
    }

    async updateMLModel(transaction, result) {
        // Queue for batch ML model update
        await redis.lpush('fraud_training_queue', JSON.stringify({
            transaction,
            result,
            timestamp: new Date()
        }));
    }

    async notifyAdmin(alert) {
        await db.query(`
            INSERT INTO admin_alerts (
                type, severity, message, data, created_at
            ) VALUES ($1, 'high', $2, $3, NOW())
        `, [alert.type, `Fraud detected: ${alert.flags.join(', ')}`, JSON.stringify(alert)]);
    }
}

// Middleware for API routes
const fraudMiddleware = async (req, res, next) => {
    const fraudService = new FraudDetectionService();

    const transaction = {
        id: req.body.transactionId,
        userId: req.user.id,
        amount: req.body.amount,
        productId: req.body.productId,
        title: req.body.title,
        description: req.body.description,
        ipAddress: req.ip,
        deviceFingerprint: req.headers['device-fingerprint'],
        cardBrand: req.body.cardBrand,
        paymentMethod: req.body.paymentMethod,
        billingCountry: req.body.billingCountry,
        shippingCountry: req.body.shippingCountry
    };

    const result = await fraudService.detectFraud(transaction);

    if (result.isFraudulent) {
        return res.status(403).json({
            error: 'Transaction blocked due to fraud detection',
            riskScore: result.riskScore,
            reference: 'Contact support for resolution'
        });
    }

    req.fraudResult = result;
    next();
};

module.exports = { FraudDetectionService, fraudMiddleware };