// frontend/src/utils/performance.js
// Pure JavaScript utilities — NO JSX

/**
 * Pagination helper
 */
export const paginateQuery = async (query, params, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) FROM');
    const [dataResult, countResult] = await Promise.all([
        query(`${query} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]),
        query(countQuery, params),
    ]);

    return {
        data: dataResult.rows,
        pagination: {
            page,
            limit,
            total: parseInt(countResult.rows[0].count),
            pages: Math.ceil(countResult.rows[0].count / limit),
        },
    };
};

/**
 * CDN configuration
 */
export const configureCDN = () => ({
    images: {
        cdn: 'https://cdn.pricepulse.com',
        formats: ['webp', 'avif'],
        quality: 80,
        sizes: [300, 600, 900, 1200],
    },
    caching: {
        'static/*': { maxAge: 31536000 },
        'images/*': { maxAge: 2592000 },
        'api/*': { maxAge: 300 },
    },
});

/**
 * Database connection pool config
 */
export const poolConfig = {
    max: 20,
    min: 2,
    idle: 10000,
    acquire: 30000,
    evict: 1000,
};
