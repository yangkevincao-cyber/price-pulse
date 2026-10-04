// backend/src/services/cache/cacheService.js
const { redis } = require('../../config/redis');
const { logger } = require('../../config/logger');

class CacheService {
    /**
     * Get cached data
     */
    async get(key) {
        try {
            const data = await redis.get(key);
            if (data) {
                logger.debug(`Cache hit: ${key}`);
                return JSON.parse(data);
            }
            logger.debug(`Cache miss: ${key}`);
            return null;
        } catch (error) {
            logger.error(`Cache get error for key ${key}:`, error);
            return null;
        }
    }

    /**
     * Set cached data
     */
    async set(key, value, ttl = 3600) {
        try {
            const serialized = JSON.stringify(value);
            if (ttl > 0) {
                await redis.setex(key, ttl, serialized);
            } else {
                await redis.set(key, serialized);
            }
            logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
            return true;
        } catch (error) {
            logger.error(`Cache set error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Delete cached data
     */
    async delete(key) {
        try {
            await redis.del(key);
            logger.debug(`Cache delete: ${key}`);
            return true;
        } catch (error) {
            logger.error(`Cache delete error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Delete by pattern
     */
    async deletePattern(pattern) {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
                logger.debug(`Cache delete pattern: ${pattern} (${keys.length} keys)`);
            }
            return keys.length;
        } catch (error) {
            logger.error(`Cache delete pattern error for ${pattern}:`, error);
            return 0;
        }
    }

    /**
     * Check if key exists
     */
    async exists(key) {
        try {
            const result = await redis.exists(key);
            return result === 1;
        } catch (error) {
            logger.error(`Cache exists error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Get TTL of key
     */
    async getTTL(key) {
        try {
            return await redis.ttl(key);
        } catch (error) {
            logger.error(`Cache TTL error for key ${key}:`, error);
            return -1;
        }
    }

    /**
     * Increment counter
     */
    async increment(key, amount = 1) {
        try {
            const result = await redis.incrby(key, amount);
            logger.debug(`Cache increment: ${key} (+${amount})`);
            return result;
        } catch (error) {
            logger.error(`Cache increment error for key ${key}:`, error);
            return null;
        }
    }

    /**
     * Get multiple keys
     */
    async getMultiple(keys) {
        try {
            const results = await redis.mget(keys);
            return results.map(data => {
                try {
                    return data ? JSON.parse(data) : null;
                } catch {
                    return null;
                }
            });
        } catch (error) {
            logger.error(`Cache get multiple error:`, error);
            return keys.map(() => null);
        }
    }

    /**
     * Set multiple keys
     */
    async setMultiple(items, ttl = 3600) {
        try {
            const pipeline = redis.pipeline();
            for (const { key, value } of items) {
                const serialized = JSON.stringify(value);
                if (ttl > 0) {
                    pipeline.setex(key, ttl, serialized);
                } else {
                    pipeline.set(key, serialized);
                }
            }
            await pipeline.exec();
            logger.debug(`Cache set multiple: ${items.length} items`);
            return true;
        } catch (error) {
            logger.error(`Cache set multiple error:`, error);
            return false;
        }
    }

    /**
     * Cache with function
     */
    async remember(key, ttl, callback) {
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }

        const data = await callback();
        await this.set(key, data, ttl);
        return data;
    }

    /**
     * Clear all cache (admin only)
     */
    async clearAll() {
        try {
            const keys = await redis.keys('*');
            if (keys.length > 0) {
                await redis.del(...keys);
                logger.info(`Cache clear all: ${keys.length} keys removed`);
            }
            return keys.length;
        } catch (error) {
            logger.error('Cache clear all error:', error);
            return 0;
        }
    }

    /**
     * Get cache stats
     */
    async getStats() {
        try {
            const keys = await redis.keys('*');
            const info = await redis.info('stats');

            return {
                totalKeys: keys.length,
                memory: info.split('\n').find(line => line.startsWith('used_memory_human'))?.split(':')[1]?.trim(),
                hits: info.split('\n').find(line => line.startsWith('keyspace_hits'))?.split(':')[1]?.trim(),
                misses: info.split('\n').find(line => line.startsWith('keyspace_misses'))?.split(':')[1]?.trim(),
                keys: keys.slice(0, 100), // First 100 keys
            };
        } catch (error) {
            logger.error('Cache stats error:', error);
            return null;
        }
    }
}

module.exports = new CacheService();