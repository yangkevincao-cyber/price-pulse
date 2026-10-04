// backend/src/utils/encryption.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Hash password using bcrypt
 */
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

/**
 * Compare password with hash
 */
const comparePassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};

/**
 * Generate secure random token
 */
const generateSecureToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate secure random code (numeric)
 */
const generateSecureCode = (length = 6) => {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return code;
};

/**
 * Hash token (for storage)
 */
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Encrypt data with AES-256-CBC
 */
const encrypt = (text, key) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

/**
 * Decrypt data with AES-256-CBC
 */
const decrypt = (text, key) => {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};

/**
 * Generate HMAC signature
 */
const generateHMAC = (data, secret) => {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

/**
 * Verify HMAC signature
 */
const verifyHMAC = (data, signature, secret) => {
    const expected = generateHMAC(data, secret);
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
    );
};

/**
 * Generate random salt
 */
const generateSalt = (length = 16) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash with salt (SHA256)
 */
const hashWithSalt = (data, salt) => {
    return crypto.createHash('sha256').update(data + salt).digest('hex');
};

/**
 * Generate API key
 */
const generateApiKey = () => {
    return 'pk_' + generateSecureToken(24);
};

/**
 * Generate secret key
 */
const generateSecretKey = () => {
    return 'sk_' + generateSecureToken(32);
};

module.exports = {
    hashPassword,
    comparePassword,
    generateSecureToken,
    generateSecureCode,
    hashToken,
    encrypt,
    decrypt,
    generateHMAC,
    verifyHMAC,
    generateSalt,
    hashWithSalt,
    generateApiKey,
    generateSecretKey,
};