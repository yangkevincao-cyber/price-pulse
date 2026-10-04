// backend/src/middleware/fraudDetection.js
const { logger } = require('../config/logger');
const fraudDetectionService = require('../services/intelligence/fraudDetectionService');

/**
 * Fraud Detection Middleware
 * Checks transactions for fraud
 */
const fraudDetection = (req, res, next) => {
    // Skip fraud detection for GET requests
    if (req.method === 'GET') {
        return next();
    }

    // Skip for admin routes
    if (req.path.startsWith('/admin')) {
        return next();
    }

    // Skip for health checks
    if (req.path === '/health' || req.path === '/version') {
        return next();
    }

    // Collect transaction data
    const transaction = {
        userId: req.user?.id || null,
        ipAddress: req.ip || req.connection.remoteAddress,
        deviceFingerprint: req.headers['device-fingerprint'] || null,
        userAgent: req.headers['user-agent'] || null,
        amount: req.body.amount || req.body.price || 0,
        productId: req.body.productId || req.body.product_id || null,
        listingId: req.body.listingId || req.body.listing_id || null,
        title: req.body.title || null,
        description: req.body.description || null,
        paymentMethod: req.body.paymentMethod || req.body.payment_method || null,
        billingCountry: req.body.billingCountry || null,
        shippingCountry: req.body.shippingCountry || null,
    };

    // Skip if not enough data
    if (!transaction.userId || !transaction.amount) {
        return next();
    }

    // Run fraud detection
    fraudDetectionService.detectFraud(transaction)
        .then(result => {
            if (result.isFraudulent) {
                logger.warn('Fraudulent transaction blocked', {
                    userId: transaction.userId,
                    amount: transaction.amount,
                    flags: result.flags,
                    riskScore: result.riskScore,
                });

                return res.status(403).json({
                    success: false,
                    error: 'Transaction blocked due to fraud detection',
                    code: 'FRAUD_BLOCKED',
                    riskScore: result.riskScore,
                    reference: 'Contact support for resolution',
                });
            }

            // Attach fraud result to request
            req.fraudResult = result;
            next();
        })
        .catch(error => {
            logger.error('Fraud detection error:', error);
            next();
        });
};

module.exports = fraudDetection;