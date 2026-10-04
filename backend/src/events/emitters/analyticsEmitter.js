// backend/src/events/emitters/analyticsEmitter.js
const { logger } = require('../../config/logger');

class AnalyticsEmitter {
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
     * Emit page view event
     */
    emitPageView(userId, page, data = {}) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('analytics:page_view', {
            userId,
            page,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit product view event
     */
    emitProductView(userId, productId, data = {}) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('analytics:product_view', {
            userId,
            productId,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit search event
     */
    emitSearch(userId, query, results, data = {}) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('analytics:search', {
            userId,
            query,
            results,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit add to cart event
     */
    emitAddToCart(userId, productId, quantity, data = {}) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('analytics:add_to_cart', {
            userId,
            productId,
            quantity,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit purchase event
     */
    emitPurchase(userId, transaction, data = {}) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('analytics:purchase', {
            userId,
            transaction,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit user action event
     */
    emitUserAction(userId, action, data = {}) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('analytics:user_action', {
            userId,
            action,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit conversion event
     */
    emitConversion(userId, type, value, data = {}) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('analytics:conversion', {
            userId,
            type,
            value,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit custom event
     */
    emitCustom(userId, eventName, data = {}) {
        if (!this.emitter) {
            logger.warn('Event emitter not set');
            return;
        }

        this.emitter.emit('analytics:custom', {
            userId,
            eventName,
            data,
            timestamp: new Date().toISOString(),
        });
    }
}

module.exports = new AnalyticsEmitter();