// frontend/src/components/CategoryFilter.jsx
import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, Filter, Star } from 'lucide-react';

export default function CategoryFilter({ categoryId, filters = {}, onApplyFilters, onClose }) {
    const [localFilters, setLocalFilters] = useState({
        priceRange: filters.priceRange || { min: 0, max: 1000 },
        condition: filters.condition || [],
        brand: filters.brand || [],
        rating: filters.rating || 0,
        inStock: filters.inStock || false,
    });

    const [expanded, setExpanded] = useState({
        price: true,
        condition: true,
        rating: true,
    });

    const toggleSection = (section) =>
        setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

    const handlePriceChange = (type, value) =>
        setLocalFilters(prev => ({
            ...prev,
            priceRange: { ...prev.priceRange, [type]: value },
        }));

    const handleConditionToggle = (condition) => {
        const current = localFilters.condition || [];
        const updated = current.includes(condition)
            ? current.filter(c => c !== condition)
            : [...current, condition];
        setLocalFilters({ ...localFilters, condition: updated });
    };

    const handleApply = () => onApplyFilters?.(localFilters);

    const handleReset = () => {
        const reset = {
            priceRange: { min: 0, max: 1000 },
            condition: [],
            brand: [],
            rating: 0,
            inStock: false,
        };
        setLocalFilters(reset);
        onApplyFilters?.(reset);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900 flex items-center">
                    <Filter className="h-5 w-5 mr-2" /> Filters
                </h3>
                <div className="flex items-center space-x-2">
                    <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700">
                        Reset
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Price Range */}
            <div className="border-b border-gray-200 pb-4">
                <button
                    onClick={() => toggleSection('price')}
                    className="flex justify-between items-center w-full text-left"
                >
                    <span className="font-medium text-gray-900">Price Range</span>
                    {expanded.price ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {expanded.price && (
                    <div className="mt-3 space-y-2">
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Min"
                                value={localFilters.priceRange.min}
                                onChange={(e) => handlePriceChange('min', parseFloat(e.target.value) || 0)}
                                className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                            <input
                                type="number"
                                placeholder="Max"
                                value={localFilters.priceRange.max}
                                onChange={(e) => handlePriceChange('max', parseFloat(e.target.value) || 1000)}
                                className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Condition */}
            <div className="border-b border-gray-200 pb-4">
                <button
                    onClick={() => toggleSection('condition')}
                    className="flex justify-between items-center w-full text-left"
                >
                    <span className="font-medium text-gray-900">Condition</span>
                    {expanded.condition ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {expanded.condition && (
                    <div className="mt-3 space-y-2">
                        {['new', 'like-new', 'good', 'fair'].map((condition) => (
                            <label key={condition} className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={localFilters.condition.includes(condition)}
                                    onChange={() => handleConditionToggle(condition)}
                                    className="h-4 w-4 text-blue-600 rounded"
                                />
                                <span className="ml-2 text-sm text-gray-700 capitalize">
                                    {condition.replace('-', ' ')}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {/* Rating */}
            <div className="border-b border-gray-200 pb-4">
                <button
                    onClick={() => toggleSection('rating')}
                    className="flex justify-between items-center w-full text-left"
                >
                    <span className="font-medium text-gray-900">Rating</span>
                    {expanded.rating ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {expanded.rating && (
                    <div className="mt-3 space-y-2">
                        {[4, 3, 2, 1].map((rating) => (
                            <label key={rating} className="flex items-center">
                                <input
                                    type="radio"
                                    name="rating"
                                    checked={localFilters.rating === rating}
                                    onChange={() => setLocalFilters({ ...localFilters, rating })}
                                    className="h-4 w-4 text-blue-600"
                                />
                                <span className="ml-2 flex items-center text-sm text-gray-700">
                                    {Array.from({ length: 5 }, (_, i) => (
                                        <Star
                                            key={i}
                                            className={`h-4 w-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                                        />
                                    ))}
                                    <span className="ml-1">& up</span>
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {/* In Stock */}
            <div className="pb-4">
                <label className="flex items-center">
                    <input
                        type="checkbox"
                        checked={localFilters.inStock}
                        onChange={(e) => setLocalFilters({ ...localFilters, inStock: e.target.checked })}
                        className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">In Stock Only</span>
                </label>
            </div>

            <button
                onClick={handleApply}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
            >
                Apply Filters
            </button>
        </div>
    );
}
