// backend/scripts/healthCheck.js
const http = require('http');
const { sequelize } = require('../src/config/database');
const { redis } = require('../src/config/redis');

/**
 * Health Check Script
 * Checks all system components
 */
async function healthCheck() {
    const results = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {}
    };

    // Check API
    try {
        const response = await new Promise((resolve, reject) => {
            const req = http.get('http://localhost:3000/health', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve({ status: 'error', message: 'Invalid response' });
                    }
                });
            });
            req.on('error', reject);
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
        });

        results.checks.api = {
            status: response.status === 'ok' ? 'healthy' : 'unhealthy',
            response: response,
        };
    } catch (error) {
        results.checks.api = {
            status: 'unhealthy',
            error: error.message,
        };
        results.status = 'unhealthy';
    }

    // Check Database
    try {
        await sequelize.authenticate();
        results.checks.database = {
            status: 'healthy',
        };
    } catch (error) {
        results.checks.database = {
            status: 'unhealthy',
            error: error.message,
        };
        results.status = 'unhealthy';
    }

    // Check Redis
    try {
        await redis.ping();
        results.checks.redis = {
            status: 'healthy',
        };
    } catch (error) {
        results.checks.redis = {
            status: 'unhealthy',
            error: error.message,
        };
        results.status = 'unhealthy';
    }

    // Output results
    console.log(JSON.stringify(results, null, 2));

    // Exit with appropriate code
    process.exit(results.status === 'healthy' ? 0 : 1);
}

// Run health check
healthCheck();