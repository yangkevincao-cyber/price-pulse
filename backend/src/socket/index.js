// backend/src/socket/index.js
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const Redis = require('ioredis');

class NotificationSystem {
    constructor(server) {
        this.io = socketIO(server, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:3001',
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });

        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            retryStrategy: (times) => Math.min(times * 50, 2000)
        });

        this.userSockets = new Map(); // userId -> socketId
        this.sellerRooms = new Map(); // sellerId -> room name

        this.setupMiddleware();
        this.setupEventHandlers();
        this.startBackgroundTasks();
    }

    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    return next(new Error('Authentication required'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await db.query(
                    'SELECT id, username, role FROM users WHERE id = $1',
                    [decoded.userId]
                );

                if (!user.rows.length) {
                    return next(new Error('User not found'));
                }

                socket.user = user.rows[0];
                next();
            } catch (error) {
                next(new Error('Invalid token'));
            }
        });
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.user.username} (${socket.id})`);

            // Store connection
            this.userSockets.set(socket.user.id, socket.id);

            // Join seller room if applicable
            if (socket.user.role === 'seller') {
                const roomName = `seller_${socket.user.id}`;
                socket.join(roomName);
                this.sellerRooms.set(socket.user.id, roomName);
                console.log(`Seller ${socket.user.username} joined room ${roomName}`);
            }

            // Handle subscription to product alerts
            socket.on('subscribe_product', async (productId) => {
                const roomName = `product_${productId}`;
                socket.join(roomName);
                socket.subscribedProducts = socket.subscribedProducts || new Set();
                socket.subscribedProducts.add(productId);

                // Send recent alerts for this product
                const recentAlerts = await this.getRecentProductAlerts(productId, socket.user.id);
                socket.emit('product_alerts_history', recentAlerts);
            });

            // Handle subscription to category alerts
            socket.on('subscribe_category', async (categoryId) => {
                const roomName = `category_${categoryId}`;
                socket.join(roomName);
                socket.subscribedCategories = socket.subscribedCategories || new Set();
                socket.subscribedCategories.add(categoryId);
            });

            // Handle demand alert preferences update
            socket.on('update_alert_preferences', async (preferences) => {
                await db.query(`
                    UPDATE seller_alert_subscriptions
                    SET alert_frequency = $1,
                        min_demand_score = $2,
                        updated_at = NOW()
                    WHERE seller_id = $3
                `, [preferences.frequency, preferences.minScore, socket.user.id]);

                socket.emit('preferences_updated', { success: true });
            });

            // Handle price check requests (real-time)
            socket.on('check_price', async (productId) => {
                const priceData = await this.getRealTimePrice(productId);
                socket.emit('price_update', priceData);
            });

            // Handle exchange match requests
            socket.on('find_exchange_matches', async (listingId) => {
                const matches = await this.findExchangeMatches(listingId);
                socket.emit('exchange_matches', matches);
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                console.log(`User disconnected: ${socket.user.username}`);
                this.userSockets.delete(socket.user.id);
                this.sellerRooms.delete(socket.user.id);
            });
        });
    }

    // Send real-time demand alert to sellers
    async sendDemandAlert(alertData) {
        const { sellerId, productName, demandScore, message, opportunityScore } = alertData;

        const roomName = `seller_${sellerId}`;

        // Check if seller is online
        const hasRoom = this.io.sockets.adapter.rooms.has(roomName);

        if (hasRoom) {
            // Send real-time notification
            this.io.to(roomName).emit('new_demand_alert', {
                id: Date.now(),
                product_name: productName,
                demand_score: demandScore,
                message: message,
                opportunity_score: opportunityScore,
                timestamp: new Date().toISOString(),
                read: false
            });

            // Store in Redis for persistence
            await this.redis.lpush(
                `alerts:${sellerId}`,
                JSON.stringify({
                    ...alertData,
                    sent_at: new Date().toISOString(),
                    read: false
                })
            );
            await this.redis.ltrim(`alerts:${sellerId}`, 0, 99); // Keep last 100 alerts
        } else {
            // Store for when user comes online
            await this.redis.lpush(
                `pending_alerts:${sellerId}`,
                JSON.stringify(alertData)
            );
        }

        // Always store in database
        await db.query(`
            INSERT INTO demand_alerts 
            (seller_id, product_name, demand_score, message, opportunity_score, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
        `, [sellerId, productName, demandScore, message, opportunityScore]);
    }

    // Broadcast price drop to interested buyers
    async broadcastPriceDrop(productId, oldPrice, newPrice) {
        const roomName = `product_${productId}`;
        const dropPercent = ((oldPrice - newPrice) / oldPrice) * 100;

        if (dropPercent > 10) { // Only notify for significant drops
            this.io.to(roomName).emit('price_drop_alert', {
                product_id: productId,
                old_price: oldPrice,
                new_price: newPrice,
                drop_percent: dropPercent,
                message: `🚨 Price dropped by ${dropPercent.toFixed(1)}%!`
            });
        }
    }

    // Send trending product updates to all sellers
    async broadcastTrendingProducts() {
        const trending = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.demand_score,
                COUNT(DISTINCT sq.id) as searches_24h
            FROM products p
            LEFT JOIN search_queries sq ON sq.query_text ILIKE '%' || p.name || '%'
                AND sq.created_at > NOW() - INTERVAL '24 hours'
            WHERE p.demand_score > 0.7
            GROUP BY p.id
            ORDER BY p.demand_score DESC
            LIMIT 10
        `);

        // Broadcast to all seller rooms
        for (const [sellerId, roomName] of this.sellerRooms) {
            this.io.to(roomName).emit('trending_update', {
                products: trending.rows,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Send personalized recommendations to seller
    async sendPersonalizedRecommendations(sellerId) {
        const recommendations = await db.query(`
            WITH seller_products AS (
                SELECT DISTINCT category_id
                FROM listings
                WHERE seller_id = $1 AND status = 'active'
            ),
            high_demand_products AS (
                SELECT 
                    p.id,
                    p.name,
                    p.category_id,
                    p.demand_score,
                    COUNT(DISTINCT sq.id) as searches,
                    COUNT(DISTINCT l.id) as active_sellers
                FROM products p
                LEFT JOIN search_queries sq ON sq.query_text ILIKE '%' || p.name || '%'
                    AND sq.created_at > NOW() - INTERVAL '7 days'
                LEFT JOIN listings l ON l.product_id = p.id AND l.status = 'active'
                WHERE p.category_id IN (SELECT category_id FROM seller_products)
                    AND p.demand_score > 0.6
                    AND p.id NOT IN (
                        SELECT product_id FROM listings 
                        WHERE seller_id = $1 AND status = 'active'
                    )
                GROUP BY p.id
                ORDER BY p.demand_score DESC
                LIMIT 5
            )
            SELECT * FROM high_demand_products
        `, [sellerId]);

        const roomName = `seller_${sellerId}`;
        if (recommendations.rows.length > 0) {
            this.io.to(roomName).emit('personalized_recommendations', {
                products: recommendations.rows,
                message: '🎯 Products you should consider selling based on your niche!'
            });
        }
    }

    // Handle exchange match notifications
    async notifyExchangeMatch(matchData) {
        const { user1Id, user2Id, matchScore, product1, product2 } = matchData;

        for (const userId of [user1Id, user2Id]) {
            const socketId = this.userSockets.get(userId);
            if (socketId) {
                this.io.to(socketId).emit('exchange_match_found', {
                    match_id: matchData.id,
                    match_score: matchScore,
                    their_product: userId === user1Id ? product2 : product1,
                    your_product: userId === user1Id ? product1 : product2,
                    suggested_adjustment: matchData.suggested_cash_adjustment,
                    message: `🤝 Great exchange match found! ${(matchScore * 100).toFixed(0)}% match quality`
                });
            }
        }
    }

    // Background tasks
    startBackgroundTasks() {
        // Send trending updates every hour
        setInterval(() => {
            this.broadcastTrendingProducts();
        }, 3600000);

        // Send personalized recommendations every 6 hours
        setInterval(() => {
            for (const [sellerId] of this.sellerRooms) {
                this.sendPersonalizedRecommendations(sellerId);
            }
        }, 21600000);

        // Clean up old Redis data daily
        setInterval(async () => {
            const keys = await this.redis.keys('pending_alerts:*');
            const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

            for (const key of keys) {
                const alerts = await this.redis.lrange(key, 0, -1);
                for (const alert of alerts) {
                    const data = JSON.parse(alert);
                    if (new Date(data.sent_at).getTime() < oneWeekAgo) {
                        await this.redis.lrem(key, 1, alert);
                    }
                }
            }
        }, 86400000);
    }

    // Helper methods
    async getRecentProductAlerts(productId, userId) {
        const alerts = await db.query(`
            SELECT * FROM demand_alerts
            WHERE product_id = $1 AND seller_id = $2
            ORDER BY created_at DESC
            LIMIT 10
        `, [productId, userId]);

        return alerts.rows;
    }

    async getRealTimePrice(productId) {
        const price = await db.query(`
            SELECT price, source_name, scraped_at
            FROM external_prices ep
            JOIN external_sources es ON es.id = ep.source_id
            WHERE ep.product_id = $1
            ORDER BY ep.scraped_at DESC
            LIMIT 1
        `, [productId]);

        return price.rows[0] || null;
    }

    async findExchangeMatches(listingId) {
        const matches = await db.query(`
            SELECT * FROM exchange_matches
            WHERE listing1_id = $1 OR listing2_id = $1
            ORDER BY match_score DESC
            LIMIT 5
        `, [listingId]);

        return matches.rows;
    }

    // Send notification to specific user
    async sendToUser(userId, event, data) {
        const socketId = this.userSockets.get(userId);
        if (socketId) {
            this.io.to(socketId).emit(event, data);
            return true;
        }
        return false;
    }

    // Get online status of user
    isUserOnline(userId) {
        return this.userSockets.has(userId);
    }

    // Get all online sellers
    getOnlineSellers() {
        return Array.from(this.sellerRooms.keys());
    }
}

module.exports = NotificationSystem;