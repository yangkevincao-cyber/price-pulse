// backend/src/events/index.js
const { logger } = require('../config/logger');
const EventEmitter = require('events');

// Import event emitters
const notificationEmitter = require('./emitters/notificationEmitter');
const analyticsEmitter = require('./emitters/analyticsEmitter');
const auditEmitter = require('./emitters/auditEmitter');

// Import event listeners
const userListeners = require('./listeners/userListeners');
const transactionListeners = require('./listeners/transactionListeners');
const alertListeners = require('./listeners/alertListeners');
const exchangeListeners = require('./listeners/exchangeListeners');

/**
 * Initialize event system
 */
const initEvents = () => {
    try {
        logger.info('Initializing event system...');

        // Create global event emitter
        const eventEmitter = new EventEmitter();
        eventEmitter.setMaxListeners(50);

        // Register all listeners
        userListeners.register(eventEmitter);
        transactionListeners.register(eventEmitter);
        alertListeners.register(eventEmitter);
        exchangeListeners.register(eventEmitter);

        // Register emitters
        notificationEmitter.setEmitter(eventEmitter);
        analyticsEmitter.setEmitter(eventEmitter);
        auditEmitter.setEmitter(eventEmitter);

        // Global error handler for events
        eventEmitter.on('error', (error) => {
            logger.error('Event error:', error);
        });

        logger.info('Event system initialized successfully');
        return { success: true, emitter: eventEmitter };
    } catch (error) {
        logger.error('Event system initialization failed:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get event emitter
 */
const getEmitter = () => {
    const { eventEmitter } = require('../../app');
    return eventEmitter;
};

module.exports = {
    initEvents,
    getEmitter,
    notificationEmitter,
    analyticsEmitter,
    auditEmitter,
};