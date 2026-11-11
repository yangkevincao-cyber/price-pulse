// backend/src/services/notification/webSocketService.js
const socketIO = require('socket.io');
const { logger } = require('../../config/logger');
const authConfig = require('../../config/auth');
const { User } = require('../../models');

class WebSocketService {
    constructor() {
        this.io = null;
        this.userSockets = new Map(); // userId -> socketId
        this.socketUsers = new Map(); // socketId -> userId
        this.sellerRooms = new Map(); // sellerId -> roomName
        this.isInitialized = false;
    }

    /**
     * Initialize WebSocket server
     */
    initialize(server) {
        if (this.isInitialized) {
            logger.warn('WebSocket already initialized');
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
        });

        // Middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    return next(new Error('Authentication required'));
                }

                const decoded = await authConfig.verifyAccessToken(token);
                const user = await User.findByPk(decoded.id, {
                    attributes: ['id', 'username', 'email', 'role'],
                });

                if (!user || !user.is_active) {
                    return next(new Error('User not found or inactive'));
                }

                socket.user = user;
                next();
            } catch (error) {
                logger.error('WebSocket auth error:', error);
                next(new Error('Authentication failed'));
            }
        });

        // Connection handler
        this.io.on('connection', this.handleConnection.bind(this));

        this.isInitialized = true;
        logger.info('WebSocket server initialized');
    }

    /**
     * Handle new connection
     */
    handleConnection(socket) {
        const userId = socket.user.id;
        const username = socket.user.username;

        // Store connection
        this.userSockets.set(userId, socket.id);
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

        logger.info(`WebSocket connected: ${username} (${userId}) - ${socket.id}`);

        // Send initial data
        this.sendInitialData(socket);

        // Setup event handlers
        this.setupEventHandlers(socket);

        // Broadcast online status
        this.broadcastOnlineStatus(userId, true);
    }

    /**
     * Send initial data to client
     */
    async sendInitialData(socket) {
        try {
            // Send notifications
            const { Notification } = require('../../models');
            const notifications = await Notification.findAll({
                where: {
                    user_id: socket.user.id,
                    read: false,
                },
                order: [['created_at', 'DESC']],
                limit: 20,
            });

            socket.emit('initial_data', {
                user: socket.user,
                notifications: notifications,
                unread_count: notifications.length,
            });

            // Send unread alerts if seller
            if (socket.user.role === 'seller') {
                const { DemandAlert } = require('../../models');
                const alerts = await DemandAlert.findAll({
                    where: {
                        user_id: socket.user.id,
                        read: false,
                    },
                    order: [['created_at', 'DESC']],
                    limit: 10,
                });

                socket.emit('initial_alerts', {
                    alerts,
                    unread_count: alerts.length,
                });
            }
        } catch (error) {
            logger.error('Send initial data error:', error);
        }
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers(socket) {
        // Subscribe to product updates
        socket.on('subscribe_product', async (productId) => {
            const room = `product_${productId}`;
            socket.join(room);

            // Store subscriptions
            socket.productSubscriptions = socket.productSubscriptions || new Set();
            socket.productSubscriptions.add(productId);

            // Send recent price history
            const { PriceHistory } = require('../../models');
            const history = await PriceHistory.findAll({
                where: { product_id: productId },
                order: [['created_at', 'DESC']],
                limit: 10,
            });

            socket.emit('product_history', { productId, history });
        });

        // Subscribe to category updates
        socket.on('subscribe_category', (categoryId) => {
            const room = `category_${categoryId}`;
            socket.join(room);

            socket.categorySubscriptions = socket.categorySubscriptions || new Set();
            socket.categorySubscriptions.add(categoryId);
        });

        // Subscribe to demand alerts
        socket.on('subscribe_alerts', async () => {
            // Already joined seller room on connection
            socket.emit('subscribed_alerts', { success: true });
        });

        // Unsubscribe from product
        socket.on('unsubscribe_product', (productId) => {
            const room = `product_${productId}`;
            socket.leave(room);

            if (socket.productSubscriptions) {
                socket.productSubscriptions.delete(productId);
            }
        });

        // Unsubscribe from category
        socket.on('unsubscribe_category', (categoryId) => {
            const room = `category_${categoryId}`;
            socket.leave(room);

            if (socket.categorySubscriptions) {
                socket.categorySubscriptions.delete(categoryId);
            }
        });

        // Join chat room
        socket.on('join_chat', (roomId) => {
            socket.join(`chat_${roomId}`);
        });

        // Send chat message
        socket.on('chat_message', async (data) => {
            const { roomId, message, recipientId } = data;

            // Store message in database
            // Broadcast to room
            this.io.to(`chat_${roomId}`).emit('chat_message', {
                userId: socket.user.id,
                username: socket.user.username,
                message,
                timestamp: new Date().toISOString(),
            });

            // Send notification to recipient
            if (recipientId) {
                await this.sendNotification(recipientId, {
                    title: `New message from ${socket.user.username}`,
                    body: message,
                    type: 'chat',
                    data: { roomId },
                });
            }
        });

        // Mark notification as read
        socket.on('mark_read', async (notificationId) => {
            const { Notification } = require('../../models');
            await Notification.update(
                { read: true, read_at: new Date() },
                { where: { id: notificationId, user_id: socket.user.id } }
            );

            // Update unread count
            const count = await Notification.count({
                where: { user_id: socket.user.id, read: false },
            });

            socket.emit('unread_count', count);
        });

        // Mark all as read
        socket.on('mark_all_read', async () => {
            const { Notification } = require('../../models');
            await Notification.update(
                { read: true, read_at: new Date() },
                { where: { user_id: socket.user.id, read: false } }
            );

            socket.emit('unread_count', 0);
        });

        // Disconnect handler
        socket.on('disconnect', () => {
            this.handleDisconnect(socket);
        });

        // Error handler
        socket.on('error', (error) => {
            logger.error(`WebSocket error for ${socket.user.username}:`, error);
        });
    }

    /**
     * Handle disconnect
     */
    handleDisconnect(socket) {
        const userId = this.socketUsers.get(socket.id);
        if (userId) {
            this.userSockets.delete(userId);
            this.socketUsers.delete(socket.id);
            this.sellerRooms.delete(userId);

            logger.info(`WebSocket disconnected: ${socket.user.username} (${userId})`);

            // Broadcast offline status
            this.broadcastOnlineStatus(userId, false);
        }
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
    async sendNotification(userId, notification) {
        try {
            // Find socket
            const socketId = this.userSockets.get(userId);
            if (socketId) {
                this.io.to(socketId).emit('notification', {
                    ...notification,
                    timestamp: new Date().toISOString(),
                });
            }

            // Store in database
            const { Notification: NotificationModel } = require('../../models');
            await NotificationModel.create({
                user_id: userId,
                type: notification.type || 'system',
                title: notification.title,
                message: notification.body || notification.message,
                data: notification.data || {},
                action_url: notification.action_url || null,
                action_label: notification.action_label || null,
                channel: ['in_app'],
            });

            return true;
        } catch (error) {
            logger.error('Send notification error:', error);
            return false;
        }
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
            const room = `seller_${alert.user_id}`;
            this.io.to(room).emit('new_demand_alert', alert);
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
        this.io.to(room).emit('price_update', {
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
            totalSellers: this.sellerRooms.size,
            users: Array.from(this.userSockets.keys()),
            rooms: Array.from(this.io.sockets.adapter.rooms.keys()),
        };
    }

    /**
     * Close WebSocket server
     */
    close() {
        if (this.io) {
            this.io.close();
            this.isInitialized = false;
            this.userSockets.clear();
            this.socketUsers.clear();
            this.sellerRooms.clear();
            logger.info('WebSocket server closed');
        }
    }
}

module.exports = new WebSocketService();