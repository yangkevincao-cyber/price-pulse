// backend/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const { sequelize } = require('./config/database');
const { redis } = require('./config/redis');
const { errorHandler } = require('./middleware/errorHandler');
const { requestId } = require('./middleware/requestId');
const { logger } = require('./config/logger');
const { rateLimiter } = require('./middleware/rateLimiter');
const routes = require('./routes');
const { initSocket } = require('./socket');
const { initWorkers } = require('./workers');
const { initJobs } = require('./jobs');
const { initEvents } = require('./events');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https://cdn.pricepulse.com"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'", "https://fonts.googleapis.com"],
            connectSrc: ["'self'", process.env.API_URL],
        },
    },
}));

// ✅ CORS
app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ✅ Request ID middleware
app.use(requestId);

// ✅ Logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`, {
        requestId: req.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
    });
    next();
});

// ✅ Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Rate limiting
app.use(rateLimiter);

// ✅ Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ✅ Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version,
    });
});

// ✅ API routes
app.use('/api', routes);

// ✅ 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path,
    });
});

// ✅ Error handler (must be last)
app.use(errorHandler);

// ✅ Start server
async function startServer() {
    try {
        // Connect to database
        await sequelize.authenticate();
        logger.info('📦 Database connected successfully');

        // Connect to Redis
        await redis.ping();
        logger.info('🔴 Redis connected successfully');

        // Run migrations if not in production
        if (process.env.NODE_ENV !== 'production') {
            await sequelize.sync({ alter: true });
            logger.info('📝 Database sync complete');
        }

        // Start server
        const server = app.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT}`);
            logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
            logger.info(`🔗 API URL: ${process.env.API_URL || `http://localhost:${PORT}`}`);
        });

        // ✅ Initialize Socket.IO
        const io = initSocket(server);
        logger.info('🔌 WebSocket server initialized');

        // ✅ Initialize workers
        await initWorkers();
        logger.info('👷 Workers initialized');

        // ✅ Initialize cron jobs
        await initJobs();
        logger.info('⏰ Cron jobs initialized');

        // ✅ Initialize event listeners
        await initEvents();
        logger.info('📡 Event listeners initialized');

        // Graceful shutdown
        const shutdown = async () => {
            logger.info('🛑 Shutting down gracefully...');

            // Close server
            server.close(async () => {
                logger.info('📡 HTTP server closed');

                // Close database connection
                await sequelize.close();
                logger.info('📦 Database connection closed');

                // Close Redis connection
                await redis.quit();
                logger.info('🔴 Redis connection closed');

                // Close workers
                // Worker cleanup code here

                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('💥 Uncaught Exception:', error);
            shutdown();
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('💥 Unhandled Rejection:', reason);
        });

    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Only start if not in test environment
if (process.env.NODE_ENV !== 'test') {
    startServer();
}

// Export for testing
module.exports = { app, startServer };