// frontend/src/services/api.js
import axios from 'axios';
import toast from 'react-hot-toast';

// ✅ Create axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});

// ✅ Request interceptor - Add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Add device fingerprint for fraud detection
        const fingerprint = localStorage.getItem('deviceFingerprint');
        if (fingerprint) {
            config.headers['X-Device-Fingerprint'] = fingerprint;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// ✅ Response interceptor - Handle errors globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const { response } = error;

        if (response) {
            // Handle specific status codes
            switch (response.status) {
                case 401:
                    // Unauthorized - Redirect to login
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                    toast.error('Session expired. Please login again.');
                    break;

                case 403:
                    // Forbidden - Show permission error
                    toast.error('You don\'t have permission to perform this action.');
                    break;

                case 404:
                    // Not found
                    toast.error('Resource not found.');
                    break;

                case 422:
                    // Validation error
                    const errors = response.data.errors || response.data.message;
                    if (typeof errors === 'string') {
                        toast.error(errors);
                    } else if (Array.isArray(errors)) {
                        errors.forEach(err => toast.error(err));
                    } else if (typeof errors === 'object') {
                        Object.values(errors).forEach(err => {
                            if (Array.isArray(err)) {
                                err.forEach(msg => toast.error(msg));
                            } else {
                                toast.error(String(err));
                            }
                        });
                    }
                    break;

                case 429:
                    // Rate limit
                    toast.error('Too many requests. Please slow down.');
                    break;

                case 500:
                    // Server error
                    toast.error('Something went wrong. Please try again later.');
                    break;

                default:
                    // Generic error
                    toast.error(response.data?.message || 'An error occurred.');
            }
        } else if (error.request) {
            // Network error
            toast.error('Network error. Please check your internet connection.');
        } else {
            // Other errors
            toast.error(error.message || 'An unexpected error occurred.');
        }

        return Promise.reject(error);
    }
);

// ✅ Helper functions for common API calls
export const apiHelpers = {
    // Auth
    auth: {
        login: (credentials) => api.post('/auth/login', credentials),
        register: (data) => api.post('/auth/register', data),
        logout: () => api.post('/auth/logout'),
        me: () => api.get('/auth/me'),
        refresh: () => api.post('/auth/refresh'),
        verifyEmail: (token) => api.post('/auth/verify-email', { token }),
        resetPassword: (data) => api.post('/auth/reset-password', data),
    },

    // Products
    products: {
        search: (params) => api.get('/products/search', { params }),
        get: (id) => api.get(`/products/${id}`),
        getBySlug: (slug) => api.get(`/products/slug/${slug}`),
        getTrending: (params) => api.get('/products/trending', { params }),
        getPriceHistory: (id) => api.get(`/products/${id}/price-history`),
        getSimilar: (id) => api.get(`/products/${id}/similar`),
        getByCategory: (categoryId, params) => api.get(`/products/category/${categoryId}`, { params }),
    },

    // Listings
    listings: {
        create: (data) => api.post('/listings', data),
        update: (id, data) => api.put(`/listings/${id}`, data),
        delete: (id) => api.delete(`/listings/${id}`),
        get: (id) => api.get(`/listings/${id}`),
        getMyListings: (params) => api.get('/listings/my', { params }),
        getSellerListings: (sellerId, params) => api.get(`/listings/seller/${sellerId}`, { params }),
        toggleStatus: (id) => api.patch(`/listings/${id}/toggle`),
    },

    // Demand Alerts
    alerts: {
        getMyAlerts: () => api.get('/demand-alerts/my-alerts'),
        getRecent: () => api.get('/demand-alerts/recent'),
        subscribe: (data) => api.post('/demand-alerts/subscribe', data),
        unsubscribe: (id) => api.delete(`/demand-alerts/subscriptions/${id}`),
        markRead: (id) => api.patch(`/demand-alerts/${id}/read`),
        markAllRead: () => api.patch('/demand-alerts/mark-all-read'),
        getSubscriptions: () => api.get('/demand-alerts/my-subscriptions'),
    },

    // Exchanges
    exchanges: {
        getListings: (params) => api.get('/exchanges/listings', { params }),
        createListing: (data) => api.post('/exchanges/listings', data),
        updateListing: (id, data) => api.put(`/exchanges/listings/${id}`, data),
        deleteListing: (id) => api.delete(`/exchanges/listings/${id}`),
        getMatches: () => api.get('/exchanges/matches'),
        acceptMatch: (id) => api.post(`/exchanges/matches/${id}/accept`),
        declineMatch: (id) => api.post(`/exchanges/matches/${id}/decline`),
    },

    // Payments
    payments: {
        createStripeIntent: (data) => api.post('/payments/stripe/create-payment', data),
        createPaypalOrder: (data) => api.post('/payments/paypal/create-order', data),
        capturePaypalOrder: (orderId) => api.post('/payments/paypal/capture-order', { orderId }),
        getTransactionHistory: (params) => api.get('/payments/transactions', { params }),
        createConnectAccount: () => api.post('/payments/stripe/create-connect-account'),
    },

    // Admin
    admin: {
        getMetrics: (params) => api.get('/admin/metrics', { params }),
        getUsers: (params) => api.get('/admin/users', { params }),
        updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
        deleteUser: (id) => api.delete(`/admin/users/${id}`),
        getProducts: (params) => api.get('/admin/products', { params }),
        deleteProduct: (id) => api.delete(`/admin/products/${id}`),
        getScrapingStatus: () => api.get('/admin/scraping/status'),
        toggleScraper: (id) => api.post(`/admin/scraping/${id}/toggle`),
        triggerScrape: (data) => api.post('/admin/scraping/trigger', data),
    },

    // Categories
    categories: {
        getAll: () => api.get('/categories'),
        get: (id) => api.get(`/categories/${id}`),
        getSEO: (id) => api.get(`/categories/${id}/seo`),
        getSubcategories: (id) => api.get(`/categories/${id}/subcategories`),
    },

    // Users
    users: {
        getProfile: () => api.get('/users/profile'),
        updateProfile: (data) => api.put('/users/profile', data),
        updateSettings: (data) => api.put('/users/settings', data),
        getSellerProfile: (id) => api.get(`/users/seller/${id}`),
        getStats: () => api.get('/users/stats'),
    },
};

export default api;