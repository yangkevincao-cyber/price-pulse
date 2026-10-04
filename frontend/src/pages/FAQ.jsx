// frontend/src/pages/FAQ.jsx
import React, { useEffect, useState } from 'react';
import { updatePageMeta, generateFAQSchema, injectSchema } from '../utils/seo';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

function FAQ() {
    useEffect(() => {
        updatePageMeta({
            title: 'FAQ - PricePulse Help Center',
            description: 'Find answers to frequently asked questions about PricePulse - selling, buying, exchanges, payments, and more.',
            url: 'https://pricepulse.com/faq',
        });
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [openItems, setOpenItems] = useState([]);

    const faqs = [
        {
            category: 'Getting Started',
            questions: [
                {
                    q: 'What is PricePulse?',
                    a: 'PricePulse is an intelligent marketplace that helps sellers know what to sell with real-time demand alerts, and helps buyers find the best prices through global price comparison.'
                },
                {
                    q: 'How do I create an account?',
                    a: 'Click "Sign Up" on the homepage, enter your email and password, or sign up with Google. You can choose to be a buyer, seller, or both.'
                },
                {
                    q: 'Is PricePulse free to use?',
                    a: 'Yes, creating an account and browsing is free. Sellers pay a 5% commission on completed transactions.'
                }
            ]
        },
        {
            category: 'Selling',
            questions: [
                {
                    q: 'How do I list an item for sale?',
                    a: 'Go to your seller dashboard, click "New Listing", add photos, description, price, and condition. Your listing will be live immediately.'
                },
                {
                    q: 'How does the demand alert system work?',
                    a: 'Our AI analyzes search queries and market trends. When demand spikes for a product, we send you an alert with suggested pricing and opportunity scores.'
                },
                {
                    q: 'What payment methods do you support?',
                    a: 'We support Stripe (credit cards) and PayPal. Funds are held in escrow until the buyer confirms receipt.'
                },
                {
                    q: 'How do I get paid?',
                    a: 'Payouts are processed within 3-5 business days after successful delivery confirmation. Funds are sent to your connected Stripe or PayPal account.'
                }
            ]
        },
        {
            category: 'Buying',
            questions: [
                {
                    q: 'How do I find the best price?',
                    a: 'Use our price comparison tool to search for any product. We aggregate prices from global sellers and show you the cheapest options.'
                },
                {
                    q: 'Is it safe to buy on PricePulse?',
                    a: 'Yes! All payments are held in escrow. You get 14 days to confirm the item matches the description. Our fraud detection system monitors all transactions.'
                },
                {
                    q: 'Can I negotiate the price?',
                    a: 'Yes, many sellers accept offers. Look for the "Make an Offer" button on listings. Sellers can accept, decline, or counteroffer.'
                }
            ]
        },
        {
            category: 'Exchanges',
            questions: [
                {
                    q: 'How does the exchange system work?',
                    a: 'List items you want to trade. Our AI finds matching trades based on what others want. You can accept matches and arrange details with the other party.'
                },
                {
                    q: 'Is cash involved in exchanges?',
                    a: 'Cash adjustments are optional. The AI suggests fair value based on market prices. You can accept or propose a different adjustment.'
                },
                {
                    q: 'What if the exchange goes wrong?',
                    a: 'We recommend reviewing each other\'s profiles and ratings before trading. We provide dispute resolution for issues that arise.'
                }
            ]
        },
        {
            category: 'Account & Security',
            questions: [
                {
                    q: 'How do I reset my password?',
                    a: 'Click "Forgot Password" on the login page. We\'ll send a reset link to your registered email. Use it within 24 hours.'
                },
                {
                    q: 'How do I delete my account?',
                    a: 'Go to Settings > Account > Delete Account. You\'ll need to confirm your password and verify you want to permanently delete all data.'
                },
                {
                    q: 'How does fraud prevention work?',
                    a: 'We use AI-powered fraud detection that analyzes transaction patterns, IP addresses, device fingerprints, and user behavior to identify suspicious activity.'
                }
            ]
        }
    ];

    const toggleItem = (categoryIndex, questionIndex) => {
        const key = `${categoryIndex}-${questionIndex}`;
        if (openItems.includes(key)) {
            setOpenItems(openItems.filter(i => i !== key));
        } else {
            setOpenItems([...openItems, key]);
        }
    };

    // ✅ Inject FAQ Schema
    useEffect(() => {
        const allFaqs = faqs.flatMap(cat => cat.questions);
        const faqSchema = generateFAQSchema(allFaqs);
        injectSchema(faqSchema);
    }, []);

    const filteredFaqs = faqs.map(category => ({
        ...category,
        questions: category.questions.filter(
            q => q.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
                q.a.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(cat => cat.questions.length > 0);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero */}
            <div className="bg-gradient-to-r from-pulse-blue-900 to-pulse-blue-700 text-white py-16">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold">Frequently Asked Questions</h1>
                    <p className="mt-4 text-xl text-blue-100">
                        Find answers to common questions about PricePulse
                    </p>

                    {/* Search */}
                    <div className="mt-8 max-w-xl mx-auto relative">
                        <input
                            type="text"
                            placeholder="Search FAQs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-5 py-3 pl-12 bg-white/20 backdrop-blur text-white placeholder-blue-200 rounded-xl border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 h-5 w-5" />
                    </div>
                </div>
            </div>

            {/* FAQ Content */}
            <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                {filteredFaqs.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500">No results found for "{searchTerm}"</p>
                        <button
                            onClick={() => setSearchTerm('')}
                            className="mt-4 text-pulse-blue-600 hover:text-pulse-blue-800"
                        >
                            Clear search
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {filteredFaqs.map((category, catIndex) => (
                            <div key={catIndex} className="bg-white rounded-2xl shadow-soft p-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">
                                    {category.category}
                                </h2>
                                <div className="space-y-3">
                                    {category.questions.map((faq, qIndex) => {
                                        const key = `${catIndex}-${qIndex}`;
                                        const isOpen = openItems.includes(key);

                                        return (
                                            <div key={qIndex} className="border border-gray-200 rounded-xl overflow-hidden">
                                                <button
                                                    onClick={() => toggleItem(catIndex, qIndex)}
                                                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition"
                                                >
                                                    <span className="font-medium text-gray-900">
                                                        {faq.q}
                                                    </span>
                                                    {isOpen ? (
                                                        <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0 ml-4" />
                                                    ) : (
                                                        <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0 ml-4" />
                                                    )}
                                                </button>

                                                {isOpen && (
                                                    <div className="px-5 pb-4 text-gray-600 leading-relaxed">
                                                        {faq.a}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Contact CTA */}
                <div className="mt-12 bg-pulse-blue-50 rounded-2xl p-8 text-center">
                    <h3 className="text-lg font-semibold text-gray-900">Still have questions?</h3>
                    <p className="text-gray-600 mt-2">
                        Can't find what you're looking for? Our support team is here to help.
                    </p>
                    <a
                        href="/contact"
                        className="inline-block mt-4 px-6 py-3 bg-pulse-blue-600 text-white rounded-xl font-medium hover:bg-pulse-blue-700 transition"
                    >
                        Contact Support
                    </a>
                </div>
            </div>
        </div>
    );
}

export default FAQ;