// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store';

// Layout
import Layout from './components/Layout/Layout';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SellerDashboard from './pages/SellerDashboard';
import DemandAlerts from './pages/DemandAlerts';
import PriceComparison from './pages/PriceComparison';
import Exchanges from './pages/Exchanges';
import AdminPanel from './pages/AdminPanel';

const queryClient = new QueryClient();

function PrivateRoute({ children, role }) {
    const { user, isAuthenticated } = useAuthStore();

    if (!isAuthenticated) return <Navigate to="/login" />;
    if (role && user?.role !== role) return <Navigate to="/" />;

    return children;
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Toaster position="top-right" />
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    <Route path="/" element={<Layout />}>
                        <Route index element={<Home />} />
                        <Route path="compare" element={<PriceComparison />} />
                        <Route path="exchanges" element={<Exchanges />} />

                        {/* Seller Routes */}
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
                        </Route>

                        {/* Admin Routes */}
                        <Route
                            path="admin"
                            element={
                                <PrivateRoute role="admin">
                                    <AdminPanel />
                                </PrivateRoute>
                            }
                        />
                    </Route>
                </Routes>
            </BrowserRouter>
        </QueryClientProvider>
    );
}

export default App;