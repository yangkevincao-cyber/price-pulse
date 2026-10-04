// backend/src/controllers/authController.js
const authService = require('../services/auth/authService');
const { logger } = require('../config/logger');
const { validationResult } = require('express-validator');

class AuthController {
    /**
     * Register a new user
     */
    async register(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array(),
                });
            }

            const { email, username, password, firstName, lastName, role } = req.body;

            const result = await authService.register({
                email,
                username,
                password,
                firstName,
                lastName,
                role,
            });

            return res.status(201).json({
                success: true,
                message: 'Registration successful. Please verify your email.',
                data: result,
            });
        } catch (error) {
            logger.error('Registration error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Login user
     */
    async login(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array(),
                });
            }

            const { email, password } = req.body;
            const ipAddress = req.ip || req.connection.remoteAddress;
            const userAgent = req.headers['user-agent'];

            const result = await authService.login(email, password, ipAddress, userAgent);

            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            logger.error('Login error:', error);
            return res.status(401).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Social login (Google, Facebook, etc.)
     */
    async socialLogin(req, res) {
        try {
            const { provider, accessToken } = req.body;
            const ipAddress = req.ip || req.connection.remoteAddress;
            const userAgent = req.headers['user-agent'];

            // Verify social token and get user profile
            const profile = await this.verifySocialToken(provider, accessToken);

            const result = await authService.socialLogin(provider, profile, ipAddress, userAgent);

            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            logger.error('Social login error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Verify social token
     */
    async verifySocialToken(provider, token) {
        // Implementation for Google, Facebook, etc.
        // This would call the respective OAuth APIs
        throw new Error('Social login provider not implemented');
    }

    /**
     * Refresh token
     */
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    error: 'Refresh token required',
                });
            }

            const tokens = await authService.refreshTokens(refreshToken);

            return res.json({
                success: true,
                data: tokens,
            });
        } catch (error) {
            logger.error('Refresh token error:', error);
            return res.status(401).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Logout user
     */
    async logout(req, res) {
        try {
            await authService.logout(req.user.id, req.token);

            return res.json({
                success: true,
                message: 'Logged out successfully',
            });
        } catch (error) {
            logger.error('Logout error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to logout',
            });
        }
    }

    /**
     * Verify email
     */
    async verifyEmail(req, res) {
        try {
            const { token } = req.params;
            const user = await authService.verifyEmail(token);

            return res.json({
                success: true,
                message: 'Email verified successfully',
                data: { user },
            });
        } catch (error) {
            logger.error('Email verification error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Resend verification email
     */
    async resendVerification(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email required',
                });
            }

            // Logic to resend verification email
            await authService.resendVerification(email);

            return res.json({
                success: true,
                message: 'Verification email sent',
            });
        } catch (error) {
            logger.error('Resend verification error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email required',
                });
            }

            const result = await authService.requestPasswordReset(email);

            return res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Password reset request error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Reset password
     */
    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;

            if (!token || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Token and new password required',
                });
            }

            const result = await authService.resetPassword(token, newPassword);

            return res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Password reset error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Change password (authenticated)
     */
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Current password and new password required',
                });
            }

            const result = await authService.changePassword(
                req.user.id,
                currentPassword,
                newPassword
            );

            return res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Change password error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Get current user profile
     */
    async getProfile(req, res) {
        try {
            const user = await authService.getProfile(req.user.id);

            return res.json({
                success: true,
                data: { user },
            });
        } catch (error) {
            logger.error('Get profile error:', error);
            return res.status(404).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(req, res) {
        try {
            const user = await authService.updateProfile(req.user.id, req.body);

            return res.json({
                success: true,
                message: 'Profile updated successfully',
                data: { user },
            });
        } catch (error) {
            logger.error('Update profile error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Deactivate account
     */
    async deactivateAccount(req, res) {
        try {
            const result = await authService.deactivateAccount(req.user.id);

            return res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Deactivate account error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Delete account
     */
    async deleteAccount(req, res) {
        try {
            const result = await authService.deleteAccount(req.user.id);

            return res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Delete account error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Revoke all tokens
     */
    async revokeAllTokens(req, res) {
        try {
            await authService.revokeAllTokens(req.user.id);

            return res.json({
                success: true,
                message: 'All tokens revoked successfully',
            });
        } catch (error) {
            logger.error('Revoke tokens error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to revoke tokens',
            });
        }
    }

    /**
     * Check authentication status
     */
    async checkAuth(req, res) {
        try {
            const user = await authService.getProfile(req.user.id);

            return res.json({
                success: true,
                authenticated: true,
                data: { user },
            });
        } catch (error) {
            return res.json({
                success: true,
                authenticated: false,
            });
        }
    }
}

module.exports = new AuthController();