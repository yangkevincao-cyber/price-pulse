// backend/src/config/logger.js
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

// Define format for console
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:SSS' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}] ${message}`;
        if (Object.keys(meta).length > 0 && meta.stack) {
            msg += `\n${meta.stack}`;
        } else if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Define format for files (JSON)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Define transports
const transports = [];

// Console transport (always enabled)
transports.push(
    new winston.transports.Console({
        format: consoleFormat,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    })
);

// File transports
if (process.env.NODE_ENV !== 'test') {
    // Error log
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true,
        })
    );

    // Combined log
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            format: fileFormat,
            maxsize: 5242880,
            maxFiles: 5,
            tailable: true,
        })
    );

    // Access log (HTTP requests)
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'access.log'),
            level: 'http',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:SSS' }),
                winston.format.printf(({ timestamp, message }) => {
                    return `${timestamp} [HTTP] ${message}`;
                })
            ),
            maxsize: 5242880,
            maxFiles: 5,
            tailable: true,
        })
    );
}

// Create logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels,
    format: fileFormat,
    transports,
    exitOnError: false,
});

// Stream for Morgan (HTTP request logging)
const stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};

// Request logging middleware
const logRequest = (req, res, next) => {
    const start = Date.now();

    // Log request on response finish
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            requestId: req.id,
            userId: req.user?.id || null,
        };

        // Log at appropriate level
        if (res.statusCode >= 500) {
            logger.error('Request failed', logData);
        } else if (res.statusCode >= 400) {
            logger.warn('Request client error', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    next();
};

// Log rotation helper
const rotateLogs = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // Check if logs need rotation
    const files = ['access.log', 'error.log', 'combined.log'];
    for (const file of files) {
        const filePath = path.join(logDir, file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const fileDate = new Date(stats.mtime);

            // Rotate if older than 24 hours
            if (now - fileDate > 24 * 60 * 60 * 1000) {
                const rotatedPath = path.join(logDir, `${file}-${dateStr}.log`);
                fs.renameSync(filePath, rotatedPath);
                // Create new empty file
                fs.writeFileSync(filePath, '');
                logger.info(`Log rotated: ${file} -> ${rotatedPath}`);
            }
        }
    }
};

// Schedule daily log rotation
if (process.env.NODE_ENV === 'production') {
    setInterval(rotateLogs, 24 * 60 * 60 * 1000);
}

module.exports = {
    logger,
    stream,
    logRequest,
    rotateLogs,
};