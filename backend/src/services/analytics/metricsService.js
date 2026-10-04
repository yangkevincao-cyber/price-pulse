// backend/src/services/analytics/metricsService.js
const { sequelize } = require('../../config/database');
const { redis } = require('../../config/redis');
const { logger } = require('../../config/logger');

class MetricsService {
    /**
     * Collect system metrics
     */
    async collectMetrics() {
        const metrics = {
            timestamp: new Date().toISOString(),
            system: await this.getSystemMetrics(),
            database: await this.getDatabaseMetrics(),
            redis: await this.getRedisMetrics(),
            application: await this.getApplicationMetrics(),
            business: await this.getBusinessMetrics(),
        };

        // Store in Redis for real-time access
        await redis.setex('metrics:latest', 60, JSON.stringify(metrics));

        // Store historical data
        await this.storeHistoricalMetrics(metrics);

        return metrics;
    }

    /**
     * Get system metrics
     */
    async getSystemMetrics() {
        const os = require('os');
        const cpuUsage = os.loadavg()[0];
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        return {
            cpu: {
                loadAverage: cpuUsage,
                cores: os.cpus().length,
            },
            memory: {
                total: totalMem,
                used: usedMem,
                free: freeMem,
                usagePercentage: (usedMem / totalMem * 100).toFixed(2),
            },
            uptime: process.uptime(),
            platform: os.platform(),
            nodeVersion: process.version,
        };
    }

    /**
     * Get database metrics
     */
    async getDatabaseMetrics() {
        try {
            const [dbStats] = await sequelize.query(`
                SELECT 
                    pg_database_size(current_database()) as size,
                    (SELECT count(*) FROM pg_stat_activity) as connections,
                    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
            `);

            return {
                size: parseInt(dbStats.size),
                sizeFormatted: this.formatBytes(dbStats.size),
                connections: parseInt(dbStats.connections),
                activeConnections: parseInt(dbStats.active_connections),
                status: 'healthy',
            };
        } catch (error) {
            logger.error('Database metrics error:', error);
            return {
                status: 'error',
                error: error.message,
            };
        }
    }

    /**
     * Get Redis metrics
     */
    async getRedisMetrics() {
        try {
            const info = await redis.info();
            const memory = info.split('\n').find(line => line.startsWith('used_memory_human'))?.split(':')[1]?.trim();
            const hits = parseInt(info.split('\n').find(line => line.startsWith('keyspace_hits'))?.split(':')[1] || 0);
            const misses = parseInt(info.split('\n').find(line => line.startsWith('keyspace_misses'))?.split(':')[1] || 0);
            const totalKeys = await redis.dbsize();

            return {
                memory: memory || '0',
                hits,
                misses,
                hitRate: hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(2) : 0,
                totalKeys,
                status: 'healthy',
            };
        } catch (error) {
            logger.error('Redis metrics error:', error);
            return {
                status: 'error',
                error: error.message,
            };
        }
    }

    /**
     * Get application metrics
     */
    async getApplicationMetrics() {
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();

        return {
            uptime: uptime,
            uptimeFormatted: this.formatUptime(uptime),
            memory: {
                rss: memoryUsage.rss,
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed,
                external: memoryUsage.external,
            },
            requests: await this.getRequestStats(),
        };
    }

    /**
     * Get business metrics
     */
    async getBusinessMetrics() {
        const metrics = await sequelize.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
                (SELECT COUNT(*) FROM users WHERE role = 'seller' AND is_active = true) as total_sellers,
                (SELECT COUNT(*) FROM users WHERE last_active > NOW() - INTERVAL '24 hours') as active_users_24h,
                (SELECT COUNT(*) FROM listings WHERE status = 'active' AND available_quantity > 0) as active_listings,
                (SELECT COUNT(*) FROM transactions WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as daily_transactions,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as daily_volume,
                (SELECT COUNT(*) FROM demand_alerts WHERE created_at > NOW() - INTERVAL '24 hours') as daily_alerts,
                (SELECT COALESCE(AVG(amount), 0) FROM transactions WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as avg_order_value,
                (SELECT COUNT(*) FROM products WHERE created_at > NOW() - INTERVAL '24 hours') as new_products_24h
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        return metrics[0];
    }

    /**
     * Get request statistics
     */
    async getRequestStats() {
        const stats = await redis.hgetall('request:stats');
        return {
            total: parseInt(stats.total) || 0,
            success: parseInt(stats.success) || 0,
            error: parseInt(stats.error) || 0,
            avgResponseTime: parseInt(stats.avgResponseTime) || 0,
        };
    }

    /**
     * Track request
     */
    async trackRequest(status, responseTime) {
        await redis.hincrby('request:stats', 'total', 1);
        if (status < 400) {
            await redis.hincrby('request:stats', 'success', 1);
        } else {
            await redis.hincrby('request:stats', 'error', 1);
        }

        // Track average response time
        const currentAvg = parseInt(await redis.hget('request:stats', 'avgResponseTime')) || 0;
        const total = parseInt(await redis.hget('request:stats', 'total')) || 1;
        const newAvg = ((currentAvg * (total - 1)) + responseTime) / total;
        await redis.hset('request:stats', 'avgResponseTime', Math.round(newAvg));
    }

    /**
     * Store historical metrics
     */
    async storeHistoricalMetrics(metrics) {
        try {
            await sequelize.query(`
                INSERT INTO metrics_history (
                    timestamp, cpu_load, memory_usage, db_size, 
                    redis_memory, active_users, active_listings, 
                    daily_transactions, daily_volume
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, {
                bind: [
                    metrics.timestamp,
                    metrics.system.cpu.loadAverage,
                    metrics.system.memory.usagePercentage,
                    metrics.database.size || 0,
                    metrics.redis.memory || '0',
                    metrics.business.active_users_24h || 0,
                    metrics.business.active_listings || 0,
                    metrics.business.daily_transactions || 0,
                    metrics.business.daily_volume || 0,
                ],
            });
        } catch (error) {
            logger.error('Store historical metrics error:', error);
        }
    }

    /**
     * Get historical metrics
     */
    async getHistoricalMetrics(days = 7) {
        const metrics = await sequelize.query(`
            SELECT 
                timestamp,
                cpu_load,
                memory_usage,
                db_size,
                redis_memory,
                active_users,
                active_listings,
                daily_transactions,
                daily_volume
            FROM metrics_history
            WHERE timestamp > NOW() - INTERVAL '${days} days'
            ORDER BY timestamp ASC
        `, {
            type: sequelize.QueryTypes.SELECT,
        });

        return metrics;
    }

    /**
     * Format bytes to human-readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format uptime
     */
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        parts.push(`${secs}s`);

        return parts.join(' ');
    }
}

module.exports = new MetricsService();