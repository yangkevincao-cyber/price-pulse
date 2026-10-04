// backend/tests/integration/api/auth.test.js
const request = require('supertest');
const { app } = require('../../../src/app');

describe('Auth API Integration', () => {
    const testUser = {
        email: 'apitest@example.com',
        username: 'apitest',
        password: 'Test@123456',
        firstName: 'API',
        lastName: 'Test',
        role: 'buyer',
    };

    let authToken;
    let refreshToken;

    describe('POST /api/auth/register', () => {
        it('should register a new user', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(testUser)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user.email).toBe(testUser.email);
            expect(response.body.data.tokens).toHaveProperty('accessToken');
            expect(response.body.data.tokens).toHaveProperty('refreshToken');

            authToken = response.body.data.tokens.accessToken;
            refreshToken = response.body.data.tokens.refreshToken;
        });

        it('should return error for duplicate email', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send(testUser)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('User already exists');
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login successfully', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password,
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.tokens).toHaveProperty('accessToken');
            expect(response.body.data.tokens).toHaveProperty('refreshToken');

            authToken = response.body.data.tokens.accessToken;
            refreshToken = response.body.data.tokens.refreshToken;
        });

        it('should return error for invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'wrongpassword',
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid credentials');
        });
    });

    describe('GET /api/auth/profile', () => {
        it('should get profile with valid token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user.email).toBe(testUser.email);
        });

        it('should return error without token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('No token provided');
        });
    });

    describe('POST /api/auth/refresh-token', () => {
        it('should refresh tokens with valid refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh-token')
                .send({ refreshToken })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('accessToken');
            expect(response.body.data).toHaveProperty('refreshToken');

            authToken = response.body.data.accessToken;
            refreshToken = response.body.data.refreshToken;
        });

        it('should return error without refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh-token')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Refresh token required');
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should logout successfully', async () => {
            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Logged out successfully');
        });

        it('should not allow access after logout', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });
});