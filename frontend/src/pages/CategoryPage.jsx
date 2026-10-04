// frontend/src/pages/CategoryPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import {
    updatePageMeta,
    generateBreadcrumbSchema,
    injectSchema,
    generateFAQSchema
} from '../utils/seo';
import api from '../services/api';
import {
    Filter,
    Grid,
    List,
    SlidersHorizontal,
    ChevronDown,
    Star,
    ShoppingBag,
    TrendingUp
} from 'lucide-react';

// Components
import ProductCard from '../components/ProductCard';
import CategoryFilter from '../components/CategoryFilter';
import Pagination from '../components/Pagination';
import SortDropdown from '../components/SortDropdown';
import LoadingSpinner from '../components/Common/LoadingSpinner';

function CategoryPage() {
    const { id, subId } = useParams();
    const navigate = useNavigate();

    // State
    const [viewMode, setViewMode] = useState('grid'); // grid | list
    const [sortBy, setSortBy] = useState('popularity');
    const [filters, setFilters] = useState({
        priceRange: { min: 0, max: 1000 },
        condition: [],
        brand: [],
        rating: 0,
        inStock: false,
    });
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const limit = 20;

    // ✅ Fetch category data
    const { data: category, isLoading: categoryLoading } = useQuery(
        ['category', id],
        () => api.get(`/categories/${id}`).then(res => res.data),
        { enabled: !!id }
    );

    // ✅ Fetch subcategories if subId exists
    const { data: subcategory } = useQuery(
        ['subcategory', subId],
        () => api.get(`/categories/sub/${subId}`).then(res => res.data),
        { enabled: !!subId }
    );

    // ✅ Fetch products with filters
    const { data: productsData, isLoading: productsLoading, refetch } = useQuery(
        ['categoryProducts', id, subId, sortBy, filters, page],
        async () => {
            const params = {
                categoryId: subId || id,
                sort: sortBy,
                page,
                limit,
                ...filters,
                minPrice: filters.priceRange.min,
                maxPrice: filters.priceRange.max,
            };
            const response = await api.get('/products/category', { params });
            return response.data;
        },
        { keepPreviousData: true }
    );

    // ✅ Fetch category metadata for SEO
    const { data: categorySEO } = useQuery(
        ['categorySEO', id],
        () => api.get(`/categories/${id}/seo`).then(res => res.data),
        { enabled: !!id }
    );

    // ✅ Update SEO when category or filters change
    useEffect(() => {
        if (category) {
            const title = subcategory
                ? `${subcategory.name} - ${category.name} | PricePulse`
                : `${category.name} - Price Comparison & Best Deals | PricePulse`;

            const description = subcategory
                ? `Compare prices for ${subcategory.name} in ${category.name}. Find the best deals, check demand scores, and shop smart.`
                : `Compare prices for ${category.name} across global sellers. Find the best deals, check demand scores, and shop smart.`;

            updatePageMeta({
                title,
                description,
                url: `https://pricepulse.com/category/${id}${subId ? `/subcategory/${subId}` : ''}`,
                image: category.image || 'https://pricepulse.com/og-image.jpg',
                type: 'product.group',
            });

            // ✅ Inject Breadcrumb Schema
            const breadcrumbItems = [
                { name: 'Home', url: '/' },
                { name: 'Categories', url: '/categories' },
                { name: category.name, url: `/category/${id}` },
            ];

            if (subcategory) {
                breadcrumbItems.push({
                    name: subcategory.name,
                    url: `/category/${id}/subcategory/${subId}`
                });
            }

            const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);
            injectSchema(breadcrumbSchema);

            // ✅ Inject Category Schema (if available)
            if (categorySEO) {
                const categorySchema = {
                    "@context": "https://schema.org",
                    "@type": "CollectionPage",
                    "name": subcategory ? `${subcategory.name} - ${category.name}` : category.name,
                    "description": subcategory
                        ? `Browse ${subcategory.name} in ${category.name} on PricePulse`
                        : `Browse ${category.name} on PricePulse`,
                    "url": `https://pricepulse.com/category/${id}`,
                    "about": {
                        "@type": "Thing",
                        "name": category.name
                    },
                    "mainEntity": {
                        "@type": "ItemList",
                        "itemListElement": productsData?.products?.map((product, index) => ({
                            "@type": "ListItem",
                            "position": index + 1,
                            "url": `https://pricepulse.com/product/${product.slug}`
                        })) || []
                    }
                };
                injectSchema(categorySchema);
            }
        }
    }, [category, subcategory, productsData, id, subId]);

    // ✅ Apply filters
    const applyFilters = useCallback((newFilters) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
        setPage(1); // Reset to first page on filter change
    }, []);

    // ✅ Handle sort change
    const handleSortChange = (value) => {
        setSortBy(value);
        setPage(1);
    };

    // ✅ Loading state
    if (categoryLoading || productsLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    if (!category) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900">Category Not Found</h2>
                    <p className="text-gray-600 mt-2">The category you're looking for doesn't exist.</p>
                    <Link to="/" className="inline-block mt-4 text-blue-600 hover:text-blue-800">
                        Go Home →
                    </Link>
                </div>
            </div>
        );
    }

    const products = productsData?.products || [];
    const totalProducts = productsData?.total || 0;
    const totalPages = Math.ceil(totalProducts / limit);

    // ✅ Get category stats
    const stats = productsData?.stats || {
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        totalSellers: 0,
        avgDemandScore: 0
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ✅ Category Hero / Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
                <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold">
                                {subcategory ? subcategory.name : category.name}
                            </h1>
                            <p className="mt-2 text-blue-100">
                                {subcategory
                                    ? `${subcategory.description || `Browse ${subcategory.name} in ${category.name}`}`
                                    : category.description || `Browse ${category.name} and find the best prices`}
                            </p>

                            {/* ✅ Category Stats */}
                            <div className="mt-4 flex flex-wrap gap-4 text-sm">
                                <span className="flex items-center">
                                    <ShoppingBag className="h-4 w-4 mr-1" />
                                    {totalProducts} products
                                </span>
                                <span className="flex items-center">
                                    <TrendingUp className="h-4 w-4 mr-1" />
                                    Avg Demand: {(stats.avgDemandScore * 100).toFixed(0)}%
                                </span>
                                <span className="flex items-center">
                                    $ {stats.avgPrice.toFixed(2)} avg price
                                </span>
                                <span className="flex items-center">
                                    {stats.totalSellers} sellers
                                </span>
                            </div>
                        </div>

                        {/* ✅ Category Image (if available) */}
                        {category.image && (
                            <img
                                src={category.image}
                                alt={category.name}
                                className="mt-4 md:mt-0 w-32 h-32 rounded-lg object-cover shadow-lg"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* ✅ Filters & Controls */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Sort and View Controls */}
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <SlidersHorizontal className="h-4 w-4 mr-2" />
                            Filters
                            {Object.keys(filters).some(k => {
                                if (k === 'priceRange') {
                                    return filters.priceRange.min > 0 || filters.priceRange.max < 1000;
                                }
                                if (k === 'condition' || k === 'brand') {
                                    return filters[k].length > 0;
                                }
                                if (k === 'rating') {
                                    return filters.rating > 0;
                                }
                                return false;
                            }) && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Active
                                    </span>
                                )}
                        </button>

                        <SortDropdown
                            value={sortBy}
                            onChange={handleSortChange}
                            options={[
                                { value: 'popularity', label: 'Popularity' },
                                { value: 'price_low', label: 'Price: Low to High' },
                                { value: 'price_high', label: 'Price: High to Low' },
                                { value: 'rating', label: 'Highest Rated' },
                                { value: 'newest', label: 'Newest First' },
                                { value: 'demand', label: 'Highest Demand' },
                            ]}
                        />
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Grid className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <List className="h-5 w-5" />
                        </button>
                        <span className="text-sm text-gray-500 ml-2">
                            {totalProducts} results
                        </span>
                    </div>
                </div>

                {/* ✅ Filter Panel */}
                {showFilters && (
                    <div className="mt-4 p-4 bg-white rounded-lg shadow border border-gray-200">
                        <CategoryFilter
                            categoryId={id}
                            filters={filters}
                            onApplyFilters={applyFilters}
                            onClose={() => setShowFilters(false)}
                        />
                    </div>
                )}

                {/* ✅ Products Grid */}
                {products.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-gray-400">
                            <ShoppingBag className="h-12 w-12 mx-auto" />
                        </div>
                        <h3 className="mt-4 text-lg font-medium text-gray-900">No products found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Try adjusting your filters or search for something else.
                        </p>
                        <button
                            onClick={() => {
                                setFilters({
                                    priceRange: { min: 0, max: 1000 },
                                    condition: [],
                                    brand: [],
                                    rating: 0,
                                    inStock: false,
                                });
                            }}
                            className="mt-4 text-blue-600 hover:text-blue-800"
                        >
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <>
                        <div className={`mt-6 grid gap-6 ${viewMode === 'grid'
                                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                                : 'grid-cols-1'
                            }`}>
                            {products.map(product => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    viewMode={viewMode}
                                />
                            ))}
                        </div>

                        {/* ✅ Pagination */}
                        {totalPages > 1 && (
                            <Pagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={setPage}
                                className="mt-8"
                            />
                        )}
                    </>
                )}

                {/* ✅ Subcategories (if no subcategory selected) */}
                {!subId && category.subcategories?.length > 0 && (
                    <div className="mt-12">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            Explore Subcategories
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {category.subcategories.map(sub => (
                                <Link
                                    key={sub.id}
                                    to={`/category/${id}/subcategory/${sub.id}`}
                                    className="bg-white rounded-lg shadow p-4 hover:shadow-md transition"
                                >
                                    {sub.image && (
                                        <img
                                            src={sub.image}
                                            alt={sub.name}
                                            className="w-full h-24 object-cover rounded"
                                        />
                                    )}
                                    <h3 className="mt-2 font-medium text-gray-900">{sub.name}</h3>
                                    <p className="text-sm text-gray-500">{sub.productCount} products</p>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ✅ SEO - Related FAQ Schema */}
            {categorySEO?.faqs && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            Frequently Asked Questions
                        </h2>
                        <div className="space-y-4">
                            {categorySEO.faqs.map((faq, index) => (
                                <details key={index} className="border rounded-lg p-4">
                                    <summary className="font-medium cursor-pointer">
                                        {faq.question}
                                    </summary>
                                    <p className="mt-2 text-gray-600">{faq.answer}</p>
                                </details>
                            ))}
                        </div>
                    </div>

                    {/* ✅ Inject FAQ Schema */}
                    {(() => {
                        const faqSchema = generateFAQSchema(categorySEO.faqs);
                        // This will be injected only once
                        const scriptId = 'faq-schema';
                        if (!document.getElementById(scriptId)) {
                            const script = document.createElement('script');
                            script.id = scriptId;
                            script.type = 'application/ld+json';
                            script.textContent = JSON.stringify(faqSchema);
                            document.head.appendChild(script);
                        }
                        return null;
                    })()}
                </div>
            )}
        </div>
    );
}

export default CategoryPage;