// backend/src/utils/helpers.js
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Generate a random token
 */
const generateToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a UUID
 */
const generateUUID = () => {
    return uuidv4();
};

/**
 * Generate a random code (e.g., for verification)
 */
const generateCode = (length = 6) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

/**
 * Generate a slug from string
 */
const generateSlug = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')          // Replace spaces with -
        .replace(/[^\w\-]+/g, '')      // Remove all non-word chars
        .replace(/\-\-+/g, '-')        // Replace multiple - with single -
        .replace(/^-+/, '')            // Trim - from start of text
        .replace(/-+$/, '');           // Trim - from end of text
};

/**
 * Format currency
 */
const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount);
};

/**
 * Format date
 */
const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
};

/**
 * Truncate text
 */
const truncate = (text, length = 100, suffix = '...') => {
    if (text.length <= length) return text;
    return text.substring(0, length) + suffix;
};

/**
 * Deep clone object
 */
const deepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};

/**
 * Pick specific fields from object
 */
const pick = (obj, fields) => {
    return fields.reduce((acc, field) => {
        if (obj[field] !== undefined) {
            acc[field] = obj[field];
        }
        return acc;
    }, {});
};

/**
 * Omit specific fields from object
 */
const omit = (obj, fields) => {
    const result = { ...obj };
    fields.forEach(field => {
        delete result[field];
    });
    return result;
};

/**
 * Check if value is empty
 */
const isEmpty = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
};

/**
 * Check if value is between min and max
 */
const isBetween = (value, min, max) => {
    return value >= min && value <= max;
};

/**
 * Sleep for specified milliseconds
 */
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry function with exponential backoff
 */
const retry = async (fn, retries = 3, delay = 1000) => {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) throw error;
        await sleep(delay);
        return retry(fn, retries - 1, delay * 2);
    }
};

/**
 * Parse JSON safely
 */
const safeJSONParse = (str) => {
    try {
        return JSON.parse(str);
    } catch (error) {
        return null;
    }
};

/**
 * Get difference between two dates in days
 */
const getDaysDifference = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Check if date is in the past
 */
const isPastDate = (date) => {
    return new Date(date) < new Date();
};

/**
 * Get relative time string (e.g., "2 hours ago")
 */
const getRelativeTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
};

/**
 * Mask sensitive data
 */
const maskData = (data, fields = ['password', 'token', 'secret']) => {
    if (!data) return data;
    const result = { ...data };
    fields.forEach(field => {
        if (result[field]) {
            result[field] = '******';
        }
    });
    return result;
};

module.exports = {
    generateToken,
    generateUUID,
    generateCode,
    generateSlug,
    formatCurrency,
    formatDate,
    truncate,
    deepClone,
    pick,
    omit,
    isEmpty,
    isBetween,
    sleep,
    retry,
    safeJSONParse,
    getDaysDifference,
    isPastDate,
    getRelativeTime,
    maskData,
};