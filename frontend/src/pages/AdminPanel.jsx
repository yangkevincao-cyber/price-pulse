// frontend/src/pages/AdminPanel.jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
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
    DollarSign,
    Users,
    ShoppingBag
} from 'lucide-react';
import api from '../services/api';
import { Line, Bar } from 'react-chartjs-2';
import toast from 'react-hot-toast';

function AdminPanel() {
    const queryClient = useQueryClient();
    const [selectedScraper, setSelectedScraper] = useState(null);
    const [dateRange, setDateRange] = useState('week');

    // Fetch system metrics
    const { data: metrics, isLoading: metricsLoading } = useQuery(
        ['systemMetrics', dateRange],
        () => api.get(`/admin/metrics?range=${dateRange}`).then(res => res.data),
        { refetchInterval: 30000 }
    );

    // Fetch scraping status
    const { data: scrapingStatus, refetch: refetchScraping } = useQuery(
        'scrapingStatus',
        () => api.get('/admin/scraping/status').then(res => res.data),
        { refetchInterval: 60000 }
    );

    // Fetch users stats
    const { data: userStats } = useQuery(
        'userStats',
        () => api.get('/admin/users/stats').then(res => res.data)
    );

    // Fetch product stats
    const { data: productStats } = useQuery(
        'productStats',
        () => api.get('/admin/products/stats').then(res => res.data)
    );

    // Toggle scraper mutation
    const toggleScraperMutation = useMutation(
        (scraperId) => api.post(`/admin/scraping/${scraperId}/toggle`),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('scrapingStatus');
                toast.success('Scraper status updated');
            }
        }
    );

    // Trigger manual scrape mutation
    const manualScrapeMutation = useMutation(
        (source) => api.post('/admin/scraping/trigger', { source }),
        {
            onSuccess: () => {
                toast.success('Manual scraping triggered');
                refetchScraping();
            }
        }
    );

    if (metricsLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Chart data for scraping performance
    const scrapingPerformanceData = {
        labels: metrics?.scrapingPerformance?.map(p => p.date) || [],
        datasets: [
            {
                label: 'Products Scraped',
                data: metrics?.scrapingPerformance?.map(p => p.count) || [],
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
            },
            {
                label: 'Success Rate (%)',
                data: metrics?.scrapingPerformance?.map(p => p.success_rate) || [],
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                fill: true,
            }
        ],
    };

    // Chart data for price trends
    const priceTrendData = {
        labels: metrics?.priceTrends?.map(p => p.date) || [],
        datasets: [
            {
                label: 'Average Price',
                data: metrics?.priceTrends?.map(p => p.avg_price) || [],
                borderColor: 'rgb(249, 115, 22)',
                tension: 0.4,
            }
        ],
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Monitor system performance, scraping jobs, and platform metrics
                    </p>
                </div>

                {/* System Health Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">System Status</p>
                                <div className="flex items-center mt-1">
                                    <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                                    <p className="text-lg font-semibold text-gray-900">Operational</p>
                                </div>
                            </div>
                            <Activity className="h-8 w-8 text-green-500" />
                        </div>
                        <p className="text-xs text-gray-400 mt-4">Uptime: 99.97%</p>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Active Scrapers</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {scrapingStatus?.active_scrapers || 0}/{scrapingStatus?.total_scrapers || 0}
                                </p>
                            </div>
                            <Server className="h-8 w-8 text-blue-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total Products</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {productStats?.total_products?.toLocaleString() || 0}
                                </p>
                            </div>
                            <Database className="h-8 w-8 text-purple-500" />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Active Users</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {userStats?.active_users_7d?.toLocaleString() || 0}
                                </p>
                            </div>
                            <Users className="h-8 w-8 text-green-500" />
                        </div>
                    </div>
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm opacity-90">Daily Searches</p>
                                <p className="text-3xl font-bold">{metrics?.daily_searches?.toLocaleString() || 0}</p>
                            </div>
                            <Globe className="h-8 w-8 opacity-90" />
                        </div>
                        <p className="text-xs mt-4 opacity-75">+{metrics?.search_growth || 0}% from yesterday</p>
                    </div>

                    <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm opacity-90">Total Sales</p>
                                <p className="text-3xl font-bold">${metrics?.total_sales?.toLocaleString() || 0}</p>
                            </div>
                            <DollarSign className="h-8 w-8 opacity-90" />
                        </div>
                        <p className="text-xs mt-4 opacity-75">This month</p>
                    </div>

                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm opacity-90">Active Listings</p>
                                <p className="text-3xl font-bold">{productStats?.active_listings?.toLocaleString() || 0}</p>
                            </div>
                            <ShoppingBag className="h-8 w-8 opacity-90" />
                        </div>
                        <p className="text-xs mt-4 opacity-75">Across all categories</p>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Scraping Performance</h2>
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="text-sm border rounded-md px-2 py-1"
                            >
                                <option value="week">Last 7 Days</option>
                                <option value="month">Last 30 Days</option>
                                <option value="quarter">Last 90 Days</option>
                            </select>
                        </div>
                        <Line data={scrapingPerformanceData} options={{ responsive: true }} />
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Price Trends</h2>
                        <Line data={priceTrendData} options={{ responsive: true }} />
                    </div>
                </div>

                {/* Scraping Status Section */}
                <div className="bg-white rounded-lg shadow mb-8">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-900">Web Scraping Status</h2>
                        <button
                            onClick={() => refetchScraping()}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </button>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {scrapingStatus?.scrapers?.map((scraper) => (
                            <div key={scraper.id} className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div className={`p-2 rounded-full ${scraper.status === 'active' ? 'bg-green-100' : 'bg-red-100'
                                            }`}>
                                            {scraper.status === 'active' ? (
                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-600" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{scraper.name}</h3>
                                            <p className="text-sm text-gray-500">Last run: {scraper.last_run || 'Never'}</p>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => manualScrapeMutation.mutate(scraper.name)}
                                            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                        >
                                            <Play className="h-4 w-4 mr-1" />
                                            Run Now
                                        </button>
                                        <button
                                            onClick={() => toggleScraperMutation.mutate(scraper.id)}
                                            className={`inline-flex items-center px-3 py-1 border rounded-md text-sm font-medium ${scraper.status === 'active'
                                                    ? 'border-red-300 text-red-700 hover:bg-red-50'
                                                    : 'border-green-300 text-green-700 hover:bg-green-50'
                                                }`}
                                        >
                                            {scraper.status === 'active' ? (
                                                <>
                                                    <Pause className="h-4 w-4 mr-1" />
                                                    Pause
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="h-4 w-4 mr-1" />
                                                    Start
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Products Scraped (24h)</p>
                                        <p className="text-lg font-semibold">{scraper.products_today || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Success Rate</p>
                                        <div className="flex items-center">
                                            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                                <div
                                                    className="bg-green-500 rounded-full h-2"
                                                    style={{ width: `${scraper.success_rate || 0}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-sm">{scraper.success_rate || 0}%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Avg Response Time</p>
                                        <p className="text-lg font-semibold">{scraper.avg_response_time || 0}ms</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Errors (24h)</p>
                                        <p className="text-lg font-semibold text-red-600">{scraper.errors_today || 0}</p>
                                    </div>
                                </div>
                                {scraper.last_error && (
                                    <div className="mt-4 p-3 bg-red-50 rounded-md">
                                        <div className="flex items-start">
                                            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 mr-2" />
                                            <div>
                                                <p className="text-xs text-red-800 font-medium">Last Error</p>
                                                <p className="text-xs text-red-600">{scraper.last_error}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Activity Log */}
                <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">Recent System Activity</h2>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {metrics?.recent_activity?.map((activity, index) => (
                            <div key={index} className="p-4 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className={`p-1.5 rounded-full ${activity.type === 'success' ? 'bg-green-100' :
                                                activity.type === 'error' ? 'bg-red-100' : 'bg-blue-100'
                                            }`}>
                                            {activity.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                                            {activity.type === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                                            {activity.type === 'info' && <Activity className="h-4 w-4 text-blue-600" />}
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-900">{activity.message}</p>
                                            <p className="text-xs text-gray-400">{activity.timestamp}</p>
                                        </div>
                                    </div>
                                    {activity.details && (
                                        <button
                                            onClick={() => setSelectedScraper(activity.details)}
                                            className="text-xs text-blue-600 hover:text-blue-800"
                                        >
                                            Details
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminPanel;