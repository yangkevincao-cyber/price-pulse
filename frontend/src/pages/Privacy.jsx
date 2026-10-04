// frontend/src/pages/Privacy.jsx
import React, { useEffect } from 'react';
import { updatePageMeta } from '../utils/seo';

function Privacy() {
    useEffect(() => {
        updatePageMeta({
            title: 'Privacy Policy - PricePulse',
            description: 'Learn how PricePulse collects, uses, and protects your personal data. We are committed to transparency and data privacy.',
            url: 'https://pricepulse.com/privacy',
        });
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-2xl shadow-soft p-8 md:p-12">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
                    <p className="text-gray-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

                    <div className="prose prose-lg max-w-none">
                        <h2>1. Information We Collect</h2>
                        <p>
                            PricePulse collects information you provide directly, such as your name, email address, phone number, and payment information when you create an account, list items, or make transactions.
                        </p>

                        <h2>2. How We Use Your Information</h2>
                        <p>
                            We use your information to provide, maintain, and improve our services, process transactions, send you updates and alerts, and personalize your experience on PricePulse.
                        </p>

                        <h2>3. Information Sharing</h2>
                        <p>
                            We do not sell your personal information. We may share your information with third parties only when necessary to provide our services (e.g., payment processors, shipping partners) or when required by law.
                        </p>

                        <h2>4. Data Security</h2>
                        <p>
                            We implement industry-standard security measures to protect your data, including encryption, secure servers, and regular security audits.
                        </p>

                        <h2>5. Your Rights</h2>
                        <p>
                            You have the right to access, correct, or delete your personal data. You can also opt out of marketing communications at any time.
                        </p>

                        <h2>6. Cookies</h2>
                        <p>
                            We use cookies to improve your experience, analyze site usage, and personalize content. You can control cookie settings in your browser.
                        </p>

                        <h2>7. Contact Us</h2>
                        <p>
                            If you have questions about this privacy policy, contact us at <a href="mailto:privacy@pricepulse.com">privacy@pricepulse.com</a>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Privacy;