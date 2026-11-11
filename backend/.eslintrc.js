// backend/.eslintrc.js
module.exports = {
    env: {
        node: true,
        es2022: true,
        jest: true,
    },
    extends: [
        'eslint:recommended',
        'prettier',
    ],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'script',
    },
    rules: {
        // Error prevention
        'no-unused-vars': ['warn', {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
        }],
        'no-undef': 'error',
        'no-console': 'off',
        'no-process-exit': 'off',

        // Style (keep light — Prettier handles formatting)
        'prefer-const': 'warn',
        'no-var': 'error',
        'eqeqeq': ['warn', 'smart'],
        'curly': ['warn', 'multi-line'],

        // Async/Promise
        'no-async-promise-executor': 'warn',
        'require-atomic-updates': 'off',

        // Import
        'no-duplicate-imports': 'warn',

        // Best practices
        'no-throw-literal': 'warn',
        'no-return-await': 'warn',
    },
    ignorePatterns: [
        'node_modules/',
        'coverage/',
        'logs/',
        'uploads/',
        'backups/',
        'dist/',
        'build/',
        'src/migrations/',
        'src/seeders/',
    ],
    overrides: [
        // ✅ Scraping files run browser code via page.evaluate()
        {
            files: [
                'src/scraping/**/*.js',
                'src/services/scraping/**/*.js',
            ],
            env: {
                browser: true,   // ← enables document, window, navigator, etc.
                node: true,      // ← keeps require, process, __dirname
            },
        },
        // Test files
        {
            files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
            env: { jest: true },
            rules: { 'no-unused-vars': 'off' },
        },
    ],
};