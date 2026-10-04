// Frontend analytics dashboard component
// frontend/src/pages/AnalyticsDashboard.jsx
import React, { useEffect, useState } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { useWebSocket } from '../hooks/useWebSocket';

function AnalyticsDashboard() {
    const [analytics, setAnalytics] = useState(null);
    const [period, setPeriod] = useState('30d');
    const { lastMessage } = useWebSocket();

    useEffect(() => {
        fetchAnalytics();
    }, [period]);

    useEffect(() => {
        if (lastMessage?.event === 'realtime_stats') {
            setAnalytics(prev => ({
                ...prev,
                realtime: lastMessage.data
            }));
        }
    }, [lastMessage]);

    const fetchAnalytics = async () => {
        const response = await api.get(`/analytics/seller?period=${period}`);
        setAnalytics(response.data);
    };

    if (!analytics) return <div>Loading...</div>;

    const viewsData = {
        labels: analytics.daily.map(d => d.date),
        datasets: [{
            label: 'Views',
            data: analytics.daily.map(d => d.views),
            borderColor: '#3B82F6',
            fill: false
        }, {
            label: 'Sales',
            data: analytics.daily.map(d => d.sales),
            borderColor: '#10B981',
            fill: false
        }]
    };

    const revenueData = {
        labels: analytics.daily.map(d => d.date),
        datasets: [{
            label: 'Revenue ($)',
            data: analytics.daily.map(d => d.revenue),
            backgroundColor: 'rgba(59, 130, 246, 0.5)'
        }]
    };

    const demandAlertsData = {
        labels: analytics.demandAlerts.map(a => a.alert_type),
        datasets: [{
            data: analytics.demandAlerts.map(a => a.count),
            backgroundColor: ['#EF4444', '#F59E0B', '#10B981']
        }]
    };

    return (
        <div className="p-6">
            <div className="flex justify-between mb-6">
                <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
                <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="border rounded px-3 py-1"
                >
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                </select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded shadow">
                    <p className="text-gray-500">Total Revenue</p>
                    <p className="text-2xl font-bold">${analytics.summary.total_revenue}</p>
                </div>
                <div className="bg-white p-4 rounded shadow">
                    <p className="text-gray-500">Total Sales</p>
                    <p className="text-2xl font-bold">{analytics.summary.total_sales}</p>
                </div>
                <div className="bg-white p-4 rounded shadow">
                    <p className="text-gray-500">Conversion Rate</p>
                    <p className="text-2xl font-bold">{analytics.summary.conversion_rate}%</p>
                </div>
                <div className="bg-white p-4 rounded shadow">
                    <p className="text-gray-500">Avg Order Value</p>
                    <p className="text-2xl font-bold">${analytics.summary.avg_order_value}</p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-4 rounded shadow">
                    <h2 className="text-lg font-semibold mb-4">Views vs Sales Trend</h2>
                    <Line data={viewsData} />
                </div>
                <div className="bg-white p-4 rounded shadow">
                    <h2 className="text-lg font-semibold mb-4">Revenue Trend</h2>
                    <Bar data={revenueData} />
                </div>
            </div>

            {/* Demand Alerts Performance */}
            <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-4 rounded shadow">
                    <h2 className="text-lg font-semibold mb-4">Demand Alerts by Type</h2>
                    <Pie data={demandAlertsData} />
                </div>
                <div className="bg-white p-4 rounded shadow">
                    <h2 className="text-lg font-semibold mb-4">Alert Performance</h2>
                    <div className="space-y-3">
                        {analytics.demandAlerts.map(alert => (
                            <div key={alert.alert_type}>
                                <div className="flex justify-between mb-1">
                                    <span className="capitalize">{alert.alert_type}</span>
                                    <span>{alert.click_through_rate}% CTR</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 rounded-full h-2"
                                        style={{ width: `${alert.click_through_rate}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Products */}
            <div className="bg-white p-4 rounded shadow">
                <h2 className="text-lg font-semibold mb-4">Top Performing Products</h2>
                <table className="w-full">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left py-2">Product</th>
                            <th className="text-right py-2">Views</th>
                            <th className="text-right py-2">Sales</th>
                            <th className="text-right py-2">Revenue</th>
                            <th className="text-right py-2">Demand Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {analytics.topProducts.map(product => (
                            <tr key={product.name} className="border-b">
                                <td className="py-2">{product.name}</td>
                                <td className="text-right">{product.views}</td>
                                <td className="text-right">{product.sales}</td>
                                <td className="text-right">${product.revenue}</td>
                                <td className="text-right">{(product.demand_score * 100).toFixed(0)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default AnalyticsDashboard;