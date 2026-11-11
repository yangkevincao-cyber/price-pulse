// backend/src/routes/index.js
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const productRoutes = require('./products');
const listingRoutes = require('./listings');
const transactionRoutes = require('./transactions');
const demandAlertRoutes = require('./demandAlerts');
const exchangeRoutes = require('./exchanges');
const categoryRoutes = require('./categories');
const paymentRoutes = require('./payments');
const userRoutes = require('./users');
const adminRoutes = require('./admin');
const searchRoutes = require('./search');
const analyticsRoutes = require('./analytics');
const notificationRoutes = require('./notifications');

// Import middleware
// Health check (public)
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
    });
});

// API version
router.get('/version', (req, res) => {
    res.json({
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/listings', listingRoutes);
router.use('/transactions', transactionRoutes);
router.use('/demand-alerts', demandAlertRoutes);
router.use('/exchanges', exchangeRoutes);
router.use('/categories', categoryRoutes);
router.use('/payments', paymentRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/search', searchRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationRoutes);

// 404 handler
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path,
        method: req.method,
    });
});

module.exports = router;