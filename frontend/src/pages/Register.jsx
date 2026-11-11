// frontend/src/pages/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';
import { Mail, Lock, User, Eye, EyeOff, Loader2, Check, X, Store, ShoppingBag } from 'lucide-react';

export default function Register() {
    const navigate = useNavigate();
    const { register } = useAuthStore();

    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'buyer',
        terms: false,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Password strength
    const pw = form.password;
    const strength = {
        minLength: pw.length >= 8,
        upper: /[A-Z]/.test(pw),
        lower: /[a-z]/.test(pw),
        number: /[0-9]/.test(pw),
        special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw),
    };
    const strengthScore = Object.values(strength).filter(Boolean).length;
    const strengthLabels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

    const validate = () => {
        const errs = {};
        if (!form.firstName.trim()) errs.firstName = 'First name is required';
        if (!form.lastName.trim()) errs.lastName = 'Last name is required';
        if (!form.email.trim()) errs.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format';
        if (!form.password) errs.password = 'Password is required';
        else if (strengthScore < 5) errs.password = 'Password must meet all requirements';
        if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
        if (!form.terms) errs.terms = 'You must accept the Terms of Service';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            await register({
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                email: form.email.trim().toLowerCase(),
                password: form.password,
                role: form.role,
            });
            toast.success('Account created! Welcome to PricePulse.');
            navigate(form.role === 'seller' ? '/seller' : '/', { replace: true });
        } catch (error) {
            const message = error.response?.data?.error || error.message || 'Registration failed';
            toast.error(message);
            setErrors({ submit: message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
            <div className="max-w-lg w-full">
                <div className="text-center mb-8">
                    <Link to="/" className="text-3xl font-black text-pulse-blue-600">
                        PRICE<span className="text-pulse-orange-500">PULSE</span>
                    </Link>
                    <h1 className="mt-6 text-2xl font-bold text-gray-900">Create your account</h1>
                    <p className="mt-2 text-gray-600">Start buying, selling, or trading in minutes</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                        {/* Role selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                I want to...
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <RoleCard
                                    icon={<ShoppingBag className="h-5 w-5" />}
                                    title="Buy things"
                                    subtitle="Find best deals"
                                    selected={form.role === 'buyer'}
                                    onClick={() => setForm({ ...form, role: 'buyer' })}
                                />
                                <RoleCard
                                    icon={<Store className="h-5 w-5" />}
                                    title="Sell things"
                                    subtitle="Get demand alerts"
                                    selected={form.role === 'seller'}
                                    onClick={() => setForm({ ...form, role: 'seller' })}
                                />
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                                You can switch roles anytime from settings.
                            </p>
                        </div>

                        {/* Name */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                                    First name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        id="firstName"
                                        name="firstName"
                                        type="text"
                                        autoComplete="given-name"
                                        value={form.firstName}
                                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                                        className={`w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                                            errors.firstName
                                                ? 'border-red-300 focus:ring-red-500'
                                                : 'border-gray-300 focus:ring-pulse-blue-500'
                                        }`}
                                    />
                                </div>
                                {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
                            </div>
                            <div>
                                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                                    Last name
                                </label>
                                <input
                                    id="lastName"
                                    name="lastName"
                                    type="text"
                                    autoComplete="family-name"
                                    value={form.lastName}
                                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                                    className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                                        errors.lastName
                                            ? 'border-red-300 focus:ring-red-500'
                                            : 'border-gray-300 focus:ring-pulse-blue-500'
                                    }`}
                                />
                                {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                                        errors.email
                                            ? 'border-red-300 focus:ring-red-500'
                                            : 'border-gray-300 focus:ring-pulse-blue-500'
                                    }`}
                                    placeholder="you@example.com"
                                />
                            </div>
                            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                                        errors.password
                                            ? 'border-red-300 focus:ring-red-500'
                                            : 'border-gray-300 focus:ring-pulse-blue-500'
                                    }`}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>

                            {/* Password strength bar */}
                            {form.password && (
                                <div className="mt-2">
                                    <div className="flex gap-1 mb-1">
                                        {[0, 1, 2, 3, 4].map(i => (
                                            <div
                                                key={i}
                                                className={`h-1 flex-1 rounded ${
                                                    i < strengthScore ? strengthColors[strengthScore - 1] : 'bg-gray-200'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-600">
                                        Strength: <span className="font-medium">{strengthLabels[strengthScore - 1] || 'Very weak'}</span>
                                    </p>
                                    <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
                                        <Req ok={strength.minLength}>8+ characters</Req>
                                        <Req ok={strength.upper}>Uppercase</Req>
                                        <Req ok={strength.lower}>Lowercase</Req>
                                        <Req ok={strength.number}>Number</Req>
                                        <Req ok={strength.special}>Special char</Req>
                                    </ul>
                                </div>
                            )}
                            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                        </div>

                        {/* Confirm password */}
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                Confirm password
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                value={form.confirmPassword}
                                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                                    errors.confirmPassword
                                        ? 'border-red-300 focus:ring-red-500'
                                        : 'border-gray-300 focus:ring-pulse-blue-500'
                                }`}
                                placeholder="••••••••"
                            />
                            {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
                        </div>

                        {/* Terms */}
                        <div>
                            <label className="flex items-start">
                                <input
                                    type="checkbox"
                                    checked={form.terms}
                                    onChange={(e) => setForm({ ...form, terms: e.target.checked })}
                                    className="mt-1 h-4 w-4 text-pulse-blue-600 border-gray-300 rounded"
                                />
                                <span className="ml-2 text-sm text-gray-600">
                                    I agree to the{' '}
                                    <Link to="/terms" className="text-pulse-blue-600 hover:underline">Terms</Link> and{' '}
                                    <Link to="/privacy" className="text-pulse-blue-600 hover:underline">Privacy Policy</Link>
                                </span>
                            </label>
                            {errors.terms && <p className="mt-1 text-sm text-red-600">{errors.terms}</p>}
                        </div>

                        {errors.submit && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                {errors.submit}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-pulse-blue-600 text-white rounded-lg font-semibold hover:bg-pulse-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    Creating account...
                                </>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-600">
                        Already have an account?{' '}
                        <Link to="/login" className="text-pulse-blue-600 hover:text-pulse-blue-800 font-semibold">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Helper components ───
function RoleCard({ icon, title, subtitle, selected, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`p-4 rounded-lg border-2 text-left transition ${
                selected
                    ? 'border-pulse-blue-600 bg-pulse-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
            }`}
        >
            <div className={`mb-2 ${selected ? 'text-pulse-blue-600' : 'text-gray-400'}`}>{icon}</div>
            <p className="font-medium text-gray-900 text-sm">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </button>
    );
}

function Req({ ok, children }) {
    return (
        <li className={`flex items-center ${ok ? 'text-green-600' : 'text-gray-400'}`}>
            {ok ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
            {children}
        </li>
    );
}
