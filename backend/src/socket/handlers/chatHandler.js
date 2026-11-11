// backend/src/socket/handlers/chatHandler.js
const { logger } = require('../../config/logger');
const { ChatMessage, User } = require('../../models');

class ChatHandler {
    /**
     * Send initial messages
     */
    async sendInitialMessages(socket) {
        try {
            const userId = socket.user.id;

            // Get unread messages count
            const unreadCount = await ChatMessage.count({
                where: {
                    recipient_id: userId,
                    read: false,
                },
            });

            socket.emit('initial_chat_data', {
                unreadCount,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`Initial chat data sent to ${socket.user.username}`);
        } catch (error) {
            logger.error('Send initial messages error:', error);
        }
    }

    /**
     * Join chat room
     */
    async joinChat(socket, data) {
        try {
            const { roomId } = data;
            const room = `chat_${roomId}`;
            socket.join(room);

            // Mark messages as read
            await ChatMessage.update(
                { read: true, read_at: new Date() },
                {
                    where: {
                        room_id: roomId,
                        recipient_id: socket.user.id,
                        read: false,
                    },
                }
            );

            // Send recent messages
            const messages = await ChatMessage.findAll({
                where: { room_id: roomId },
                order: [['created_at', 'DESC']],
                limit: 50,
                include: [
                    {
                        model: User,
                        as: 'sender',
                        attributes: ['id', 'username', 'avatar'],
                    },
                ],
            });

            socket.emit('chat_history', {
                roomId,
                messages: messages.reverse(),
                timestamp: new Date().toISOString(),
            });

            // Notify others in room
            socket.to(room).emit('user_joined_chat', {
                userId: socket.user.id,
                username: socket.user.username,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`User ${socket.user.username} joined chat room ${roomId}`);
        } catch (error) {
            logger.error('Join chat error:', error);
            socket.emit('chat_error', {
                error: 'Failed to join chat',
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Leave chat room
     */
    leaveChat(socket, data) {
        try {
            const { roomId } = data;
            const room = `chat_${roomId}`;
            socket.leave(room);

            // Notify others in room
            socket.to(room).emit('user_left_chat', {
                userId: socket.user.id,
                username: socket.user.username,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`User ${socket.user.username} left chat room ${roomId}`);
        } catch (error) {
            logger.error('Leave chat error:', error);
        }
    }

    /**
     * Send message
     */
    async sendMessage(socket, data) {
        try {
            const { roomId, recipientId, message } = data;

            // Create message
            const chatMessage = await ChatMessage.create({
                room_id: roomId,
                sender_id: socket.user.id,
                recipient_id: recipientId,
                message,
                read: false,
            });

            // Get sender info
            const sender = await User.findByPk(socket.user.id, {
                attributes: ['id', 'username', 'avatar'],
            });

            const messageData = {
                ...chatMessage.toJSON(),
                sender,
                timestamp: new Date().toISOString(),
            };

            // Send to room
            const room = `chat_${roomId}`;
            socket.to(room).emit('new_message', messageData);

            // Send back to sender
            socket.emit('message_sent', messageData);

            // Send notification to recipient if online
            if (recipientId !== socket.user.id) {
                const { io } = require('../index');
                const socketServer = io ? io : require('../index').getIO();
                if (socketServer) {
                    const isOnline = socketServer.isUserOnline(recipientId);
                    if (isOnline) {
                        socketServer.sendToUser(recipientId, 'new_chat_message', {
                            ...messageData,
                            unreadCount: await ChatMessage.count({
                                where: { recipient_id: recipientId, read: false },
                            }),
                        });
                    }
                }
            }

            logger.debug(`Message sent in room ${roomId} by ${socket.user.username}`);
        } catch (error) {
            logger.error('Send message error:', error);
            socket.emit('chat_error', {
                error: 'Failed to send message',
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * User typing indicator
     */
    typing(socket, data) {
        try {
            const { roomId, recipientId } = data;
            const room = `chat_${roomId}`;

            socket.to(room).emit('user_typing', {
                userId: socket.user.id,
                username: socket.user.username,
                timestamp: new Date().toISOString(),
            });

            // Send to recipient if specified
            if (recipientId) {
                socket.to(`user_${recipientId}`).emit('user_typing', {
                    userId: socket.user.id,
                    username: socket.user.username,
                    timestamp: new Date().toISOString(),
                });
            }

            logger.debug(`${socket.user.username} is typing in room ${roomId}`);
        } catch (error) {
            logger.error('Typing indicator error:', error);
        }
    }

    /**
     * User stopped typing
     */
    stopTyping(socket, data) {
        try {
            const { roomId, recipientId } = data;
            const room = `chat_${roomId}`;

            socket.to(room).emit('user_stopped_typing', {
                userId: socket.user.id,
                username: socket.user.username,
                timestamp: new Date().toISOString(),
            });

            if (recipientId) {
                socket.to(`user_${recipientId}`).emit('user_stopped_typing', {
                    userId: socket.user.id,
                    username: socket.user.username,
                    timestamp: new Date().toISOString(),
                });
            }

            logger.debug(`${socket.user.username} stopped typing in room ${roomId}`);
        } catch (error) {
            logger.error('Stop typing error:', error);
        }
    }

    /**
     * Mark message as read
     */
    async markMessageRead(socket, data) {
        try {
            const { messageId } = data;

            await ChatMessage.update(
                { read: true, read_at: new Date() },
                { where: { id: messageId } }
            );

            // Get updated unread count for recipient
            const unreadCount = await ChatMessage.count({
                where: {
                    recipient_id: socket.user.id,
                    read: false,
                },
            });

            socket.emit('message_read', {
                messageId,
                unreadCount,
                timestamp: new Date().toISOString(),
            });

            logger.debug(`Message ${messageId} marked as read by ${socket.user.username}`);
        } catch (error) {
            logger.error('Mark message read error:', error);
        }
    }
}

module.exports = new ChatHandler();