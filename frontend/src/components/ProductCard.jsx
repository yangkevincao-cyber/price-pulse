// frontend/src/components/ProductCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, TrendingUp, Clock } from 'lucide-react';
//import { LazyImage } from '../utils/performance';
import LazyImage from '../components/LazyImage';
import VirtualProductList from '../components/VirtualProductList';

function ProductCard({ product, viewMode = 'grid' }) {
    const {
        id,
        slug,
        name,
        price,
        image,
        rating,
        reviewCount,
        demandScore,
        condition,
        sellerName,
        sellerRating,
        inStock,
        tags = [],
        discountPercentage,
        originalPrice,
        shippingCost,
        created_at
    } = product;

    const isNew = new Date(created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const isHot = demandScore > 0.8;

    if (viewMode === 'list') {
        return (
            <div className="bg-white rounded-lg shadow hover:shadow-md transition flex flex-col sm:flex-row">
                {/* Image */}
                <Link to={`/product/${slug}`} className="sm:w-48 flex-shrink-0">
                    <LazyImage
                        src={image || '/placeholder-product.jpg'}
                        alt={name}
                        className="w-full h-48 sm:h-full object-cover rounded-t-lg sm:rounded-l-lg sm:rounded-t-none"
                    />
                </Link>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between">
                        <div>
                            <Link to={`/product/${slug}`} className="hover:text-blue-600">
                                <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
                            </Link>
                            <div className="flex items-center mt-1 space-x-2">
                                <span className="text-sm text-gray-500">by {sellerName}</span>
                                <span className="flex items-center text-sm">
                                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                                    <span className="ml-1">{rating?.toFixed(1) || 'New'}</span>
                                    {reviewCount > 0 && (
                                        <span className="text-gray-400 ml-1">({reviewCount})</span>
                                    )}
                                </span>
                            </div>
                        </div>
                        {isNew && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                New
                            </span>
                        )}
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {tags.map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Price & CTA */}
                    <div className="mt-4 flex items-center justify-between">
                        <div>
                            <span className="text-2xl font-bold text-blue-600">${price}</span>
                            {originalPrice && (
                                <span className="ml-2 text-sm text-gray-400 line-through">${originalPrice}</span>
                            )}
                            {discountPercentage > 0 && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                    -{discountPercentage}%
                                </span>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                                {shippingCost === 0 ? 'Free shipping' : `Shipping: $${shippingCost}`}
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            {isHot && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                    <TrendingUp className="h-3 w-3 mr-1" />
                                    Hot
                                </span>
                            )}
                            <Link
                                to={`/product/${slug}`}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                View Details
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ✅ Grid View (Default)
    return (
        <div className="bg-white rounded-lg shadow hover:shadow-lg transition group">
            {/* Image Container */}
            <Link to={`/product/${slug}`} className="relative block overflow-hidden rounded-t-lg">
                <LazyImage
                    src={image || '/placeholder-product.jpg'}
                    alt={name}
                    className="w-full h-48 object-cover group-hover:scale-105 transition duration-300"
                />

                {/* Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {isNew && (
                        <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded">
                            New
                        </span>
                    )}
                    {isHot && (
                        <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-medium rounded flex items-center">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Hot
                        </span>
                    )}
                    {discountPercentage > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded">
                            -{discountPercentage}%
                        </span>
                    )}
                </div>

                {/* Quick view button - appears on hover */}
                <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <button className="px-4 py-2 bg-white rounded-lg text-gray-900 font-medium hover:bg-gray-100">
                        Quick View
                    </button>
                </div>
            </Link>

            {/* Content */}
            <div className="p-4">
                <Link to={`/product/${slug}`} className="hover:text-blue-600">
                    <h3 className="font-semibold text-gray-900 line-clamp-2">{name}</h3>
                </Link>

                {/* Rating */}
                <div className="flex items-center mt-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="ml-1 text-sm font-medium">{rating?.toFixed(1) || 'New'}</span>
                    {reviewCount > 0 && (
                        <span className="ml-1 text-sm text-gray-400">({reviewCount})</span>
                    )}
                </div>

                {/* Demand Score */}
                {demandScore && (
                    <div className="mt-2 flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                                className="bg-blue-600 rounded-full h-1.5"
                                style={{ width: `${demandScore * 100}%` }}
                            />
                        </div>
                        <span className="ml-2 text-xs text-gray-500">
                            {(demandScore * 100).toFixed(0)}% demand
                        </span>
                    </div>
                )}

                {/* Price & Actions */}
                <div className="mt-3 flex items-center justify-between">
                    <div>
                        <span className="text-lg font-bold text-blue-600">${price}</span>
                        {originalPrice && (
                            <span className="ml-1 text-xs text-gray-400 line-through">${originalPrice}</span>
                        )}
                    </div>

                    <button
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                        onClick={() => {/* Add to cart */ }}
                    >
                        <ShoppingCart className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ProductCard;