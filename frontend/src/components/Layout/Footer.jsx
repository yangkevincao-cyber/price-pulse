// frontend/src/components/Layout/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import {
    Twitter,
    Facebook,
    Instagram,
    Linkedin,
    Github,
    Mail,
    MapPin,
    Phone,
    Heart
} from 'lucide-react';

function Footer() {
    const currentYear = new Date().getFullYear();

    const footerLinks = {
        platform: [
            { name: 'About', href: '/about' },
            { name: 'Contact', href: '/contact' },
            { name: 'FAQ', href: '/faq' },
            { name: 'Blog', href: '/blog' },
            { name: 'Careers', href: '/careers' },
        ],
        marketplace: [
            { name: 'Sell', href: '/sell' },
            { name: 'Buy', href: '/compare' },
            { name: 'Exchange', href: '/exchanges' },
            { name: 'Categories', href: '/categories' },
            { name: 'Trending', href: '/trending' },
        ],
        support: [
            { name: 'Help Center', href: '/help' },
            { name: 'Safety Tips', href: '/safety' },
            { name: 'Disputes', href: '/disputes' },
            { name: 'Returns', href: '/returns' },
            { name: 'Report Issue', href: '/report' },
        ],
        legal: [
            { name: 'Privacy Policy', href: '/privacy' },
            { name: 'Terms of Service', href: '/terms' },
            { name: 'Cookie Policy', href: '/cookies' },
            { name: 'GDPR', href: '/gdpr' },
            { name: 'Transparency', href: '/transparency' },
        ],
    };

    return (
        <footer className="bg-gray-900 text-white">
            {/* Main Footer */}
            <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
                    {/* Brand */}
                    <div className="lg:col-span-1">
                        <Link to="/" className="text-2xl font-black">
                            PRICE<span className="text-pulse-orange-500">PULSE</span>
                        </Link>
                        <p className="mt-4 text-gray-400 text-sm">
                            Feel the market pulse. Real-time demand alerts, price comparison, and smart exchanges.
                        </p>
                        <div className="mt-4 flex space-x-4">
                            <a href="#" className="text-gray-400 hover:text-white transition">
                                <Twitter className="h-5 w-5" />
                            </a>
                            <a href="#" className="text-gray-400 hover:text-white transition">
                                <Facebook className="h-5 w-5" />
                            </a>
                            <a href="#" className="text-gray-400 hover:text-white transition">
                                <Instagram className="h-5 w-5" />
                            </a>
                            <a href="#" className="text-gray-400 hover:text-white transition">
                                <Linkedin className="h-5 w-5" />
                            </a>
                            <a href="#" className="text-gray-400 hover:text-white transition">
                                <Github className="h-5 w-5" />
                            </a>
                        </div>
                    </div>

                    {/* Platform */}
                    <div>
                        <h3 className="font-semibold text-white">Platform</h3>
                        <ul className="mt-4 space-y-2">
                            {footerLinks.platform.map((link) => (
                                <li key={link.name}>
                                    <Link to={link.href} className="text-gray-400 hover:text-white text-sm transition">
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Marketplace */}
                    <div>
                        <h3 className="font-semibold text-white">Marketplace</h3>
                        <ul className="mt-4 space-y-2">
                            {footerLinks.marketplace.map((link) => (
                                <li key={link.name}>
                                    <Link to={link.href} className="text-gray-400 hover:text-white text-sm transition">
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h3 className="font-semibold text-white">Support</h3>
                        <ul className="mt-4 space-y-2">
                            {footerLinks.support.map((link) => (
                                <li key={link.name}>
                                    <Link to={link.href} className="text-gray-400 hover:text-white text-sm transition">
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h3 className="font-semibold text-white">Legal</h3>
                        <ul className="mt-4 space-y-2">
                            {footerLinks.legal.map((link) => (
                                <li key={link.name}>
                                    <Link to={link.href} className="text-gray-400 hover:text-white text-sm transition">
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="mt-8 pt-8 border-t border-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
                        <div className="flex items-center">
                            <Mail className="h-5 w-5 mr-3 text-gray-500" />
                            <span>support@pricepulse.com</span>
                        </div>
                        <div className="flex items-center">
                            <Phone className="h-5 w-5 mr-3 text-gray-500" />
                            <span>+1 (800) 123-4567</span>
                        </div>
                        <div className="flex items-center">
                            <MapPin className="h-5 w-5 mr-3 text-gray-500" />
                            <span>San Francisco, CA</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
                    <p>
                        © {currentYear} PricePulse. All rights reserved.
                        Made with <Heart className="h-4 w-4 text-pulse-red-500 inline" /> by the PricePulse team.
                    </p>
                    <div className="flex space-x-4 mt-4 md:mt-0">
                        <Link to="/sitemap" className="hover:text-white transition">Sitemap</Link>
                        <Link to="/accessibility" className="hover:text-white transition">Accessibility</Link>
                        <Link to="/cookies" className="hover:text-white transition">Cookies</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default Footer;