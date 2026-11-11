// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { logger } = require('../config/logger');
const { redis } = require('../config/redis');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided',
                code: 'NO_TOKEN',
            });
        }

        const token = authHeader.split(' ')[1];

        // Check if token is blacklisted
        const isBlacklisted = await redis.get(`blacklist:${token}`);
        if (isBlacklisted) {
            return res.status(401).json({
                success: false,
                error: 'Token has been revoked',
                code: 'TOKEN_REVOKED',
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from database
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password', 'verification_token', 'reset_token', 'reset_token_expiry'] },
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND',
            });
        }

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated',
                code: 'ACCOUNT_DEACTIVATED',
            });
        }

        // Attach user and token to request
        req.user = user;
        req.token = token;
        req.tokenDecoded = decoded;

        // Update last active
        await user.update({ last_active: new Date() });

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                code: 'TOKEN_EXPIRED',
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                code: 'INVALID_TOKEN',
            });
        }

        logger.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed',
            code: 'AUTH_FAILED',
        });
    }
};

/**
 * Optional Authentication
 * Tries to authenticate but continues if no token
 */
const optionalAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findByPk(decoded.id, {
                    attributes: { exclude: ['password'] },
                });

                if (user && user.is_active) {
                    req.user = user;
                    req.token = token;
                }
            } catch (error) {
                // Ignore auth errors for optional auth
            }
        }
    } catch (error) {
        // Ignore
    }
    next();
};

/**
 * Role-based Authorization
 * Checks if user has required role
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: roles,
                current: req.user.role,
            });
        }

        next();
    };
};

/**
 * Seller-only middleware
 */
const isSeller = authorize('seller', 'admin');

/**
 * Admin-only middleware
 */
const isAdmin = authorize('admin');

/**
 * Check if user owns the resource
 */
const isOwner = (model, paramName = 'id') => {
    return async (req, res, next) => {
        try {
            const resource = await model.findByPk(req.params[paramName]);

            if (!resource) {
                return res.status(404).json({
                    success: false,
                    error: 'Resource not found',
                    code: 'RESOURCE_NOT_FOUND',
                });
            }

            // Check ownership
            const userId = req.user.id;
            const resourceUserId = resource.user_id || resource.buyer_id || resource.seller_id;

            if (resourceUserId && resourceUserId !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not own this resource',
                    code: 'NOT_OWNER',
                });
            }

            // Attach resource to request
            req.resource = resource;
            next();
        } catch (error) {
            logger.error('Owner check error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to verify ownership',
                code: 'OWNERSHIP_CHECK_FAILED',
            });
        }
    };
};

/**
 * Refresh token handler
 */
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token required',
                code: 'REFRESH_TOKEN_REQUIRED',
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        // Get user
        const user = await User.findByPk(decoded.id);
        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'User not found or inactive',
                code: 'USER_INVALID',
            });
        }

        // Generate new tokens
        const accessToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Blacklist old refresh token
        await redis.setex(`blacklist:${refreshToken}`, 86400 * 30, 'revoked');

        return res.json({
            success: true,
            data: {
                accessToken,
                tokenType: 'Bearer',
                expiresIn: process.env.JWT_EXPIRES_IN || '7d',
            },
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Refresh token expired',
                code: 'REFRESH_TOKEN_EXPIRED',
            });
        }

        logger.error('Refresh token error:', error);
        return res.status(401).json({
            success: false,
            error: 'Invalid refresh token',
            code: 'INVALID_REFRESH_TOKEN',
        });
    }
};

/**
 * Logout handler
 */
const logout = async (req, res) => {
    try {
        if (req.token) {
            // Blacklist access token
            await redis.setex(`blacklist:${req.token}`, 86400, 'revoked');
        }

        // Blacklist refresh token if provided
        if (req.body.refreshToken) {
            await redis.setex(`blacklist:${req.body.refreshToken}`, 86400 * 30, 'revoked');
        }

        // Clear session
        await redis.del(`session:${req.user.id}`);

        return res.json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        logger.error('Logout error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to logout',
            code: 'LOGOUT_FAILED',
        });
    }
};

module.exports = {
    authenticate,
    optionalAuthenticate,
    authorize,
    isSeller,
    isAdmin,
    isOwner,
    refreshToken,
    logout,
};