// backend/src/utils/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

winston.addColors(colors);

// Define format
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Define transports
const transports = [
    // Console transport
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.simple(),
        ),
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    }),
];

// File transports in production
if (process.env.NODE_ENV === 'production') {
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880,
            maxFiles: 5,
        })
    );
}

// Create logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels,
    format,
    transports,
    exitOnError: false,
});

// Stream for morgan
const stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};

// Request logging middleware
const logRequest = (req, res, next) => {
    const start = Date.now();

    // Log on response finish
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.id,
        };

        if (res.statusCode >= 400) {
            logger.error('Request failed', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    next();
};

module.exports = {
    logger,
    stream,
    logRequest,
};