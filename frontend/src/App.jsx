// frontend/src/App.jsx
import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import { updatePageMeta } from './utils/seo';
import { useWebSocket } from './hooks/useWebSocket';

// ✅ Lazy load pages for better performance
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const SellerDashboard = lazy(() => import('./pages/SellerDashboard'));
const DemandAlerts = lazy(() => import('./pages/DemandAlerts'));
const PriceComparison = lazy(() => import('./pages/PriceComparison'));
const Exchanges = lazy(() => import('./pages/Exchanges'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const FAQ = lazy(() => import('./pages/FAQ'));

// ✅ Layout components
import Layout from './components/Layout/Layout';
import LoadingSpinner from './components/Common/LoadingSpinner';

// ✅ Private route guard
const PrivateRoute = ({ children, role }) => {
    const { user, isAuthenticated } = useAuthStore();

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (role && user?.role !== role) return <Navigate to="/" replace />;

    return children;
};

function App() {
    const { isAuthenticated } = useAuthStore();

    // ✅ Initialize WebSocket connection when authenticated
    const { isConnected } = useWebSocket();

    // ✅ Set default SEO meta tags
    useEffect(() => {
        updatePageMeta({
            title: 'PricePulse - Feel the Market Pulse | Price Comparison & Demand Alerts',
            description: 'PricePulse helps sellers know what to sell and buyers find the best prices. Real-time demand alerts, price comparison across global sellers, and smart exchange matching.',
            url: window.location.href,
        });
    }, []);

    return (
        <BrowserRouter>
            <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Main Layout Routes */}
                    <Route path="/" element={<Layout />}>
                        {/* Homepage */}
                        <Route index element={<Home />} />

                        {/* Static Pages */}
                        <Route path="about" element={<About />} />
                        <Route path="contact" element={<Contact />} />
                        <Route path="privacy" element={<Privacy />} />
                        <Route path="terms" element={<Terms />} />
                        <Route path="faq" element={<FAQ />} />

                        {/* Product & Category */}
                        <Route path="product/:slug" element={<ProductDetail />} />
                        <Route path="category/:id" element={<CategoryPage />} />
                        <Route path="category/:id/subcategory/:subId" element={<CategoryPage />} />

                        {/* Search */}
                        <Route path="search" element={<PriceComparison />} />

                        {/* Public Marketplace */}
                        <Route path="compare" element={<PriceComparison />} />
                        <Route path="exchanges" element={<Exchanges />} />

                        {/* ✅ Seller Routes (Authenticated) */}
                        <Route path="seller">
                            <Route
                                index
                                element={
                                    <PrivateRoute role="seller">
                                        <SellerDashboard />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="alerts"
                                element={
                                    <PrivateRoute role="seller">
                                        <DemandAlerts />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="listings"
                                element={
                                    <PrivateRoute role="seller">
                                        <SellerListings />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="analytics"
                                element={
                                    <PrivateRoute role="seller">
                                        <SellerAnalytics />
                                    </PrivateRoute>
                                }
                            />
                        </Route>

                        {/* ✅ Admin Routes */}
                        <Route
                            path="admin"
                            element={
                                <PrivateRoute role="admin">
                                    <AdminPanel />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="admin/*"
                            element={
                                <PrivateRoute role="admin">
                                    <AdminPanel />
                                </PrivateRoute>
                            }
                        />

                        {/* 404 - Not Found */}
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}

// ✅ 404 Page with good SEO
const NotFound = () => {
    useEffect(() => {
        updatePageMeta({
            title: 'Page Not Found - PricePulse',
            description: 'The page you\'re looking for doesn\'t exist. Explore PricePulse for price comparison and demand alerts.',
            url: window.location.href,
        });
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-900">404</h1>
                <h2 className="text-2xl font-semibold mt-4">Page Not Found</h2>
                <p className="text-gray-600 mt-2">The page you're looking for doesn't exist.</p>
                <a
                    href="/"
                    className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    Go Home
                </a>
            </div>
        </div>
    );
};

export default App;