// backend/src/events/emitters/auditEmitter.js
const { logger } = require('../../config/logger');

class AuditEmitter {
    constructor() {
        this.emitter = null;
    }

    /**
     * Set event emitter
     */
    setEmitter(emitter) {
        this.emitter = emitter;
    }

    /**
     * Emit user login event
     */
    emitUserLogin(userId, ip, userAgent) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('audit:user_login', {
            userId,
            ip,
            userAgent,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit user logout event
     */
    emitUserLogout(userId, ip) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('audit:user_logout', {
            userId,
            ip,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit user registration event
     */
    emitUserRegistration(userId, data) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('audit:user_registration', {
            userId,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit password change event
     */
    emitPasswordChange(userId, ip) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('audit:password_change', {
            userId,
            ip,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit transaction event
     */
    emitTransaction(userId, transactionId, action, data) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('audit:transaction', {
            userId,
            transactionId,
            action,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit listing event
     */
    emitListing(userId, listingId, action, data) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('audit:listing', {
            userId,
            listingId,
            action,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit admin action event
     */
    emitAdminAction(adminId, action, data) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('audit:admin_action', {
            adminId,
            action,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit security event
     */
    emitSecurity(event, userId, data) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('audit:security', {
            event,
            userId,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit system event
     */
    emitSystem(event, data) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('audit:system', {
            event,
            data,
            timestamp: new Date().toISOString(),
        });
    }
}

module.exports = new AuditEmitter();