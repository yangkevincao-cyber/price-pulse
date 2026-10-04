// backend/src/config/auth.js
const jwt = require('jsonwebtoken');
const { redis } = require('./redis');
const { logger } = require('./logger');

/**
 * Authentication Configuration
 * Handles JWT generation, verification, and token management
 */
class AuthConfig {
    constructor() {
        this.secret = process.env.JWT_SECRET;
        this.refreshSecret = process.env.JWT_REFRESH_SECRET;
        this.expiresIn = process.env.JWT_EXPIRES_IN || '7d';
        this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
        this.algorithm = 'HS256';
        this.issuer = 'pricepulse-api';
        this.audience = 'pricepulse-users';

        // Validate secrets
        if (!this.secret || this.secret === 'your_super_secret_jwt_key_change_this') {
            throw new Error('JWT_SECRET must be set in environment variables');
        }
        if (!this.refreshSecret || this.refreshSecret === 'your_refresh_secret_key') {
            throw new Error('JWT_REFRESH_SECRET must be set in environment variables');
        }
    }

    /**
     * Generate Access Token
     */
    generateAccessToken(payload) {
        try {
            const token = jwt.sign(
                {
                    ...payload,
                    type: 'access',
                },
                this.secret,
                {
                    expiresIn: this.expiresIn,
                    algorithm: this.algorithm,
                    issuer: this.issuer,
                    audience: this.audience,
                }
            );

            // Store token metadata in Redis for tracking
            this.storeTokenMetadata(token, payload.id, 'access');

            return token;
        } catch (error) {
            logger.error('Access token generation failed:', error);
            throw new Error('Failed to generate access token');
        }
    }

    /**
     * Generate Refresh Token
     */
    generateRefreshToken(payload) {
        try {
            const token = jwt.sign(
                {
                    ...payload,
                    type: 'refresh',
                },
                this.refreshSecret,
                {
                    expiresIn: this.refreshExpiresIn,
                    algorithm: this.algorithm,
                    issuer: this.issuer,
                    audience: this.audience,
                }
            );

            // Store refresh token in Redis
            this.storeTokenMetadata(token, payload.id, 'refresh');

            return token;
        } catch (error) {
            logger.error('Refresh token generation failed:', error);
            throw new Error('Failed to generate refresh token');
        }
    }

    /**
     * Generate both tokens
     */
    generateTokens(user) {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            username: user.username,
        };

        return {
            accessToken: this.generateAccessToken(payload),
            refreshToken: this.generateRefreshToken(payload),
            expiresIn: this.expiresIn,
            tokenType: 'Bearer',
        };
    }

    /**
     * Verify Access Token
     */
    verifyAccessToken(token) {
        try {
            const decoded = jwt.verify(token, this.secret, {
                algorithms: [this.algorithm],
                issuer: this.issuer,
                audience: this.audience,
            });

            // Check if token is blacklisted
            return this.isTokenBlacklisted(token).then(isBlacklisted => {
                if (isBlacklisted) {
                    throw new Error('Token has been revoked');
                }
                return decoded;
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token expired');
            }
            if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            }
            throw error;
        }
    }

    /**
     * Verify Refresh Token
     */
    verifyRefreshToken(token) {
        try {
            const decoded = jwt.verify(token, this.refreshSecret, {
                algorithms: [this.algorithm],
                issuer: this.issuer,
                audience: this.audience,
            });

            return this.isTokenBlacklisted(token).then(isBlacklisted => {
                if (isBlacklisted) {
                    throw new Error('Refresh token has been revoked');
                }
                return decoded;
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Refresh token expired');
            }
            if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid refresh token');
            }
            throw error;
        }
    }

    /**
     * Store token metadata in Redis
     */
    async storeTokenMetadata(token, userId, type) {
        try {
            const key = `token:${type}:${token}`;
            const metadata = {
                userId,
                type,
                createdAt: new Date().toISOString(),
                ip: 'pending', // Will be set during request
            };

            // Store with expiry matching token expiry
            const expiry = type === 'access'
                ? this.getExpirySeconds(this.expiresIn)
                : this.getExpirySeconds(this.refreshExpiresIn);

            await redis.setex(key, expiry, JSON.stringify(metadata));

            // Add to user's token list for easy revocation
            await redis.sadd(`user:tokens:${userId}:${type}`, token);
            await redis.expire(`user:tokens:${userId}:${type}`, expiry);

        } catch (error) {
            logger.error('Failed to store token metadata:', error);
            // Don't throw - this is non-critical
        }
    }

    /**
     * Blacklist a token
     */
    async blacklistToken(token, type = 'access') {
        try {
            // Get token metadata
            const key = `token:${type}:${token}`;
            const metadata = await redis.get(key);

            if (metadata) {
                const parsed = JSON.parse(metadata);
                const expiry = type === 'access'
                    ? this.getExpirySeconds(this.expiresIn)
                    : this.getExpirySeconds(this.refreshExpiresIn);

                // Add to blacklist with same expiry
                await redis.setex(`blacklist:${token}`, expiry, JSON.stringify({
                    ...parsed,
                    blacklistedAt: new Date().toISOString(),
                    reason: 'manual_revocation',
                }));

                // Remove from user's token list
                await redis.srem(`user:tokens:${parsed.userId}:${type}`, token);

                // Delete original token metadata
                await redis.del(key);
            }

            return true;
        } catch (error) {
            logger.error('Failed to blacklist token:', error);
            return false;
        }
    }

    /**
     * Check if token is blacklisted
     */
    async isTokenBlacklisted(token) {
        try {
            const result = await redis.get(`blacklist:${token}`);
            return !!result;
        } catch (error) {
            logger.error('Failed to check blacklist:', error);
            return false;
        }
    }

    /**
     * Revoke all tokens for a user
     */
    async revokeAllUserTokens(userId) {
        try {
            // Get all access tokens
            const accessTokens = await redis.smembers(`user:tokens:${userId}:access`);
            const refreshTokens = await redis.smembers(`user:tokens:${userId}:refresh`);

            // Blacklist all tokens
            for (const token of accessTokens) {
                await this.blacklistToken(token, 'access');
            }
            for (const token of refreshTokens) {
                await this.blacklistToken(token, 'refresh');
            }

            // Delete user token lists
            await redis.del(`user:tokens:${userId}:access`);
            await redis.del(`user:tokens:${userId}:refresh`);

            return true;
        } catch (error) {
            logger.error('Failed to revoke user tokens:', error);
            return false;
        }
    }

    /**
     * Refresh token pair
     */
    async refreshTokens(refreshToken) {
        try {
            // Verify refresh token
            const decoded = await this.verifyRefreshToken(refreshToken);

            // Get user from database
            const { User } = require('../models');
            const user = await User.findByPk(decoded.id);

            if (!user || !user.is_active) {
                throw new Error('User not found or inactive');
            }

            // Blacklist old refresh token
            await this.blacklistToken(refreshToken, 'refresh');

            // Generate new tokens
            return this.generateTokens(user);

        } catch (error) {
            logger.error('Token refresh failed:', error);
            throw error;
        }
    }

    /**
     * Helper: Convert expiry string to seconds
     */
    getExpirySeconds(expiryStr) {
        const unit = expiryStr.slice(-1);
        const value = parseInt(expiryStr.slice(0, -1));

        switch (unit) {
            case 'd': return value * 24 * 60 * 60;
            case 'h': return value * 60 * 60;
            case 'm': return value * 60;
            case 's': return value;
            default: return 3600; // 1 hour default
        }
    }

    /**
     * Decode token without verification (for debugging)
     */
    decodeToken(token) {
        try {
            return jwt.decode(token);
        } catch (error) {
            return null;
        }
    }

    /**
     * Get token expiry time
     */
    getTokenExpiry(token) {
        try {
            const decoded = jwt.decode(token);
            if (decoded && decoded.exp) {
                return new Date(decoded.exp * 1000);
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Validate password strength
     */
    validatePassword(password) {
        const requirements = {
            minLength: 8,
            hasUpperCase: /[A-Z]/.test(password),
            hasLowerCase: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
        };

        const isValid = password.length >= requirements.minLength &&
            requirements.hasUpperCase &&
            requirements.hasLowerCase &&
            requirements.hasNumber &&
            requirements.hasSpecialChar;

        return {
            isValid,
            requirements,
            message: isValid
                ? 'Password is strong'
                : 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
        };
    }

    /**
     * Generate secure random token
     */
    generateSecureToken(length = 32) {
        const crypto = require('crypto');
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Hash token for storage
     */
    hashToken(token) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(token).digest('hex');
    }
}

// Export singleton instance
const authConfig = new AuthConfig();

module.exports = authConfig;