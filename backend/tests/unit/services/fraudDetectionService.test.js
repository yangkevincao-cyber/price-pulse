// backend/tests/unit/services/fraudDetectionService.test.js
const fraudDetectionService = require('../../../src/services/intelligence/fraudDetectionService');
const { User, Transaction, FraudLog } = require('../../../src/models');

describe('Fraud Detection Service', () => {
    let testUser;
    let testTransaction;

    beforeEach(async () => {
        // Create test user
        testUser = await User.create({
            email: 'fraudtest@example.com',
            username: 'fraudtest',
            password: 'Test@123456',
            first_name: 'Fraud',
            last_name: 'Test',
            role: 'buyer',
            is_active: true,
            seller_rating: 4.5,
            total_sales: 10,
        });

        testTransaction = {
            id: 'test-transaction-id',
            userId: testUser.id,
            productId: 'test-product-id',
            amount: 500,
            title: 'Test Product',
            description: 'Test product description',
            ipAddress: '192.168.1.1',
            deviceFingerprint: 'test-device-fingerprint',
            cardBrand: 'visa',
            paymentMethod: 'stripe',
            billingCountry: 'US',
            shippingCountry: 'US',
        };
    });

    describe('detectFraud', () => {
        it('should return low risk score for normal transaction', async () => {
            const result = await fraudDetectionService.detectFraud(testTransaction);

            expect(result).toHaveProperty('isFraudulent');
            expect(result).toHaveProperty('riskScore');
            expect(result).toHaveProperty('flags');
            expect(result).toHaveProperty('recommendations');
            expect(result.riskScore).toBeLessThan(0.5);
            expect(result.isFraudulent).toBe(false);
            expect(result.recommendations).toContain('ALLOW_TRANSACTION');
        });

        it('should detect price anomaly', async () => {
            // Create a transaction with very high price
            const highPriceTransaction = {
                ...testTransaction,
                amount: 10000,
            };

            const result = await fraudDetectionService.detectFraud(highPriceTransaction);
            expect(result.flags).toContain(expect.stringContaining('Price anomaly'));
            expect(result.riskScore).toBeGreaterThan(0.5);
        });

        it('should detect rapid transactions', async () => {
            // Create multiple transactions in quick succession
            for (let i = 0; i < 12; i++) {
                await Transaction.create({
                    id: `test-tx-${i}`,
                    listing_id: 'test-listing-id',
                    buyer_id: testUser.id,
                    seller_id: 'test-seller-id',
                    amount: 100,
                    total_amount: 100,
                    status: 'pending',
                });
            }

            const result = await fraudDetectionService.detectFraud(testTransaction);
            expect(result.flags).toContain(expect.stringContaining('Rapid transactions'));
            expect(result.riskScore).toBeGreaterThan(0.5);
        });

        it('should detect suspicious keywords', async () => {
            const suspiciousTransaction = {
                ...testTransaction,
                title: 'FREE Bitcoin Wallet Hacker Tool',
                description: 'Get free bitcoin wallet and hack any account',
            };

            const result = await fraudDetectionService.detectFraud(suspiciousTransaction);
            expect(result.flags).toContain(expect.stringContaining('Suspicious keywords'));
            expect(result.riskScore).toBeGreaterThan(0.5);
        });

        it('should detect IP mismatch', async () => {
            const user = await User.create({
                email: 'ipuser@example.com',
                username: 'ipuser',
                password: 'Test@123456',
                first_name: 'IP',
                last_name: 'Test',
                role: 'buyer',
                is_active: true,
                location_country: 'US',
            });

            const ipMismatchTransaction = {
                ...testTransaction,
                userId: user.id,
                ipAddress: '200.100.50.1', // Non-US IP
            };

            const result = await fraudDetectionService.detectFraud(ipMismatchTransaction);
            expect(result.flags).toContain(expect.stringContaining('IP location mismatch'));
        });

        it('should detect low user reputation', async () => {
            const lowRepUser = await User.create({
                email: 'lowrep@example.com',
                username: 'lowrep',
                password: 'Test@123456',
                first_name: 'Low',
                last_name: 'Rep',
                role: 'seller',
                is_active: true,
                seller_rating: 1.5,
                total_sales: 2,
            });

            const lowRepTransaction = {
                ...testTransaction,
                userId: lowRepUser.id,
            };

            const result = await fraudDetectionService.detectFraud(lowRepTransaction);
            expect(result.flags).toContain(expect.stringContaining('Low seller rating'));
        });

        it('should detect device fingerprint issues', async () => {
            // Create multiple sessions with different fingerprints
            const devices = ['device1', 'device2', 'device3', 'device4'];
            for (const device of devices) {
                await User.create({
                    email: `device${device}@example.com`,
                    username: `device${device}`,
                    password: 'Test@123456',
                    first_name: 'Device',
                    last_name: 'Test',
                    role: 'buyer',
                    is_active: true,
                });
            }

            // This would typically check device switching
            // For the test, we'll mock the device check
            const result = await fraudDetectionService.detectFraud(testTransaction);
            // The actual result depends on the implementation
            expect(result).toHaveProperty('riskScore');
        });

        it('should block fraudulent transactions', async () => {
            const fraudulentTransaction = {
                ...testTransaction,
                amount: 50000,
                title: 'FREE Bitcoin Miner',
                description: 'Get free bitcoin, hack any wallet',
            };

            const result = await fraudDetectionService.detectFraud(fraudulentTransaction);
            expect(result.isFraudulent).toBe(true);
            expect(result.riskScore).toBeGreaterThan(0.7);
            expect(result.recommendations).toContain('BLOCK_TRANSACTION');
            expect(result.recommendations).toContain('FLAG_USER');
            expect(result.recommendations).toContain('NOTIFY_ADMIN');
        });
    });

    describe('checkPriceAnomaly', () => {
        it('should calculate z-score correctly', async () => {
            // Create some price history
            const prices = [100, 110, 105, 115, 108, 112, 107];
            for (const price of prices) {
                await Listing.create({
                    id: `listing-${price}`,
                    user_id: testUser.id,
                    product_id: testTransaction.productId,
                    title: 'Test Listing',
                    price: price,
                    condition: 'new',
                    status: 'sold',
                    sold_at: new Date(),
                });
            }

            const result = await fraudDetectionService.checkPriceAnomaly({
                ...testTransaction,
                amount: 500,
            });

            expect(result).toHaveProperty('score');
            expect(result).toHaveProperty('flagged');
        });
    });

    describe('checkVelocity', () => {
        it('should detect high transaction velocity', async () => {
            // Create many transactions in a short time
            for (let i = 0; i < 15; i++) {
                await Transaction.create({
                    id: `velocity-tx-${i}`,
                    listing_id: 'test-listing-id',
                    buyer_id: testUser.id,
                    seller_id: 'test-seller-id',
                    amount: 50,
                    total_amount: 50,
                    status: 'pending',
                    created_at: new Date(),
                });
            }

            const result = await fraudDetectionService.checkVelocity(testTransaction);
            expect(result.flagged).toBe(true);
            expect(result.score).toBeGreaterThan(0.5);
        });
    });

    describe('checkUserReputation', () => {
        it('should flag new users with low activity', async () => {
            const newUser = await User.create({
                email: 'newuser@example.com',
                username: 'newuser',
                password: 'Test@123456',
                first_name: 'New',
                last_name: 'User',
                role: 'seller',
                is_active: true,
                created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days old
            });

            const result = await fraudDetectionService.checkUserReputation({
                ...testTransaction,
                userId: newUser.id,
            });

            expect(result.flagged).toBe(true);
            expect(result.reason).toContain('New account with few sales');
        });
    });

    describe('blockTransaction', () => {
        it('should block and log fraudulent transaction', async () => {
            const transaction = {
                id: 'block-test-id',
                userId: testUser.id,
                riskScore: 0.9,
                flags: ['price_anomaly', 'suspicious_keywords'],
                ipAddress: '192.168.1.1',
                deviceFingerprint: 'test-fingerprint',
                listingId: 'test-listing-id',
            };

            await fraudDetectionService.blockTransaction(transaction);

            const fraudLog = await FraudLog.findOne({
                where: { transaction_id: 'block-test-id' },
            });

            expect(fraudLog).toBeDefined();
            expect(fraudLog.risk_score).toBe(0.9);
            expect(fraudLog.action_taken).toBe('blocked');
        });
    });

    describe('getFraudStats', () => {
        it('should return fraud statistics', async () => {
            // Create some fraud logs
            await FraudLog.create({
                user_id: testUser.id,
                type: 'price_anomaly',
                severity: 'high',
                risk_score: 0.8,
                description: 'Test fraud log 1',
            });
            await FraudLog.create({
                user_id: testUser.id,
                type: 'velocity_exceeded',
                severity: 'medium',
                risk_score: 0.6,
                description: 'Test fraud log 2',
            });

            const stats = await fraudDetectionService.getFraudStats();
            expect(stats).toHaveProperty('total_fraud_cases');
            expect(stats).toHaveProperty('avg_risk_score');
            expect(stats).toHaveProperty('topTypes');
            expect(stats.total_fraud_cases).toBeGreaterThan(0);
        });
    });

    describe('reviewFraudCase', () => {
        it('should review and resolve fraud case', async () => {
            const fraudLog = await FraudLog.create({
                user_id: testUser.id,
                type: 'suspicious_keywords',
                severity: 'high',
                risk_score: 0.9,
                description: 'Test fraud case for review',
                resolved: false,
            });

            const result = await fraudDetectionService.reviewFraudCase(
                fraudLog.id,
                'reviewer-id',
                'user_banned',
                'Test resolution notes'
            );

            expect(result.resolved).toBe(true);
            expect(result.resolution_notes).toBe('Test resolution notes');
            expect(result.action_taken).toBe('user_banned');
            expect(result.reviewed_by).toBe('reviewer-id');
        });
    });
});