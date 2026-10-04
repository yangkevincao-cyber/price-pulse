// backend/src/config/database.js
const { Sequelize } = require('sequelize');
const { logger } = require('./logger');

// Database configuration
const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'pricepulse',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
    pool: {
        max: 20,
        min: 2,
        acquire: 30000,
        idle: 10000,
    },
    define: {
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
        paranoid: true,
    },
    dialectOptions: {
        ssl: process.env.DB_SSL === 'true' ? {
            require: true,
            rejectUnauthorized: false,
        } : false,
        statement_timeout: 30000,
        query_timeout: 30000,
    },
    retry: {
        match: [
            /SequelizeConnectionError/,
            /SequelizeConnectionRefusedError/,
            /SequelizeHostNotFoundError/,
            /SequelizeHostNotReachableError/,
            /SequelizeInvalidConnectionError/,
            /SequelizeConnectionTimedOutError/,
        ],
        max: 5,
    },
};

// Create Sequelize instance
const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
);

// Test connection
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        logger.info('✅ Database connection established successfully');
        return true;
    } catch (error) {
        logger.error('❌ Database connection failed:', error);
        return false;
    }
};

// Database health check
const healthCheck = async () => {
    try {
        await sequelize.query('SELECT 1');
        return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
        logger.error('Database health check failed:', error);
        return { status: 'unhealthy', error: error.message };
    }
};

// Export
module.exports = {
    sequelize,
    Sequelize,
    testConnection,
    healthCheck,
    config,
};