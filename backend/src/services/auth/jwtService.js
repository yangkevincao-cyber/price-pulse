// backend/src/services/auth/jwtService.js
const jwt = require('jsonwebtoken');
const { redis } = require('../../config/redis');
const { logger } = require('../../config/logger');

class JWTService {
    constructor() {
        this.secret = process.env.JWT_SECRET;
        this.refreshSecret = process.env.JWT_REFRESH_SECRET;
        this.expiresIn = process.env.JWT_EXPIRES_IN || '7d';
        this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
    }

    /**
     * Generate access token
     */
    generateToken(payload) {
        try {
            const token = jwt.sign(
                payload,
                this.secret,
                {
                    expiresIn: this.expiresIn,
                    algorithm: 'HS256',
                    issuer: 'pricepulse-api',
                    audience: 'pricepulse-users',
                }
            );

            return token;
        } catch (error) {
            logger.error('Token generation failed:', error);
            throw new Error('Failed to generate token');
        }
    }

    /**
     * Generate refresh token
     */
    generateRefreshToken(payload) {
        try {
            const token = jwt.sign(
                payload,
                this.refreshSecret,
                {
                    expiresIn: this.refreshExpiresIn,
                    algorithm: 'HS256',
                    issuer: 'pricepulse-api',
                    audience: 'pricepulse-users',
                }
            );

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
            accessToken: this.generateToken(payload),
            refreshToken: this.generateRefreshToken(payload),
            expiresIn: this.expiresIn,
            tokenType: 'Bearer',
        };
    }

    /**
     * Verify access token
     */
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.secret, {
                algorithms: ['HS256'],
                issuer: 'pricepulse-api',
                audience: 'pricepulse-users',
            });
            return decoded;
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
     * Verify refresh token
     */
    verifyRefreshToken(token) {
        try {
            const decoded = jwt.verify(token, this.refreshSecret, {
                algorithms: ['HS256'],
                issuer: 'pricepulse-api',
                audience: 'pricepulse-users',
            });
            return decoded;
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
     * Decode token (without verification)
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
     * Check if token is expired
     */
    isTokenExpired(token) {
        const expiry = this.getTokenExpiry(token);
        if (!expiry) return true;
        return expiry < new Date();
    }

    /**
     * Blacklist token
     */
    async blacklistToken(token, type = 'access') {
        try {
            const expiry = this.getTokenExpiry(token);
            if (!expiry) return false;

            const ttl = Math.floor((expiry - new Date()) / 1000);
            if (ttl > 0) {
                await redis.setex(`blacklist:${token}`, ttl, JSON.stringify({
                    type,
                    blacklistedAt: new Date().toISOString(),
                }));
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Token blacklist failed:', error);
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
            logger.error('Token blacklist check failed:', error);
            return false;
        }
    }

    /**
     * Refresh token pair
     */
    async refreshTokens(refreshToken) {
        try {
            // Verify refresh token
            const decoded = this.verifyRefreshToken(refreshToken);

            // Get user
            const { User } = require('../../models');
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
}

module.exports = new JWTService();