// frontend/src/services/socket.js
import { io } from 'socket.io-client';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

let socket = null;

export const initializeSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;

    socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    socket.on('connect', () => {
        console.log('WebSocket connected');
    });

    socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
    });

    socket.on('new_demand_alert', (alert) => {
        // Show toast notification
        toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                        <div className="flex-shrink-0 pt-0.5">
                            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                                <Bell className="h-6 w-6 text-red-600" />
                            </div>
                        </div>
                        <div className="ml-3 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                                New Demand Alert!
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                {alert.message}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                                Opportunity Score: {(alert.opportunity_score * 100).toFixed(0)}%
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex border-l border-gray-200">
                    <button
                        onClick={() => {
                            toast.dismiss(t.id);
                            window.location.href = '/seller/alerts';
                        }}
                        className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
                    >
                        View
                    </button>
                </div>
            </div>
        ), { duration: 10000 });

        // Update store
        useAlertStore.getState().addAlert(alert);
    });

    socket.on('price_drop_alert', (data) => {
        toast.success(data.message, {
            duration: 8000,
            action: {
                label: 'View',
                onClick: () => window.location.href = `/compare?product=${data.product_id}`
            }
        });
    });

    socket.on('exchange_match_found', (match) => {
        toast.custom((t) => (
            <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            🤝
                        </div>
                    </div>
                    <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">Exchange Match Found!</p>
                        <p className="text-sm text-gray-500">{match.message}</p>
                        <button
                            onClick={() => {
                                toast.dismiss(t.id);
                                window.location.href = `/exchanges/matches/${match.match_id}`;
                            }}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                            View Match →
                        </button>
                    </div>
                </div>
            </div>
        ));
    });

    socket.on('personalized_recommendations', (data) => {
        toast((t) => (
            <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                            🎯
                        </div>
                    </div>
                    <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">Recommendations for You</p>
                        <p className="text-sm text-gray-500">{data.message}</p>
                        <div className="mt-2 space-y-1">
                            {data.products.slice(0, 2).map(product => (
                                <p key={product.id} className="text-xs text-gray-600">
                                    • {product.name} (Demand: {(product.demand_score * 100).toFixed(0)}%)
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        ), { duration: 15000 });
    });

    return socket;
};

export const getSocket = () => socket;

export const subscribeToProduct = (productId) => {
    if (socket) {
        socket.emit('subscribe_product', productId);
    }
};

export const subscribeToCategory = (categoryId) => {
    if (socket) {
        socket.emit('subscribe_category', categoryId);
    }
};

export const checkPrice = (productId, callback) => {
    if (socket) {
        socket.emit('check_price', productId);
        socket.once('price_update', callback);
    }
};

export const findExchangeMatches = (listingId, callback) => {
    if (socket) {
        socket.emit('find_exchange_matches', listingId);
        socket.once('exchange_matches', callback);
    }
};