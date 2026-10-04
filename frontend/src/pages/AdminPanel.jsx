// frontend/src/pages/AdminPanel.jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
    Users,
    ShoppingBag,
    DollarSign,
    Activity,
    Server,
    Database,
    AlertTriangle,
    CheckCircle,
    XCircle,
    RefreshCw,
    Play,
    Pause,
    BarChart3,
    Globe,
    Clock,
    TrendingUp,
    TrendingDown,
    Filter,
    Download,
    Eye,
    Trash2,
    Edit,
    MoreVertical,
    Plus,
    Search
} from 'lucide-react';
import { updatePageMeta } from '../utils/seo';
import api from '../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { Line, Bar, Pie } from 'react-chartjs-2';

function AdminPanel() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('overview');
    const [dateRange, setDateRange] = useState('week');
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // ✅ Update SEO
    useEffect(() => {
        updatePageMeta({
            title: 'Admin Dashboard - PricePulse',
            description: 'Administrative dashboard for PricePulse platform management.',
            url: 'https://pricepulse.com/admin',
        });
    }, []);

    // ✅ Fetch system metrics
    const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery(
        ['adminMetrics', dateRange],
        () => api.get(`/admin/metrics?range=${dateRange}`).then(res => res.data),
        { refetchInterval: 30000 }
    );

    // ✅ Fetch users
    const { data: users, isLoading: usersLoading } = useQuery(
        ['adminUsers', searchTerm],
        () => api.get('/admin/users', { params: { search: searchTerm } }).then(res => res.data)
    );

    // ✅ Fetch products
    const { data: products, isLoading: productsLoading } = useQuery(
        ['adminProducts', searchTerm],
        () => api.get('/admin/products', { params: { search: searchTerm } }).then(res => res.data)
    );

    // ✅ Fetch scraping status
    const { data: scrapingStatus, refetch: refetchScraping } = useQuery(
        'adminScrapingStatus',
        () => api.get('/admin/scraping/status').then(res => res.data),
        { refetchInterval: 60000 }
    );

    // ✅ Toggle scraper mutation
    const toggleScraperMutation = useMutation(
        (scraperId) => api.post(`/admin/scraping/${scraperId}/toggle`),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('adminScrapingStatus');
                toast.success('Scraper status updated');
            }
        }
    );

    // ✅ Delete user mutation
    const deleteUserMutation = useMutation(
        (userId) => api.delete(`/admin/users/${userId}`),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('adminUsers');
                toast.success('User deleted successfully');
            }
        }
    );

    // ✅ Delete product mutation
    const deleteProductMutation = useMutation(
        (productId) => api.delete(`/admin/products/${productId}`),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('adminProducts');
                toast.success('Product deleted successfully');
            }
        }
    );

    const loading = metricsLoading || usersLoading || productsLoading;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    // ✅ Chart data
    const viewsData = {
        labels: metrics?.daily?.map(d => d.date) || [],
        datasets: [
            {
                label: 'Active Users',
                data: metrics?.daily?.map(d => d.active_users) || [],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
            },
            {
                label: 'Transactions',
                data: metrics?.daily?.map(d => d.transactions) || [],
                borderColor: 'rgb(16, 185, 129)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
            }
        ]
    };

    const revenueData = {
        labels: metrics?.daily?.map(d => d.date) || [],
        datasets: [
            {
                label: 'Revenue ($)',
                data: metrics?.daily?.map(d => d.volume) || [],
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
            }
        ]
    };

    const categoryData = {
        labels: metrics?.topCategories?.map(c => c.name) || [],
        datasets: [
            {
                data: metrics?.topCategories?.map(c => c.transactions) || [],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(168, 85, 247, 0.8)',
                ]
            }
        ]
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ✅ Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                            <p className="text-sm text-gray-500">Manage your platform, users, and content</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                                <option value="7d">Last 7 Days</option>
                                <option value="30d">Last 30 Days</option>
                                <option value="90d">Last 90 Days</option>
                                <option value="1y">Last Year</option>
                            </select>
                            <button
                                onClick={() => {
                                    refetchMetrics();
                                    refetchScraping();
                                    toast.success('Data refreshed');
                                }}
                                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                            >
                                <RefreshCw className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ✅ Tabs */}
            <div className="border-b border-gray-200 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex space-x-8">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
                                    ? 'border-pulse-blue-500 text-pulse-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'users'
                                    ? 'border-pulse-blue-500 text-pulse-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Users
                        </button>
                        <button
                            onClick={() => setActiveTab('products')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'products'
                                    ? 'border-pulse-blue-500 text-pulse-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Products
                        </button>
                        <button
                            onClick={() => setActiveTab('scraping')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'scraping'
                                    ? 'border-pulse-blue-500 text-pulse-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Scraping
                        </button>
                        <button
                            onClick={() => setActiveTab('analytics')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'analytics'
                                    ? 'border-pulse-blue-500 text-pulse-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Analytics
                        </button>
                    </nav>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* ✅ OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white rounded-xl shadow-card p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Total Users</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {metrics?.users?.total_users?.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-blue-100 rounded-full">
                                        <Users className="h-6 w-6 text-blue-600" />
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center text-sm">
                                    <span className="text-green-600">+{metrics?.users?.new_users_7d}</span>
                                    <span className="text-gray-500 ml-2">new this week</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-card p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Total Listings</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {metrics?.listings?.total_listings?.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-green-100 rounded-full">
                                        <ShoppingBag className="h-6 w-6 text-green-600" />
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center text-sm">
                                    <span className="text-green-600">{metrics?.listings?.active_listings}</span>
                                    <span className="text-gray-500 ml-2">active</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-card p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Total Revenue</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            ${metrics?.transactions?.completed_volume?.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-orange-100 rounded-full">
                                        <DollarSign className="h-6 w-6 text-orange-600" />
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center text-sm">
                                    <span className="text-green-600">{metrics?.transactions?.completed_transactions}</span>
                                    <span className="text-gray-500 ml-2">transactions</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-card p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500">Demand Alerts</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {metrics?.demand_alerts?.total_alerts_sent?.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-purple-100 rounded-full">
                                        <Activity className="h-6 w-6 text-purple-600" />
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center text-sm">
                                    <span className="text-green-600">{metrics?.demand_alerts?.alert_ctr?.toFixed(1)}%</span>
                                    <span className="text-gray-500 ml-2">CTR</span>
                                </div>
                            </div>
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            <div className="bg-white rounded-xl shadow-card p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Trends</h3>
                                <Line data={viewsData} options={{ responsive: true }} />
                            </div>
                            <div className="bg-white rounded-xl shadow-card p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trends</h3>
                                <Bar data={revenueData} options={{ responsive: true }} />
                            </div>
                        </div>

                        {/* Top Categories */}
                        <div className="bg-white rounded-xl shadow-card p-6 mb-8">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Categories</h3>
                            <div className="h-64">
                                <Pie data={categoryData} options={{ responsive: true }} />
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white rounded-xl shadow-card p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                            <div className="space-y-3">
                                {metrics?.recent_activity?.slice(0, 5).map((activity, index) => (
                                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100">
                                        <div className="flex items-center">
                                            {activity.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500 mr-2" />}
                                            {activity.type === 'error' && <XCircle className="h-5 w-5 text-red-500 mr-2" />}
                                            {activity.type === 'info' && <Activity className="h-5 w-5 text-blue-500 mr-2" />}
                                            <span className="text-sm text-gray-700">{activity.message}</span>
                                        </div>
                                        <span className="text-xs text-gray-400">{activity.timestamp}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* ✅ USERS TAB */}
                {activeTab === 'users' && (
                    <div className="bg-white rounded-xl shadow-card">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <div className="relative flex-1 max-w-md">
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-blue-500"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                            </div>
                            <button className="px-4 py-2 bg-pulse-blue-600 text-white rounded-lg hover:bg-pulse-blue-700">
                                <Plus className="h-4 w-4 inline mr-1" />
                                Add User
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listings</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {users?.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 rounded-full bg-pulse-blue-100 flex items-center justify-center">
                                                        <Users className="h-5 w-5 text-pulse-blue-600" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <p className="font-medium text-gray-900">{user.username}</p>
                                                        <p className="text-sm text-gray-500">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`badge ${user.role === 'admin' ? 'badge-red' : user.role === 'seller' ? 'badge-blue' : 'badge-gray'}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                {user.listing_count || 0}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                                                    <span className="ml-1 text-sm">{user.seller_rating?.toFixed(1) || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => setSelectedUser(user)}
                                                        className="text-blue-600 hover:text-blue-800"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <button className="text-gray-600 hover:text-gray-800">
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Delete this user?')) {
                                                                deleteUserMutation.mutate(user.id);
                                                            }
                                                        }}
                                                        className="text-red-600 hover:text-red-800"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                            <span className="text-sm text-gray-500">Showing {users?.length || 0} users</span>
                            <div className="flex space-x-2">
                                <button className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Previous</button>
                                <button className="px-3 py-1 bg-pulse-blue-600 text-white rounded-lg text-sm">1</button>
                                <button className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Next</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ✅ PRODUCTS TAB */}
                {activeTab === 'products' && (
                    <div className="bg-white rounded-xl shadow-card">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <div className="relative flex-1 max-w-md">
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-blue-500"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                            </div>
                            <button className="px-4 py-2 bg-pulse-blue-600 text-white rounded-lg hover:bg-pulse-blue-700">
                                <Plus className="h-4 w-4 inline mr-1" />
                                Add Product
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Demand</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sellers</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {products?.map((product) => (
                                        <tr key={product.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <img
                                                        src={product.image || '/placeholder-product.jpg'}
                                                        alt={product.name}
                                                        className="h-10 w-10 rounded object-cover"
                                                    />
                                                    <div className="ml-3">
                                                        <p className="font-medium text-gray-900">{product.name}</p>
                                                        <p className="text-sm text-gray-500">{product.brand || 'No brand'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {product.category_name}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                ${product.price}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="w-16 bg-gray-200 rounded-full h-1.5 mr-2">
                                                        <div
                                                            className="bg-pulse-blue-600 rounded-full h-1.5"
                                                            style={{ width: `${(product.demand_score || 0) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm">{(product.demand_score || 0) * 100}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                {product.seller_count || 0}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex space-x-2">
                                                    <button className="text-blue-600 hover:text-blue-800">
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <button className="text-gray-600 hover:text-gray-800">
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Delete this product?')) {
                                                                deleteProductMutation.mutate(product.id);
                                                            }
                                                        }}
                                                        className="text-red-600 hover:text-red-800"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ✅ SCRAPING TAB */}
                {activeTab === 'scraping' && (
                    <div className="space-y-6">
                        {scrapingStatus?.scrapers?.map((scraper) => (
                            <div key={scraper.id} className="bg-white rounded-xl shadow-card p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className={`p-2 rounded-full ${scraper.scraping_enabled ? 'bg-green-100' : 'bg-red-100'
                                            }`}>
                                            {scraper.scraping_enabled ? (
                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-600" />
                                            )}
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="font-semibold text-gray-900">{scraper.source_name}</h3>
                                            <p className="text-sm text-gray-500">
                                                Last run: {scraper.last_run || 'Never'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => {
                                                // Trigger manual scrape
                                                toast.success('Scraping triggered');
                                            }}
                                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                                        >
                                            <Play className="h-4 w-4 inline mr-1" />
                                            Run Now
                                        </button>
                                        <button
                                            onClick={() => toggleScraperMutation.mutate(scraper.id)}
                                            className={`px-3 py-1 rounded-lg text-sm ${scraper.scraping_enabled
                                                    ? 'border border-red-300 text-red-600 hover:bg-red-50'
                                                    : 'border border-green-300 text-green-600 hover:bg-green-50'
                                                }`}
                                        >
                                            {scraper.scraping_enabled ? 'Pause' : 'Start'}
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Products Scraped</p>
                                        <p className="text-lg font-semibold">{scraper.products_today || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Success Rate</p>
                                        <div className="flex items-center">
                                            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                                <div
                                                    className="bg-pulse-green-500 rounded-full h-2"
                                                    style={{ width: `${scraper.success_rate || 0}%` }}
                                                />
                                            </div>
                                            <span className="text-sm">{scraper.success_rate || 0}%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Avg Response Time</p>
                                        <p className="text-lg font-semibold">{scraper.avg_response_time || 0}ms</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Errors</p>
                                        <p className="text-lg font-semibold text-red-600">{scraper.errors_today || 0}</p>
                                    </div>
                                </div>

                                {scraper.last_error && (
                                    <div className="mt-4 p-3 bg-red-50 rounded-lg">
                                        <div className="flex items-start">
                                            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 mr-2" />
                                            <div>
                                                <p className="text-xs font-medium text-red-800">Last Error</p>
                                                <p className="text-xs text-red-600">{scraper.last_error}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* ✅ ANALYTICS TAB */}
                {activeTab === 'analytics' && (
                    <div className="space-y-6">
                        {/* Conversion Funnel */}
                        <div className="bg-white rounded-xl shadow-card p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-gray-900">
                                        {metrics?.funnel?.visitors?.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500">Visitors</p>
                                    <p className="text-xs text-gray-400">100%</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-gray-900">
                                        {metrics?.funnel?.searchers?.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500">Searches</p>
                                    <p className="text-xs text-green-600">
                                        {metrics?.funnel?.search_conversion}%
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-gray-900">
                                        {metrics?.funnel?.viewers?.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500">Product Views</p>
                                    <p className="text-xs text-green-600">
                                        {metrics?.funnel?.view_conversion}%
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-gray-900">
                                        {metrics?.funnel?.added_to_cart?.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500">Added to Cart</p>
                                    <p className="text-xs text-green-600">
                                        {metrics?.funnel?.cart_conversion}%
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-gray-900">
                                        {metrics?.funnel?.initiated_checkout?.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500">Checkout</p>
                                    <p className="text-xs text-green-600">
                                        {metrics?.funnel?.checkout_conversion}%
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-pulse-green-600">
                                        {metrics?.funnel?.completed_purchase?.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-gray-500">Purchases</p>
                                    <p className="text-xs text-green-600">
                                        {metrics?.funnel?.overall_conversion}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Geography */}
                        <div className="bg-white rounded-xl shadow-card p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Geographic Distribution</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {metrics?.geography?.map((geo) => (
                                    <div key={geo.location_country} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                                        <div className="flex items-center">
                                            <Globe className="h-5 w-5 text-gray-400 mr-2" />
                                            <span className="font-medium">{geo.location_country || 'Unknown'}</span>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <span className="text-sm text-gray-500">{geo.users} users</span>
                                            <span className="font-medium text-gray-900">${geo.transaction_volume?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminPanel;