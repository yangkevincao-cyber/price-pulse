// backend/src/middleware/requestId.js
const { v4: uuidv4 } = require('uuid');

/**
 * Request ID Middleware
 * Adds a unique ID to each request for tracing
 */
const requestId = (req, res, next) => {
    const id = req.headers['x-request-id'] || uuidv4();

    req.id = id;
    res.setHeader('X-Request-ID', id);

    next();
};

module.exports = requestId;