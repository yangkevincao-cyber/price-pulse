// frontend/src/pages/Contact.jsx
import React, { useState, useEffect } from 'react';
import { updatePageMeta } from '../utils/seo';
import { Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

function Contact() {
    useEffect(() => {
        updatePageMeta({
            title: 'Contact PricePulse - Get in Touch',
            description: 'Have questions about PricePulse? Contact our support team for help with selling, buying, exchanges, or general inquiries.',
            url: 'https://pricepulse.com/contact',
        });
    }, []);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/contact', formData);
            setIsSuccess(true);
            setFormData({ name: '', email: '', subject: '', message: '' });
            toast.success('Message sent successfully!');
            setTimeout(() => setIsSuccess(false), 5000);
        } catch (error) {
            toast.error('Failed to send message. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-gradient-to-r from-pulse-blue-900 to-pulse-blue-700 text-white py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold">Contact Us</h1>
                    <p className="mt-4 text-xl text-blue-100">We'd love to hear from you. Get in touch with our team.</p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Contact Info */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-2xl shadow-soft p-6">
                            <div className="flex items-start space-x-4">
                                <div className="p-3 bg-pulse-blue-100 rounded-xl">
                                    <Mail className="h-6 w-6 text-pulse-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Email</h3>
                                    <p className="text-sm text-gray-600">support@pricepulse.com</p>
                                    <p className="text-sm text-gray-600">hello@pricepulse.com</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-soft p-6">
                            <div className="flex items-start space-x-4">
                                <div className="p-3 bg-pulse-green-100 rounded-xl">
                                    <Phone className="h-6 w-6 text-pulse-green-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Phone</h3>
                                    <p className="text-sm text-gray-600">+1 (800) 123-4567</p>
                                    <p className="text-sm text-gray-600">Mon-Fri 9am-6pm EST</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-soft p-6">
                            <div className="flex items-start space-x-4">
                                <div className="p-3 bg-pulse-orange-100 rounded-xl">
                                    <MapPin className="h-6 w-6 text-pulse-orange-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Location</h3>
                                    <p className="text-sm text-gray-600">123 Market Street</p>
                                    <p className="text-sm text-gray-600">San Francisco, CA 94105</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-soft p-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Send a Message</h2>

                            {isSuccess ? (
                                <div className="bg-pulse-green-50 border border-pulse-green-200 rounded-xl p-6 text-center">
                                    <CheckCircle className="h-12 w-12 text-pulse-green-600 mx-auto" />
                                    <h3 className="text-lg font-semibold text-gray-900 mt-4">Message Sent!</h3>
                                    <p className="text-gray-600">Thanks for reaching out. We'll get back to you within 24 hours.</p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Your Name *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Email Address *
                                            </label>
                                            <input
                                                type="email"
                                                required
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Subject *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.subject}
                                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Message *
                                        </label>
                                        <textarea
                                            rows="6"
                                            required
                                            value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-blue-500"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full px-6 py-3 bg-pulse-blue-600 text-white rounded-xl font-medium hover:bg-pulse-blue-700 transition disabled:opacity-50 flex items-center justify-center"
                                    >
                                        {isSubmitting ? 'Sending...' : (
                                            <>
                                                <Send className="h-5 w-5 mr-2" />
                                                Send Message
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Contact;