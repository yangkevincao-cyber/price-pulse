// backend/src/events/listeners/alertListeners.js
const { logger } = require('../../config/logger');
const { Product } = require('../../models');
const notificationEmitter = require('../emitters/notificationEmitter');
const analyticsEmitter = require('../emitters/analyticsEmitter');

class AlertListeners {
    /**
     * Register alert event listeners
     */
    register(emitter) {
        // Alert generated
        emitter.on('alert:generated', this.handleAlertGenerated.bind(this));

        // Alert clicked
        emitter.on('alert:clicked', this.handleAlertClicked.bind(this));

        // Alert read
        emitter.on('alert:read', this.handleAlertRead.bind(this));

        // Alert dismissed
        emitter.on('alert:dismissed', this.handleAlertDismissed.bind(this));

        // Price alert triggered
        emitter.on('alert:price_triggered', this.handlePriceAlertTriggered.bind(this));

        logger.info('Alert listeners registered');
    }

    /**
     * Handle alert generated
     */
    async handleAlertGenerated(data) {
        try {
            const { alert, userId } = data;

            // Send notification
            await notificationEmitter.emitDemandAlert(userId, alert);

            // Track analytics
            await analyticsEmitter.emitUserAction(userId, 'alert_generated', {
                alertId: alert.id,
                productId: alert.product_id,
                opportunityScore: alert.opportunity_score,
            });

            logger.info(`Alert generated: ${alert.id} for user ${userId}`);
        } catch (error) {
            logger.error('Alert generated event handler error:', error);
        }
    }

    /**
     * Handle alert clicked
     */
    async handleAlertClicked(data) {
        try {
            const { alert, userId } = data;

            // Update alert
            await alert.update({ clicked: true, clicked_at: new Date() });

            // Track analytics
            await analyticsEmitter.emitUserAction(userId, 'alert_clicked', {
                alertId: alert.id,
                productId: alert.product_id,
                opportunityScore: alert.opportunity_score,
            });

            logger.info(`Alert clicked: ${alert.id} by user ${userId}`);
        } catch (error) {
            logger.error('Alert clicked event handler error:', error);
        }
    }

    /**
     * Handle alert read
     */
    async handleAlertRead(data) {
        try {
            const { alert, userId } = data;

            // Update alert
            await alert.update({ read: true, read_at: new Date() });

            // Track analytics
            await analyticsEmitter.emitUserAction(userId, 'alert_read', {
                alertId: alert.id,
                productId: alert.product_id,
            });

            logger.info(`Alert read: ${alert.id} by user ${userId}`);
        } catch (error) {
            logger.error('Alert read event handler error:', error);
        }
    }

    /**
     * Handle alert dismissed
     */
    async handleAlertDismissed(data) {
        try {
            const { alert, userId } = data;

            // Update alert
            await alert.update({ dismissed: true, dismissed_at: new Date() });

            // Track analytics
            await analyticsEmitter.emitUserAction(userId, 'alert_dismissed', {
                alertId: alert.id,
                productId: alert.product_id,
            });

            logger.info(`Alert dismissed: ${alert.id} by user ${userId}`);
        } catch (error) {
            logger.error('Alert dismissed event handler error:', error);
        }
    }

    /**
     * Handle price alert triggered
     */
    async handlePriceAlertTriggered(data) {
        try {
            const { userId, productId, oldPrice, newPrice } = data;

            const product = await Product.findByPk(productId);

            if (product) {
                // Send price drop notification
                await notificationEmitter.emitPriceDrop(userId, product, oldPrice, newPrice);

                // Track analytics
                await analyticsEmitter.emitUserAction(userId, 'price_alert_triggered', {
                    productId,
                    oldPrice,
                    newPrice,
                    savings: oldPrice - newPrice,
                });

                // Update product demand score
                await product.updateDemandScore();

                logger.info(`Price alert triggered for user ${userId}: ${productId}`);
            }
        } catch (error) {
            logger.error('Price alert triggered event handler error:', error);
        }
    }
}

module.exports = new AlertListeners();