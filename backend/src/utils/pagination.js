// backend/src/utils/pagination.js

/**
 * Pagination Utility
 */
class Pagination {
    constructor(page = 1, limit = 20, maxLimit = 100) {
        this.page = Math.max(1, parseInt(page) || 1);
        this.limit = Math.min(maxLimit, Math.max(1, parseInt(limit) || 20));
        this.offset = (this.page - 1) * this.limit;
        this.maxLimit = maxLimit;
    }

    /**
     * Get pagination metadata
     */
    getMeta(total) {
        const totalPages = Math.ceil(total / this.limit);
        return {
            page: this.page,
            limit: this.limit,
            total,
            totalPages,
            hasNext: this.page < totalPages,
            hasPrevious: this.page > 1,
        };
    }

    /**
     * Build paginated response
     */
    buildResponse(data, total) {
        return {
            data,
            pagination: this.getMeta(total),
        };
    }

    /**
     * Get sequelize options
     */
    getSequelizeOptions() {
        return {
            limit: this.limit,
            offset: this.offset,
        };
    }

    /**
     * Get mongoose options
     */
    getMongooseOptions() {
        return {
            limit: this.limit,
            skip: this.offset,
        };
    }

    /**
     * Get knex options
     */
    getKnexOptions() {
        return {
            limit: this.limit,
            offset: this.offset,
        };
    }
}

/**
 * Create pagination instance
 */
const createPagination = (page, limit, maxLimit = 100) => {
    return new Pagination(page, limit, maxLimit);
};

/**
 * Paginate array (in-memory)
 */
const paginateArray = (array, page = 1, limit = 20) => {
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = array.slice(start, end);
    const total = array.length;
    const totalPages = Math.ceil(total / limit);

    return {
        data: paginatedData,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
        },
    };
};

/**
 * Paginate sequelize query
 */
const paginateSequelize = async (model, query, page = 1, limit = 20, options = {}) => {
    const pagination = new Pagination(page, limit);
    const { count, rows } = await model.findAndCountAll({
        ...query,
        ...pagination.getSequelizeOptions(),
        ...options,
    });

    return pagination.buildResponse(rows, count);
};

module.exports = {
    Pagination,
    createPagination,
    paginateArray,
    paginateSequelize,
};