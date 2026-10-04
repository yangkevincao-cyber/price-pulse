// frontend/src/hooks/useDebounce.js
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Debounce a value or function
 * @param {any} value - The value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {any} - Debounced value
 */
export const useDebounce = (value, delay = 300) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

/**
 * Debounce a callback function
 * @param {Function} callback - The function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced callback
 */
export const useDebouncedCallback = (callback, delay = 300) => {
    const timeoutRef = useRef(null);

    const debouncedCallback = useCallback((...args) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            callback(...args);
            timeoutRef.current = null;
        }, delay);
    }, [callback, delay]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return debouncedCallback;
};

/**
 * Throttle a callback function
 * @param {Function} callback - The function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function} - Throttled callback
 */
export const useThrottledCallback = (callback, limit = 300) => {
    const inThrottle = useRef(false);

    const throttledCallback = useCallback((...args) => {
        if (!inThrottle.current) {
            callback(...args);
            inThrottle.current = true;
            setTimeout(() => {
                inThrottle.current = false;
            }, limit);
        }
    }, [callback, limit]);

    return throttledCallback;
};

export default useDebounce;