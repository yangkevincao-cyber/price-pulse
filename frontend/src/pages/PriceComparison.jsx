// frontend/src/pages/PriceComparison.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { debounce } from 'lodash';
import {
    Search,
    Filter,
    SlidersHorizontal,
    X,
    ChevronDown,
    DollarSign,
    Store,
    TrendingUp,
    Star,
    MapPin,
    Truck,
    Clock,
    ArrowRight
} from 'lucide-react';
import { updatePageMeta } from '../utils/seo';
import api from '../services/api';
import LoadingSpinner from '../components/Common/LoadingSpinner';

function PriceComparison() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQuery = searchParams.get('q') || '';

    // State
    const [query, setQuery] = useState(initialQuery);
    const [filters, setFilters] = useState({
        category: searchParams.get('category') || '',
        minPrice: parseFloat(searchParams.get('minPrice')) || 0,
        maxPrice: parseFloat(searchParams.get('maxPrice')) || 1000,
        condition: searchParams.get('condition') || 'any',
        sortBy: searchParams.get('sort') || 'relevance',
        inStock: searchParams.get('inStock') === 'true'
    });
    const [showFilters, setShowFilters] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [priceHistory, setPriceHistory] = useState([]);

    // Fetch search results
    const { data: searchResults, isLoading, refetch } = useQuery(
        ['priceComparison', query, filters],
        async () => {
            if (!query || query.length < 2) return { products: [], total: 0 };
            const response = await api.get('/products/search', {
                params: { q: query, ...filters, limit: 50 }
            });
            return response.data;
        },
        { enabled: false, keepPreviousData: true }
    );

    // Fetch categories for filter
    const { data: categories } = useQuery(
        'categories',
        () => api.get('/categories').then(res => res.data)
    );

    // ✅ Update SEO
    useEffect(() => {
        const title = query
            ? `${query} - Price Comparison | PricePulse`
            : 'Compare Prices - Find the Best Deals | PricePulse';

        const description = query
            ? `Compare prices for ${query} across global sellers. Find the best deals, check demand scores, and save money.`
            : 'Compare prices across global sellers. Find the best deals, check demand scores, and save money.';

        updatePageMeta({
            title,
            description,
            url: `https://pricepulse.com/compare${query ? `?q=${encodeURIComponent(query)}` : ''}`,
        });
    }, [query]);

    // ✅ Debounced search
    const debouncedSearch = useCallback(
        debounce(() => {
            if (query.length >= 2) {
                refetch();
                setSearchParams({ q: query, ...filters });
            }
        }, 500),
        [query, filters]
    );

    useEffect(() => {
        debouncedSearch();
        return () => debouncedSearch.cancel();
    }, [query, filters, debouncedSearch]);

    // Fetch price history for selected product
    const fetchPriceHistory = async (productId) => {
        const response = await api.get(`/products/${productId}/price-history`);
        setPriceHistory(response.data);
    };

    const handleProductSelect = (product) => {
        setSelectedProduct(product);
        fetchPriceHistory(product.id);
    };

    const clearFilters = () => {
        setFilters({
            category: '',
            minPrice: 0,
            maxPrice: 1000,
            condition: 'any',
            sortBy: 'relevance',
            inStock: false
        });
        setShowFilters(false);
    };

    const products = searchResults?.products || [];
    const totalResults = searchResults?.total || 0;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ✅ Hero Section */}
            <div className="bg-gradient-to-r from-pulse-blue-900 to-pulse-blue-700 text-white">
                <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                    <h1 className="text-3xl md:text-4xl font-bold">
                        Compare Prices
                    </h1>
                    <p className="mt-2 text-blue-100">
                        Find the best deals across global sellers. Compare prices, check demand, and save money.
                    </p>

                    {/* Search Bar */}
                    <div className="mt-6 flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search for products..."
                                className="w-full px-5 py-3 pl-12 bg-white text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-pulse-orange-400"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                            {query && (
                                <button
                                    onClick={() => setQuery('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="inline-flex items-center justify-center px-5 py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition"
                        >
                            <SlidersHorizontal className="h-5 w-5 mr-2" />
                            Filters
                            {Object.values(filters).some(v => v !== '' && v !== 0 && v !== false && v !== 'any') && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pulse-orange-500 text-white">
                                    Active
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* ✅ Filter Panel */}
                {showFilters && (
                    <div className="mb-6 bg-white rounded-xl shadow-lg p-6 border border-gray-200 animate-slide-down">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-gray-900">Filter Results</h3>
                            <button
                                onClick={clearFilters}
                                className="text-sm text-pulse-blue-600 hover:text-pulse-blue-800"
                            >
                                Clear all
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Category */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Category
                                </label>
                                <select
                                    value={filters.category}
                                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-blue-500 focus:border-transparent"
                                >
                                    <option value="">All Categories</option>
                                    {categories?.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Price Range */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Price Range
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        placeholder="Min"
                                        value={filters.minPrice || ''}
                                        onChange={(e) => setFilters({ ...filters, minPrice: parseFloat(e.target.value) || 0 })}
                                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-blue-500"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Max"
                                        value={filters.maxPrice || ''}
                                        onChange={(e) => setFilters({ ...filters, maxPrice: parseFloat(e.target.value) || 1000 })}
                                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Condition */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Condition
                                </label>
                                <select
                                    value={filters.condition}
                                    onChange={(e) => setFilters({ ...filters, condition: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-blue-500"
                                >
                                    <option value="any">Any Condition</option>
                                    <option value="new">New</option>
                                    <option value="like-new">Like New</option>
                                    <option value="good">Good</option>
                                    <option value="fair">Fair</option>
                                </select>
                            </div>

                            {/* Sort By */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Sort By
                                </label>
                                <select
                                    value={filters.sortBy}
                                    onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-blue-500"
                                >
                                    <option value="relevance">Relevance</option>
                                    <option value="price_low">Price: Low to High</option>
                                    <option value="price_high">Price: High to Low</option>
                                    <option value="popularity">Popularity</option>
                                    <option value="rating">Highest Rated</option>
                                    <option value="demand">Highest Demand</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center">
                            <input
                                type="checkbox"
                                checked={filters.inStock}
                                onChange={(e) => setFilters({ ...filters, inStock: e.target.checked })}
                                className="h-4 w-4 text-pulse-blue-600 focus:ring-pulse-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 text-sm text-gray-700">
                                In Stock Only
                            </label>
                        </div>
                    </div>
                )}

                {/* ✅ Results Summary */}
                <div className="flex justify-between items-center mb-6">
                    <p className="text-gray-600">
                        {totalResults > 0 ? (
                            <>Found <span className="font-semibold">{totalResults}</span> results for <span className="font-semibold">"{query}"</span></>
                        ) : query ? (
                            <>No results found for <span className="font-semibold">"{query}"</span></>
                        ) : (
                            <>Enter a product name to start comparing</>
                        )}
                    </p>
                    {query && (
                        <button
                            onClick={() => {
                                setQuery('');
                                setSearchParams({});
                            }}
                            className="text-sm text-gray-500 hover:text-gray-700"
                        >
                            Clear search
                        </button>
                    )}
                </div>

                {/* ✅ Results */}
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : products.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {products.map((product) => (
                            <ComparisonCard
                                key={product.id}
                                product={product}
                                isSelected={selectedProduct?.id === product.id}
                                onSelect={() => handleProductSelect(product)}
                            />
                        ))}
                    </div>
                ) : query && !isLoading ? (
                    <div className="text-center py-12">
                        <div className="text-gray-400">
                            <Search className="h-16 w-16 mx-auto" />
                        </div>
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No products found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Try adjusting your filters or search for something else.
                        </p>
                        <button
                            onClick={clearFilters}
                            className="mt-4 text-pulse-blue-600 hover:text-pulse-blue-800"
                        >
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="text-gray-400">
                            <Search className="h-16 w-16 mx-auto" />
                        </div>
                        <h3 className="mt-4 text-lg font-medium text-gray-900">Start comparing prices</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Search for any product to see prices from multiple sellers
                        </p>
                    </div>
                )}

                {/* ✅ Selected Product Details */}
                {selectedProduct && priceHistory.length > 0 && (
                    <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-bold text-gray-900">
                                Price History: {selectedProduct.name}
                            </h2>
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Price Chart */}
                            <div className="h-64">
                                {/* Chart.js or Recharts implementation */}
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    Price trend chart will appear here
                                </div>
                            </div>

                            {/* Price Statistics */}
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Current Price</span>
                                    <span className="font-bold text-pulse-blue-600">
                                        ${selectedProduct.price}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Highest Price (30d)</span>
                                    <span className="font-bold text-pulse-red-600">
                                        ${Math.max(...priceHistory.map(p => p.price))}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Lowest Price (30d)</span>
                                    <span className="font-bold text-pulse-green-600">
                                        ${Math.min(...priceHistory.map(p => p.price))}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Demand Score</span>
                                    <span className="font-bold">
                                        {(selectedProduct.demand_score * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Active Sellers</span>
                                    <span className="font-bold">{selectedProduct.seller_count || 0}</span>
                                </div>

                                <Link
                                    to={`/product/${selectedProduct.slug}`}
                                    className="block w-full text-center px-4 py-2 bg-pulse-blue-600 text-white rounded-lg hover:bg-pulse-blue-700 transition"
                                >
                                    View Full Details →
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ✅ Comparison Card Component
const ComparisonCard = ({ product, isSelected, onSelect }) => {
    const {
        id,
        name,
        price,
        image,
        seller_name,
        seller_rating,
        condition,
        shipping_cost,
        demand_score,
        in_stock,
        store_name,
        distance_km
    } = product;

    return (
        <div
            className={`bg-white rounded-xl shadow-card border p-4 hover:shadow-card-hover transition cursor-pointer ${isSelected ? 'ring-2 ring-pulse-blue-500' : ''
                }`}
            onClick={onSelect}
        >
            <div className="flex flex-col md:flex-row gap-4">
                {/* Product Image */}
                <div className="md:w-32 flex-shrink-0">
                    <img
                        src={image || '/placeholder-product.jpg'}
                        alt={name}
                        className="w-full h-32 object-cover rounded-lg"
                    />
                </div>

                {/* Product Info */}
                <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                        <div>
                            <h3 className="font-semibold text-gray-900 line-clamp-2">{name}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-sm text-gray-600">{seller_name}</span>
                                {seller_rating && (
                                    <span className="flex items-center text-sm">
                                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                                        <span className="ml-1">{seller_rating.toFixed(1)}</span>
                                    </span>
                                )}
                                <span className={`badge ${condition === 'new' ? 'badge-green' : 'badge-gray'}`}>
                                    {condition}
                                </span>
                                {in_stock ? (
                                    <span className="badge badge-green">In Stock</span>
                                ) : (
                                    <span className="badge badge-red">Out of Stock</span>
                                )}
                            </div>
                        </div>

                        <div className="text-right">
                            <div className="text-2xl font-bold text-pulse-blue-600">
                                ${price}
                            </div>
                            {shipping_cost === 0 ? (
                                <span className="text-sm text-pulse-green-600">Free Shipping</span>
                            ) : (
                                <span className="text-sm text-gray-500">+${shipping_cost} shipping</span>
                            )}
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                        {store_name && (
                            <span className="flex items-center">
                                <Store className="h-4 w-4 mr-1" />
                                {store_name}
                            </span>
                        )}
                        {distance_km && (
                            <span className="flex items-center">
                                <MapPin className="h-4 w-4 mr-1" />
                                {distance_km} km away
                            </span>
                        )}
                        {demand_score && (
                            <span className="flex items-center">
                                <TrendingUp className="h-4 w-4 mr-1" />
                                {(demand_score * 100).toFixed(0)}% demand
                            </span>
                        )}
                        <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            Listed 2 days ago
                        </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3">
                        <button className="px-3 py-1.5 bg-pulse-blue-600 text-white text-sm rounded-lg hover:bg-pulse-blue-700 transition">
                            View Details
                        </button>
                        <button className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition">
                            Compare
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PriceComparison;