const mongoose = require('mongoose');
// Import all models
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const Category = require('../../models/Category');
const Budget = require('../../models/Budget');
const Goal = require('../../models/Goal');

// No need to connect/disconnect mongoose here, setup.js handles it.

describe('Database Query Performance (Initial Set)', () => {
  let testUser;
  let testCategory1, testCategory2, testCategoryIncome;

  beforeAll(async () => {
    // Create a test user
    const tempUser = await User.create({
      firstName: 'QueryPerf',
      lastName: 'Tester',
      username: `queryperftester_${Date.now()}`,
      email: `query.perf.tester.${Date.now()}@example.com`,
      password: 'PasswordPerf123!',
      isEmailVerified: true,
    });
    testUser = tempUser; // Assign to the outer scope variable

    // Create some base categories for this user
    testCategory1 = await Category.create({
        name: 'Groceries Perf', type: 'expense', user: testUser._id, color: '#FF0000', icon: 'cart'
    });
    testCategory2 = await Category.create({
        name: 'Salary Perf', type: 'income', user: testUser._id, color: '#00FF00', icon: 'money'
    });
    testCategoryIncome = await Category.create({ // Alias for clarity in some tests
        name: 'General Income Perf', type: 'income', user: testUser._id, color: '#00AA00', icon: 'cash'
    });
  });

  afterAll(async () => {
    // Cleanup: The global afterAll in setup.js should clear collections.
    // If specific cleanup for this user/categories is needed, it can be added here,
    // but typically not required if global teardown is effective.
    // await User.findByIdAndDelete(testUser._id);
    // await Category.deleteMany({ user: testUser._id });
  });

  beforeEach(async () => {
      // The global beforeEach in setup.js clears all collections.
      // For performance tests, data is usually seeded specifically within each test or its describe block's beforeEach.
  });

  // Test suites for different models and query types will go here
  describe('Transaction Model Query Performance', () => {
    const NUM_TRANSACTIONS_AGG = 150; // Number of transactions for aggregation tests

    beforeEach(async () => {
      // Clear and seed transactions for the testUser
      await Transaction.deleteMany({ user: testUser._id });
      const transactionsToCreate = [];
      const startDate = new Date(2023, 0, 1); // Jan 1, 2023

      for (let i = 0; i < NUM_TRANSACTIONS_AGG; i++) {
        const transactionDate = new Date(startDate);
        transactionDate.setDate(startDate.getDate() + (i % 60)); // Spread over ~2 months

        transactionsToCreate.push({
          user: testUser._id,
          category: i % 3 === 0 ? testCategory1._id : (i % 3 === 1 ? testCategory2._id : testCategoryIncome._id),
          amount: parseFloat((Math.random() * 100 + 1).toFixed(2)), // Ensure amount is a number
          type: i % 2 === 0 ? 'expense' : 'income',
          date: transactionDate,
          description: `Test transaction ${i} for aggregation with keyword search_term_${i%10}`
        });
      }
      await Transaction.insertMany(transactionsToCreate);
    });

    it('should execute complex aggregation for monthly summary by category', async () => {
      const targetMonth = 0; // January (0-indexed)
      const targetYear = 2023;
      const monthStartDate = new Date(targetYear, targetMonth, 1);
      const monthEndDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999); // End of the month

      const pipeline = [
        {
          $match: {
            user: testUser._id,
            date: { $gte: monthStartDate, $lte: monthEndDate }
          }
        },
        {
          $group: {
            _id: { category: '$category', type: '$type' },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'categories', // Mongoose pluralizes and lowercases model names for collections
            localField: '_id.category',
            foreignField: '_id',
            as: 'categoryDetails'
          }
        },
        { $unwind: '$categoryDetails' }, // Or $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true }
        {
          $project: {
            _id: 0,
            categoryName: '$categoryDetails.name',
            transactionType: '$_id.type',
            totalAmount: 1,
            transactionCount: '$count'
          }
        },
        { $sort: { categoryName: 1, transactionType: 1}}
      ];

      const startTime = Date.now();
      const results = await Transaction.aggregate(pipeline);
      const duration = Date.now() - startTime;
      console.log(`Aggregation query duration: ${duration}ms for ${NUM_TRANSACTIONS_AGG} base transactions.`);

      expect(results).toBeInstanceOf(Array);
      // Basic check: ensure some results are returned if data was seeded for the month
      // More specific assertions would require knowing exact seed data distribution
      if (results.length > 0) {
        expect(results[0].categoryName).toBeDefined();
        expect(results[0].totalAmount).toBeGreaterThan(0);
        expect(results[0].transactionCount).toBeGreaterThan(0);
      }
      // This is not a strict performance test, but a very slow query (e.g., >2-5 seconds for this volume)
      // might indicate a significant issue (missing indexes, very inefficient pipeline).
      // For CI, you might add a loose upper bound if desired, e.g. expect(duration).toBeLessThan(5000);
    });

    // Pagination Tests
    it('should correctly paginate through a large dataset of transactions', async () => {
      const totalTransactions = NUM_TRANSACTIONS_AGG; // From beforeEach
      const limit = 10;

      // Test first page
      const page1Results = await Transaction.find({ user: testUser._id }).sort({ date: -1 }).limit(limit).skip(0);
      expect(page1Results).toBeInstanceOf(Array);
      expect(page1Results.length).toBe(Math.min(limit, totalTransactions));
      const firstPageIds = page1Results.map(t => t._id.toString());

      // Test second page
      if (totalTransactions > limit) {
        const page2Results = await Transaction.find({ user: testUser._id }).sort({ date: -1 }).limit(limit).skip(limit);
        expect(page2Results).toBeInstanceOf(Array);
        expect(page2Results.length).toBe(Math.min(limit, totalTransactions - limit));

        // Ensure items are different from the first page
        const secondPageIds = page2Results.map(t => t._id.toString());
        const overlap = firstPageIds.filter(id => secondPageIds.includes(id));
        expect(overlap.length).toBe(0);
      }

      // Test page beyond total items
      const pageBeyondResults = await Transaction.find({ user: testUser._id }).sort({ date: -1 }).limit(limit).skip(totalTransactions);
      expect(pageBeyondResults).toBeInstanceOf(Array);
      expect(pageBeyondResults.length).toBe(0);
    });

    // Filtering and Sorting Tests
    it('should efficiently filter transactions by multiple criteria', async () => {
      const filterStartDate = new Date(2023, 0, 5);  // Jan 5, 2023
      const filterEndDate = new Date(2023, 0, 15); // Jan 15, 2023

      const query = {
        user: testUser._id,
        category: testCategory1._id, // Filter by one of the seeded categories
        type: 'expense',
        date: { $gte: filterStartDate, $lte: filterEndDate },
        description: { $regex: /search_term_1/i } // Example regex search
      };

      const startTime = Date.now();
      const results = await Transaction.find(query);
      const duration = Date.now() - startTime;
      console.log(`Multi-criteria filter query duration: ${duration}ms`);

      expect(results).toBeInstanceOf(Array);
      // Assertions to ensure all returned transactions match the criteria
      results.forEach(txn => {
        expect(txn.user.toString()).toBe(testUser._id.toString());
        expect(txn.category.toString()).toBe(testCategory1._id.toString());
        expect(txn.type).toBe('expense');
        expect(txn.date.getTime()).toBeGreaterThanOrEqual(filterStartDate.getTime());
        expect(txn.date.getTime()).toBeLessThanOrEqual(filterEndDate.getTime());
        expect(txn.description).toMatch(/search_term_1/i);
      });
      // Again, a loose duration check can be added if necessary.
      // expect(duration).toBeLessThan(3000);
    });

    it('should efficiently sort transactions by date and amount', async () => {
      const startTime = Date.now();
      const results = await Transaction.find({ user: testUser._id })
                                     .sort({ date: -1, amount: 1 })
                                     .limit(20); // Limit for practical assertion
      const duration = Date.now() - startTime;
      console.log(`Sort query duration: ${duration}ms`);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeLessThanOrEqual(20);

      // Plausibility check for sorting (first few items)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].date.getTime()).toBeGreaterThanOrEqual(results[i+1].date.getTime());
        if (results[i].date.getTime() === results[i+1].date.getTime()) {
          expect(results[i].amount).toBeLessThanOrEqual(results[i+1].amount);
        }
      }
      // expect(duration).toBeLessThan(3000);
    });
  });

  describe('Other Models Query Performance (Lightweight Checks)', () => {
    const NUM_ITEMS_OTHER_MODELS = 30;

    beforeEach(async () => {
      // Clear existing data for these models for the test user
      await Budget.deleteMany({ user: testUser._id });
      await Goal.deleteMany({ user: testUser._id });
      // Categories are seeded in top-level beforeAll, can add more here if needed for specific tests
      // For this lightweight check, we'll assume the base categories are enough or add a few more.

      const budgetsToCreate = [];
      const goalsToCreate = [];

      for (let i = 0; i < NUM_ITEMS_OTHER_MODELS; i++) {
        budgetsToCreate.push({
          user: testUser._id,
          name: `Test Budget ${i}`,
          totalAmount: 1000 + i * 100,
          period: i % 2 === 0 ? 'monthly' : 'yearly',
          startDate: new Date(2023, i % 12, 1),
          categoryAllocations: [{ category: testCategory1._id, allocatedAmount: 500 + i * 50 }, { category: testCategory2._id, allocatedAmount: 500 + i * 50 }]
        });

        goalsToCreate.push({
          user: testUser._id,
          name: `Test Goal ${i}`,
          targetAmount: 2000 + i * 200,
          targetDate: new Date(2024, i % 12, 28),
          currentAmount: i * 50,
          status: i % 3 === 0 ? 'in-progress' : (i % 3 === 1 ? 'achieved' : 'on-hold')
        });
      }
      await Budget.insertMany(budgetsToCreate);
      await Goal.insertMany(goalsToCreate);
    });

    it('Budget: should find active monthly budgets and sort by name', async () => {
      const results = await Budget.find({ user: testUser._id, period: 'monthly' })
                                  .sort({ name: 1 });
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThanOrEqual(NUM_ITEMS_OTHER_MODELS / 2 - 1); // Roughly half are monthly
      if (results.length > 1) {
        expect(results[0].name.localeCompare(results[1].name)).toBeLessThanOrEqual(0);
      }
    });

    it('Goal: should find in-progress goals and sort by targetDate descending', async () => {
      const results = await Goal.find({ user: testUser._id, status: 'in-progress' })
                                .sort({ targetDate: -1 });
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThanOrEqual(NUM_ITEMS_OTHER_MODELS / 3 -1 );
       if (results.length > 1) {
        expect(results[0].targetDate.getTime()).toBeGreaterThanOrEqual(results[1].targetDate.getTime());
      }
    });

    it('Category: should find expense categories and sort by name', async () => {
        // Add a few more specific categories for this test to ensure data variety
        await Category.create({ name: 'Travel Perf', type: 'expense', user: testUser._id, color: '#001', icon: 'plane' });
        await Category.create({ name: 'Utilities Perf', type: 'expense', user: testUser._id, color: '#002', icon: 'bulb' });

        const results = await Category.find({ user: testUser._id, type: 'expense' })
                                      .sort({ name: 1 });
        expect(results).toBeInstanceOf(Array);
        // Expect at least the two created here + testCategory1 (Groceries Perf)
        expect(results.length).toBeGreaterThanOrEqual(3);
        if (results.length > 1) {
            expect(results[0].name.localeCompare(results[1].name)).toBeLessThanOrEqual(0);
        }
    });
  });
});
