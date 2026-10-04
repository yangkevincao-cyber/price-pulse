// backend/tests/fixtures/mocks.js

/**
 * Mock request object
 */
const mockRequest = (options = {}) => {
    return {
        body: options.body || {},
        params: options.params || {},
        query: options.query || {},
        headers: options.headers || {},
        user: options.user || null,
        ip: options.ip || '127.0.0.1',
        method: options.method || 'GET',
        path: options.path || '/',
        get: (header) => options.headers[header] || null,
        ...options,
    };
};

/**
 * Mock response object
 */
const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    return res;
};

/**
 * Mock next function
 */
const mockNext = () => jest.fn();

/**
 * Mock database models
 */
const mockModels = {
    User: {
        findOne: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        destroy: jest.fn(),
        findAll: jest.fn(),
        findAndCountAll: jest.fn(),
    },
    Product: {
        findOne: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        destroy: jest.fn(),
        findAll: jest.fn(),
        findAndCountAll: jest.fn(),
    },
    Listing: {
        findOne: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        destroy: jest.fn(),
        findAll: jest.fn(),
        findAndCountAll: jest.fn(),
    },
    Transaction: {
        findOne: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        destroy: jest.fn(),
        findAll: jest.fn(),
        findAndCountAll: jest.fn(),
    },
};

/**
 * Mock Redis client
 */
const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
    hget: jest.fn(),
    hset: jest.fn(),
    hgetall: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn(),
    sismember: jest.fn(),
    lpush: jest.fn(),
    rpop: jest.fn(),
    lrange: jest.fn(),
    ltrim: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn(),
    flushall: jest.fn(),
};

/**
 * Mock email service
 */
const mockEmailService = {
    send: jest.fn().mockResolvedValue(true),
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    sendDemandAlertEmail: jest.fn().mockResolvedValue(true),
    sendWeeklyDigestEmail: jest.fn().mockResolvedValue(true),
    sendPriceDropAlert: jest.fn().mockResolvedValue(true),
    sendExchangeMatchEmail: jest.fn().mockResolvedValue(true),
};

/**
 * Mock Stripe service
 */
const mockStripeService = {
    createPaymentIntent: jest.fn().mockResolvedValue({
        clientSecret: 'mock_client_secret',
        paymentIntentId: 'mock_payment_intent_id',
    }),
    confirmPaymentIntent: jest.fn().mockResolvedValue({ status: 'succeeded' }),
    handleSuccessfulPayment: jest.fn().mockResolvedValue(true),
    processPayout: jest.fn().mockResolvedValue(true),
    createConnectAccount: jest.fn().mockResolvedValue({ id: 'mock_account_id' }),
    createAccountLink: jest.fn().mockResolvedValue({ url: 'mock_account_link' }),
};

/**
 * Mock PayPal service
 */
const mockPaypalService = {
    createOrder: jest.fn().mockResolvedValue({
        orderId: 'mock_order_id',
        approvalUrl: 'mock_approval_url',
    }),
    captureOrder: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
    refundPayment: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
};

module.exports = {
    mockRequest,
    mockResponse,
    mockNext,
    mockModels,
    mockRedis,
    mockEmailService,
    mockStripeService,
    mockPaypalService,
};