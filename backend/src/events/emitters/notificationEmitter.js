// backend/src/events/emitters/notificationEmitter.js
const { logger } = require('../../config/logger');

class NotificationEmitter {
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
     * Emit notification event
     */
    emitNotification(userId, notification) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('notification:send', {
            userId,
            notification,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit demand alert event
     */
    emitDemandAlert(userId, alert) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('notification:demand_alert', {
            userId,
            alert,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit price drop event
     */
    emitPriceDrop(userId, product, oldPrice, newPrice) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('notification:price_drop', {
            userId,
            product,
            oldPrice,
            newPrice,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit exchange match event
     */
    emitExchangeMatch(userId, match) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('notification:exchange_match', {
            userId,
            match,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit transaction update event
     */
    emitTransactionUpdate(userId, transaction, status) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('notification:transaction_update', {
            userId,
            transaction,
            status,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit bulk notification event
     */
    emitBulkNotification(users, notification) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('notification:bulk', {
            users,
            notification,
            timestamp: new Date().toISOString(),
        });
    }
}

module.exports = new NotificationEmitter();