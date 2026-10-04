// backend/tests/setup.js
const { sequelize } = require('../src/config/database');
const { redis } = require('../src/config/redis');
const { logger } = require('../src/config/logger');

// Suppress logs during tests
logger.transports.forEach((t) => (t.silent = true));

beforeAll(async () => {
    // Connect to test database
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
});

afterAll(async () => {
    // Clean up
    await sequelize.close();
    await redis.quit();
});

// Global test timeout
jest.setTimeout(30000);