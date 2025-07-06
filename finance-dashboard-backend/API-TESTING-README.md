# Finance Dashboard API Testing Suite

This folder contains multiple test scripts to validate the functionality, security, and reliability of the Finance Dashboard API.

## Available Test Scripts

1. **test-api.js** - Tests authentication and user management endpoints
2. **test-finance-apis.js** - Tests transaction and budget management endpoints
3. **test-security.js** - Tests API endpoints for common security vulnerabilities
4. **run-all-api-tests.js** - Master script that runs all tests in sequence

## Prerequisites

- Node.js installed (v14+ recommended)
- MongoDB running locally or configured via environment variables
- Finance Dashboard API server running on <http://localhost:5000> (default)

## Running the Tests

### Individual Test Suites

Run any of the individual test scripts:

```bash
# Authentication and user tests
node test-api.js

# Transaction and budget tests
node test-finance-apis.js

# Security tests
node test-security.js
```

### All Tests

Run all tests in sequence:

```bash
# Run all tests
node run-all-api-tests.js
```

## Test Coverage

### Authentication & User Tests

- User registration
- User login
- Token refresh
- Profile management
- Session management
- Password operations
- Email verification
- Email preferences

### Finance API Tests

- Transaction CRUD operations
- Transaction analytics and statistics
- Budget CRUD operations
- Budget analysis and recommendations

### Security Tests

- Authentication security (brute force protection, JWT security)
- Access control
- Data validation (SQL injection, XSS, NoSQL injection)
- CORS configuration

## Configuration

By default, tests use:

- Base URL: <http://localhost:5000/api>
- Test user: randomly generated email with timestamp

Modify the constants at the top of each test file to customize settings.

## Cleanup

The tests automatically clean up created test data when possible, but manual cleanup might be required if tests are interrupted or fail unexpectedly.

## Adding New Tests

To add new tests:

1. Add test functions to the appropriate test script
2. Update the `runAllTests` function to include your new tests
3. If adding entirely new test categories, create a new test file and update run-all-api-tests.js
