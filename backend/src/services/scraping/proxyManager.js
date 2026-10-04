// backend/src/services/scraping/proxyManager.js
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.loadProxies();
    }

    /**
     * Load proxies from configuration
     */
    async loadProxies() {
        try {
            // Load from environment or database
            const proxyList = process.env.SCRAPING_PROXIES || '';
            if (proxyList) {
                this.proxies = proxyList.split(',').map(proxy => {
                    const parts = proxy.trim().split('@');
                    if (parts.length === 2) {
                        const authParts = parts[0].split(':');
                        const urlParts = parts[1].split(':');
                        return {
                            host: urlParts[0],
                            port: parseInt(urlParts[1]) || 80,
                            auth: {
                                username: authParts[0],
                                password: authParts[1],
                            },
                        };
                    } else {
                        const urlParts = proxy.trim().split(':');
                        return {
                            host: urlParts[0],
                            port: parseInt(urlParts[1]) || 80,
                        };
                    }
                });
                logger.info(`Loaded ${this.proxies.length} proxies`);
            }
        } catch (error) {
            logger.error('Failed to load proxies:', error);
        }
    }

    /**
     * Get next proxy (round-robin)
     */
    async getProxy() {
        if (this.proxies.length === 0) {
            return null;
        }

        // Try up to 3 times to get a working proxy
        for (let i = 0; i < Math.min(3, this.proxies.length); i++) {
            const proxy = this.proxies[this.currentIndex % this.proxies.length];
            this.currentIndex++;

            // Check if proxy is valid
            const isValid = await this.validateProxy(proxy);
            if (isValid) {
                return proxy;
            }
        }

        return null;
    }

    /**
     * Validate proxy
     */
    async validateProxy(proxy) {
        try {
            const key = `proxy:${proxy.host}:${proxy.port}`;
            const isValid = await redis.get(key);

            if (isValid === 'valid') {
                return true;
            }
            if (isValid === 'invalid') {
                return false;
            }

            // Test proxy with a simple request
            const axios = require('axios');
            const config = {
                proxy: {
                    host: proxy.host,
                    port: proxy.port,
                    auth: proxy.auth,
                },
                timeout: 5000,
            };

            await axios.get('https://httpbin.org/ip', config);

            // Mark as valid
            await redis.setex(key, 3600, 'valid');
            return true;
        } catch (error) {
            // Mark as invalid
            const key = `proxy:${proxy.host}:${proxy.port}`;
            await redis.setex(key, 300, 'invalid');
            return false;
        }
    }

    /**
     * Add proxy
     */
    async addProxy(host, port, auth = null) {
        const proxy = { host, port, auth };
        this.proxies.push(proxy);

        // Store in Redis
        const key = `proxy:${host}:${port}`;
        await redis.setex(key, 3600, 'pending');

        logger.info(`Added proxy: ${host}:${port}`);
        return proxy;
    }

    /**
     * Remove proxy
     */
    async removeProxy(host, port) {
        this.proxies = this.proxies.filter(p => p.host !== host || p.port !== port);

        const key = `proxy:${host}:${port}`;
        await redis.del(key);

        logger.info(`Removed proxy: ${host}:${port}`);
        return true;
    }

    /**
     * Get proxy statistics
     */
    async getStats() {
        const stats = {
            total: this.proxies.length,
            valid: 0,
            invalid: 0,
            pending: 0,
        };

        for (const proxy of this.proxies) {
            const key = `proxy:${proxy.host}:${proxy.port}`;
            const status = await redis.get(key);
            if (status === 'valid') stats.valid++;
            else if (status === 'invalid') stats.invalid++;
            else stats.pending++;
        }

        return stats;
    }
}

module.exports = ProxyManager;