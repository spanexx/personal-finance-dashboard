const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server'); // Assuming server exports the app
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const Category = require('../../models/Category');

describe('Transaction API Endpoints', () => {
  let testUser;
  let accessToken;
  let testCategoryIncome;
  let testCategoryExpense;

  const testUserData = {
    firstName: 'Transaction',
    lastName: 'Tester',
    username: 'transactiontester',
    email: 'transaction.tester@example.com',
    password: 'Password123!',
  };

  beforeAll(async () => {
    // Create user
    await User.deleteMany({ email: testUserData.email }); // Clean up if exists
    testUser = await User.create({ ...testUserData, isEmailVerified: true });

    // Log in user to get accessToken
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: testUserData.email, password: testUserData.password });
    accessToken = loginResponse.body.data.tokens.accessToken;
    expect(accessToken).toBeDefined();

    // Create categories for the user
    await Category.deleteMany({ user: testUser._id }); // Clean up existing categories for this user

    testCategoryIncome = await Category.create({
      name: 'Test Income Category',
      type: 'income',
      color: '#00FF00',
      icon: 'money',
      user: testUser._id,
    });

    testCategoryExpense = await Category.create({
      name: 'Test Expense Category',
      type: 'expense',
      color: '#FF0000',
      icon: 'cart',
      user: testUser._id,
    });

    expect(testCategoryIncome).toBeDefined();
    expect(testCategoryExpense).toBeDefined();
  });

  afterAll(async () => {
    // Clean up: remove user, categories, transactions
    // Note: setup.js should clear collections, but specific cleanup can be added if needed.
    // For instance, if other tests create users that might conflict or if we want to be very explicit.
    // await User.findByIdAndDelete(testUser._id);
    // await Category.deleteMany({ user: testUser._id });
    // await Transaction.deleteMany({ user: testUser._id });
  });

  beforeEach(async () => {
    // Clear transactions for the test user before each test to ensure isolation
    // This is important because setup.js clears ALL transactions, but we might want
    // to be more specific here or rely on setup.js if that's sufficient.
    // For now, assuming setup.js handles general cleanup.
    // If transactions from other users are created, they'd be cleaned by setup.js.
    // We might still want to clean transactions specifically for testUser if tests add to it.
    await Transaction.deleteMany({ user: testUser._id });
  });

  // Test suites for CRUD operations will be added here
  describe('POST /api/transactions', () => {
    const validTransactionData = {
      amount: 100,
      type: 'expense',
      date: new Date().toISOString(),
      description: 'Test expense transaction',
    };

    it('should create a new transaction successfully', async () => {
      const transactionData = {
        ...validTransactionData,
        category: testCategoryExpense._id.toString(),
      };
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.amount).toBe(transactionData.amount);
      expect(response.body.data.type).toBe(transactionData.type);
      expect(response.body.data.user).toBe(testUser._id.toString());
      expect(response.body.data.category).toBeDefined();
      expect(response.body.data.category._id).toBe(testCategoryExpense._id.toString());
      expect(response.body.data.category.name).toBe(testCategoryExpense.name);

      const dbTransaction = await Transaction.findById(response.body.data._id);
      expect(dbTransaction).not.toBeNull();
      expect(dbTransaction.amount).toBe(transactionData.amount);
      expect(dbTransaction.user.toString()).toBe(testUser._id.toString());
    });

    it('should fail to create a transaction with missing required fields', async () => {
      const incompleteData = { type: 'expense', date: new Date() }; // Missing amount, category
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      // Example: Check for specific missing fields based on your validation
      expect(response.body.errors.some(err => err.path === 'amount')).toBe(true);
      expect(response.body.errors.some(err => err.path === 'category')).toBe(true);
    });

    it('should fail with a non-existent category ID', async () => {
      const nonExistentCategoryId = new mongoose.Types.ObjectId().toString();
      const transactionData = {
        ...validTransactionData,
        category: nonExistentCategoryId,
      };
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(transactionData)
        .expect(400); // Or 404 if category not found leads to that

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/category not found/i); // Adjust message as per API
    });

    it('should fail if category ID does not belong to the user (if validated)', async () => {
        // 1. Create another user and a category for them
        const otherUser = await User.create({
            firstName: 'Other', lastName: 'User',
            username: 'otheruser', email: 'other.user.trans@example.com',
            password: 'Password123!', isEmailVerified: true
        });
        const otherUserCategory = await Category.create({
            name: 'Other User Category', type: 'expense', user: otherUser._id
        });

        const transactionData = {
            ...validTransactionData,
            category: otherUserCategory._id.toString(),
        };

        const response = await request(app)
            .post('/api/transactions')
            .set('Authorization', `Bearer ${accessToken}`) // Authenticated as testUser
            .send(transactionData)
            .expect(400); // Or 403 if permission denied for category

        expect(response.body.success).toBe(false);
        // This message depends heavily on implementation.
        // It could be "Category not found" (if scoped to user) or a specific permission error.
        expect(response.body.message).toMatch(/invalid category/i);

        // Cleanup other user and category
        await User.findByIdAndDelete(otherUser._id);
        await Category.findByIdAndDelete(otherUserCategory._id);
    });


    it('should fail to create a transaction without authentication', async () => {
      const transactionData = {
        ...validTransactionData,
        category: testCategoryExpense._id.toString(),
      };
      const response = await request(app)
        .post('/api/transactions')
        .send(transactionData) // No Authorization header
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/authorization token required/i);
    });
  });

  describe('GET /api/transactions', () => {
    let otherUser;
    let transactionForOtherUser;

    beforeAll(async () => {
      // Create another user for testing transaction isolation
      otherUser = await User.create({
        firstName: 'OtherGet', lastName: 'UserGet',
        username: 'otheruserget', email: 'other.user.get@example.com',
        password: 'Password123!', isEmailVerified: true
      });
      const otherUserCategory = await Category.create({
        name: 'Other User Category Get', type: 'expense', user: otherUser._id
      });
      transactionForOtherUser = await Transaction.create({
        amount: 50, type: 'expense', date: new Date(),
        description: 'Other user transaction', category: otherUserCategory._id,
        user: otherUser._id
      });
    });

    afterAll(async () => {
      if (otherUser) await User.findByIdAndDelete(otherUser._id);
      // Categories and transactions for otherUser should be cleaned by their own user ID or cascade
    });

    it('should get all transactions for the authenticated user', async () => {
      // Create some transactions for the testUser
      await Transaction.create({
        amount: 150, type: 'income', date: new Date(), description: 'Income 1',
        category: testCategoryIncome._id, user: testUser._id
      });
      await Transaction.create({
        amount: 75, type: 'expense', date: new Date(), description: 'Expense 1',
        category: testCategoryExpense._id, user: testUser._id
      });

      const response = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toBeInstanceOf(Array);
      expect(response.body.data.transactions.length).toBe(2);
      // Ensure all returned transactions belong to testUser
      response.body.data.transactions.forEach(txn => {
        expect(txn.user.toString()).toBe(testUser._id.toString());
      });
      // Ensure other user's transaction is not returned
      const ids = response.body.data.transactions.map(t => t._id.toString());
      expect(ids).not.toContain(transactionForOtherUser._id.toString());
    });

    it('should filter transactions by type (income)', async () => {
      await Transaction.create({
        amount: 150, type: 'income', date: new Date(), description: 'Income for filter',
        category: testCategoryIncome._id, user: testUser._id
      });
      await Transaction.create({
        amount: 75, type: 'expense', date: new Date(), description: 'Expense for filter',
        category: testCategoryExpense._id, user: testUser._id
      });

      const response = await request(app)
        .get('/api/transactions?type=income')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions.length).toBeGreaterThanOrEqual(1);
      response.body.data.transactions.forEach(txn => expect(txn.type).toBe('income'));
    });

    it('should filter transactions by category', async () => {
        await Transaction.create({
            amount: 100, type: 'income', date: new Date(), description: 'CatFilter Income',
            category: testCategoryIncome._id, user: testUser._id
        });
        await Transaction.create({ // Another transaction with different category
            amount: 50, type: 'expense', date: new Date(), description: 'CatFilter Expense Other',
            category: testCategoryExpense._id, user: testUser._id
        });

        const response = await request(app)
            .get(`/api/transactions?category=${testCategoryIncome._id.toString()}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.transactions.length).toBeGreaterThanOrEqual(1);
        response.body.data.transactions.forEach(txn => {
            // In response, category might be populated object or just ID string
            const categoryIdInTxn = typeof txn.category === 'string' ? txn.category : txn.category._id.toString();
            expect(categoryIdInTxn).toBe(testCategoryIncome._id.toString());
        });
    });

    it('should filter transactions by date range', async () => {
        const dateToday = new Date();
        const dateYesterday = new Date(new Date().setDate(dateToday.getDate() - 1));
        const dateTomorrow = new Date(new Date().setDate(dateToday.getDate() + 1));

        await Transaction.create({ amount: 10, type: 'expense', category: testCategoryExpense._id, user: testUser._id, date: dateYesterday, description: 'Yesterday' });
        await Transaction.create({ amount: 20, type: 'expense', category: testCategoryExpense._id, user: testUser._id, date: dateToday, description: 'Today' });
        await Transaction.create({ amount: 30, type: 'expense', category: testCategoryExpense._id, user: testUser._id, date: dateTomorrow, description: 'Tomorrow' });

        const response = await request(app)
            .get(`/api/transactions?startDate=${dateYesterday.toISOString().split('T')[0]}&endDate=${dateToday.toISOString().split('T')[0]}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.transactions.length).toBe(2); // Yesterday and Today
        const descriptions = response.body.data.transactions.map(t => t.description);
        expect(descriptions).toContain('Yesterday');
        expect(descriptions).toContain('Today');
        expect(descriptions).not.toContain('Tomorrow');
    });

    it('should paginate transactions', async () => {
      // Create more transactions than default page limit (e.g., if limit is 10, create 12)
      const numTransactions = 12; // Assume default limit is < 12, e.g., 10
      for (let i = 0; i < numTransactions; i++) {
        await Transaction.create({
          amount: 10 + i, type: 'expense', category: testCategoryExpense._id,
          user: testUser._id, date: new Date(), description: `Page test ${i}`
        });
      }

      const page = 1;
      const limit = 5;
      const response = await request(app)
        .get(`/api/transactions?page=${page}&limit=${limit}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions.length).toBe(limit);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.currentPage).toBe(page);
      expect(response.body.data.pagination.totalPages).toBe(Math.ceil(numTransactions / limit));
      expect(response.body.data.pagination.totalItems).toBe(numTransactions);
    });

    it('should fail to get transactions without authentication', async () => {
      const response = await request(app)
        .get('/api/transactions')
        .expect(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/transactions/:id', () => {
    let transactionToUpdate;
    let otherUserForUpdate;
    let transactionOfOtherUserForUpdate;

    beforeAll(async () => {
        otherUserForUpdate = await User.create({
            firstName: 'OtherUpdate', lastName: 'UserUpdate',
            username: 'otherupdate', email: 'other.update@example.com',
            password: 'Password123!', isEmailVerified: true
        });
        const otherCategoryUpdate = await Category.create({ name: 'Other Cat Update', type: 'expense', user: otherUserForUpdate._id });
        transactionOfOtherUserForUpdate = await Transaction.create({
            amount: 222, type: 'expense', category: otherCategoryUpdate._id,
            user: otherUserForUpdate._id, date: new Date(), description: 'Other user update tx'
        });
    });

    afterAll(async () => {
        if(otherUserForUpdate) await User.findByIdAndDelete(otherUserForUpdate._id);
    });

    beforeEach(async () => {
      // Create a transaction for the main testUser to be updated
      transactionToUpdate = await Transaction.create({
        amount: 300, type: 'expense', date: new Date(), description: 'Update Test Original',
        category: testCategoryExpense._id, user: testUser._id
      });
    });

    it('should update a transaction successfully', async () => {
      const updateData = {
        amount: 350,
        description: 'Updated Description',
        category: testCategoryIncome._id.toString(), // Changing category as well
        type: 'income', // Type might change if category type changes
      };

      const response = await request(app)
        .put(`/api/transactions/${transactionToUpdate._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id.toString()).toBe(transactionToUpdate._id.toString());
      expect(response.body.data.amount).toBe(updateData.amount);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.category._id.toString()).toBe(updateData.category);
      expect(response.body.data.type).toBe(updateData.type);


      const dbTransaction = await Transaction.findById(transactionToUpdate._id);
      expect(dbTransaction.amount).toBe(updateData.amount);
      expect(dbTransaction.description).toBe(updateData.description);
      expect(dbTransaction.category.toString()).toBe(updateData.category);
    });

    it('should fail to update with invalid data (e.g., non-numeric amount)', async () => {
      const invalidUpdateData = { amount: 'not-a-number' };
      const response = await request(app)
        .put(`/api/transactions/${transactionToUpdate._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should fail to update a transaction not belonging to the user', async () => {
      const updateData = { amount: 225 };
      const response = await request(app)
        .put(`/api/transactions/${transactionOfOtherUserForUpdate._id}`)
        .set('Authorization', `Bearer ${accessToken}`) // Authenticated as testUser
        .send(updateData)
        .expect(404); // Or 403

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should fail to update a non-existent transaction', async () => {
        const nonExistentId = new mongoose.Types.ObjectId().toString();
        const updateData = { amount: 100 };
        const response = await request(app)
          .put(`/api/transactions/${nonExistentId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/not found/i);
      });

    it('should fail to update a transaction without authentication', async () => {
      const updateData = { amount: 301 };
      const response = await request(app)
        .put(`/api/transactions/${transactionToUpdate._id}`)
        .send(updateData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // Corrected order: GET /api/transactions/:id should come before PUT
  // The previous step incorrectly inserted PUT inside GET :id.
  // This diff will effectively move the PUT block after GET :id by re-adding GET :id content first,
  // then adding the DELETE block, and the PUT block was already added (but misplaced).
  // For clarity, I will re-add the GET /api/transactions/:id block structure here,
  // then add the DELETE block. The PUT block is assumed to be present from previous step.

  describe('GET /api/transactions/:id', () => {
    let testTransaction;
    let otherUserForSingleGet;
    let transactionOfOtherUserForSingleGet;

    beforeAll(async () => {
        // Create another user and their transaction for permission testing
        otherUserForSingleGet = await User.create({
            firstName: 'OtherSingle', lastName: 'UserSingle',
            username: 'othersingle', email: 'other.single.get@example.com',
            password: 'Password123!', isEmailVerified: true
        });
        const otherCategory = await Category.create({ name: 'Other Cat Single', type: 'income', user: otherUserForSingleGet._id });
        transactionOfOtherUserForSingleGet = await Transaction.create({
            amount: 111, type: 'income', category: otherCategory._id,
            user: otherUserForSingleGet._id, date: new Date(), description: 'Other user single tx'
        });
    });

    afterAll(async () => {
        if(otherUserForSingleGet) await User.findByIdAndDelete(otherUserForSingleGet._id);
        // Related categories/transactions should be cleaned up via user or setup.js
    });

    beforeEach(async () => {
      // Create a transaction for the main testUser before each test in this suite
      testTransaction = await Transaction.create({
        amount: 250, type: 'income', date: new Date(), description: 'Single Get Test',
        category: testCategoryIncome._id, user: testUser._id
      });
    });

    it('should get a specific transaction by ID successfully', async () => {
      const response = await request(app)
        .get(`/api/transactions/${testTransaction._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id.toString()).toBe(testTransaction._id.toString());
      expect(response.body.data.description).toBe(testTransaction.description);
      expect(response.body.data.user.toString()).toBe(testUser._id.toString());
    });

    it('should fail to get a transaction not belonging to the user', async () => {
      const response = await request(app)
        .get(`/api/transactions/${transactionOfOtherUserForSingleGet._id}`)
        .set('Authorization', `Bearer ${accessToken}`) // Authenticated as testUser
        .expect(404); // Or 403, depending on how non-ownership is handled (not found vs forbidden)

      expect(response.body.success).toBe(false);
      // Message could be "Transaction not found" or "Access denied"
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should return 404 for a non-existent transaction ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/transactions/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should fail to get a transaction without authentication', async () => {
      const response = await request(app)
        .get(`/api/transactions/${testTransaction._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/transactions/:id', () => {
    let transactionToDelete;
    let otherUserForDelete;
    let transactionOfOtherUserForDelete;

    beforeAll(async () => {
        otherUserForDelete = await User.create({
            firstName: 'OtherDelete', lastName: 'UserDelete',
            username: 'otherdelete', email: 'other.delete@example.com',
            password: 'Password123!', isEmailVerified: true
        });
        const otherCategoryDelete = await Category.create({ name: 'Other Cat Delete', type: 'expense', user: otherUserForDelete._id });
        transactionOfOtherUserForDelete = await Transaction.create({
            amount: 444, type: 'expense', category: otherCategoryDelete._id,
            user: otherUserForDelete._id, date: new Date(), description: 'Other user delete tx'
        });
    });

    afterAll(async () => {
        if(otherUserForDelete) await User.findByIdAndDelete(otherUserForDelete._id);
    });

    beforeEach(async () => {
      // Create a transaction for the main testUser to be deleted
      transactionToDelete = await Transaction.create({
        amount: 400, type: 'expense', date: new Date(), description: 'Delete Test',
        category: testCategoryExpense._id, user: testUser._id
      });
    });

    it('should delete a transaction successfully', async () => {
      const response = await request(app)
        .delete(`/api/transactions/${transactionToDelete._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200); // Or 204 if no content is returned

      expect(response.body.success).toBe(true);
      // expect(response.body.message).toMatch(/deleted successfully/i); // If message is returned

      const dbTransaction = await Transaction.findById(transactionToDelete._id);
      expect(dbTransaction).toBeNull(); // Or check for soft delete flag if implemented
    });

    it('should fail to delete a transaction not belonging to the user', async () => {
      const response = await request(app)
        .delete(`/api/transactions/${transactionOfOtherUserForDelete._id}`)
        .set('Authorization', `Bearer ${accessToken}`) // Authenticated as testUser
        .expect(404); // Or 403

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should return 404 when trying to delete a non-existent transaction', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/transactions/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should fail to delete a transaction without authentication', async () => {
      const response = await request(app)
        .delete(`/api/transactions/${transactionToDelete._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
