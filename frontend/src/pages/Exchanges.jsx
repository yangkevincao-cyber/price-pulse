// frontend/src/pages/Exchanges.jsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import {
    ArrowRightLeft,
    Plus,
    Search,
    Filter,
    X,
    Check,
    Clock,
    User,
    Package,
    DollarSign,
    TrendingUp,
    Star,
    RefreshCw,
    MessageCircle,
    ThumbsUp,
    ThumbsDown
} from 'lucide-react';
import { useAuthStore } from '../store';
import { updatePageMeta } from '../utils/seo';
import api from '../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/Common/LoadingSpinner';

function Exchanges() {
    const { user, isAuthenticated } = useAuthStore();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('browse'); // browse | my-listings | matches
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({
        offered_product_id: '',
        offered_condition: 'good',
        offered_quantity: 1,
        wanted_product_id: '',
        wanted_condition: 'any',
        cash_adjustment: 0,
    });
    const [selectedMatch, setSelectedMatch] = useState(null);

    // ✅ Update SEO
    useEffect(() => {
        updatePageMeta({
            title: 'Smart Exchange - Trade Items Fairly | PricePulse',
            description: 'Find fair exchange matches for your items. AI-powered barter matching with suggested cash adjustments.',
            url: 'https://pricepulse.com/exchanges',
        });
    }, []);

    // Fetch exchange listings
    const { data: listings, isLoading: listingsLoading } = useQuery(
        ['exchangeListings', activeTab],
        () => api.get(`/exchanges/listings?type=${activeTab}`).then(res => res.data)
    );

    // Fetch exchange matches
    const { data: matches, isLoading: matchesLoading } = useQuery(
        ['exchangeMatches'],
        () => api.get('/exchanges/matches').then(res => res.data),
        { enabled: isAuthenticated }
    );

    // Search products for exchange
    const { data: searchResults } = useQuery(
        ['exchangeSearch', searchQuery],
        () => api.get('/products/search', { params: { q: searchQuery, limit: 10 } }).then(res => res.data),
        { enabled: searchQuery.length > 2 }
    );

    // Create exchange listing mutation
    const createListingMutation = useMutation(
        (data) => api.post('/exchanges/listings', data),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('exchangeListings');
                toast.success('Exchange listing created successfully!');
                setShowCreateModal(false);
                setFormData({
                    offered_product_id: '',
                    offered_condition: 'good',
                    offered_quantity: 1,
                    wanted_product_id: '',
                    wanted_condition: 'any',
                    cash_adjustment: 0,
                });
            },
            onError: (error) => {
                toast.error(error.response?.data?.message || 'Failed to create listing');
            }
        }
    );

    // Accept exchange match mutation
    const acceptMatchMutation = useMutation(
        (matchId) => api.post(`/exchanges/matches/${matchId}/accept`),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('exchangeMatches');
                toast.success('Exchange accepted! Contact the other user to arrange details.');
            }
        }
    );

    // Decline exchange match mutation
    const declineMatchMutation = useMutation(
        (matchId) => api.post(`/exchanges/matches/${matchId}/decline`),
        {
            onSuccess: () => {
                queryClient.invalidateQueries('exchangeMatches');
                toast.success('Exchange declined');
            }
        }
    );

    const handleSubmitListing = (e) => {
        e.preventDefault();
        createListingMutation.mutate(formData);
    };

    const loading = listingsLoading || matchesLoading;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ✅ Hero Section */}
            <div className="bg-gradient-to-r from-pulse-green-700 to-pulse-green-500 text-white">
                <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold flex items-center">
                                <ArrowRightLeft className="h-8 w-8 mr-3" />
                                Smart Exchange
                            </h1>
                            <p className="mt-2 text-green-100">
                                Trade items fairly with AI-powered matching. No money needed, just fair exchanges.
                            </p>
                        </div>
                        {isAuthenticated && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="mt-4 md:mt-0 inline-flex items-center px-5 py-3 bg-white text-pulse-green-700 rounded-xl font-medium hover:bg-gray-50 transition"
                            >
                                <Plus className="h-5 w-5 mr-2" />
                                List Item for Exchange
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* ✅ Tabs */}
                <div className="border-b border-gray-200 mb-8">
                    <nav className="flex space-x-8">
                        <button
                            onClick={() => setActiveTab('browse')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'browse'
                                    ? 'border-pulse-green-500 text-pulse-green-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Browse Exchanges
                        </button>
                        {isAuthenticated && (
                            <>
                                <button
                                    onClick={() => setActiveTab('my-listings')}
                                    className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'my-listings'
                                            ? 'border-pulse-green-500 text-pulse-green-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    My Listings
                                </button>
                                <button
                                    onClick={() => setActiveTab('matches')}
                                    className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'matches'
                                            ? 'border-pulse-green-500 text-pulse-green-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Matches
                                    {matches?.length > 0 && (
                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pulse-red-100 text-pulse-red-800">
                                            {matches.length}
                                        </span>
                                    )}
                                </button>
                            </>
                        )}
                    </nav>
                </div>

                {/* ✅ Content */}
                {loading ? (
                    <LoadingSpinner />
                ) : (
                    <>
                        {/* Browse / My Listings */}
                        {(activeTab === 'browse' || activeTab === 'my-listings') && (
                            <>
                                {/* Search */}
                                <div className="mb-6">
                                    <div className="relative max-w-md">
                                        <input
                                            type="text"
                                            placeholder="Search exchange listings..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-green-500 focus:border-transparent"
                                        />
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                    </div>
                                </div>

                                {/* Listings Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {listings?.length > 0 ? (
                                        listings.map((listing) => (
                                            <ExchangeCard
                                                key={listing.id}
                                                listing={listing}
                                                isOwner={listing.user_id === user?.id}
                                            />
                                        ))
                                    ) : (
                                        <div className="col-span-full text-center py-12">
                                            <Package className="h-12 w-12 text-gray-300 mx-auto" />
                                            <h3 className="mt-4 text-lg font-medium text-gray-900">
                                                No exchange listings found
                                            </h3>
                                            <p className="mt-1 text-sm text-gray-500">
                                                {activeTab === 'my-listings'
                                                    ? 'You haven\'t listed any items for exchange yet.'
                                                    : 'No items available for exchange at the moment.'}
                                            </p>
                                            {activeTab === 'my-listings' && (
                                                <button
                                                    onClick={() => setShowCreateModal(true)}
                                                    className="mt-4 text-pulse-green-600 hover:text-pulse-green-800"
                                                >
                                                    Create your first listing →
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Matches Tab */}
                        {activeTab === 'matches' && (
                            <div>
                                {matches?.length > 0 ? (
                                    <div className="space-y-4">
                                        {matches.map((match) => (
                                            <MatchCard
                                                key={match.id}
                                                match={match}
                                                onAccept={() => acceptMatchMutation.mutate(match.id)}
                                                onDecline={() => declineMatchMutation.mutate(match.id)}
                                                isPending={acceptMatchMutation.isLoading || declineMatchMutation.isLoading}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <RefreshCw className="h-12 w-12 text-gray-300 mx-auto" />
                                        <h3 className="mt-4 text-lg font-medium text-gray-900">
                                            No matches yet
                                        </h3>
                                        <p className="mt-1 text-sm text-gray-500">
                                            We'll notify you when we find a good match for your items.
                                        </p>
                                        <Link
                                            to="/seller/alerts"
                                            className="mt-4 inline-block text-pulse-green-600 hover:text-pulse-green-800"
                                        >
                                            Enable exchange notifications →
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ✅ Create Listing Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold">List Item for Exchange</h2>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmitListing} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        What are you offering?
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search your products..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-green-500"
                                        />
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                    </div>
                                    {searchResults?.products?.length > 0 && (
                                        <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg">
                                            {searchResults.products.map(product => (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({
                                                            ...formData,
                                                            offered_product_id: product.id
                                                        });
                                                        setSearchQuery(product.name);
                                                    }}
                                                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                                                >
                                                    <span>{product.name}</span>
                                                    <span className="text-sm text-gray-500">${product.price}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Offered Condition
                                        </label>
                                        <select
                                            value={formData.offered_condition}
                                            onChange={(e) => setFormData({ ...formData, offered_condition: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-green-500"
                                        >
                                            <option value="new">New</option>
                                            <option value="like-new">Like New</option>
                                            <option value="good">Good</option>
                                            <option value="fair">Fair</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Quantity
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.offered_quantity}
                                            onChange={(e) => setFormData({ ...formData, offered_quantity: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-green-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        What do you want in exchange?
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Laptop, Bicycle, etc."
                                        value={formData.wanted_product_name}
                                        onChange={(e) => {
                                            setFormData({
                                                ...formData,
                                                wanted_product_name: e.target.value,
                                                wanted_product_id: ''
                                            });
                                        }}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-green-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Wanted Condition
                                    </label>
                                    <select
                                        value={formData.wanted_condition}
                                        onChange={(e) => setFormData({ ...formData, wanted_condition: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-green-500"
                                    >
                                        <option value="any">Any Condition</option>
                                        <option value="new">New</option>
                                        <option value="like-new">Like New</option>
                                        <option value="good">Good</option>
                                        <option value="fair">Fair</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Cash Adjustment (Optional)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formData.cash_adjustment}
                                        onChange={(e) => setFormData({ ...formData, cash_adjustment: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-green-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Positive means you want cash on top, negative means you'll add cash
                                    </p>
                                </div>

                                <div className="flex justify-end space-x-3 pt-4 border-t">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createListingMutation.isLoading}
                                        className="px-4 py-2 bg-pulse-green-600 text-white rounded-lg hover:bg-pulse-green-700 disabled:opacity-50"
                                    >
                                        {createListingMutation.isLoading ? 'Creating...' : 'List for Exchange'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ✅ Exchange Card Component
const ExchangeCard = ({ listing, isOwner }) => {
    return (
        <div className="bg-white rounded-xl shadow-card border border-gray-200 p-5 hover:shadow-card-hover transition">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{listing.offered_product_name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Offered by {listing.owner_name}
                    </p>
                </div>
                {isOwner && (
                    <span className="badge badge-blue">Your Listing</span>
                )}
            </div>

            <div className="mt-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Condition: {listing.offered_condition}</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                    Wants: {listing.wanted_product_name || 'Any item'}
                </span>
            </div>

            {listing.cash_adjustment !== 0 && (
                <div className="mt-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                        {listing.cash_adjustment > 0 ? '+' : ''}${listing.cash_adjustment} adjustment
                    </span>
                </div>
            )}

            <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                    {new Date(listing.created_at).toLocaleDateString()}
                </span>
                <button className="px-3 py-1.5 bg-pulse-green-600 text-white text-sm rounded-lg hover:bg-pulse-green-700 transition">
                    Propose Trade
                </button>
            </div>
        </div>
    );
};

// ✅ Match Card Component
const MatchCard = ({ match, onAccept, onDecline, isPending }) => {
    return (
        <div className="bg-white rounded-xl shadow-card border border-pulse-green-200 p-6">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="badge badge-green">AI Match</span>
                        <span className="text-sm font-medium text-pulse-green-600">
                            {(match.match_score * 100).toFixed(0)}% Match Quality
                        </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">You Offer</p>
                            <p className="font-medium">{match.your_offered_product}</p>
                            <p className="text-sm text-gray-600">{match.your_offered_condition}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">You Receive</p>
                            <p className="font-medium">{match.their_offered_product}</p>
                            <p className="text-sm text-gray-600">{match.their_offered_condition}</p>
                        </div>
                    </div>

                    {match.suggested_cash_adjustment !== 0 && (
                        <div className="mt-3 p-3 bg-pulse-orange-50 rounded-lg">
                            <p className="text-sm text-pulse-orange-800">
                                Suggested cash adjustment: ${match.suggested_cash_adjustment}
                                {match.suggested_cash_adjustment > 0
                                    ? ' (you receive)'
                                    : ' (you pay)'}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                    <button
                        onClick={onAccept}
                        disabled={isPending}
                        className="px-4 py-2 bg-pulse-green-600 text-white rounded-lg hover:bg-pulse-green-700 disabled:opacity-50 flex items-center"
                    >
                        <ThumbsUp className="h-4 w-4 mr-1" />
                        Accept
                    </button>
                    <button
                        onClick={onDecline}
                        disabled={isPending}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center"
                    >
                        <ThumbsDown className="h-4 w-4 mr-1" />
                        Decline
                    </button>
                    <button className="px-4 py-2 text-pulse-blue-600 hover:text-pulse-blue-800 text-sm">
                        <MessageCircle className="h-4 w-4 inline mr-1" />
                        Message
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Exchanges;