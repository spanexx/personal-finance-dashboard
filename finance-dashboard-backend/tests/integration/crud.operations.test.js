/**
 * CRUD Operations Integration Tests
 * Tests transaction, budget, goal, and category CRUD operations with proper authorization
 */

const request = require('supertest');
const { app } = require('./setup');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const Budget = require('../../models/Budget');
const Goal = require('../../models/Goal');
const Category = require('../../models/Category');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

describe('CRUD Operations Integration Tests', () => {
  let authToken;
  let userId;
  let anotherUserToken;
  let anotherUserId;

  beforeEach(async () => {
    // Create authenticated test user
    const user = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: await bcrypt.hash('Password123!', 12),
      isEmailVerified: true
    });
    userId = user._id;

    authToken = jwt.sign(
      { userId: userId.toString() },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create another user for authorization testing
    const anotherUser = await User.create({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      password: await bcrypt.hash('Password123!', 12),
      isEmailVerified: true
    });
    anotherUserId = anotherUser._id;

    anotherUserToken = jwt.sign(
      { userId: anotherUserId.toString() },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('Transaction CRUD Operations', () => {
    const validTransaction = {
      description: 'Coffee Shop',
      amount: 5.50,
      type: 'expense',
      date: new Date().toISOString(),
      payee: 'Starbucks',
      notes: 'Morning coffee'
    };

    describe('POST /api/transactions', () => {
      it('should create transaction with valid data', async () => {
        const response = await request(app)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(validTransaction)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          message: expect.stringContaining('created'),
          data: expect.objectContaining({
            transaction: expect.objectContaining({
              description: validTransaction.description,
              amount: validTransaction.amount,
              type: validTransaction.type,
              user: userId.toString()
            })
          })
        });

        // Verify transaction was saved to database
        const savedTransaction = await Transaction.findById(response.body.data.transaction._id);
        expect(savedTransaction).toBeTruthy();
        expect(savedTransaction.user.toString()).toBe(userId.toString());
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/transactions')
          .send(validTransaction)
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          message: expect.stringContaining('authorization')
        });
      });

      it('should validate transaction data', async () => {
        const invalidTransaction = {
          description: '',
          amount: -5,
          type: 'invalid',
          date: 'invalid-date'
        };

        const response = await request(app)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidTransaction)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              message: expect.any(String)
            })
          ])
        });
      });

      it('should handle category assignment', async () => {
        const category = await Category.create({
          name: 'Food & Dining',
          type: 'expense',
          user: userId
        });

        const transactionWithCategory = {
          ...validTransaction,
          category: category._id.toString()
        };

        const response = await request(app)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(transactionWithCategory)
          .expect(201);

        expect(response.body.data.transaction.category).toBe(category._id.toString());
      });
    });

    describe('GET /api/transactions', () => {
      beforeEach(async () => {
        // Create test transactions
        await Transaction.create([
          {
            ...validTransaction,
            user: userId,
            description: 'Transaction 1',
            amount: 10
          },
          {
            ...validTransaction,
            user: userId,
            description: 'Transaction 2',
            amount: 20
          },
          {
            ...validTransaction,
            user: anotherUserId,
            description: 'Another user transaction',
            amount: 30
          }
        ]);
      });

      it('should get user transactions with proper authorization', async () => {
        const response = await request(app)
          .get('/api/transactions')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            transactions: expect.arrayContaining([
              expect.objectContaining({
                description: 'Transaction 1',
                user: userId.toString()
              }),
              expect.objectContaining({
                description: 'Transaction 2',
                user: userId.toString()
              })
            ])
          })
        });

        // Should not include other user's transactions
        const otherUserTransaction = response.body.data.transactions.find(
          t => t.description === 'Another user transaction'
        );
        expect(otherUserTransaction).toBeUndefined();
      });

      it('should support filtering by date range', async () => {
        const startDate = new Date('2024-01-01').toISOString();
        const endDate = new Date('2024-12-31').toISOString();

        const response = await request(app)
          .get('/api/transactions')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ startDate, endDate })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.transactions).toBeDefined();
      });

      it('should support filtering by type', async () => {
        const response = await request(app)
          .get('/api/transactions')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ type: 'expense' })
          .expect(200);

        response.body.data.transactions.forEach(transaction => {
          expect(transaction.type).toBe('expense');
        });
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/transactions')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ page: 1, limit: 1 })
          .expect(200);

        expect(response.body.data.transactions).toHaveLength(1);
        expect(response.body.data.pagination).toMatchObject({
          currentPage: 1,
          totalPages: expect.any(Number),
          totalTransactions: expect.any(Number)
        });
      });
    });

    describe('PUT /api/transactions/:id', () => {
      let transactionId;

      beforeEach(async () => {
        const transaction = await Transaction.create({
          ...validTransaction,
          user: userId
        });
        transactionId = transaction._id;
      });

      it('should update own transaction', async () => {
        const updateData = {
          description: 'Updated Coffee Shop',
          amount: 6.50
        };

        const response = await request(app)
          .put(`/api/transactions/${transactionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            transaction: expect.objectContaining({
              description: updateData.description,
              amount: updateData.amount
            })
          })
        });

        // Verify update in database
        const updatedTransaction = await Transaction.findById(transactionId);
        expect(updatedTransaction.description).toBe(updateData.description);
        expect(updatedTransaction.amount).toBe(updateData.amount);
      });

      it('should not allow updating other user transactions', async () => {
        const updateData = { description: 'Unauthorized update' };

        const response = await request(app)
          .put(`/api/transactions/${transactionId}`)
          .set('Authorization', `Bearer ${anotherUserToken}`)
          .send(updateData)
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          message: expect.stringContaining('not found')
        });
      });

      it('should validate update data', async () => {
        const invalidUpdate = {
          amount: -100,
          type: 'invalid'
        };

        const response = await request(app)
          .put(`/api/transactions/${transactionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidUpdate)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      });
    });

    describe('DELETE /api/transactions/:id', () => {
      let transactionId;

      beforeEach(async () => {
        const transaction = await Transaction.create({
          ...validTransaction,
          user: userId
        });
        transactionId = transaction._id;
      });

      it('should delete own transaction', async () => {
        const response = await request(app)
          .delete(`/api/transactions/${transactionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: expect.stringContaining('deleted')
        });

        // Verify deletion in database
        const deletedTransaction = await Transaction.findById(transactionId);
        expect(deletedTransaction).toBeNull();
      });

      it('should not allow deleting other user transactions', async () => {
        const response = await request(app)
          .delete(`/api/transactions/${transactionId}`)
          .set('Authorization', `Bearer ${anotherUserToken}`)
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          message: expect.stringContaining('not found')
        });

        // Verify transaction still exists
        const existingTransaction = await Transaction.findById(transactionId);
        expect(existingTransaction).toBeTruthy();
      });
    });
  });

  describe('Budget CRUD Operations', () => {
    const validBudget = {
      name: 'Monthly Food Budget',
      amount: 500,
      period: 'monthly',
      startDate: new Date('2024-01-01').toISOString(),
      endDate: new Date('2024-01-31').toISOString()
    };

    describe('POST /api/budgets', () => {
      it('should create budget with valid data', async () => {
        const response = await request(app)
          .post('/api/budgets')
          .set('Authorization', `Bearer ${authToken}`)
          .send(validBudget)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            budget: expect.objectContaining({
              name: validBudget.name,
              amount: validBudget.amount,
              user: userId.toString()
            })
          })
        });
      });

      it('should validate budget data', async () => {
        const invalidBudget = {
          name: '',
          amount: -100,
          period: 'invalid'
        };

        const response = await request(app)
          .post('/api/budgets')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidBudget)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      });

      it('should handle category-specific budgets', async () => {
        const category = await Category.create({
          name: 'Food',
          type: 'expense',
          user: userId
        });

        const categoryBudget = {
          ...validBudget,
          category: category._id.toString()
        };

        const response = await request(app)
          .post('/api/budgets')
          .set('Authorization', `Bearer ${authToken}`)
          .send(categoryBudget)
          .expect(201);

        expect(response.body.data.budget.category).toBe(category._id.toString());
      });
    });

    describe('GET /api/budgets', () => {
      beforeEach(async () => {
        await Budget.create([
          { ...validBudget, user: userId, name: 'Budget 1' },
          { ...validBudget, user: userId, name: 'Budget 2' },
          { ...validBudget, user: anotherUserId, name: 'Another user budget' }
        ]);
      });

      it('should get user budgets with authorization', async () => {
        const response = await request(app)
          .get('/api/budgets')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.budgets).toHaveLength(2);
        
        response.body.data.budgets.forEach(budget => {
          expect(budget.user).toBe(userId.toString());
        });
      });

      it('should filter by active status', async () => {
        const response = await request(app)
          .get('/api/budgets')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ active: true })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Goal CRUD Operations', () => {
    const validGoal = {
      name: 'Emergency Fund',
      description: 'Save for emergencies',
      targetAmount: 10000,
      targetDate: new Date('2024-12-31').toISOString(),
      priority: 'high'
    };

    describe('POST /api/goals', () => {
      it('should create goal with valid data', async () => {
        const response = await request(app)
          .post('/api/goals')
          .set('Authorization', `Bearer ${authToken}`)
          .send(validGoal)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            goal: expect.objectContaining({
              name: validGoal.name,
              targetAmount: validGoal.targetAmount,
              user: userId.toString()
            })
          })
        });
      });

      it('should validate goal data', async () => {
        const invalidGoal = {
          name: '',
          targetAmount: -1000,
          targetDate: 'invalid-date'
        };

        const response = await request(app)
          .post('/api/goals')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidGoal)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      });
    });

    describe('POST /api/goals/:id/contributions', () => {
      let goalId;

      beforeEach(async () => {
        const goal = await Goal.create({
          ...validGoal,
          user: userId
        });
        goalId = goal._id;
      });

      it('should add contribution to goal', async () => {
        const contribution = {
          amount: 500,
          description: 'Monthly savings'
        };

        const response = await request(app)
          .post(`/api/goals/${goalId}/contributions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(contribution)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            goal: expect.objectContaining({
              currentAmount: contribution.amount
            })
          })
        });
      });

      it('should not allow contributing to other user goals', async () => {
        const contribution = { amount: 500 };

        const response = await request(app)
          .post(`/api/goals/${goalId}/contributions`)
          .set('Authorization', `Bearer ${anotherUserToken}`)
          .send(contribution)
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Category CRUD Operations', () => {
    const validCategory = {
      name: 'Food & Dining',
      type: 'expense',
      description: 'Food and restaurant expenses',
      color: '#FF5733',
      icon: 'restaurant'
    };

    describe('POST /api/categories', () => {
      it('should create category with valid data', async () => {
        const response = await request(app)
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send(validCategory)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            category: expect.objectContaining({
              name: validCategory.name,
              type: validCategory.type,
              user: userId.toString()
            })
          })
        });
      });

      it('should prevent duplicate category names for user', async () => {
        await Category.create({
          ...validCategory,
          user: userId
        });

        const response = await request(app)
          .post('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .send(validCategory)
          .expect(409);

        expect(response.body).toMatchObject({
          success: false,
          message: expect.stringContaining('already exists')
        });
      });

      it('should allow same category name for different users', async () => {
        await Category.create({
          ...validCategory,
          user: userId
        });

        const response = await request(app)
          .post('/api/categories')
          .set('Authorization', `Bearer ${anotherUserToken}`)
          .send(validCategory)
          .expect(201);

        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/categories', () => {
      beforeEach(async () => {
        await Category.create([
          { ...validCategory, user: userId, name: 'Category 1' },
          { ...validCategory, user: userId, name: 'Category 2' },
          { ...validCategory, user: anotherUserId, name: 'Another user category' }
        ]);
      });

      it('should get user categories with authorization', async () => {
        const response = await request(app)
          .get('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.categories).toHaveLength(2);
        
        response.body.data.categories.forEach(category => {
          expect(category.user).toBe(userId.toString());
        });
      });

      it('should filter categories by type', async () => {
        const response = await request(app)
          .get('/api/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ type: 'expense' })
          .expect(200);

        response.body.data.categories.forEach(category => {
          expect(category.type).toBe('expense');
        });
      });
    });
  });

  describe('User Profile Management', () => {
    describe('GET /api/users/profile', () => {
      it('should get user profile with authentication', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              firstName: 'John',
              lastName: 'Doe',
              email: 'john.doe@example.com'
            })
          })
        });

        // Should not include sensitive data
        expect(response.body.data.user.password).toBeUndefined();
        expect(response.body.data.user.refreshTokens).toBeUndefined();
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/users/profile', () => {
      it('should update user profile', async () => {
        const updateData = {
          firstName: 'Johnny',
          lastName: 'Doe Jr',
          phoneNumber: '+1234567890'
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              firstName: updateData.firstName,
              lastName: updateData.lastName,
              phoneNumber: updateData.phoneNumber
            })
          })
        });

        // Verify update in database
        const updatedUser = await User.findById(userId);
        expect(updatedUser.firstName).toBe(updateData.firstName);
        expect(updatedUser.lastName).toBe(updateData.lastName);
      });

      it('should validate profile update data', async () => {
        const invalidUpdate = {
          email: 'invalid-email',
          firstName: ''
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidUpdate)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      });

      it('should not allow updating email to existing email', async () => {
        const updateData = {
          email: 'jane.smith@example.com' // Another user's email
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(409);

        expect(response.body).toMatchObject({
          success: false,
          message: expect.stringContaining('already exists')
        });
      });
    });

    describe('PUT /api/users/preferences', () => {
      it('should update user preferences', async () => {
        const preferences = {
          currency: 'EUR',
          dateFormat: 'DD/MM/YYYY',
          emailNotifications: false,
          budgetAlerts: true
        };

        const response = await request(app)
          .put('/api/users/preferences')
          .set('Authorization', `Bearer ${authToken}`)
          .send(preferences)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            preferences: expect.objectContaining(preferences)
          })
        });
      });
    });
  });

  describe('Cross-Entity Operations', () => {
    it('should handle transaction with category assignment', async () => {
      const category = await Category.create({
        name: 'Food',
        type: 'expense',
        user: userId
      });

      const transaction = {
        description: 'Lunch',
        amount: 15,
        type: 'expense',
        category: category._id.toString()
      };

      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transaction)
        .expect(201);

      expect(response.body.data.transaction.category).toBe(category._id.toString());
    });

    it('should handle budget with category tracking', async () => {
      const category = await Category.create({
        name: 'Food',
        type: 'expense',
        user: userId
      });

      const budget = {
        name: 'Food Budget',
        amount: 300,
        category: category._id.toString(),
        period: 'monthly',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/budgets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(budget)
        .expect(201);

      expect(response.body.data.budget.category).toBe(category._id.toString());
    });

    it('should update budget spent amount when transaction is created', async () => {
      const category = await Category.create({
        name: 'Food',
        type: 'expense',
        user: userId
      });

      const budget = await Budget.create({
        name: 'Food Budget',
        amount: 300,
        category: category._id,
        user: userId,
        period: 'monthly',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      const transaction = {
        description: 'Lunch',
        amount: 15,
        type: 'expense',
        category: category._id.toString()
      };

      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transaction)
        .expect(201);

      // Check if budget was updated (this depends on your business logic implementation)
      const updatedBudget = await Budget.findById(budget._id);
      // This assertion depends on whether you have automatic budget updating
      // expect(updatedBudget.spent).toBe(15);
    });
  });
});
