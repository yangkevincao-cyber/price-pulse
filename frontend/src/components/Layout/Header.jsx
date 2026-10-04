// frontend/src/components/Layout/Header.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore, useAlertStore } from '../../store';
import {
    Search,
    Bell,
    User,
    ShoppingBag,
    Menu,
    X,
    TrendingUp,
    DollarSign,
    ArrowRightLeft,
    Home
} from 'lucide-react';

function Header() {
    const { user, isAuthenticated, logout } = useAuthStore();
    const { unreadCount, fetchAlerts } = useAlertStore();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            fetchAlerts();
        }
    }, [isAuthenticated]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
            setIsSearchOpen(false);
        }
    };

    return (
        <header className="bg-white shadow-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center space-x-2">
                        <span className="text-2xl font-black text-blue-600">
                            PRICE<span className="text-orange-500">PULSE</span>
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-6">
                        <Link to="/" className="text-gray-700 hover:text-blue-600 font-medium">
                            Home
                        </Link>
                        <Link to="/compare" className="text-gray-700 hover:text-blue-600 font-medium">
                            <span className="flex items-center">
                                <DollarSign className="h-4 w-4 mr-1" />
                                Compare
                            </span>
                        </Link>
                        <Link to="/exchanges" className="text-gray-700 hover:text-blue-600 font-medium">
                            <span className="flex items-center">
                                <ArrowRightLeft className="h-4 w-4 mr-1" />
                                Exchange
                            </span>
                        </Link>
                        {isAuthenticated && user?.role === 'seller' && (
                            <Link to="/seller" className="text-gray-700 hover:text-blue-600 font-medium">
                                <span className="flex items-center">
                                    <TrendingUp className="h-4 w-4 mr-1" />
                                    Dashboard
                                </span>
                            </Link>
                        )}
                    </nav>

                    {/* Right Section */}
                    <div className="flex items-center space-x-4">
                        {/* Search - Desktop */}
                        <form onSubmit={handleSearch} className="hidden md:flex items-center">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button
                                    type="submit"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
                                >
                                    <Search className="h-5 w-5" />
                                </button>
                            </div>
                        </form>

                        {/* Notifications */}
                        {isAuthenticated && (
                            <Link to="/seller/alerts" className="relative text-gray-600 hover:text-blue-600">
                                <Bell className="h-6 w-6" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white font-medium">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </Link>
                        )}

                        {/* User Menu */}
                        {isAuthenticated ? (
                            <div className="relative">
                                <button
                                    onClick={() => {/* Toggle dropdown */ }}
                                    className="flex items-center space-x-2 text-gray-700 hover:text-blue-600"
                                >
                                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                        <User className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <span className="hidden lg:inline font-medium">
                                        {user?.username}
                                    </span>
                                </button>
                            </div>
                        ) : (
                            <Link
                                to="/login"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                            >
                                Sign In
                            </Link>
                        )}

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden text-gray-600 hover:text-blue-600"
                        >
                            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Search */}
                <div className="md:hidden pb-3">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
                        >
                            <Search className="h-5 w-5" />
                        </button>
                    </form>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden py-4 border-t border-gray-200">
                        <nav className="flex flex-col space-y-4">
                            <Link
                                to="/"
                                className="text-gray-700 hover:text-blue-600 font-medium"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <span className="flex items-center">
                                    <Home className="h-5 w-5 mr-2" />
                                    Home
                                </span>
                            </Link>
                            <Link
                                to="/compare"
                                className="text-gray-700 hover:text-blue-600 font-medium"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <span className="flex items-center">
                                    <DollarSign className="h-5 w-5 mr-2" />
                                    Compare Prices
                                </span>
                            </Link>
                            <Link
                                to="/exchanges"
                                className="text-gray-700 hover:text-blue-600 font-medium"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <span className="flex items-center">
                                    <ArrowRightLeft className="h-5 w-5 mr-2" />
                                    Exchange
                                </span>
                            </Link>
                            {isAuthenticated && (
                                <>
                                    <Link
                                        to="/seller"
                                        className="text-gray-700 hover:text-blue-600 font-medium"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        <span className="flex items-center">
                                            <TrendingUp className="h-5 w-5 mr-2" />
                                            Seller Dashboard
                                        </span>
                                    </Link>
                                    <button
                                        onClick={() => {
                                            logout();
                                            setIsMobileMenuOpen(false);
                                            navigate('/');
                                        }}
                                        className="text-left text-red-600 hover:text-red-700 font-medium"
                                    >
                                        Sign Out
                                    </button>
                                </>
                            )}
                            {!isAuthenticated && (
                                <Link
                                    to="/login"
                                    className="text-blue-600 hover:text-blue-700 font-medium"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Sign In
                                </Link>
                            )}
                        </nav>
                    </div>
                )}
            </div>
        </header>
    );
}

export default Header;