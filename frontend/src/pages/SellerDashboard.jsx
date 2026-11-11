// frontend/src/pages/SellerDashboard.jsx
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { useAlertStore, useAuthStore } from '../store';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
    TrendingUp,
    Bell,
    DollarSign,
    Package,
    Eye,
    ShoppingCart,
    AlertTriangle,
    CheckCircle,
    ArrowUp,
    ArrowDown
} from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

function SellerDashboard() {
    const { user } = useAuthStore();
    const { fetchAlerts, unreadCount } = useAlertStore();
    const queryClient = useQueryClient();
    const [selectedPeriod, setSelectedPeriod] = useState('week');

    // Fetch dashboard data
    const { data: dashboardData, isLoading } = useQuery(
        ['sellerDashboard', selectedPeriod],
        () => api.get(`/seller/dashboard?period=${selectedPeriod}`).then(res => res.data),
        { refetchInterval: 30000 }
    );

    // Fetch demand alerts
    useEffect(() => {
        fetchAlerts();
    }, []);

    // Create new listing mutation
    const createListingMutation = useMutation(
        (listingData) => api.post('/listings', listingData),
        {
            onSuccess: () => {
                queryClient.invalidateQueries(['sellerDashboard']);
                toast.success('Listing created successfully!');
            },
            onError: (error) => {
                toast.error(error.response?.data?.message || 'Failed to create listing');
            }
        }
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const data = dashboardData || {
        stats: {},
        performance: {},
        topProducts: [],
        recentAlerts: []
    };

    // Performance chart data
    const performanceData = {
        labels: data.performance?.labels || [],
        datasets: [
            {
                label: 'Views',
                data: data.performance?.views || [],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
            },
            {
                label: 'Sales',
                data: data.performance?.sales || [],
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4,
            },
        ],
    };

    // Category distribution data
    const categoryData = {
        labels: data.categoryDistribution?.labels || [],
        datasets: [
            {
                data: data.categoryDistribution?.values || [],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(249, 115, 22, 0.8)',
                    'rgba(168, 85, 247, 0.8)',
                    'rgba(236, 72, 153, 0.8)',
                ],
            },
        ],
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                Seller Dashboard
                            </h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Welcome back, {user?.username}! Here's what's happening with your store.
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => window.location.href = '/seller/alerts'}
                                className="relative inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                                <Bell className="h-5 w-5 mr-2" />
                                Alerts
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => document.getElementById('createListingModal').showModal()}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                            >
                                <Package className="h-5 w-5 mr-2" />
                                New Listing
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="p-3 bg-blue-100 rounded-full">
                                <Eye className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Total Views</p>
                                <p className="text-2xl font-semibold text-gray-900">
                                    {data.stats?.totalViews?.toLocaleString() || 0}
                                </p>
                                {data.stats?.viewsChange && (
                                    <p className={`text-xs ${data.stats.viewsChange > 0 ? 'text-green-600' : 'text-red-600'} flex items-center mt-1`}>
                                        {data.stats.viewsChange > 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                                        {Math.abs(data.stats.viewsChange)}% from last period
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="p-3 bg-green-100 rounded-full">
                                <ShoppingCart className="h-6 w-6 text-green-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Total Sales</p>
                                <p className="text-2xl font-semibold text-gray-900">
                                    {data.stats?.totalSales?.toLocaleString() || 0}
                                </p>
                                {data.stats?.salesChange && (
                                    <p className={`text-xs ${data.stats.salesChange > 0 ? 'text-green-600' : 'text-red-600'} flex items-center mt-1`}>
                                        {data.stats.salesChange > 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                                        {Math.abs(data.stats.salesChange)}% from last period
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="p-3 bg-purple-100 rounded-full">
                                <DollarSign className="h-6 w-6 text-purple-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Revenue</p>
                                <p className="text-2xl font-semibold text-gray-900">
                                    ${data.stats?.revenue?.toLocaleString() || 0}
                                </p>
                                {data.stats?.revenueChange && (
                                    <p className={`text-xs ${data.stats.revenueChange > 0 ? 'text-green-600' : 'text-red-600'} flex items-center mt-1`}>
                                        {data.stats.revenueChange > 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                                        {Math.abs(data.stats.revenueChange)}% from last period
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="p-3 bg-orange-100 rounded-full">
                                <TrendingUp className="h-6 w-6 text-orange-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Conversion Rate</p>
                                <p className="text-2xl font-semibold text-gray-900">
                                    {data.stats?.conversionRate || 0}%
                                </p>
                                {data.stats?.conversionChange && (
                                    <p className={`text-xs ${data.stats.conversionChange > 0 ? 'text-green-600' : 'text-red-600'} flex items-center mt-1`}>
                                        {data.stats.conversionChange > 0 ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
                                        {Math.abs(data.stats.conversionChange)}% from last period
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Performance Trend</h2>
                            <select
                                value={selectedPeriod}
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                                className="text-sm border rounded-md px-2 py-1"
                            >
                                <option value="week">Last 7 Days</option>
                                <option value="month">Last 30 Days</option>
                                <option value="quarter">Last 90 Days</option>
                            </select>
                        </div>
                        <Line data={performanceData} options={{ responsive: true }} />
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales by Category</h2>
                        <Doughnut data={categoryData} options={{ responsive: true }} />
                    </div>
                </div>

                {/* Top Products */}
                <div className="bg-white rounded-lg shadow mb-8">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">Top Performing Products</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <table>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Views</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Demand Score</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                </table>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {data.topProducts?.map((product) => (
                                    <tr key={product.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <img
                                                    src={product.image || '/api/placeholder/40/40'}
                                                    alt={product.name}
                                                    className="h-10 w-10 rounded object-cover"
                                                />
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                                    <div className="text-sm text-gray-500">{product.category}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.views}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.sales}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${product.revenue}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                                                    <div
                                                        className="bg-blue-600 rounded-full h-2"
                                                        style={{ width: `${product.demandScore * 100}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-sm text-gray-600">{(product.demandScore * 100).toFixed(0)}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <button className="text-blue-600 hover:text-blue-800">Edit</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Demand Alerts */}
                <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">Recent Demand Alerts</h2>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {data.recentAlerts?.map((alert) => (
                            <div key={alert.id} className="p-6 hover:bg-gray-50 transition">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start space-x-3">
                                        <div className={`p-2 rounded-full ${alert.alert_type === 'spike' ? 'bg-red-100' :
                                            alert.alert_type === 'trending' ? 'bg-green-100' : 'bg-yellow-100'
                                            }`}>
                                            {alert.alert_type === 'spike' ? <AlertTriangle className="h-5 w-5 text-red-600" /> :
                                                alert.alert_type === 'trending' ? <TrendingUp className="h-5 w-5 text-green-600" /> :
                                                    <CheckCircle className="h-5 w-5 text-yellow-600" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{alert.product_name}</p>
                                            <p className="text-sm text-gray-500 mt-1">{alert.message}</p>
                                            <div className="flex items-center space-x-4 mt-2">
                                                <span className="text-xs text-gray-400">
                                                    {new Date(alert.created_at).toLocaleDateString()}
                                                </span>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                    Opportunity Score: {(alert.opportunity_score * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => window.location.href = `/seller/alerts?product=${alert.product_id}`}
                                        className="text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        View Details →
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Create Listing Modal */}
            <dialog id="createListingModal" className="rounded-lg shadow-xl w-full max-w-2xl">
                <div className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Create New Listing</h2>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        createListingMutation.mutate({
                            product_name: formData.get('product_name'),
                            category_id: formData.get('category_id'),
                            price: parseFloat(formData.get('price')),
                            condition: formData.get('condition'),
                            description: formData.get('description'),
                            quantity: parseInt(formData.get('quantity'))
                        });
                        e.target.reset();
                        document.getElementById('createListingModal').close();
                    }}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Product Name</label>
                                <input
                                    type="text"
                                    name="product_name"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Category</label>
                                <select
                                    name="category_id"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                >
                                    <option value="">Select category</option>
                                    <option value="1">Electronics</option>
                                    <option value="2">Clothing</option>
                                    <option value="3">Home & Garden</option>
                                    <option value="4">Sports</option>
                                    <option value="5">Toys</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Price ($)</label>
                                <input
                                    type="number"
                                    name="price"
                                    step="0.01"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Condition</label>
                                <select
                                    name="condition"
                                    required
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                >
                                    <option value="new">New</option>
                                    <option value="like-new">Like New</option>
                                    <option value="good">Good</option>
                                    <option value="fair">Fair</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Quantity</label>
                                <input
                                    type="number"
                                    name="quantity"
                                    defaultValue="1"
                                    min="1"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <textarea
                                    name="description"
                                    rows="3"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                ></textarea>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => document.getElementById('createListingModal').close()}
                                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                            >
                                Create Listing
                            </button>
                        </div>
                    </form>
                </div>
            </dialog>
        </div>
    );
}

export default SellerDashboard;