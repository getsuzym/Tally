module.exports = {
    testEnvironment: 'node',
    collectCoverageFrom: [
        'js/**/*.js',
        '!js/**/*.test.js',
        '!node_modules/**'
    ],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/test/'
    ],
    testMatch: [
        '**/js/**/*.test.js'
    ],
    verbose: true
};
