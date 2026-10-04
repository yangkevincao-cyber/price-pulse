// backend/src/utils/currency.js
const axios = require('axios');
const { redis } = require('../config/redis');
const { logger } = require('./logger');

/**
 * Currency Utility
 */
class Currency {
    constructor() {
        this.defaultCurrency = 'USD';
        this.rates = {};
        this.lastUpdated = null;
    }

    /**
     * Get exchange rates from API
     */
    async fetchRates(baseCurrency = 'USD') {
        try {
            const cacheKey = `currency:rates:${baseCurrency}`;
            const cached = await redis.get(cacheKey);

            if (cached) {
                const data = JSON.parse(cached);
                this.rates = data.rates;
                this.lastUpdated = data.lastUpdated;
                return data;
            }

            // Fetch from API (exchangerate-api.com, fixer.io, etc.)
            const response = await axios.get(
                `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`
            );

            this.rates = response.data.rates;
            this.lastUpdated = new Date();

            // Cache for 1 hour
            await redis.setex(
                cacheKey,
                3600,
                JSON.stringify({
                    rates: this.rates,
                    lastUpdated: this.lastUpdated,
                })
            );

            return {
                rates: this.rates,
                lastUpdated: this.lastUpdated,
            };
        } catch (error) {
            logger.error('Currency rate fetch error:', error);
            throw error;
        }
    }

    /**
     * Convert amount from one currency to another
     */
    async convert(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) {
            return amount;
        }

        const rates = await this.getRates(fromCurrency);
        if (!rates || !rates[toCurrency]) {
            throw new Error(`Invalid currency: ${toCurrency}`);
        }

        return amount * rates[toCurrency];
    }

    /**
     * Get rates for a base currency
     */
    async getRates(baseCurrency = 'USD') {
        const cacheKey = `currency:rates:${baseCurrency}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            return JSON.parse(cached).rates;
        }

        await this.fetchRates(baseCurrency);
        return this.rates;
    }

    /**
     * Format currency amount
     */
    format(amount, currency = 'USD', locale = 'en-US') {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
        }).format(amount);
    }

    /**
     * Parse currency string to number
     */
    parse(currencyString) {
        const number = parseFloat(currencyString.replace(/[^0-9.-]/g, ''));
        return isNaN(number) ? 0 : number;
    }

    /**
     * Get currency symbol
     */
    getSymbol(currency = 'USD') {
        const symbols = {
            USD: '$',
            EUR: '€',
            GBP: '£',
            JPY: '¥',
            CNY: '¥',
            INR: '₹',
            CAD: 'C$',
            AUD: 'A$',
            CHF: 'Fr',
            SGD: 'S$',
            MYR: 'RM',
            PHP: '₱',
            IDR: 'Rp',
            THB: '฿',
            VND: '₫',
            KRW: '₩',
            RUB: '₽',
            BRL: 'R$',
            ZAR: 'R',
            NZD: 'NZ$',
        };
        return symbols[currency] || currency;
    }

    /**
     * Validate currency code
     */
    isValidCurrency(currency) {
        const currencies = [
            'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'CHF', 'SGD',
            'MYR', 'PHP', 'IDR', 'THB', 'VND', 'KRW', 'RUB', 'BRL', 'ZAR', 'NZD',
        ];
        return currencies.includes(currency.toUpperCase());
    }

    /**
     * Get all supported currencies
     */
    getCurrencies() {
        return [
            { code: 'USD', name: 'US Dollar', symbol: '$' },
            { code: 'EUR', name: 'Euro', symbol: '€' },
            { code: 'GBP', name: 'British Pound', symbol: '£' },
            { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
            { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
            { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
            { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
            { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
            { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
            { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
            { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
            { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
            { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
            { code: 'THB', name: 'Thai Baht', symbol: '฿' },
            { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
            { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
            { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
            { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
            { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
            { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
        ];
    }
}

module.exports = new Currency();