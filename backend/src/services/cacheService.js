// backend/src/services/cacheService.js
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

class CacheService {

    constructor() {
        this.defaultTTL = 3600; // 1 hour
        this.productTTL = 1800; // 30 minutes for product data
        this.priceTTL = 300; // 5 minutes for price data
        this.userTTL = 7200; // 2 hours for user sessions
    }

    // Generic cache get/set
    async get(key) {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    }

    async set(key, value, ttl = this.defaultTTL) {
        await redis.setex(key, ttl, JSON.stringify(value));
    }

    async delete(key) {
        await redis.del(key);
    }

    async deletePattern(pattern) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    }

    // Product caching
    async getProduct(productId) {
        const cacheKey = `product:${productId}`;
        let product = await this.get(cacheKey);

        if (!product) {
            product = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
            if (product.rows[0]) {
                await this.set(cacheKey, product.rows[0], this.productTTL);
            }
        }

        return product;
    }

    async invalidateProduct(productId) {
        await this.delete(`product:${productId}`);
        await this.deletePattern(`products:list:*`);
    }

    // Price caching
    async getProductPrices(productId) {
        const cacheKey = `prices:${productId}`;
        let prices = await this.get(cacheKey);

        if (!prices) {
            prices = await db.query(`
                SELECT * FROM external_prices 
                WHERE product_id = $1 
                ORDER BY scraped_at DESC 
                LIMIT 10
            `, [productId]);
            await this.set(cacheKey, prices.rows, this.priceTTL);
        }

        return prices;
    }

    // User session caching
    async getUserSession(userId) {
        const cacheKey = `session:${userId}`;
        let session = await this.get(cacheKey);

        if (!session) {
            session = await db.query(
                'SELECT * FROM user_sessions WHERE user_id = $1 AND active = true',
                [userId]
            );
            if (session.rows[0]) {
                await this.set(cacheKey, session.rows[0], this.userTTL);
            }
        }

        return session;
    }

    // Demand alerts caching (critical for performance)
    async getDemandAlerts(sellerId, limit = 20) {
        const cacheKey = `alerts:${sellerId}:${limit}`;
        let alerts = await this.get(cacheKey);

        if (!alerts) {
            alerts = await db.query(`
                SELECT * FROM demand_alerts 
                WHERE seller_id = $1 
                ORDER BY created_at DESC 
                LIMIT $2
            `, [sellerId, limit]);
            await this.set(cacheKey, alerts.rows, 600); // 10 minutes
        }

        return alerts;
    }

    // Trending products caching
    async getTrendingProducts() {
        let trending = await this.get('trending:products');

        if (!trending) {
            trending = await db.query(`
                SELECT 
                    p.*,
                    COUNT(DISTINCT sq.id) as search_count_24h,
                    p.demand_score
                FROM products p
                LEFT JOIN search_queries sq ON sq.query_text ILIKE '%' || p.name || '%'
                    AND sq.created_at > NOW() - INTERVAL '24 hours'
                WHERE p.demand_score > 0.6
                GROUP BY p.id
                ORDER BY p.demand_score DESC
                LIMIT 50
            `);
            await this.set('trending:products', trending.rows, 1800); // 30 minutes
        }

        return trending;
    }
}

// Query optimization with indexes
const createOptimizedIndexes = async () => {
    await db.query(`
        -- Composite indexes for common queries
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_status_price 
        ON listings(status, price) WHERE status = 'active';
        
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_queries_product_date 
        ON search_queries(product_id, created_at DESC);
        
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prices_product_date 
        ON external_prices(product_id, scraped_at DESC);
        
        -- Partial indexes for active data only
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_listings_seller 
        ON listings(seller_id) WHERE status = 'active';
        
        -- GiST index for geolocation queries
        CREATE EXTENSION IF NOT EXISTS postgis;
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_location 
        ON users USING GIST (geolocation);
        
        -- Covering indexes for frequent queries
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_demand_alerts_seller_unread_covering 
        ON demand_alerts(seller_id, read) INCLUDE (product_name, demand_score, created_at)
        WHERE read = false;
    `);
};

// Pagination optimization
const paginatedQuery = async (query, params, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) FROM');

    const [dataResult, countResult] = await Promise.all([
        db.query(`${query} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]),
        db.query(countQuery, params)
    ]);

    return {
        data: dataResult.rows,
        pagination: {
            page,
            limit,
            total: parseInt(countResult.rows[0].count),
            pages: Math.ceil(countResult.rows[0].count / limit)
        }
    };
};

// CDN configuration for static assets
const configureCDN = () => {
    return {
        images: {
            cdn: 'https://cdn.pricepulse.com',
            formats: ['webp', 'avif'],
            quality: 80,
            sizes: [300, 600, 900, 1200]
        },
        caching: {
            'static/*': { maxAge: 31536000 }, // 1 year
            'images/*': { maxAge: 2592000 }, // 30 days
            'api/*': { maxAge: 300 } // 5 minutes
        },
        compression: {
            gzip: true,
            brotli: true,
            minSize: 1024 // 1KB
        }
    };
};

// Database connection pooling
const poolConfig = {
    max: 20, // Maximum pool size
    min: 2, // Minimum pool size
    idle: 10000, // Close idle connections after 10 seconds
    acquire: 30000, // Acquire timeout
    evict: 1000 // Eviction interval
};

// Batch processing for bulk operations
class BatchProcessor {
    constructor(batchSize = 100, interval = 5000) {
        this.batchSize = batchSize;
        this.interval = interval;
        this.queue = [];
        this.timer = null;
    }

    add(item) {
        this.queue.push(item);
        if (this.queue.length >= this.batchSize) {
            this.process();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this.process(), this.interval);
        }
    }

    async process() {
        if (this.queue.length === 0) return;

        const batch = this.queue.splice(0, this.batchSize);
        clearTimeout(this.timer);
        this.timer = null;

        // Process batch in transaction
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            for (const item of batch) {
                await client.query(item.query, item.params);
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Batch processing error:', error);
        } finally {
            client.release();
        }
    }
}

module.exports = { CacheService, paginatedQuery, configureCDN, poolConfig, BatchProcessor };