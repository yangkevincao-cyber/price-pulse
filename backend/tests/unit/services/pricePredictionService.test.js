// backend/tests/unit/controllers/authController.test.js
const authController = require('../../../src/controllers/authController');
const { mockRequest, mockResponse } = require('../../fixtures/mocks');

describe('Auth Controller', () => {
    describe('register', () => {
        it('should register a new user', async () => {
            const req = mockRequest({
                body: {
                    email: 'newuser@example.com',
                    username: 'newuser',
                    password: 'Test@123456',
                    firstName: 'New',
                    lastName: 'User',
                    role: 'buyer',
                },
            });
            const res = mockResponse();

            await authController.register(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: expect.any(String),
                    data: expect.objectContaining({
                        user: expect.any(Object),
                        tokens: expect.any(Object),
                    }),
                })
            );
        });

        it('should return validation errors for invalid data', async () => {
            const req = mockRequest({
                body: {
                    email: 'invalid-email',
                    username: 'a',
                    password: 'weak',
                    firstName: '',
                    lastName: '',
                },
            });
            const res = mockResponse();

            await authController.register(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    errors: expect.any(Array),
                })
            );
        });
    });

    describe('login', () => {
        it('should login successfully', async () => {
            const req = mockRequest({
                body: {
                    email: 'test@example.com',
                    password: 'Test@123456',
                },
            });
            const res = mockResponse();

            await authController.login(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        user: expect.any(Object),
                        tokens: expect.any(Object),
                    }),
                })
            );
        });

        it('should return error for invalid credentials', async () => {
            const req = mockRequest({
                body: {
                    email: 'test@example.com',
                    password: 'wrongpassword',
                },
            });
            const res = mockResponse();

            await authController.login(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.any(String),
                })
            );
        });
    });

    describe('getProfile', () => {
        it('should get user profile', async () => {
            const req = mockRequest({
                user: { id: '11111111-1111-1111-1111-111111111111' },
            });
            const res = mockResponse();

            await authController.getProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        user: expect.any(Object),
                    }),
                })
            );
        });
    });
});