// backend/src/socket/middleware/auth.js
const jwt = require('jsonwebtoken');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');
const { User } = require('../../models');

/**
 * Socket.IO Authentication Middleware
 */
const authenticate = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;

        if (!token) {
            logger.warn('Socket connection without token');
            return next(new Error('Authentication required'));
        }

        // Check if token is blacklisted
        const isBlacklisted = await redis.get(`blacklist:${token}`);
        if (isBlacklisted) {
            return next(new Error('Token has been revoked'));
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user
        const user = await User.findByPk(decoded.id, {
            attributes: ['id', 'username', 'email', 'role', 'is_active'],
        });

        if (!user) {
            return next(new Error('User not found'));
        }

        if (!user.is_active) {
            return next(new Error('User account is inactive'));
        }

        socket.user = user;
        socket.token = token;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return next(new Error('Token expired'));
        }
        if (error.name === 'JsonWebTokenError') {
            return next(new Error('Invalid token'));
        }
        logger.error('Socket auth error:', error);
        return next(new Error('Authentication failed'));
    }
};

module.exports = authenticate;