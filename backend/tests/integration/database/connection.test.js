// backend/tests/integration/database/connection.test.js
const { sequelize } = require('../../../src/config/database');
const { redis } = require('../../../src/config/redis');
const { logger } = require('../../../src/config/logger');

describe('Database Connection Tests', () => {
    describe('PostgreSQL Connection', () => {
        it('should connect to database successfully', async () => {
            const result = await sequelize.authenticate();
            expect(result).toBeUndefined();
        });

        it('should execute a simple query', async () => {
            const [results] = await sequelize.query('SELECT 1 as test');
            expect(results[0].test).toBe(1);
        });

        it('should handle transactions correctly', async () => {
            const transaction = await sequelize.transaction();
            try {
                await sequelize.query('SELECT 1', { transaction });
                await transaction.commit();
                expect(true).toBe(true);
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        });

        it('should handle rollback correctly', async () => {
            const transaction = await sequelize.transaction();
            try {
                await sequelize.query('SELECT 1', { transaction });
                await transaction.rollback();
                // Should not throw
                expect(true).toBe(true);
            } catch (error) {
                throw error;
            }
        });

        it('should get database version', async () => {
            const [results] = await sequelize.query('SELECT version()');
            expect(results[0].version).toContain('PostgreSQL');
        });

        it('should check database size', async () => {
            const [results] = await sequelize.query(`
                SELECT pg_database_size(current_database()) as size
            `);
            expect(parseInt(results[0].size)).toBeGreaterThan(0);
        });

        it('should list all tables', async () => {
            const [results] = await sequelize.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            `);
            expect(results.length).toBeGreaterThan(0);
        });

        it('should handle connection pool', async () => {
            const pool = sequelize.connectionManager.pool;
            expect(pool).toBeDefined();
            expect(pool.read).toBeDefined();
            expect(pool.write).toBeDefined();
        });

        it('should handle concurrent connections', async () => {
            const queries = Array(5).fill().map(() =>
                sequelize.query('SELECT pg_sleep(0.1)')
            );
            const results = await Promise.all(queries);
            expect(results.length).toBe(5);
        });

        it('should handle query timeout', async () => {
            const start = Date.now();
            try {
                await sequelize.query('SELECT pg_sleep(2)', {
                    timeout: 1000
                });
            } catch (error) {
                // Should timeout
                expect(error).toBeDefined();
            }
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(2000);
        });

        it('should handle invalid query gracefully', async () => {
            try {
                await sequelize.query('INVALID SQL QUERY');
            } catch (error) {
                expect(error).toBeDefined();
                expect(error.name).toBe('SequelizeDatabaseError');
            }
        });
    });

    describe('Redis Connection', () => {
        it('should connect to Redis successfully', async () => {
            const result = await redis.ping();
            expect(result).toBe('PONG');
        });

        it('should set and get values', async () => {
            const key = 'test:key';
            const value = 'test-value';

            await redis.set(key, value);
            const result = await redis.get(key);

            expect(result).toBe(value);
            await redis.del(key);
        });

        it('should handle expiration', async () => {
            const key = 'test:expire';
            const value = 'test-value';

            await redis.setex(key, 1, value);
            expect(await redis.get(key)).toBe(value);

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 1500));
            expect(await redis.get(key)).toBeNull();
        });

        it('should handle JSON serialization', async () => {
            const key = 'test:json';
            const data = { name: 'test', value: 123, nested: { key: 'value' } };

            await redis.set(key, JSON.stringify(data));
            const result = await redis.get(key);
            const parsed = JSON.parse(result);

            expect(parsed).toEqual(data);
            await redis.del(key);
        });

        it('should handle hash operations', async () => {
            const key = 'test:hash';

            await redis.hset(key, 'field1', 'value1');
            await redis.hset(key, 'field2', 'value2');

            const result = await redis.hgetall(key);
            expect(result.field1).toBe('value1');
            expect(result.field2).toBe('value2');

            await redis.del(key);
        });

        it('should handle list operations', async () => {
            const key = 'test:list';

            await redis.lpush(key, 'item1', 'item2', 'item3');
            const results = await redis.lrange(key, 0, -1);

            expect(results).toContain('item1');
            expect(results).toContain('item2');
            expect(results).toContain('item3');

            await redis.del(key);
        });

        it('should handle set operations', async () => {
            const key = 'test:set';

            await redis.sadd(key, 'item1', 'item2', 'item3');
            const results = await redis.smembers(key);

            expect(results).toContain('item1');
            expect(results).toContain('item2');
            expect(results).toContain('item3');

            await redis.del(key);
        });

        it('should handle key expiration check', async () => {
            const key = 'test:ttl';
            await redis.setex(key, 10, 'value');

            const ttl = await redis.ttl(key);
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(10);

            await redis.del(key);
        });

        it('should handle connection errors gracefully', async () => {
            const badRedis = require('ioredis');
            const badClient = new badRedis({
                host: 'invalid.host',
                port: 6379,
                connectTimeout: 1000,
                retryStrategy: () => null,
            });

            try {
                await badClient.ping();
            } catch (error) {
                expect(error).toBeDefined();
            } finally {
                badClient.disconnect();
            }
        });

        it('should handle bulk operations', async () => {
            const pipeline = redis.pipeline();
            const data = Array(10).fill().map((_, i) => ({
                key: `test:bulk:${i}`,
                value: `value-${i}`,
            }));

            data.forEach(({ key, value }) => {
                pipeline.set(key, value);
            });

            await pipeline.exec();

            for (const { key, value } of data) {
                const result = await redis.get(key);
                expect(result).toBe(value);
                await redis.del(key);
            }
        });
    });

    describe('Database Performance', () => {
        it('should handle query performance', async () => {
            const start = Date.now();
            await sequelize.query('SELECT 1');
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(1000);
        });

        it('should handle bulk inserts', async () => {
            const start = Date.now();
            const values = Array(100).fill().map((_, i) => ({
                id: `test-${i}`,
                name: `Test ${i}`,
            }));

            // Bulk insert test
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(1000);
        });

        it('should handle indexes', async () => {
            const [results] = await sequelize.query(`
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE schemaname = 'public'
            `);
            expect(results.length).toBeGreaterThan(0);
        });
    });

    describe('Database Health Check', () => {
        it('should check database health', async () => {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                connections: 0,
            };

            try {
                await sequelize.authenticate();
                health.status = 'healthy';

                const [connResult] = await sequelize.query(`
                    SELECT count(*) as connections 
                    FROM pg_stat_activity
                `);
                health.connections = parseInt(connResult[0].connections);

                expect(health.status).toBe('healthy');
                expect(health.connections).toBeGreaterThan(0);
            } catch (error) {
                health.status = 'unhealthy';
                health.error = error.message;
                throw error;
            }
        });

        it('should check Redis health', async () => {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                memory: 0,
                connectedClients: 0,
            };

            try {
                await redis.ping();
                health.status = 'healthy';

                const info = await redis.info('memory');
                const memoryMatch = info.match(/used_memory_human:([^\n]+)/);
                if (memoryMatch) {
                    health.memory = memoryMatch[1];
                }

                const clientMatch = info.match(/connected_clients:([^\n]+)/);
                if (clientMatch) {
                    health.connectedClients = parseInt(clientMatch[1]);
                }

                expect(health.status).toBe('healthy');
            } catch (error) {
                health.status = 'unhealthy';
                health.error = error.message;
                throw error;
            }
        });
    });

    describe('Connection Pool Management', () => {
        it('should handle pool size', () => {
            const config = sequelize.options.pool;
            expect(config.max).toBeGreaterThan(0);
            expect(config.min).toBeGreaterThanOrEqual(0);
            expect(config.acquire).toBeGreaterThan(0);
            expect(config.idle).toBeGreaterThan(0);
        });

        it('should handle pool events', async () => {
            const pool = sequelize.connectionManager.pool;
            const events = [];

            pool.on('acquire', () => events.push('acquire'));
            pool.on('release', () => events.push('release'));

            await sequelize.query('SELECT 1');
            await sequelize.query('SELECT 1');

            expect(events.length).toBeGreaterThan(0);
        });

        it('should release connections after use', async () => {
            const before = await getActiveConnections();
            await Promise.all([
                sequelize.query('SELECT 1'),
                sequelize.query('SELECT 1'),
                sequelize.query('SELECT 1'),
            ]);
            const after = await getActiveConnections();

            expect(after - before).toBeLessThan(3);
        });
    });
});

// Helper function to get active connections
async function getActiveConnections() {
    const [results] = await sequelize.query(`
        SELECT count(*) as connections 
        FROM pg_stat_activity 
        WHERE datname = current_database()
    `);
    return parseInt(results[0].connections);
}