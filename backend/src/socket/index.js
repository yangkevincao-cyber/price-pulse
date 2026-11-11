// backend/src/socket/index.js
const socketIO = require('socket.io');
const { logger } = require('../config/logger');
const authConfig = require('../config/auth');
const { User } = require('../models');
const alertHandler = require('./handlers/alertHandler');
const chatHandler = require('./handlers/chatHandler');
const notificationHandler = require('./handlers/notificationHandler');
const exchangeHandler = require('./handlers/exchangeHandler');

class SocketServer {
    constructor() {
        this.io = null;
        this.userSockets = new Map(); // userId -> Set of socketIds
        this.socketUsers = new Map(); // socketId -> userId
        this.sellerRooms = new Map(); // sellerId -> roomName
        this.isInitialized = false;
    }

    /**
     * Initialize Socket.IO server
     */
    initialize(server) {
        if (this.isInitialized) {
            logger.warn('Socket server already initialized');
            return;
        }

        this.io = socketIO(server, {
            cors: {
                origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
                credentials: true,
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling'],
            allowEIO3: true,
        });

        // Authentication middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    return next(new Error('Authentication required'));
                }

                // Verify token
                const decoded = await authConfig.verifyAccessToken(token);
                const user = await User.findByPk(decoded.id, {
                    attributes: ['id', 'username', 'email', 'role', 'is_active'],
                });

                if (!user || !user.is_active) {
                    return next(new Error('User not found or inactive'));
                }

                socket.user = user;
                next();
            } catch (error) {
                logger.error('Socket auth error:', error);
                next(new Error('Authentication failed'));
            }
        });

        // Connection handler
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });

        // Error handler
        this.io.on('error', (error) => {
            logger.error('Socket server error:', error);
        });

        this.isInitialized = true;
        logger.info('Socket.IO server initialized');
    }

    /**
     * Handle new connection
     */
    handleConnection(socket) {
        const userId = socket.user.id;
        const username = socket.user.username;

        // Store connection
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socket.id);
        this.socketUsers.set(socket.id, userId);

        // Join user room
        const userRoom = `user_${userId}`;
        socket.join(userRoom);

        // Join seller room if seller
        if (socket.user.role === 'seller') {
            const sellerRoom = `seller_${userId}`;
            socket.join(sellerRoom);
            this.sellerRooms.set(userId, sellerRoom);
        }

        // Join admin room if admin
        if (socket.user.role === 'admin') {
            socket.join('admin_room');
        }

        logger.info(`Socket connected: ${username} (${userId}) - ${socket.id}`);

        // Send initial data
        this.sendInitialData(socket);

        // Setup event handlers
        this.setupEventHandlers(socket);

        // Broadcast online status
        this.broadcastOnlineStatus(userId, true);

        // Handle disconnect
        socket.on('disconnect', () => {
            this.handleDisconnect(socket);
        });

        // Handle errors
        socket.on('error', (error) => {
            logger.error(`Socket error for ${username}:`, error);
        });
    }

    /**
     * Send initial data to client
     */
    async sendInitialData(socket) {
        try {
            // Send user data
            socket.emit('initial_data', {
                user: {
                    id: socket.user.id,
                    username: socket.user.username,
                    email: socket.user.email,
                    role: socket.user.role,
                },
                timestamp: new Date().toISOString(),
            });

            // Send notifications
            await notificationHandler.sendInitialNotifications(socket);

            // Send alerts if seller
            if (socket.user.role === 'seller') {
                await alertHandler.sendInitialAlerts(socket);
            }

            // Send unread chat messages
            await chatHandler.sendInitialMessages(socket);

            // Send pending exchange matches
            if (socket.user.role === 'seller') {
                await exchangeHandler.sendInitialMatches(socket);
            }

        } catch (error) {
            logger.error('Send initial data error:', error);
        }
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers(socket) {
        // Alert handlers
        socket.on('subscribe_alerts', () => alertHandler.subscribeAlerts(socket));
        socket.on('mark_alert_read', (data) => alertHandler.markAlertRead(socket, data));
        socket.on('mark_all_alerts_read', () => alertHandler.markAllAlertsRead(socket));

        // Chat handlers
        socket.on('join_chat', (data) => chatHandler.joinChat(socket, data));
        socket.on('leave_chat', (data) => chatHandler.leaveChat(socket, data));
        socket.on('send_message', (data) => chatHandler.sendMessage(socket, data));
        socket.on('typing', (data) => chatHandler.typing(socket, data));
        socket.on('stop_typing', (data) => chatHandler.stopTyping(socket, data));
        socket.on('mark_message_read', (data) => chatHandler.markMessageRead(socket, data));

        // Notification handlers
        socket.on('mark_notification_read', (data) => notificationHandler.markRead(socket, data));
        socket.on('mark_all_notifications_read', () => notificationHandler.markAllRead(socket));

        // Exchange handlers
        socket.on('subscribe_exchanges', () => exchangeHandler.subscribeExchanges(socket));
        socket.on('accept_exchange', (data) => exchangeHandler.acceptExchange(socket, data));
        socket.on('decline_exchange', (data) => exchangeHandler.declineExchange(socket, data));

        // Product handlers
        socket.on('subscribe_product', (data) => this.subscribeProduct(socket, data));
        socket.on('unsubscribe_product', (data) => this.unsubscribeProduct(socket, data));

        // Category handlers
        socket.on('subscribe_category', (data) => this.subscribeCategory(socket, data));
        socket.on('unsubscribe_category', (data) => this.unsubscribeCategory(socket, data));

        // Heartbeat
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: new Date().toISOString() });
        });
    }

    /**
     * Handle disconnect
     */
    handleDisconnect(socket) {
        const userId = this.socketUsers.get(socket.id);
        if (userId) {
            // Remove socket from user's set
            const userSockets = this.userSockets.get(userId);
            if (userSockets) {
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    this.userSockets.delete(userId);
                    this.sellerRooms.delete(userId);
                }
            }
            this.socketUsers.delete(socket.id);

            logger.info(`Socket disconnected: ${socket.user.username} (${userId})`);

            // Broadcast offline status if no more connections
            if (!this.userSockets.has(userId)) {
                this.broadcastOnlineStatus(userId, false);
            }
        }
    }

    /**
     * Subscribe to product updates
     */
    async subscribeProduct(socket, data) {
        const { productId } = data;
        const room = `product_${productId}`;
        socket.join(room);

        socket.productSubscriptions = socket.productSubscriptions || new Set();
        socket.productSubscriptions.add(productId);

        // Send recent price history
        const { PriceHistory } = require('../models');
        const history = await PriceHistory.findAll({
            where: { product_id: productId },
            order: [['created_at', 'DESC']],
            limit: 10,
        });

        socket.emit('product_history', {
            productId,
            history,
            timestamp: new Date().toISOString(),
        });

        logger.debug(`Product subscribed: ${productId} by ${socket.user.username}`);
    }

    /**
     * Unsubscribe from product updates
     */
    unsubscribeProduct(socket, data) {
        const { productId } = data;
        const room = `product_${productId}`;
        socket.leave(room);

        if (socket.productSubscriptions) {
            socket.productSubscriptions.delete(productId);
        }

        logger.debug(`Product unsubscribed: ${productId} by ${socket.user.username}`);
    }

    /**
     * Subscribe to category updates
     */
    subscribeCategory(socket, data) {
        const { categoryId } = data;
        const room = `category_${categoryId}`;
        socket.join(room);

        socket.categorySubscriptions = socket.categorySubscriptions || new Set();
        socket.categorySubscriptions.add(categoryId);

        logger.debug(`Category subscribed: ${categoryId} by ${socket.user.username}`);
    }

    /**
     * Unsubscribe from category updates
     */
    unsubscribeCategory(socket, data) {
        const { categoryId } = data;
        const room = `category_${categoryId}`;
        socket.leave(room);

        if (socket.categorySubscriptions) {
            socket.categorySubscriptions.delete(categoryId);
        }

        logger.debug(`Category unsubscribed: ${categoryId} by ${socket.user.username}`);
    }

    /**
     * Broadcast online status
     */
    broadcastOnlineStatus(userId, isOnline) {
        this.io.emit('user_status', {
            userId,
            isOnline,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Send notification to user
     */
    sendToUser(userId, event, data) {
        const socketIds = this.userSockets.get(userId);
        if (socketIds) {
            for (const socketId of socketIds) {
                this.io.to(socketId).emit(event, data);
            }
            return true;
        }
        return false;
    }

    /**
     * Send to room
     */
    sendToRoom(room, event, data) {
        this.io.to(room).emit(event, data);
    }

    /**
     * Send to all sellers
     */
    sendToSellers(event, data) {
        const rooms = Array.from(this.sellerRooms.values());
        for (const room of rooms) {
            this.io.to(room).emit(event, data);
        }
    }

    /**
     * Send to admins
     */
    sendToAdmins(event, data) {
        this.io.to('admin_room').emit(event, data);
    }

    /**
     * Broadcast demand alert
     */
    broadcastDemandAlert(alert) {
        // Send to specific seller
        if (alert.user_id) {
            this.sendToUser(alert.user_id, 'new_demand_alert', alert);
        }

        // Also broadcast to all sellers if high opportunity
        if (alert.opportunity_score > 0.8) {
            this.sendToSellers('high_opportunity_alert', alert);
        }
    }

    /**
     * Broadcast price update
     */
    broadcastPriceUpdate(productId, priceData) {
        const room = `product_${productId}`;
        this.sendToRoom(room, 'price_update', {
            productId,
            ...priceData,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Get connected users
     */
    getConnectedUsers() {
        return Array.from(this.userSockets.keys());
    }

    /**
     * Check if user is online
     */
    isUserOnline(userId) {
        return this.userSockets.has(userId);
    }

    /**
     * Get connection stats
     */
    getStats() {
        return {
            totalConnections: this.userSockets.size,
            totalSockets: this.socketUsers.size,
            totalSellers: this.sellerRooms.size,
            users: Array.from(this.userSockets.keys()),
            rooms: Array.from(this.io.sockets.adapter.rooms.keys()),
        };
    }

    /**
     * Close Socket.IO server
     */
    close() {
        if (this.io) {
            this.io.close();
            this.isInitialized = false;
            this.userSockets.clear();
            this.socketUsers.clear();
            this.sellerRooms.clear();
            logger.info('Socket.IO server closed');
        }
    }

    /**
     * Get Socket.IO instance
     */
    getIO() {
        return this.io;
    }
}

// Singleton instance
const socketServer = new SocketServer();

module.exports = socketServer;