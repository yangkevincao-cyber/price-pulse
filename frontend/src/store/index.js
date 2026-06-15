// frontend/src/store/index.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            token: null,

            login: async (email, password) => {
                try {
                    const response = await api.post('/auth/login', { email, password });
                    const { user, token } = response.data;
                    set({ user, token, isAuthenticated: true });
                    localStorage.setItem('token', token);
                    return { success: true };
                } catch (error) {
                    return { success: false, error: error.response?.data?.message };
                }
            },

            register: async (userData) => {
                try {
                    const response = await api.post('/auth/register', userData);
                    return { success: true, data: response.data };
                } catch (error) {
                    return { success: false, error: error.response?.data?.message };
                }
            },

            logout: () => {
                set({ user: null, token: null, isAuthenticated: false });
                localStorage.removeItem('token');
            },
        }),
        {
            name: 'auth-storage',
        }
    )
);

export const useAlertStore = create((set, get) => ({
    alerts: [],
    unreadCount: 0,
    loading: false,

    fetchAlerts: async () => {
        set({ loading: true });
        try {
            const response = await api.get('/demand-alerts/my-alerts');
            const unreadCount = response.data.filter(a => !a.read).length;
            set({ alerts: response.data, unreadCount, loading: false });
        } catch (error) {
            set({ loading: false });
        }
    },

    markAsRead: async (alertId) => {
        await api.patch(`/demand-alerts/${alertId}/read`);
        set(state => ({
            alerts: state.alerts.map(a =>
                a.id === alertId ? { ...a, read: true } : a
            ),
            unreadCount: state.unreadCount - 1
        }));
    },

    subscribeToCategory: async (categoryId, preferences) => {
        const response = await api.post('/demand-alerts/subscribe', {
            category_id: categoryId,
            ...preferences
        });
        return response.data;
    },
}));

export const useProductStore = create((set, get) => ({
    trendingProducts: [],
    searchResults: [],
    loading: false,

    fetchTrending: async () => {
        set({ loading: true });
        try {
            const response = await api.get('/products/trending');
            set({ trendingProducts: response.data, loading: false });
        } catch (error) {
            set({ loading: false });
        }
    },

    searchProducts: async (query, filters = {}) => {
        set({ loading: true });
        try {
            const response = await api.get('/products/search', {
                params: { q: query, ...filters }
            });
            set({ searchResults: response.data, loading: false });
            return response.data;
        } catch (error) {
            set({ loading: false });
            return [];
        }
    },
}));