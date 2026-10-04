// frontend/src/pages/Terms.jsx
import React, { useEffect } from 'react';
import { updatePageMeta } from '../utils/seo';

function Terms() {
    useEffect(() => {
        updatePageMeta({
            title: 'Terms of Service - PricePulse',
            description: 'Read PricePulse terms of service. Understand the rules for buying, selling, and exchanging on our platform.',
            url: 'https://pricepulse.com/terms',
        });
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-2xl shadow-soft p-8 md:p-12">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
                    <p className="text-gray-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

                    <div className="prose prose-lg max-w-none">
                        <h2>1. Acceptance of Terms</h2>
                        <p>
                            By using PricePulse, you agree to these terms. If you do not agree, please do not use our platform.
                        </p>

                        <h2>2. User Accounts</h2>
                        <p>
                            You are responsible for maintaining the security of your account and for all activities that occur under your account. You must provide accurate information when creating an account.
                        </p>

                        <h2>3. Buying and Selling</h2>
                        <p>
                            Sellers are responsible for accurately describing items. Buyers are responsible for reviewing listings carefully. PricePulse facilitates transactions but is not a party to any sale agreement.
                        </p>

                        <h2>4. Fees and Payments</h2>
                        <p>
                            PricePulse charges a 5% platform fee on completed transactions. Fees are deducted automatically from the seller's payout. All prices are listed in USD unless otherwise specified.
                        </p>

                        <h2>5. Prohibited Items</h2>
                        <p>
                            The following items are prohibited: illegal goods, weapons, hazardous materials, counterfeit products, and items that violate intellectual property rights.
                        </p>

                        <h2>6. Dispute Resolution</h2>
                        <p>
                            In case of disputes, we encourage users to communicate directly. PricePulse may mediate but does not guarantee resolution.
                        </p>

                        <h2>7. Termination</h2>
                        <p>
                            We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.
                        </p>

                        <h2>8. Limitation of Liability</h2>
                        <p>
                            PricePulse is provided "as is." We are not liable for any damages arising from your use of the platform.
                        </p>

                        <h2>9. Changes to Terms</h2>
                        <p>
                            We may update these terms from time to time. Continued use of the platform constitutes acceptance of updated terms.
                        </p>

                        <h2>10. Contact</h2>
                        <p>
                            Questions? Contact us at <a href="mailto:legal@pricepulse.com">legal@pricepulse.com</a>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Terms;