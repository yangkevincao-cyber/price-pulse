// backend/tests/unit/models/User.test.js
const { User } = require('../../../src/models');
const { sequelize } = require('../../../src/config/database');

describe('User Model', () => {
    const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test@123456',
        first_name: 'Test',
        last_name: 'User',
        role: 'buyer',
    };

    describe('Validation', () => {
        it('should create a valid user', async () => {
            const user = await User.create(userData);
            expect(user.id).toBeDefined();
            expect(user.email).toBe(userData.email);
            expect(user.username).toBe(userData.username);
            expect(user.password).not.toBe(userData.password); // Should be hashed
            expect(user.role).toBe('buyer');
        });

        it('should require email', async () => {
            const invalidData = { ...userData, email: null };
            await expect(User.create(invalidData)).rejects.toThrow();
        });

        it('should require username', async () => {
            const invalidData = { ...userData, username: null };
            await expect(User.create(invalidData)).rejects.toThrow();
        });

        it('should require password', async () => {
            const invalidData = { ...userData, password: null };
            await expect(User.create(invalidData)).rejects.toThrow();
        });

        it('should enforce unique email', async () => {
            await User.create(userData);
            await expect(User.create(userData)).rejects.toThrow();
        });

        it('should enforce unique username', async () => {
            await User.create(userData);
            const duplicate = { ...userData, email: 'different@example.com' };
            await expect(User.create(duplicate)).rejects.toThrow();
        });

        it('should validate email format', async () => {
            const invalidData = { ...userData, email: 'invalid-email' };
            await expect(User.create(invalidData)).rejects.toThrow();
        });

        it('should validate username format', async () => {
            const invalidData = { ...userData, username: 'invalid username!' };
            await expect(User.create(invalidData)).rejects.toThrow();
        });
    });

    describe('Password Hashing', () => {
        it('should hash password before saving', async () => {
            const user = await User.create(userData);
            expect(user.password).not.toBe(userData.password);
            expect(user.password).toHaveLength(60); // bcrypt hash length
        });

        it('should compare password correctly', async () => {
            const user = await User.create(userData);
            const isValid = await user.comparePassword(userData.password);
            expect(isValid).toBe(true);
        });

        it('should reject incorrect password', async () => {
            const user = await User.create(userData);
            const isValid = await user.comparePassword('wrongpassword');
            expect(isValid).toBe(false);
        });
    });

    describe('Instance Methods', () => {
        let user;

        beforeEach(async () => {
            user = await User.create(userData);
        });

        it('should generate auth token', () => {
            const token = user.generateAuthToken();
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
        });

        it('should get full name', () => {
            expect(user.getFullName()).toBe('Test User');
        });

        it('should get short name', () => {
            expect(user.getShortName()).toBe('Test U.');
        });

        it('should exclude sensitive data from JSON', () => {
            const json = user.toJSON();
            expect(json).not.toHaveProperty('password');
            expect(json).not.toHaveProperty('verification_token');
            expect(json).not.toHaveProperty('reset_token');
            expect(json).not.toHaveProperty('reset_token_expiry');
        });
    });

    describe('Scopes', () => {
        it('should scope active users', async () => {
            await User.create(userData);
            const activeUsers = await User.scope('active').findAll();
            expect(activeUsers.length).toBeGreaterThan(0);
        });

        it('should scope sellers', async () => {
            const seller = await User.create({
                ...userData,
                email: 'seller@example.com',
                username: 'selleruser',
                role: 'seller',
            });
            const sellers = await User.scope('seller').findAll();
            expect(sellers).toContainEqual(expect.objectContaining({ id: seller.id }));
        });
    });

    describe('Hooks', () => {
        it('should lowercase email before save', async () => {
            const user = await User.create({
                ...userData,
                email: 'TEST@EXAMPLE.COM',
            });
            expect(user.email).toBe('test@example.com');
        });

        it('should lowercase username before save', async () => {
            const user = await User.create({
                ...userData,
                username: 'TESTUSER',
                email: 'test2@example.com',
            });
            expect(user.username).toBe('testuser');
        });

        it('should set default avatar', async () => {
            const user = await User.create({
                ...userData,
                email: 'avatar@example.com',
                username: 'avataruser',
            });
            expect(user.avatar).toContain('ui-avatars.com');
        });
    });

    describe('Relationships', () => {
        it('should have listings association', async () => {
            const user = await User.create({
                ...userData,
                email: 'listings@example.com',
                username: 'listingsuser',
            });
            expect(user).toHaveProperty('listings');
            expect(user).toHaveProperty('purchases');
            expect(user).toHaveProperty('sales');
        });
    });
});