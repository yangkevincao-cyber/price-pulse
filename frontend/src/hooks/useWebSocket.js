// frontend/src/hooks/useWebSocket.js
import { useEffect, useState } from 'react';
import { initializeSocket, getSocket } from '../services/socket';
import { useAuthStore } from '../store';

export const useWebSocket = () => {
    const { isAuthenticated } = useAuthStore();
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) return;

        const socket = initializeSocket();

        if (socket) {
            socket.on('connect', () => setIsConnected(true));
            socket.on('disconnect', () => setIsConnected(false));
            socket.onAny((event, data) => {
                setLastMessage({ event, data, timestamp: new Date() });
            });
        }

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [isAuthenticated]);

    return { isConnected, lastMessage, socket: getSocket() };
};