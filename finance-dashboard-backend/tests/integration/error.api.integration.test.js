const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server'); // Assuming server exports the app
const User = require('../../models/User');
const Category = require('../../models/Category');
const Transaction = require('../../models/Transaction');
const Goal = require('../../models/Goal');

describe('API General Error Handling', () => {
  let testUser;
  let accessToken;
  let testCategoryId; // For use in tests that need a valid category ID

  const testUserData = {
    firstName: 'ErrorTest',
    lastName: 'UserTest',
    username: 'errortestuser',
    email: 'error.test@example.com',
    password: 'Password123!',
  };

  beforeAll(async () => {
    // Create user
    await User.deleteMany({ email: testUserData.email });
    testUser = await User.create({ ...testUserData, isEmailVerified: true });

    // Log in user
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: testUserData.email, password: testUserData.password });
    accessToken = loginResponse.body.data.tokens.accessToken;
    expect(accessToken).toBeDefined();

    // Create a prerequisite category for some tests
    const category = await Category.create({
      name: 'Test Category for Errors',
      type: 'expense',
      user: testUser._id,
      color: '#EFEFEF',
      icon: 'error-icon'
    });
    testCategoryId = category._id.toString();
  });

  afterAll(async () => {
    // Clean up
    // if (testUser) await User.findByIdAndDelete(testUser._id);
    // if (testCategoryId) await Category.findByIdAndDelete(testCategoryId);
    // Other models cleaned by global setup or specific test needs
  });

  beforeEach(async () => {
    // Ensure a clean state for specific resources if tests modify them and don't clean up
    // For example, clear transactions if a test creates a malformed one.
    // await Transaction.deleteMany({ user: testUser._id });
  });

  // Test suites for different error types will be added here
  describe('API Validation Error Responses (400 Bad Request)', () => {
    it('Auth: should fail registration with an invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test', lastName: 'User', username: 'invemail',
          email: 'not-an-email', password: 'Password123!'
        })
        .expect(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err => err.path === 'email')).toBe(true);
    });

    it('Auth: should fail login with a missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testUserData.email /*, password missing */ })
        .expect(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err => err.path === 'password')).toBe(true);
    });

    it('Transactions: should fail creating a transaction without required amount', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ type: 'expense', category: testCategoryId, date: new Date() }) // amount is missing
        .expect(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err => err.path === 'amount')).toBe(true);
    });

    it('Transactions: should fail updating a transaction with invalid data type for amount', async () => {
      // First create a transaction to update
      const transaction = await Transaction.create({
        amount: 100, type: 'expense', category: testCategoryId,
        user: testUser._id, date: new Date(), description: 'Valid tx for update test'
      });

      const response = await request(app)
        .put(`/api/transactions/${transaction._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ amount: 'not-a-number' })
        .expect(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err => err.path === 'amount')).toBe(true);

      await Transaction.findByIdAndDelete(transaction._id); // Clean up
    });

    it('Categories: should fail creating a category with an invalid type', async () => {
      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Invalid Type Cat', type: 'investment', color: '#CCC', icon: 'inv' })
        .expect(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err => err.path === 'type')).toBe(true);
    });

    it('Goals: should fail creating a goal with targetAmount as a string', async () => {
      const response = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'String Amount Goal',
          targetAmount: 'not-a-number', // Invalid
          targetDate: new Date(new Date().getFullYear() + 1, 0, 1).toISOString()
        })
        .expect(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err => err.path === 'targetAmount')).toBe(true);
    });
  });

  describe('API Authentication & Authorization Error Responses (401 Unauthorized, 403 Forbidden)', () => {
    it('should return 401 when accessing a protected route (transactions) without a token', async () => {
      const response = await request(app)
        .get('/api/transactions') // Example protected route
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/authorization token required/i);
    });

    it('should return 401 when using an invalid/expired token for a protected route', async () => {
      const response = await request(app)
        .get('/api/users/me') // Example protected route
        .set('Authorization', 'Bearer invalidorExpiredToken12345')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/invalid token/i); // Or similar based on actual API message
    });

    it('should return 403 or 404 when trying to access another user\'s specific resource', async () => {
      // 1. Create another user and a resource for them
      const otherUser = await User.create({ email: 'otheruser.errors@example.com', password: 'password', username: 'othererrors'});
      const otherUserCategory = await Category.create({ name: 'Other User Category Error Test', type: 'expense', user: otherUser._id });

      // 2. Attempt to access it using primary testUser's token
      const response = await request(app)
        .get(`/api/categories/${otherUserCategory._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404); // Or 403, depending on API design (not found vs. forbidden)

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i); // Adjust if 403 with different message

      // Cleanup
      await User.findByIdAndDelete(otherUser._id);
      await Category.findByIdAndDelete(otherUserCategory._id);
    });

    // If specific admin routes exist, a test for 403 for non-admin users would go here.
    // For example:
    // it('should return 403 when a non-admin user tries to access an admin route', async () => {
    //   const response = await request(app)
    //     .get('/api/admin/some-admin-data') // Assuming this is an admin-only route
    //     .set('Authorization', `Bearer ${accessToken}`) // Token for a regular user
    //     .expect(403);
    //   expect(response.body.success).toBe(false);
    //   expect(response.body.message).toMatch(/access denied/i); // Or similar
    // });
  });

  describe('API Database Error Responses (e.g., 409 Conflict)', () => {
    it('should return 409 when attempting to create a category with a duplicate name for the same user and type', async () => {
      const categoryData = { name: 'Duplicate Category Test', type: 'expense', user: testUser._id, color: '#DDD', icon: 'dup' };
      // Create it once
      await Category.create(categoryData);

      // Attempt to create again
      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: categoryData.name, type: categoryData.type, color: '#EEE', icon: 'dup2' })
        .expect(409); // Or 400 depending on specific backend implementation for duplicates

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/category with this name and type already exists/i); // Or similar
    });

    it('should return 409 when attempting to register a user with an email that already exists', async () => {
        // The primary test user (error.test@example.com) already exists.
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Duplicate', lastName: 'Email', username: 'dupemailuser',
                email: testUserData.email, // Using existing email
                password: 'Password123!'
            })
            .expect(409); // Or 400

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/email already exists/i);
    });

    // Simulating other DB errors like "DB connection down" is generally out of scope for API integration tests
    // and better suited for unit tests with DB layer mocking or chaos engineering.
    // The global error handler should catch unhandled Mongoose errors and return a 500,
    // which is implicitly tested if any unhandled error occurs during other tests.
  });

  describe('Malformed Requests and Method Not Allowed', () => {
    it('should return 400 for a POST request with malformed JSON body', async () => {
      const response = await request(app)
        .post('/api/transactions') // Any POST/PUT endpoint expecting JSON
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send('{"amount": 100, "description": "missing quote}') // Malformed JSON
        .expect(400);

      expect(response.body.success).toBe(false);
      // The exact error message might come from the body-parser middleware
      expect(response.body.message).toMatch(/malformed|invalid json/i);
    });

    it('should return 400 for a PUT request with malformed JSON to update a category', async () => {
        const categoryToUpdate = await Category.create({ name: 'Malformed Update Test', type: 'expense', user: testUser._id});
        const response = await request(app)
          .put(`/api/categories/${categoryToUpdate._id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .set('Content-Type', 'application/json')
          .send('{"name": "Updated Name", "color": "#12345 // Missing closing quote and brace')
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/malformed|invalid json/i);
        await Category.findByIdAndDelete(categoryToUpdate._id); // Cleanup
      });

    it('should return 405 Method Not Allowed or 404 Not Found for an unsupported HTTP method on a valid path', async () => {
      // Example: Using PATCH on /api/transactions/:id if PATCH is not supported
      // First, create a transaction to have a valid :id
      const transaction = await Transaction.create({
        amount: 200, type: 'income', category: testCategoryId,
        user: testUser._id, date: new Date(), description: 'Method test tx'
      });

      const response = await request(app)
        .patch(`/api/transactions/${transaction._id}`) // Assuming PATCH is not supported
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ description: 'Trying PATCH' })
        .expect(res => { // Status could be 404 or 405
            if (res.status !== 404 && res.status !== 405) {
                throw new Error(`Expected 404 or 405, but got ${res.status}`);
            }
        });

      // If 405, there might be an 'Allow' header.
      // if (response.status === 405) {
      //   expect(response.headers['allow']).toBeDefined();
      // }
      // General check for failure
      expect(response.body.success).toBe(false); // Assuming error middleware sets this

      await Transaction.findByIdAndDelete(transaction._id); // Cleanup
    });

    it('should return 404 Not Found for a completely undefined route', async () => {
        const response = await request(app)
          .get('/api/this-route-does-not-exist')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(404);

        // The response body for a generic 404 from the framework might not have `success: false`
        // It often is a simple HTML page or a short JSON message like { "error": "Not Found" }
        // Check if the response indicates "Not Found" or similar.
        // For a JSON API that consistently uses a global error handler, it might include `success: false`.
        // expect(response.body.success).toBe(false);
        expect(response.text).toMatch(/not found/i); // More general check for 404 page
      });
  });
});
