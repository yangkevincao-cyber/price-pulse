// frontend/src/pages/About.jsx
import React, { useEffect } from 'react';
import { updatePageMeta } from '../utils/seo';
import { Users, Award, Shield, Globe, Zap, Heart } from 'lucide-react';

function About() {
    useEffect(() => {
        updatePageMeta({
            title: 'About PricePulse - Our Mission & Story',
            description: 'Learn about PricePulse, our mission to democratize market intelligence, and how we help sellers and buyers make smarter decisions.',
            url: 'https://pricepulse.com/about',
        });
    }, []);

    const values = [
        {
            icon: <Zap className="h-6 w-6" />,
            title: 'Intelligence',
            description: 'We use AI and data to give you market insights you won\'t find anywhere else.'
        },
        {
            icon: <Shield className="h-6 w-6" />,
            title: 'Trust',
            description: 'Transparent pricing, verified users, and fair exchange matching.'
        },
        {
            icon: <Heart className="h-6 w-6" />,
            title: 'Community',
            description: 'Built for sellers, buyers, and traders to thrive together.'
        },
        {
            icon: <Globe className="h-6 w-6" />,
            title: 'Global Reach',
            description: 'Connect with buyers and sellers from around the world.'
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero */}
            <div className="bg-gradient-to-r from-pulse-blue-900 to-pulse-blue-700 text-white py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold">About PricePulse</h1>
                    <p className="mt-4 text-xl text-blue-100 max-w-3xl mx-auto">
                        We're on a mission to democratize market intelligence and make buying, selling, and trading smarter for everyone.
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                {/* Story */}
                <div className="bg-white rounded-2xl shadow-soft p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Story</h2>
                    <p className="text-gray-600 leading-relaxed">
                        PricePulse was born from a simple observation: sellers often guess what to sell, and buyers struggle to find the best prices. We created a platform that gives sellers real-time demand alerts and buyers comprehensive price comparison, all powered by AI and data analytics.
                    </p>
                    <p className="text-gray-600 leading-relaxed mt-4">
                        Today, PricePulse helps thousands of sellers know exactly what to sell, when to sell it, and for how much. Buyers save money by finding the best deals across global markets. And traders connect through our AI-powered exchange matching.
                    </p>
                </div>

                {/* Values */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Our Values</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {values.map((value, index) => (
                            <div key={index} className="bg-white rounded-xl shadow-soft p-6 text-center">
                                <div className="inline-flex p-3 bg-pulse-blue-100 text-pulse-blue-600 rounded-full mb-4">
                                    {value.icon}
                                </div>
                                <h3 className="font-semibold text-gray-900">{value.title}</h3>
                                <p className="mt-2 text-sm text-gray-600">{value.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white rounded-2xl shadow-soft p-8">
                    <div className="text-center">
                        <p className="text-3xl font-bold text-pulse-blue-600">50K+</p>
                        <p className="text-sm text-gray-500">Active Users</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-pulse-blue-600">100K+</p>
                        <p className="text-sm text-gray-500">Products Listed</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-pulse-blue-600">90%</p>
                        <p className="text-sm text-gray-500">Seller Satisfaction</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-pulse-blue-600">$10M+</p>
                        <p className="text-sm text-gray-500">Total Transactions</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default About;