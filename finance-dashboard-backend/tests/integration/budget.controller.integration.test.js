const request = require('supertest');

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Budget = require('../../models/Budget');
const User = require('../../models/User');
const Category = require('../../models/Category');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock the socket service
jest.mock('../../services/socket.service', () => ({
  emitToUser: jest.fn(),
  initialize: jest.fn(),
  cleanup: jest.fn(),
  EVENT_TYPES: {
    BUDGET_CREATED: 'budget:created',
    BUDGET_UPDATED: 'budget:updated',
    BUDGET_DELETED: 'budget:deleted',
  },
}));

const socketService = require('../../services/socket.service');

let mongoServer;
let token;
let userId;
let categoryId;

beforeAll(async () => {
  process.env.NODE_ENV = 'test'; // Set Node environment to test
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create a test user
  const user = await User.create({
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
  });
  userId = user._id;
  process.env.JWT_ACCESS_SECRET = 'testaccesssecret';
  process.env.JWT_REFRESH_SECRET = 'testrefreshsecret';
  app = require('../../server');
  token = jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });

  const currentYear = new Date().getFullYear();
  const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');

  // Create a test category
  const category = await Category.create({
    name: 'Food',
    type: 'expense',
    user: userId,
    icon: 'fa-food',
    color: '#FF0000',
  });
  categoryId = category._id;

  // Create budgets for testing
  this.newBudget = {
    name: 'Monthly Groceries',
    totalAmount: 500,
    period: 'monthly',
    startDate: `${currentYear}-${currentMonth}-01`,
    endDate: `${currentYear}-${currentMonth}-31`,
    categoryAllocations: [{
      category: categoryId,
      allocatedAmount: 500
    }]
  };

  this.existingBudget = await Budget.create({
    name: 'Old Budget',
    totalAmount: 300,
    period: 'monthly',
    startDate: `${currentYear}-${currentMonth}-01`,
    endDate: `${currentYear}-${currentMonth}-31`,
    user: userId,
    categoryAllocations: [{
      category: categoryId,
      allocatedAmount: 300
    }]
  });

  this.budgetToDelete = await Budget.create({
    name: 'Budget to Delete',
    totalAmount: 100,
    period: 'monthly',
    startDate: `${currentYear}-${currentMonth}-01`,
    endDate: `${currentYear}-${currentMonth}-31`,
    user: userId,
    categoryAllocations: [{
      category: categoryId,
      allocatedAmount: 100
    }]
  });
}, 60000); // Increase timeout to 60 seconds

afterEach(async () => {
  // Clean up budgets created during tests
  await Budget.deleteMany({ user: userId });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Budget Controller Notifications', () => {
  it('should emit budget:created event after creating a budget', async () => {
    const res = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send(this.newBudget);

    expect(res.statusCode).toEqual(201);
    expect(socketService.emitToUser).toHaveBeenCalledWith(
      userId.toString(),
      'budget:created',
      expect.objectContaining({
        message: `Your budget '${this.newBudget.name}' was created successfully.`,
        budgetId: expect.any(String),
        timestamp: expect.any(String),
      })
    );
  });

  it('should emit budget:updated event after updating a budget', async () => {
    const updatedData = {
      name: 'New Budget Name',
      totalAmount: 400,
    };

    const res = await request(app)
      .put(`/api/budgets/${this.existingBudget._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatedData);

    expect(res.statusCode).toEqual(200);
    expect(socketService.emitToUser).toHaveBeenCalledWith(
      userId.toString(),
      'budget:updated',
      expect.objectContaining({
        message: `Your budget '${updatedData.name}' was updated.`,
        budgetId: this.existingBudget._id.toString(),
        timestamp: expect.any(String),
      })
    );
  });

  it('should emit budget:deleted event after deleting a budget', async () => {
    const res = await request(app)
      .delete(`/api/budgets/${this.budgetToDelete._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(socketService.emitToUser).toHaveBeenCalledWith(
      userId.toString(),
      'budget:deleted',
      expect.objectContaining({
        message: `Your budget was deleted.`,
        budgetId: this.budgetToDelete._id.toString(),
        timestamp: expect.any(String),
      })
    );
  });
});
