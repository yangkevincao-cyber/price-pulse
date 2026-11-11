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
            branches: 0,
            functions: 0,
            lines: 0,
            statements: 0,
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

};