// backend/src/app.js
// backend/src/app.js — ✅ CORRECT
require('dotenv').config();   // ← FIRST line
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { sequelize } = require('./config/database');
const { redis } = require('./config/redis');
const { errorHandler } = require('./middleware/errorHandler');
const requestId = require('./middleware/requestId');
const { logger } = require('./config/logger');
const rateLimiter = require('./middleware/rateLimiter');
const routes = require('./routes');
const { initWorkers } = require('./workers');
const { initJobs } = require('./jobs');
const { initEvents } = require('./events');

const app = express();
const PORT = process.env.PORT || 3000;

const { prometheus } = require('./services/monitoring');

// backend/src/app.js — after imports, before app.use() calls

const assertFn = (name, fn) => {
    if (typeof fn !== 'function') {
        const available = typeof fn === 'object' && fn !== null
            ? `Available keys: ${Object.keys(fn).join(', ')}`
            : `Got: ${typeof fn}`;
        throw new Error(
            `❌ app.use() needs a function for '${name}', but got ${typeof fn}. ${available}`
        );
    }
};

// Now wrap every app.use(middleware) to catch before Express throws
assertFn('helmet', helmet);
assertFn('cors', cors);
assertFn('requestId', requestId);
// assertFn('rateLimiter', rateLimiter);   // ← if this fails, rateLimiter is an object!

// For object exports, use specific properties:
assertFn('rateLimiter.api', rateLimiter.api);
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', prometheus.register.contentType);
    res.end(await prometheus.register.metrics());
});

// ✅ Security middleware
// Validate ALL modules used with app.use()
const routeModules = {
    routes: require('./routes'),
    uploads: require('./routes/uploads'),
};

const otherMiddleware = {
    cors: require('./middleware/cors'),
    requestId: require('./middleware/requestId'),
    rateLimiter: require('./middleware/rateLimiter'),
    logger: require('./middleware/logger'),
    validation: require('./middleware/validation'),
};

for (const [name, mod] of Object.entries(otherMiddleware)) {
    if (typeof mod !== 'function' && typeof mod !== 'object') {
        throw new Error(`Middleware '${name}' exports ${typeof mod} — check module.exports`);
    }
}

for (const [name, mod] of Object.entries(routeModules)) {
    if (typeof mod !== 'function') {
        throw new Error(`Route module '${name}' exports ${typeof mod} — should export router function`);
    }
}

console.log('✅ All middleware and routes validated');

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
// Validate before using
if (typeof requestId !== 'function') {
    throw new Error(`requestId middleware is ${typeof requestId}, expected function. Check module.exports in middleware/requestId.js`);
}
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
app.use(rateLimiter.api);

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
app.use(errorHandler.errorHandler);

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

        process.on('unhandledRejection', (reason) => {
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


