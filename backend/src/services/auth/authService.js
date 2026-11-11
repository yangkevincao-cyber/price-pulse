// backend/src/services/auth/authService.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, Listing, Transaction } = require('../../models');
const authConfig = require('../../config/auth');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');
const { sequelize } = require('../src/config/database');
const { emailService } = require('../notification/emailService');

class AuthService {
    /**
     * Register a new user
     */
    async register(userData) {
        const { email, username, password, firstName, lastName, role } = userData;

        // Check if user exists
        const existingUser = await User.findOne({
            where: {
                [sequelize.Op.or]: [
                    { email: email.toLowerCase() },
                    { username: username.toLowerCase() }
                ]
            }
        });

        if (existingUser) {
            throw new Error('User already exists with this email or username');
        }

        // Validate password strength
        const passwordValidation = authConfig.validatePassword(password);
        if (!passwordValidation.isValid) {
            throw new Error(passwordValidation.message);
        }

        // Create user
        const user = await User.create({
            email: email.toLowerCase(),
            username: username.toLowerCase(),
            password,
            first_name: firstName,
            last_name: lastName,
            role: role || 'buyer',
            verification_token: authConfig.generateSecureToken(),
        });

        // Generate tokens
        const tokens = authConfig.generateTokens(user);

        // Send welcome email
        await emailService.sendWelcomeEmail(user);

        // Log registration
        logger.info(`New user registered: ${user.email} (${user.id})`);

        return {
            user: user.toJSON(),
            tokens,
        };
    }

    /**
     * Login user
     */
    async login(email, password, ipAddress, userAgent) {
        // Find user
        const user = await User.findOne({
            where: { email: email.toLowerCase() },
        });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        if (!user.is_active) {
            throw new Error('Account is deactivated');
        }

        // Verify password
        const isValid = await user.comparePassword(password);
        if (!isValid) {
            // Track failed login attempts
            await this.trackFailedLogin(user.id, ipAddress);
            throw new Error('Invalid credentials');
        }

        // Reset failed login attempts
        await this.resetFailedLogins(user.id);

        // Generate tokens
        const tokens = authConfig.generateTokens(user);

        // Update last login
        await user.update({
            last_active: new Date(),
        });

        // Store session in Redis
        await this.storeSession(user.id, tokens.accessToken, ipAddress, userAgent);

        logger.info(`User logged in: ${user.email} (${user.id})`);

        return {
            user: user.toJSON(),
            tokens,
        };
    }

    /**
     * Social login (Google, Facebook, etc.)
     */
    async socialLogin(provider, profile, ipAddress, userAgent) {
        // Find or create user based on social provider
        let user = await User.findOne({
            where: {
                [sequelize.Op.or]: [
                    { email: profile.email },
                    { [`social_providers.${provider}.id`]: profile.id }
                ]
            }
        });

        if (!user) {
            // Create new user
            user = await User.create({
                email: profile.email,
                username: profile.email.split('@')[0] + '_' + crypto.randomBytes(4).toString('hex'),
                first_name: profile.firstName || profile.displayName.split(' ')[0],
                last_name: profile.lastName || profile.displayName.split(' ').slice(1).join(' '),
                password: crypto.randomBytes(32).toString('hex'),
                is_verified: profile.email_verified || false,
                social_providers: {
                    [provider]: {
                        id: profile.id,
                        email: profile.email,
                        name: profile.displayName,
                        picture: profile.picture,
                    }
                }
            });
        } else {
            // Update social provider info
            const socialProviders = user.social_providers || {};
            socialProviders[provider] = {
                id: profile.id,
                email: profile.email,
                name: profile.displayName,
                picture: profile.picture,
            };
            await user.update({ social_providers: socialProviders });
        }

        // Generate tokens
        const tokens = authConfig.generateTokens(user);

        // Store session
        await this.storeSession(user.id, tokens.accessToken, ipAddress, userAgent);

        logger.info(`User logged in via ${provider}: ${user.email} (${user.id})`);

        return {
            user: user.toJSON(),
            tokens,
        };
    }

    /**
     * Verify email
     */
    async verifyEmail(token) {
        const user = await User.findOne({
            where: { verification_token: token },
        });

        if (!user) {
            throw new Error('Invalid verification token');
        }

        if (user.email_verified) {
            throw new Error('Email already verified');
        }

        await user.update({
            email_verified: true,
            email_verified_at: new Date(),
            verification_token: null,
        });

        logger.info(`Email verified for user: ${user.email} (${user.id})`);

        return user;
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(email) {
        const user = await User.findOne({
            where: { email: email.toLowerCase() },
        });

        if (!user) {
            // Don't reveal if user exists
            return { message: 'If an account exists, a reset link has been sent' };
        }

        // Generate reset token
        const resetToken = authConfig.generateSecureToken();
        const hashedToken = authConfig.hashToken(resetToken);

        await user.update({
            reset_token: hashedToken,
            reset_token_expiry: new Date(Date.now() + 3600000), // 1 hour
        });

        // Send reset email
        await emailService.sendPasswordResetEmail(user, resetToken);

        logger.info(`Password reset requested for: ${user.email} (${user.id})`);

        return { message: 'Password reset link sent to your email' };
    }

    /**
     * Reset password
     */
    async resetPassword(token, newPassword) {
        const hashedToken = authConfig.hashToken(token);

        const user = await User.findOne({
            where: {
                reset_token: hashedToken,
                reset_token_expiry: { [sequelize.Op.gt]: new Date() },
            },
        });

        if (!user) {
            throw new Error('Invalid or expired reset token');
        }

        // Validate new password
        const passwordValidation = authConfig.validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            throw new Error(passwordValidation.message);
        }

        // Update password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(newPassword, salt);

        await user.update({
            password: hashedPassword,
            reset_token: null,
            reset_token_expiry: null,
        });

        // Revoke all existing tokens
        await authConfig.revokeAllUserTokens(user.id);

        logger.info(`Password reset for user: ${user.email} (${user.id})`);

        return { message: 'Password reset successful' };
    }

    /**
     * Change password (authenticated)
     */
    async changePassword(userId, currentPassword, newPassword) {
        const user = await User.findByPk(userId);

        if (!user) {
            throw new Error('User not found');
        }

        // Verify current password
        const isValid = await user.comparePassword(currentPassword);
        if (!isValid) {
            throw new Error('Current password is incorrect');
        }

        // Validate new password
        const passwordValidation = authConfig.validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            throw new Error(passwordValidation.message);
        }

        // Update password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(newPassword, salt);

        await user.update({ password: hashedPassword });

        // Revoke all other sessions (optional)
        // await authConfig.revokeAllUserTokens(user.id);

        logger.info(`Password changed for user: ${user.email} (${user.id})`);

        return { message: 'Password changed successfully' };
    }

    /**
     * Track failed login attempts
     */
    async trackFailedLogin(userId, ipAddress) {
        const key = `failed_login:${userId}`;
        const attempts = await redis.incr(key);
        await redis.expire(key, 3600);

        logger.warn(`Failed login attempt for user ${userId}`, {
            userId,
            ipAddress,
            attempts,
        });

        if (attempts >= 5) {
            await User.update(
                { is_active: false },
                { where: { id: userId } }
            );
            logger.warn(`Account locked for user ${userId} after ${attempts} failed attempts`, {
                userId,
                ipAddress,
            });
        }

        return attempts;
    }

    /**
     * Reset failed login attempts
     */
    async resetFailedLogins(userId) {
        await redis.del(`failed_login:${userId}`);
    }

    /**
     * Store user session in Redis
     */
    async storeSession(userId, token, ipAddress, userAgent) {
        const key = `session:${userId}`;
        await redis.hset(key, 'token', token);
        await redis.hset(key, 'ip', ipAddress);
        await redis.hset(key, 'userAgent', userAgent);
        await redis.hset(key, 'lastActive', new Date().toISOString());
        await redis.expire(key, 86400); // 24 hours
    }

    /**
     * Get user session
     */
    async getSession(userId) {
        const key = `session:${userId}`;
        return redis.hgetall(key);
    }

    /**
     * Logout (clear session)
     */
    async logout(userId, token) {
        // Blacklist token
        await authConfig.blacklistToken(token, 'access');

        // Clear session
        await redis.del(`session:${userId}`);

        logger.info(`User logged out: ${userId}`);

        return { message: 'Logged out successfully' };
    }

    /**
     * Refresh tokens
     */
    async refreshTokens(refreshToken) {
        return authConfig.refreshTokens(refreshToken);
    }

    /**
     * Get current user profile
     */
    async getProfile(userId) {
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password', 'verification_token', 'reset_token', 'reset_token_expiry'] },
            include: [
                {
                    model: Listing,
                    as: 'listings',
                    where: { status: 'active' },
                    required: false,
                    limit: 10,
                },
                {
                    model: Transaction,
                    as: 'purchases',
                    where: { status: 'completed' },
                    required: false,
                    limit: 10,
                },
                {
                    model: Transaction,
                    as: 'sales',
                    where: { status: 'completed' },
                    required: false,
                    limit: 10,
                },
            ],
        });

        if (!user) {
            throw new Error('User not found');
        }

        return user;
    }

    /**
     * Update user profile
     */
    async updateProfile(userId, updateData) {
        const user = await User.findByPk(userId);

        if (!user) {
            throw new Error('User not found');
        }

        // Remove sensitive fields
        const allowedFields = [
            'first_name', 'last_name', 'bio', 'phone',
            'location_country', 'location_city', 'location_lat', 'location_lng',
            'avatar', 'preferences'
        ];

        const filteredData = {};
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                filteredData[field] = updateData[field];
            }
        }

        await user.update(filteredData);

        logger.info(`Profile updated for user: ${user.id}`);

        return user;
    }

    /**
     * Deactivate account
     */
    async deactivateAccount(userId) {
        const user = await User.findByPk(userId);

        if (!user) {
            throw new Error('User not found');
        }

        await user.update({
            is_active: false,
        });

        // Revoke all tokens
        await authConfig.revokeAllUserTokens(userId);

        logger.info(`Account deactivated: ${user.id}`);

        return { message: 'Account deactivated successfully' };
    }

    /**
     * Delete account (hard delete)
     */
    async deleteAccount(userId) {
        const user = await User.findByPk(userId);

        if (!user) {
            throw new Error('User not found');
        }

        // Revoke all tokens
        await authConfig.revokeAllUserTokens(userId);

        // Delete user (paranoid)
        await user.destroy();

        logger.info(`Account deleted: ${userId}`);

        return { message: 'Account deleted successfully' };
    }
}

module.exports = new AuthService();