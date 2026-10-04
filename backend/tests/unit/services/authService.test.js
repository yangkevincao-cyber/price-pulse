// backend/tests/unit/services/authService.test.js
const authService = require('../../../src/services/auth/authService');
const { User } = require('../../../src/models');
const { generateToken } = require('../../../src/utils/helpers');

jest.mock('../../../src/services/notification/emailService', () => ({
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

describe('Auth Service', () => {
    const testUser = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Test@123456',
        firstName: 'Test',
        lastName: 'User',
        role: 'buyer',
    };

    describe('register', () => {
        it('should register a new user successfully', async () => {
            const result = await authService.register(testUser);

            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('tokens');
            expect(result.user.email).toBe(testUser.email);
            expect(result.user.username).toBe(testUser.username);
            expect(result.user).not.toHaveProperty('password');
        });

        it('should throw error if email already exists', async () => {
            await expect(authService.register(testUser)).rejects.toThrow(
                'User already exists'
            );
        });

        it('should throw error for weak password', async () => {
            const weakUser = {
                ...testUser,
                email: 'weak@example.com',
                username: 'weakuser',
                password: '123',
            };
            await expect(authService.register(weakUser)).rejects.toThrow(
                'Password must be at least 8 characters'
            );
        });
    });

    describe('login', () => {
        it('should login successfully with correct credentials', async () => {
            const result = await authService.login(
                testUser.email,
                testUser.password,
                '127.0.0.1',
                'test-agent'
            );

            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('tokens');
            expect(result.user.email).toBe(testUser.email);
        });

        it('should throw error with incorrect password', async () => {
            await expect(
                authService.login(testUser.email, 'wrongpassword', '127.0.0.1', 'test-agent')
            ).rejects.toThrow('Invalid credentials');
        });

        it('should throw error with non-existent email', async () => {
            await expect(
                authService.login('nonexistent@example.com', 'password', '127.0.0.1', 'test-agent')
            ).rejects.toThrow('Invalid credentials');
        });
    });

    describe('changePassword', () => {
        let user;

        beforeEach(async () => {
            user = await User.findOne({ where: { email: testUser.email } });
        });

        it('should change password successfully', async () => {
            const result = await authService.changePassword(
                user.id,
                testUser.password,
                'NewTest@123456'
            );

            expect(result.message).toBe('Password changed successfully');

            // Verify new password works
            const loginResult = await authService.login(
                testUser.email,
                'NewTest@123456',
                '127.0.0.1',
                'test-agent'
            );
            expect(loginResult).toHaveProperty('user');
        });

        it('should throw error with incorrect current password', async () => {
            await expect(
                authService.changePassword(user.id, 'wrongpassword', 'NewTest@123456')
            ).rejects.toThrow('Current password is incorrect');
        });
    });

    describe('verifyEmail', () => {
        it('should verify email with valid token', async () => {
            const user = await User.findOne({ where: { email: testUser.email } });
            const token = user.verification_token;

            const result = await authService.verifyEmail(token);
            expect(result.email_verified).toBe(true);

            const updatedUser = await User.findByPk(user.id);
            expect(updatedUser.email_verified).toBe(true);
        });

        it('should throw error with invalid token', async () => {
            await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(
                'Invalid verification token'
            );
        });
    });

    describe('requestPasswordReset', () => {
        it('should send password reset email', async () => {
            const result = await authService.requestPasswordReset(testUser.email);
            expect(result.message).toBe('Password reset link sent to your email');
        });

        it('should not reveal if email does not exist', async () => {
            const result = await authService.requestPasswordReset('nonexistent@example.com');
            expect(result.message).toBe('If an account exists, a reset link has been sent');
        });
    });

    describe('resetPassword', () => {
        let resetToken;

        beforeEach(async () => {
            // Request reset to get token
            await authService.requestPasswordReset(testUser.email);
            const user = await User.findOne({ where: { email: testUser.email } });
            resetToken = user.reset_token;
        });

        it('should reset password with valid token', async () => {
            const result = await authService.resetPassword(resetToken, 'NewTest@123456');
            expect(result.message).toBe('Password reset successful');

            // Verify new password works
            const loginResult = await authService.login(
                testUser.email,
                'NewTest@123456',
                '127.0.0.1',
                'test-agent'
            );
            expect(loginResult).toHaveProperty('user');
        });

        it('should throw error with invalid token', async () => {
            await expect(
                authService.resetPassword('invalid-token', 'NewTest@123456')
            ).rejects.toThrow('Invalid or expired reset token');
        });
    });
});