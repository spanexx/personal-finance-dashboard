require('dotenv').config({ path: './tests/test.env' });

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  coverageDirectory: 'coverage',  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'models/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  verbose: true,
  testTimeout: 120000, // 2 minutes timeout for all tests
  detectOpenHandles: true,
  forceExit: true
};
