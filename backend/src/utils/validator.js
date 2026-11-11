// backend/src/utils/validator.js

/**
 * Custom Validators
 */
class Validator {
    /**
     * Validate email
     */
    static isEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    /**
     * Validate phone number
     */
    static isPhone(phone) {
        const regex = /^\+?[1-9]\d{1,14}$/;
        return regex.test(phone);
    }

    /**
     * Validate username
     */
    static isUsername(username) {
        const regex = /^[a-zA-Z0-9_]+$/;
        return regex.test(username) && username.length >= 3 && username.length <= 30;
    }

    /**
     * Validate password strength
     */
    static isStrongPassword(password) {
        const requirements = {
            minLength: 8,
            hasUpperCase: /[A-Z]/.test(password),
            hasLowerCase: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSpecialChar: /[^A-Za-z0-9]/.test(password),
        };

        return password.length >= requirements.minLength &&
            requirements.hasUpperCase &&
            requirements.hasLowerCase &&
            requirements.hasNumber &&
            requirements.hasSpecialChar;
    }

    /**
     * Validate URL
     */
    static isUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate UUID
     */
    static isUUID(uuid) {
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return regex.test(uuid);
    }

    /**
     * Validate date
     */
    static isDate(date) {
        const d = new Date(date);
        return d instanceof Date && !isNaN(d);
    }

    /**
     * Validate future date
     */
    static isFutureDate(date) {
        return this.isDate(date) && new Date(date) > new Date();
    }

    /**
     * Validate past date
     */
    static isPastDate(date) {
        return this.isDate(date) && new Date(date) < new Date();
    }

    /**
     * Validate age (minimum age)
     */
    static isMinimumAge(date, minAge = 18) {
        if (!this.isDate(date)) return false;
        const age = Math.floor((new Date() - new Date(date)) / (365.25 * 24 * 60 * 60 * 1000));
        return age >= minAge;
    }

    /**
     * Validate postal code
     */
    static isPostalCode(postalCode, country = 'US') {
        const patterns = {
            US: /^[0-9]{5}(?:-[0-9]{4})?$/,
            UK: /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/,
            CA: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/,
            AU: /^[0-9]{4}$/,
            DE: /^[0-9]{5}$/,
            FR: /^[0-9]{5}$/,
            JP: /^[0-9]{3}-[0-9]{4}$/,
            CN: /^[0-9]{6}$/,
            IN: /^[0-9]{6}$/,
            BR: /^[0-9]{5}-[0-9]{3}$/,
        };
        const pattern = patterns[country] || patterns.US;
        return pattern.test(postalCode);
    }

    /**
     * Validate hex color
     */
    static isHexColor(color) {
        const regex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        return regex.test(color);
    }

    /**
     * Validate credit card number (Luhn algorithm)
     */
    static isCreditCard(number) {
        const digits = number.replace(/\D/g, '');
        if (digits.length < 13 || digits.length > 19) return false;

        let sum = 0;
        let alt = false;
        for (let i = digits.length - 1; i >= 0; i--) {
            let n = parseInt(digits[i]);
            if (alt) {
                n *= 2;
                if (n > 9) n -= 9;
            }
            sum += n;
            alt = !alt;
        }
        return sum % 10 === 0;
    }

    /**
     * Validate credit card expiry date
     */
    static isCardExpiry(month, year) {
        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;

        if (year < currentYear || (year === currentYear && month < currentMonth)) {
            return false;
        }
        return true;
    }

    /**
     * Validate CVV
     */
    static isCVV(cvv) {
        const regex = /^[0-9]{3,4}$/;
        return regex.test(cvv);
    }

    /**
     * Validate IP address
     */
    static isIP(ip) {
        const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6 = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
        return ipv4.test(ip) || ipv6.test(ip);
    }

    /**
     * Validate domain
     */
    static isDomain(domain) {
        const regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
        return regex.test(domain);
    }

    /**
     * Validate object has required fields
     */
    static hasRequiredFields(obj, fields) {
        return fields.every(field => {
            if (field.includes('.')) {
                const parts = field.split('.');
                let value = obj;
                for (const part of parts) {
                    if (!value || !value[part]) return false;
                    value = value[part];
                }
                return true;
            }
            return obj && obj[field] !== undefined && obj[field] !== null && obj[field] !== '';
        });
    }

    /**
     * Validate value is in array
     */
    static isInArray(value, array) {
        return array.includes(value);
    }

    /**
     * Validate value is between min and max
     */
    static isBetween(value, min, max) {
        return value >= min && value <= max;
    }
}

module.exports = Validator;