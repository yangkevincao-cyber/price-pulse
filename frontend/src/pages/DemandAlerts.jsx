// frontend/src/pages/DemandAlerts.jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Bell, TrendingUp, TrendingDown, Filter, Download, Zap } from 'lucide-react';
import { useAlertStore, useAuthStore } from '../store';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Line } from 'react-chartjs-2';

function DemandAlerts() {
    const { user } = useAuthStore();
    const { alerts, unreadCount, fetchAlerts, markAsRead, subscribeToCategory } = useAlertStore();
    const queryClient = useQueryClient();
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [filter, setFilter] = useState('all');
    const [showSubscribeModal, setShowSubscribeModal] = useState(false);

    // Fetch trending products
    const { data: trendingProducts } = useQuery(
        'trendingProducts',
        () => api.get('/products/trending').then(res => res.data),
        { refetchInterval: 300000 }
    );

    // Fetch categories for subscription
    const { data: categories } = useQuery(
        'categories',
        () => api.get('/categories').then(res => res.data)
    );

    // Fetch seller's subscriptions
    const { data: subscriptions } = useQuery(
        'subscriptions',
        () => api.get('/demand-alerts/my-subscriptions').then(res => res.data)
    );

    useEffect(() => {
        fetchAlerts();
    }, []);

    const filteredAlerts = alerts.filter(alert => {
        if (filter === 'unread') return !alert.read;
        if (filter === 'read') return alert.read;
        return true;
    });

    const subscribeMutation = useMutation(
        (data) => subscribeToCategory(data.categoryId, data.preferences),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('subscriptions');
                toast.success('Subscribed to demand alerts!');
                setShowSubscribeModal(false);
            }
        }
    );

    const AlertDetailModal = ({ alert, onClose }) => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center space-x-2">
                                <Zap className="h-6 w-6 text-yellow-500" />
                                <h2 className="text-2xl font-bold">{alert.product_name}</h2>
                            </div>
                            <p className="text-gray-500 mt-1">Alert Type: {alert.alert_type}</p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-500">Demand Score</p>
                            <p className="text-2xl font-bold">{(alert.demand_score * 100).toFixed(0)}%</p>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                <div className="bg-green-500 rounded-full h-2" style={{ width: `${alert.demand_score * 100}%` }}></div>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-500">Search Volume (7d)</p>
                            <p className="text-2xl font-bold">{alert.search_volume_7d}</p>
                            <p className={`text-sm ${alert.search_volume_change_pct > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {alert.search_volume_change_pct > 0 ? '+' : ''}{alert.search_volume_change_pct}% from last week
                            </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-500">Active Sellers</p>
                            <p className="text-2xl font-bold">{alert.active_listings || 0}</p>
                            <p className="text-sm text-gray-500">Low competition</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="text-sm text-gray-500">Suggested Price</p>
                            <p className="text-2xl font-bold">${alert.suggested_price}</p>
                            <p className="text-sm text-gray-500">vs avg ${alert.avg_listing_price}</p>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg mb-6">
                        <h3 className="font-semibold mb-2">Opportunity Analysis</h3>
                        <p className="text-gray-700">{alert.message}</p>
                    </div>

                    <div className="flex space-x-3">
                        <button
                            onClick={() => {
                                window.location.href = `/seller/create-listing?product=${alert.product_id}&suggested_price=${alert.suggested_price}`;
                            }}
                            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
                        >
                            List This Product Now
                        </button>
                        <button
                            onClick={() => markAsRead(alert.id)}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                        >
                            Mark as Read
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Demand Alerts</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Real-time insights to help you sell what people want, when they want it
                            </p>
                        </div>
                        <button
                            onClick={() => setShowSubscribeModal(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            <Bell className="h-5 w-5 mr-2" />
                            Subscribe to Alerts
                        </button>
                    </div>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Unread Alerts</p>
                                <p className="text-3xl font-bold">{unreadCount}</p>
                            </div>
                            <div className="p-3 bg-red-100 rounded-full">
                                <Bell className="h-6 w-6 text-red-600" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Active Subscriptions</p>
                                <p className="text-3xl font-bold">{subscriptions?.length || 0}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full">
                                <TrendingUp className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Opportunities Captured</p>
                                <p className="text-3xl font-bold">12</p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-full">
                                <Zap className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Trending Products Section */}
                <div className="bg-white rounded-lg shadow mb-8">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">🔥 Trending Right Now</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
                        {trendingProducts?.slice(0, 4).map((product) => (
                            <div key={product.id} className="border rounded-lg p-4 hover:shadow-lg transition">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{product.name}</h3>
                                        <p className="text-sm text-gray-500 mt-1">Demand Score: {(product.demand_score * 100).toFixed(0)}%</p>
                                    </div>
                                    <TrendingUp className="h-5 w-5 text-green-500" />
                                </div>
                                <div className="mt-3 flex justify-between items-center">
                                    <span className="text-xs text-gray-500">{product.searches_24h || 0} searches (24h)</span>
                                    <button
                                        onClick={() => window.location.href = `/seller/create-listing?product=${product.id}`}
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        List Now →
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Alerts List */}
                <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-900">Your Demand Alerts</h2>
                        <div className="flex space-x-2">
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="text-sm border rounded-md px-2 py-1"
                            >
                                <option value="all">All Alerts</option>
                                <option value="unread">Unread Only</option>
                                <option value="read">Read</option>
                            </select>
                            <button className="p-1 rounded-md hover:bg-gray-100">
                                <Download className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {filteredAlerts.length === 0 ? (
                        <div className="p-12 text-center">
                            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">No alerts yet. Subscribe to categories to get demand insights!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {filteredAlerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className={`p-6 hover:bg-gray-50 transition cursor-pointer ${!alert.read ? 'bg-blue-50' : ''}`}
                                    onClick={() => setSelectedAlert(alert)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start space-x-3">
                                            <div className={`p-2 rounded-full ${alert.alert_type === 'spike' ? 'bg-red-100' :
                                                    alert.alert_type === 'trending' ? 'bg-green-100' : 'bg-yellow-100'
                                                }`}>
                                                {alert.alert_type === 'spike' ? <TrendingUp className="h-5 w-5 text-red-600" /> :
                                                    alert.alert_type === 'trending' ? <TrendingUp className="h-5 w-5 text-green-600" /> :
                                                        <Zap className="h-5 w-5 text-yellow-600" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <p className="text-sm font-medium text-gray-900">{alert.product_name}</p>
                                                    {!alert.read && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            New
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">{alert.message.substring(0, 150)}...</p>
                                                <div className="flex items-center space-x-4 mt-2">
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(alert.created_at).toLocaleDateString()}
                                                    </span>
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                        Score: {(alert.opportunity_score * 100).toFixed(0)}%
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        Searches: {alert.search_volume_7d} (+{alert.search_volume_change_pct}%)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {!alert.read && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        markAsRead(alert.id);
                                                    }}
                                                    className="text-xs text-gray-500 hover:text-gray-700"
                                                >
                                                    Mark read
                                                </button>
                                            )}
                                            <button className="text-blue-600 hover:text-blue-800">→</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Subscribe Modal */}
            {showSubscribeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg max-w-md w-full mx-4">
                        <div className="p-6">
                            <h2 className="text-xl font-bold mb-4">Subscribe to Demand Alerts</h2>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.target);
                                subscribeMutation.mutate({
                                    categoryId: formData.get('category_id'),
                                    preferences: {
                                        min_demand_score: parseFloat(formData.get('min_score')),
                                        alert_frequency: formData.get('frequency')
                                    }
                                });
                            }}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Category</label>
                                        <select
                                            name="category_id"
                                            required
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        >
                                            <option value="">Select category</option>
                                            {categories?.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Minimum Demand Score</label>
                                        <select
                                            name="min_score"
                                            defaultValue="0.7"
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        >
                                            <option value="0.9">90%+ (High demand only)</option>
                                            <option value="0.7">70%+ (Medium-high demand)</option>
                                            <option value="0.5">50%+ (Any significant demand)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Alert Frequency</label>
                                        <select
                                            name="frequency"
                                            defaultValue="daily"
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        >
                                            <option value="instant">Instant (Real-time)</option>
                                            <option value="daily">Daily Digest</option>
                                            <option value="weekly">Weekly Summary</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-end space-x-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowSubscribeModal(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                                    >
                                        Subscribe
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {selectedAlert && (
                <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
            )}
        </div>
    );
}

export default DemandAlerts;