// frontend/src/pages/Home.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { TrendingUp, DollarSign, ArrowRightLeft, Search, ArrowRight, Star, Package } from 'lucide-react';
import api from '../services/api';
import LazyImage from '../components/LazyImage';

export default function Home() {
    // Fetch trending products
    const { data: trending, isLoading: loadingTrending } = useQuery(
        'trendingProducts',
        () => api.get('/products/trending').then(r => r.data.data),
        { staleTime: 5 * 60 * 1000 }
    );

    const { data: featured } = useQuery(
        'featuredProducts',
        () => api.get('/products/featured').then(r => r.data.data),
        { staleTime: 5 * 60 * 1000 }
    );

    return (
        <div className="min-h-screen">
            {/* ─────────── HERO ─────────── */}
            <section className="bg-gradient-to-br from-pulse-blue-900 via-pulse-blue-700 to-pulse-blue-600 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
                    <div className="max-w-3xl">
                        <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                            Feel the <span className="text-pulse-orange-400">Market Pulse</span>
                        </h1>
                        <p className="mt-6 text-xl md:text-2xl text-blue-100">
                            Real-time demand alerts. Global price comparison. Smart exchanges.
                            Everything you need to sell smarter and buy cheaper.
                        </p>

                        {/* Search bar */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const q = e.target.search.value.trim();
                                if (q) window.location.href = `/compare?q=${encodeURIComponent(q)}`;
                            }}
                            className="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl"
                        >
                            <div className="relative flex-1">
                                <input
                                    name="search"
                                    type="text"
                                    placeholder="Search products..."
                                    className="w-full px-5 py-4 pl-12 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-pulse-orange-400"
                                />
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                            </div>
                            <button
                                type="submit"
                                className="px-8 py-4 bg-pulse-orange-500 text-white rounded-xl font-semibold hover:bg-pulse-orange-600 transition"
                            >
                                Search
                            </button>
                        </form>

                        {/* CTA buttons */}
                        <div className="mt-6 flex flex-wrap gap-3">
                            <Link
                                to="/seller"
                                className="inline-flex items-center px-6 py-3 bg-white text-pulse-blue-700 rounded-lg font-medium hover:bg-gray-100 transition"
                            >
                                Start Selling <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                            <Link
                                to="/exchanges"
                                className="inline-flex items-center px-6 py-3 border-2 border-white/30 text-white rounded-lg font-medium hover:bg-white/10 transition"
                            >
                                Trade Items <ArrowRightLeft className="ml-2 h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─────────── 3 FEATURES ─────────── */}
            <section className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <Feature
                            icon={<TrendingUp className="h-8 w-8 text-pulse-blue-600" />}
                            title="Demand Alerts"
                            description="Know what's trending before your competitors do. Real-time alerts when demand spikes."
                            link="/seller"
                        />
                        <Feature
                            icon={<DollarSign className="h-8 w-8 text-pulse-green-600" />}
                            title="Price Comparison"
                            description="Compare prices across global sellers. Find the best deal in seconds."
                            link="/compare"
                        />
                        <Feature
                            icon={<ArrowRightLeft className="h-8 w-8 text-pulse-orange-500" />}
                            title="Smart Exchange"
                            description="AI-powered matching for fair trades. Trade what you have for what you want."
                            link="/exchanges"
                        />
                    </div>
                </div>
            </section>

            {/* ─────────── TRENDING ─────────── */}
            <section className="py-16 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900">🔥 Trending Now</h2>
                            <p className="text-gray-500 mt-1">The most searched products this week</p>
                        </div>
                        <Link to="/compare" className="text-pulse-blue-600 hover:text-pulse-blue-800 font-medium">
                            View All →
                        </Link>
                    </div>

                    {loadingTrending ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                                    <div className="h-40 bg-gray-200 rounded mb-3"></div>
                                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                </div>
                            ))}
                        </div>
                    ) : trending && trending.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {trending.slice(0, 8).map((product) => (
                                <Link
                                    key={product.id}
                                    to={`/product/${product.slug}`}
                                    className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden group"
                                >
                                    <div className="h-40 bg-gray-100 flex items-center justify-center">
                                        {product.main_image ? (
                                            <LazyImage
                                                src={product.main_image}
                                                alt={product.name}
                                                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                            />
                                        ) : (
                                            <Package className="h-12 w-12 text-gray-300" />
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</p>
                                        <div className="mt-2 flex items-center text-xs text-gray-500">
                                            <Star className="h-3 w-3 text-yellow-400 fill-current mr-1" />
                                            {product.demand_score ? `${Math.round(product.demand_score * 100)}% demand` : 'Trending'}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-white rounded-xl">
                            <Package className="h-12 w-12 text-gray-300 mx-auto" />
                            <p className="text-gray-500 mt-3">No trending products yet. Start listing!</p>
                            <Link to="/seller" className="inline-block mt-4 text-pulse-blue-600 hover:text-pulse-blue-800">
                                List your first product →
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* ─────────── FEATURED ─────────── */}
            {featured && featured.length > 0 && (
                <section className="py-16 bg-white">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-8">⭐ Featured Products</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {featured.slice(0, 4).map((product) => (
                                <Link
                                    key={product.id}
                                    to={`/product/${product.slug}`}
                                    className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden"
                                >
                                    <div className="h-40 bg-gray-100 flex items-center justify-center">
                                        {product.main_image ? (
                                            <LazyImage
                                                src={product.main_image}
                                                alt={product.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <Package className="h-12 w-12 text-gray-300" />
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ─────────── CTA ─────────── */}
            <section className="py-20 bg-gradient-to-r from-pulse-blue-900 to-pulse-blue-700 text-white">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold">
                        Ready to sell smarter?
                    </h2>
                    <p className="mt-4 text-xl text-blue-100">
                        Join thousands of sellers using real-time demand intelligence.
                    </p>
                    <Link
                        to="/register"
                        className="inline-block mt-8 px-8 py-4 bg-pulse-orange-500 text-white rounded-xl font-semibold hover:bg-pulse-orange-600 transition"
                    >
                        Get Started Free →
                    </Link>
                </div>
            </section>
        </div>
    );
}

// ─────────── Helper Component ───────────
function Feature({ icon, title, description, link }) {
    return (
        <Link to={link} className="block p-6 bg-white rounded-xl border border-gray-200 hover:border-pulse-blue-400 hover:shadow-lg transition group">
            <div className="p-3 bg-gray-50 rounded-lg inline-block group-hover:bg-pulse-blue-50 transition">
                {icon}
            </div>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">{title}</h3>
            <p className="mt-2 text-gray-600">{description}</p>
            <span className="mt-4 inline-flex items-center text-pulse-blue-600 font-medium group-hover:gap-2 transition-all">
                Learn more <ArrowRight className="ml-1 h-4 w-4" />
            </span>
        </Link>
    );
}
