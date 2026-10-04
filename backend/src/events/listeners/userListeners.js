// backend/src/events/listeners/userListeners.js
const { logger } = require('../../config/logger');
const { User } = require('../../models');
const notificationEmitter = require('../emitters/notificationEmitter');
const analyticsEmitter = require('../emitters/analyticsEmitter');
const auditEmitter = require('../emitters/auditEmitter');

class UserListeners {
    /**
     * Register user event listeners
     */
    register(emitter) {
        // User registration
        emitter.on('user:registered', this.handleUserRegistration.bind(this));

        // User login
        emitter.on('user:login', this.handleUserLogin.bind(this));

        // User logout
        emitter.on('user:logout', this.handleUserLogout.bind(this));

        // User profile update
        emitter.on('user:profile_updated', this.handleProfileUpdate.bind(this));

        // User password change
        emitter.on('user:password_changed', this.handlePasswordChange.bind(this));

        // User account deactivation
        emitter.on('user:deactivated', this.handleUserDeactivation.bind(this));

        // User account deletion
        emitter.on('user:deleted', this.handleUserDeletion.bind(this));

        // User email verification
        emitter.on('user:email_verified', this.handleEmailVerification.bind(this));

        logger.info('User listeners registered');
    }

    /**
     * Handle user registration
     */
    async handleUserRegistration(data) {
        try {
            const { userId, userData } = data;

            // Send welcome email
            await notificationEmitter.emitNotification(userId, {
                type: 'system_announcement',
                title: 'Welcome to PricePulse! 🎉',
                message: 'Welcome to the smartest marketplace on the planet!',
                action_url: '/dashboard',
                action_label: 'Go to Dashboard',
            });

            // Track analytics
            await analyticsEmitter.emitUserAction(userId, 'registration', {
                role: userData.role,
                source: userData.source || 'direct',
            });

            // Audit
            await auditEmitter.emitUserRegistration(userId, {
                email: userData.email,
                role: userData.role,
                ip: userData.ip,
            });

            logger.info(`User registered: ${userId}`);
        } catch (error) {
            logger.error('User registration event handler error:', error);
        }
    }

    /**
     * Handle user login
     */
    async handleUserLogin(data) {
        try {
            const { userId, ip, userAgent } = data;

            // Update last login
            await User.update(
                { last_login: new Date(), last_ip: ip, last_user_agent: userAgent },
                { where: { id: userId } }
            );

            // Track analytics
            await analyticsEmitter.emitUserAction(userId, 'login', {
                ip,
                userAgent,
            });

            // Audit
            await auditEmitter.emitUserLogin(userId, ip, userAgent);

            logger.info(`User logged in: ${userId}`);
        } catch (error) {
            logger.error('User login event handler error:', error);
        }
    }

    /**
     * Handle user logout
     */
    async handleUserLogout(data) {
        try {
            const { userId, ip } = data;

            // Audit
            await auditEmitter.emitUserLogout(userId, ip);

            logger.info(`User logged out: ${userId}`);
        } catch (error) {
            logger.error('User logout event handler error:', error);
        }
    }

    /**
     * Handle profile update
     */
    async handleProfileUpdate(data) {
        try {
            const { userId, updates } = data;

            // Track analytics
            await analyticsEmitter.emitUserAction(userId, 'profile_update', {
                fields: Object.keys(updates),
            });

            // Audit
            await auditEmitter.emit('audit:profile_update', {
                userId,
                updates,
                timestamp: new Date().toISOString(),
            });

            logger.info(`Profile updated for user: ${userId}`);
        } catch (error) {
            logger.error('Profile update event handler error:', error);
        }
    }

    /**
     * Handle password change
     */
    async handlePasswordChange(data) {
        try {
            const { userId, ip } = data;

            // Audit
            await auditEmitter.emitPasswordChange(userId, ip);

            // Send notification
            await notificationEmitter.emitNotification(userId, {
                type: 'security_alert',
                title: 'Password Changed',
                message: 'Your password was changed successfully. If this was not you, please contact support immediately.',
                action_url: '/settings/security',
                action_label: 'Review Security',
            });

            logger.info(`Password changed for user: ${userId}`);
        } catch (error) {
            logger.error('Password change event handler error:', error);
        }
    }

    /**
     * Handle user deactivation
     */
    async handleUserDeactivation(data) {
        try {
            const { userId, reason } = data;

            // Audit
            await auditEmitter.emitSecurity('user_deactivated', userId, { reason });

            // Send notification
            await notificationEmitter.emitNotification(userId, {
                type: 'system_announcement',
                title: 'Account Deactivated',
                message: `Your account has been deactivated. Reason: ${reason || 'Not specified'}`,
            });

            logger.info(`User deactivated: ${userId}`);
        } catch (error) {
            logger.error('User deactivation event handler error:', error);
        }
    }

    /**
     * Handle user deletion
     */
    async handleUserDeletion(data) {
        try {
            const { userId, reason } = data;

            // Audit
            await auditEmitter.emitSecurity('user_deleted', userId, { reason });

            logger.info(`User deleted: ${userId}`);
        } catch (error) {
            logger.error('User deletion event handler error:', error);
        }
    }

    /**
     * Handle email verification
     */
    async handleEmailVerification(data) {
        try {
            const { userId } = data;

            // Update user
            await User.update(
                { email_verified: true, email_verified_at: new Date() },
                { where: { id: userId } }
            );

            // Send welcome email
            await notificationEmitter.emitNotification(userId, {
                type: 'system_announcement',
                title: 'Email Verified ✅',
                message: 'Your email has been verified successfully! You can now access all features.',
                action_url: '/dashboard',
                action_label: 'Go to Dashboard',
            });

            // Track analytics
            await analyticsEmitter.emitConversion(userId, 'email_verification', 1);

            logger.info(`Email verified for user: ${userId}`);
        } catch (error) {
            logger.error('Email verification event handler error:', error);
        }
    }
}

module.exports = new UserListeners();