// backend/jest.config.js
module.exports = {
    // Test environment
    testEnvironment: 'node',

    // Test files pattern
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js',
    ],

    // Coverage collection
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/app.js',
        '!src/**/index.js',
        '!src/config/**',
        '!src/migrations/**',
        '!src/seeders/**',
        '!src/**/*.test.js',
    ],

    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

    // Module paths
    moduleDirectories: ['node_modules', 'src'],

    // Timeout
    testTimeout: 30000,

    // Verbose output
    verbose: true,

    // Force exit after tests
    forceExit: true,

    // Detect open handles
    detectOpenHandles: true,

    // Coverage directory
    coverageDirectory: 'coverage',

    // Coverage reporters
    coverageReporters: ['text', 'lcov', 'html'],

    // Global teardown
    globalTeardown: async () => {
        // Cleanup
    },
};