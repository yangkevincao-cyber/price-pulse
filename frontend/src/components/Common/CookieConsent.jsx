// frontend/src/components/Common/CookieConsent.jsx
import React, { useState, useEffect } from 'react';
import { X, Cookie, Check, Settings } from 'lucide-react';

function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [preferences, setPreferences] = useState({
        essential: true,
        functional: true,
        analytics: false,
        marketing: false
    });

    useEffect(() => {
        const consent = localStorage.getItem('cookieConsent');
        if (!consent) {
            setIsVisible(true);
        } else {
            try {
                const parsed = JSON.parse(consent);
                setPreferences(parsed);
            } catch (e) {
                setIsVisible(true);
            }
        }
    }, []);

    const handleAcceptAll = () => {
        const allPreferences = {
            essential: true,
            functional: true,
            analytics: true,
            marketing: true
        };
        savePreferences(allPreferences);
    };

    const handleAcceptEssential = () => {
        const essentialPreferences = {
            essential: true,
            functional: false,
            analytics: false,
            marketing: false
        };
        savePreferences(essentialPreferences);
    };

    const handleSavePreferences = () => {
        savePreferences(preferences);
        setShowSettings(false);
    };

    const savePreferences = (prefs) => {
        localStorage.setItem('cookieConsent', JSON.stringify(prefs));
        setPreferences(prefs);
        setIsVisible(false);
        applyPreferences(prefs);
    };

    const applyPreferences = (prefs) => {
        // Apply analytics preferences
        if (prefs.analytics && typeof gtag !== 'undefined') {
            gtag('consent', 'update', {
                'analytics_storage': 'granted'
            });
        }

        // Apply marketing preferences
        if (prefs.marketing && typeof gtag !== 'undefined') {
            gtag('consent', 'update', {
                'ad_storage': 'granted'
            });
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
            <div className="max-w-4xl mx-auto">
                {!showSettings ? (
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 p-2 bg-pulse-blue-100 rounded-lg">
                                <Cookie className="h-6 w-6 text-pulse-blue-600" />
                            </div>
                            <div className="ml-4 flex-1">
                                <h3 className="text-lg font-semibold text-gray-900">🍪 Cookie Settings</h3>
                                <p className="mt-1 text-sm text-gray-600">
                                    We use cookies to enhance your experience, analyze site usage, and personalize content.
                                    By clicking "Accept All", you consent to our use of cookies.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                        onClick={handleAcceptAll}
                                        className="px-4 py-2 bg-pulse-blue-600 text-white text-sm rounded-lg hover:bg-pulse-blue-700 transition"
                                    >
                                        <Check className="h-4 w-4 inline mr-1" />
                                        Accept All
                                    </button>
                                    <button
                                        onClick={handleAcceptEssential}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition"
                                    >
                                        Essential Only
                                    </button>
                                    <button
                                        onClick={() => setShowSettings(true)}
                                        className="px-4 py-2 text-gray-600 text-sm hover:text-gray-900 transition"
                                    >
                                        <Settings className="h-4 w-4 inline mr-1" />
                                        Customize
                                    </button>
                                    <button
                                        onClick={() => setIsVisible(false)}
                                        className="ml-auto text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Cookie Preferences</h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900">Essential Cookies</p>
                                    <p className="text-sm text-gray-500">Required for basic site functionality</p>
                                </div>
                                <span className="px-3 py-1 bg-pulse-green-100 text-pulse-green-700 text-xs font-medium rounded-full">
                                    Always On
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900">Functional Cookies</p>
                                    <p className="text-sm text-gray-500">Remember your preferences and settings</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={preferences.functional}
                                        onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-pulse-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pulse-blue-600"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900">Analytics Cookies</p>
                                    <p className="text-sm text-gray-500">Help us improve our site with usage data</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={preferences.analytics}
                                        onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-pulse-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pulse-blue-600"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900">Marketing Cookies</p>
                                    <p className="text-sm text-gray-500">Personalize ads and promotions</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={preferences.marketing}
                                        onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-pulse-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pulse-blue-600"></div>
                                </label>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSavePreferences}
                                className="px-4 py-2 bg-pulse-blue-600 text-white rounded-lg hover:bg-pulse-blue-700 transition"
                            >
                                Save Preferences
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CookieConsent;