// backend/src/config/redis.js
const Redis = require('ioredis');
const { logger } = require('./logger');

class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    connect() {
        if (this.client) {
            return this.client;
        }

        const config = {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                logger.warn(`Redis connection retry ${times} in ${delay}ms`);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true,
        };

        // Use URL if provided
        if (process.env.REDIS_URL) {
            this.client = new Redis(process.env.REDIS_URL, {
                retryStrategy: config.retryStrategy,
                maxRetriesPerRequest: config.maxRetriesPerRequest,
            });
        } else {
            this.client = new Redis(config);
        }

        // Event handlers
        this.client.on('connect', () => {
            this.isConnected = true;
            logger.info('🔴 Redis connected');
        });

        this.client.on('ready', () => {
            logger.info('🔴 Redis ready');
        });

        this.client.on('error', (error) => {
            this.isConnected = false;
            logger.error('🔴 Redis error:', error);
        });

        this.client.on('close', () => {
            this.isConnected = false;
            logger.warn('🔴 Redis connection closed');
        });

        this.client.on('reconnecting', () => {
            logger.warn('🔴 Redis reconnecting...');
        });

        return this.client;
    }

    getClient() {
        if (!this.client) {
            this.connect();
        }
        return this.client;
    }

    async ping() {
        try {
            const result = await this.getClient().ping();
            return result === 'PONG';
        } catch (error) {
            logger.error('Redis ping failed:', error);
            return false;
        }
    }

    async get(key) {
        try {
            const data = await this.getClient().get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error(`Redis get error for key ${key}:`, error);
            return null;
        }
    }

    async set(key, value, ttl = 3600) {
        try {
            const serialized = JSON.stringify(value);
            if (ttl > 0) {
                await this.getClient().setex(key, ttl, serialized);
            } else {
                await this.getClient().set(key, serialized);
            }
            return true;
        } catch (error) {
            logger.error(`Redis set error for key ${key}:`, error);
            return false;
        }
    }

    async delete(key) {
        try {
            await this.getClient().del(key);
            return true;
        } catch (error) {
            logger.error(`Redis delete error for key ${key}:`, error);
            return false;
        }
    }

    async deletePattern(pattern) {
        try {
            const keys = await this.getClient().keys(pattern);
            if (keys.length > 0) {
                await this.getClient().del(...keys);
            }
            return keys.length;
        } catch (error) {
            logger.error(`Redis deletePattern error for ${pattern}:`, error);
            return 0;
        }
    }

    async exists(key) {
        try {
            const result = await this.getClient().exists(key);
            return result === 1;
        } catch (error) {
            logger.error(`Redis exists error for key ${key}:`, error);
            return false;
        }
    }

    async expire(key, seconds) {
        try {
            await this.getClient().expire(key, seconds);
            return true;
        } catch (error) {
            logger.error(`Redis expire error for key ${key}:`, error);
            return false;
        }
    }

    async hset(key, field, value) {
        try {
            await this.getClient().hset(key, field, JSON.stringify(value));
            return true;
        } catch (error) {
            logger.error(`Redis hset error for key ${key}:`, error);
            return false;
        }
    }

    async hget(key, field) {
        try {
            const data = await this.getClient().hget(key, field);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error(`Redis hget error for key ${key}:`, error);
            return null;
        }
    }

    async hgetall(key) {
        try {
            const data = await this.getClient().hgetall(key);
            const result = {};
            for (const [field, value] of Object.entries(data)) {
                try {
                    result[field] = JSON.parse(value);
                } catch {
                    result[field] = value;
                }
            }
            return result;
        } catch (error) {
            logger.error(`Redis hgetall error for key ${key}:`, error);
            return {};
        }
    }

    async lpush(key, value) {
        try {
            await this.getClient().lpush(key, JSON.stringify(value));
            return true;
        } catch (error) {
            logger.error(`Redis lpush error for key ${key}:`, error);
            return false;
        }
    }

    async rpop(key) {
        try {
            const data = await this.getClient().rpop(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error(`Redis rpop error for key ${key}:`, error);
            return null;
        }
    }

    async lrange(key, start, stop) {
        try {
            const data = await this.getClient().lrange(key, start, stop);
            return data.map(item => {
                try {
                    return JSON.parse(item);
                } catch {
                    return item;
                }
            });
        } catch (error) {
            logger.error(`Redis lrange error for key ${key}:`, error);
            return [];
        }
    }

    async ltrim(key, start, stop) {
        try {
            await this.getClient().ltrim(key, start, stop);
            return true;
        } catch (error) {
            logger.error(`Redis ltrim error for key ${key}:`, error);
            return false;
        }
    }

    async sadd(key, value) {
        try {
            await this.getClient().sadd(key, JSON.stringify(value));
            return true;
        } catch (error) {
            logger.error(`Redis sadd error for key ${key}:`, error);
            return false;
        }
    }

    async srem(key, value) {
        try {
            await this.getClient().srem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            logger.error(`Redis srem error for key ${key}:`, error);
            return false;
        }
    }

    async smembers(key) {
        try {
            const data = await this.getClient().smembers(key);
            return data.map(item => {
                try {
                    return JSON.parse(item);
                } catch {
                    return item;
                }
            });
        } catch (error) {
            logger.error(`Redis smembers error for key ${key}:`, error);
            return [];
        }
    }

    async sismember(key, value) {
        try {
            const result = await this.getClient().sismember(key, JSON.stringify(value));
            return result === 1;
        } catch (error) {
            logger.error(`Redis sismember error for key ${key}:`, error);
            return false;
        }
    }

    async close() {
        if (this.client) {
            await this.client.quit();
            this.client = null;
            this.isConnected = false;
        }
    }
}

// Singleton instance
const redisClient = new RedisClient();
const redis = redisClient.connect();

module.exports = {
    redis,
    redisClient,
};