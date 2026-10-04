// frontend/src/components/Layout/Layout.jsx
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import CookieConsent from '../Common/CookieConsent';
import ScrollToTop from '../Common/ScrollToTop';

function Layout() {
    const location = useLocation();

    // ✅ Detect if it's a seller or admin route to adjust layout
    const isSellerRoute = location.pathname.startsWith('/seller');
    const isAdminRoute = location.pathname.startsWith('/admin');

    // ✅ Don't show footer on admin pages
    const showFooter = !isAdminRoute;

    // ✅ Don't show header on login/register pages (handled separately)
    const showHeader = !['/login', '/register'].includes(location.pathname);

    return (
        <div className="min-h-screen flex flex-col">
            <ScrollToTop />

            {showHeader && <Header />}

            <main className={`flex-1 ${isSellerRoute ? 'bg-gray-50' : ''}`}>
                <Outlet />
            </main>

            {showFooter && <Footer />}

            <CookieConsent />
        </div>
    );
}

export default Layout;