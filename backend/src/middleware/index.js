// backend/src/middleware/index.js
const auth = require('./auth');
const validation = require('./validation');
const rateLimiter = require('./rateLimiter');
const errorHandler = require('./errorHandler');
const logger = require('./logger');
const cors = require('./cors');
const upload = require('./upload');
const cache = require('./cache');
const requestId = require('./requestId');
const fraudDetection = require('./fraudDetection');

module.exports = {
    auth,
    validation,
    rateLimiter,
    errorHandler,
    logger,
    cors,
    upload,
    cache,
    requestId,
    fraudDetection,
};