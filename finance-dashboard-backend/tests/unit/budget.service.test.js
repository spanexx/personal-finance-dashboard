const mongoose = require('mongoose');
const BudgetService = require('../../services/budget.service');
const Budget = require('../../models/Budget');
const Transaction = require('../../models/Transaction');
const Category = require('../../models/Category');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  DatabaseError 
} = require('../../utils/errorHandler');

// Mock the models and services
jest.mock('../../models/Budget');
jest.mock('../../models/Transaction');
jest.mock('../../models/Category');
jest.mock('../../services/socket.service');

const socketService = require('../../services/socket.service');
const BudgetController = require('../../controllers/budget.controller');
const ApiResponse = require('../../utils/apiResponse');
const { ErrorHandler } = require('../../utils/errorHandler');

jest.mock('../../utils/apiResponse');
jest.mock('../../utils/errorHandler', () => ({
  ErrorHandler: {
    asyncHandler: jest.fn(fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next))
  },
  ValidationError: jest.fn((message, errors) => {
    const error = new Error(message);
    error.errors = errors;
    return error;
  }),
  NotFoundError: jest.fn(message => new Error(message)),
  ConflictError: jest.fn(message => new Error(message)),
  DatabaseError: jest.fn(message => new Error(message))
}));

describe('BudgetService', () => {
  let mockUserId;
  let mockBudgetId;
  let mockCategoryId;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = new mongoose.Types.ObjectId();
    mockBudgetId = new mongoose.Types.ObjectId();
    mockCategoryId = new mongoose.Types.ObjectId();
  });

  describe('validateBudgetData', () => {
    test('should validate budget data successfully with valid input', async () => {
      const budgetData = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        categoryAllocations: [
          { category: mockCategoryId, allocatedAmount: 500 },
          { category: new mongoose.Types.ObjectId(), allocatedAmount: 300 }
        ],
        totalAmount: 800,
        alertSettings: {
          thresholds: { warning: 70, critical: 90 }
        }
      };

      Budget.find.mockResolvedValue([]); // No overlapping budgets
      Category.find.mockResolvedValue([
        { _id: mockCategoryId, name: 'Food' },
        { _id: budgetData.categoryAllocations[1].category, name: 'Transport' }
      ]);

      const result = await BudgetService.validateBudgetData(budgetData, mockUserId);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect overlapping budget periods', async () => {
      const budgetData = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      Budget.find.mockResolvedValue([
        { name: 'Existing Budget', _id: new mongoose.Types.ObjectId() }
      ]);

      const result = await BudgetService.validateBudgetData(budgetData, mockUserId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Budget period overlaps with existing budget(s): Existing Budget');
    });

    test('should detect invalid date range', async () => {
      const budgetData = {
        startDate: '2024-01-31',
        endDate: '2024-01-01'
      };

      Budget.find.mockResolvedValue([]);

      const result = await BudgetService.validateBudgetData(budgetData, mockUserId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start date must be before end date');
    });

    test('should detect category allocation mismatch with total amount', async () => {
      const budgetData = {
        categoryAllocations: [
          { category: mockCategoryId, allocatedAmount: 500 },
          { category: new mongoose.Types.ObjectId(), allocatedAmount: 400 }
        ],
        totalAmount: 800
      };

      Budget.find.mockResolvedValue([]);
      Category.find.mockResolvedValue([
        { _id: mockCategoryId, name: 'Food' },
        { _id: budgetData.categoryAllocations[1].category, name: 'Transport' }
      ]);

      const result = await BudgetService.validateBudgetData(budgetData, mockUserId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Total category allocations must equal total budget amount');
    });

    test('should detect duplicate categories', async () => {
      const budgetData = {
        categoryAllocations: [
          { category: mockCategoryId, allocatedAmount: 400 },
          { category: mockCategoryId, allocatedAmount: 400 }
        ],
        totalAmount: 800
      };

      Budget.find.mockResolvedValue([]);

      const result = await BudgetService.validateBudgetData(budgetData, mockUserId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate categories found in allocations');
    });

    test('should detect invalid alert threshold configuration', async () => {
      const budgetData = {
        alertSettings: {
          thresholds: { warning: 90, critical: 80 }
        }
      };

      Budget.find.mockResolvedValue([]);

      const result = await BudgetService.validateBudgetData(budgetData, mockUserId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Warning threshold must be less than critical threshold');
    });

    test('should detect invalid categories', async () => {
      const invalidCategoryId = new mongoose.Types.ObjectId();
      const budgetData = {
        categoryAllocations: [
          { category: invalidCategoryId, allocatedAmount: 500 }
        ],
        totalAmount: 500
      };

      Budget.find.mockResolvedValue([]);
      Category.find.mockResolvedValue([]); // No categories found

      const result = await BudgetService.validateBudgetData(budgetData, mockUserId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(`Invalid categories: ${invalidCategoryId}`);
    });
  });

  describe('calculateBudgetPerformance', () => {
    test('should calculate performance metrics correctly', async () => {
      const mockBudget = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalAmount: 1000,
        daysRemaining: 15,
        getBudgetPerformance: jest.fn().mockResolvedValue({
          totalSpent: 400,
          utilizationRate: 40
        })
      };

      const asOfDate = new Date('2024-01-16');
      const result = await BudgetService.calculateBudgetPerformance(mockBudget, asOfDate);

      expect(result.totalSpent).toBe(400);
      expect(result.timeProgress).toBeCloseTo(48.39, 1); // Approximately 15 days of 31
      expect(result.dailySpendingRate).toBeCloseTo(26.67, 1); // 400/15
      expect(result.burnRate).toBe(40);
      expect(result.burnRateVariance).toBeCloseTo(-8.39, 1); // 40 - 48.39
      expect(result.isOnTrack).toBe(true); // Within 10% variance
    });

    test('should handle budget with no spending', async () => {
      const mockBudget = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalAmount: 1000,
        daysRemaining: 20,
        getBudgetPerformance: jest.fn().mockResolvedValue({
          totalSpent: 0,
          utilizationRate: 0
        })
      };

      const result = await BudgetService.calculateBudgetPerformance(mockBudget);

      expect(result.totalSpent).toBe(0);
      expect(result.dailySpendingRate).toBe(0);
      expect(result.projectedEndSpending).toBe(0);
      expect(result.burnRate).toBe(0);
      expect(result.projectedOverrun).toBe(0);
    });

    test('should calculate projections for overspending budget', async () => {
      const mockBudget = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalAmount: 1000,
        daysRemaining: 10,
        getBudgetPerformance: jest.fn().mockResolvedValue({
          totalSpent: 800,
          utilizationRate: 80
        })
      };

      const asOfDate = new Date('2024-01-21');
      const result = await BudgetService.calculateBudgetPerformance(mockBudget, asOfDate);

      expect(result.burnRate).toBe(80);
      expect(result.dailySpendingRate).toBeCloseTo(38.1, 1); // 800/21
      expect(result.projectedOverrun).toBeGreaterThan(0);
      expect(result.isOnTrack).toBe(false);
    });
  });

  describe('createBudget', () => {
    test('should create budget successfully with valid data', async () => {
      const budgetData = {
        name: 'Monthly Budget',
        totalAmount: 1000,
        period: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        categoryAllocations: [
          { categoryId: mockCategoryId, amount: 500, notes: 'Food expenses' },
          { categoryId: new mongoose.Types.ObjectId(), amount: 500, notes: 'Transport' }
        ],
        description: 'Test budget',
        tags: ['Essential', 'MONTHLY'],
        rolloverEnabled: true,
        autoAdjustAllocations: false,
        alertThreshold: 80
      };

      const mockBudget = {
        _id: mockBudgetId,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue({
          ...budgetData,
          _id: mockBudgetId,
          user: mockUserId
        })
      };

      Budget.mockImplementation(() => mockBudget);
      Budget.findOne.mockResolvedValue(null); // No previous budget for rollover

      jest.spyOn(BudgetService, 'checkPeriodConflicts').mockResolvedValue();
      jest.spyOn(BudgetService, 'validateCategoryAllocations').mockResolvedValue();

      const result = await BudgetService.createBudget(budgetData, mockUserId);

      expect(mockBudget.save).toHaveBeenCalled();
      expect(mockBudget.populate).toHaveBeenCalledWith('categoryAllocations.category', 'name type color icon');
      expect(result._id).toBe(mockBudgetId);
    });

    test('should handle duplicate key error', async () => {
      const budgetData = {
        name: 'Duplicate Budget',
        totalAmount: 1000,
        period: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        categoryAllocations: []
      };

      const mockBudget = {
        save: jest.fn().mockRejectedValue({ code: 11000 })
      };

      Budget.mockImplementation(() => mockBudget);
      jest.spyOn(BudgetService, 'checkPeriodConflicts').mockResolvedValue();
      jest.spyOn(BudgetService, 'validateCategoryAllocations').mockResolvedValue();

      await expect(BudgetService.createBudget(budgetData, mockUserId))
        .rejects.toThrow(ConflictError);
    });

    test('should create budget from template', async () => {
      const budgetData = {
        name: 'Template Budget',
        totalAmount: 1000,
        period: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        templateBudgetId: new mongoose.Types.ObjectId()
      };

      const mockTemplateBudget = {
        _id: budgetData.templateBudgetId,
        name: 'Template',
        totalAmount: 800
      };

      Budget.createFromTemplate = jest.fn().mockResolvedValue(mockTemplateBudget);
      jest.spyOn(BudgetService, 'checkPeriodConflicts').mockResolvedValue();

      const result = await BudgetService.createBudget(budgetData, mockUserId);

      expect(Budget.createFromTemplate).toHaveBeenCalledWith(
        budgetData.templateBudgetId,
        expect.objectContaining({
          user: mockUserId,
          name: budgetData.name,
          totalAmount: budgetData.totalAmount
        })
      );
      expect(result).toBe(mockTemplateBudget);
    });

    test('should apply rollover from previous budget', async () => {
      const budgetData = {
        name: 'Rollover Budget',
        totalAmount: 1000,
        period: 'monthly',
        startDate: '2024-02-01',
        endDate: '2024-02-29',
        categoryAllocations: [],
        rolloverEnabled: true,
        applyPreviousRollover: true
      };

      const mockPreviousBudget = {
        _id: new mongoose.Types.ObjectId(),
        endDate: new Date('2024-01-31')
      };

      const mockBudget = {
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue({ _id: mockBudgetId }),
        applyRollover: jest.fn().mockResolvedValue(true)
      };

      Budget.mockImplementation(() => mockBudget);
      Budget.findOne.mockResolvedValue(mockPreviousBudget);

      jest.spyOn(BudgetService, 'checkPeriodConflicts').mockResolvedValue();
      jest.spyOn(BudgetService, 'validateCategoryAllocations').mockResolvedValue();

      await BudgetService.createBudget(budgetData, mockUserId);

      expect(mockBudget.applyRollover).toHaveBeenCalledWith(mockPreviousBudget._id);
    });
  });

  describe('updateBudget', () => {
    let mockBudget;

    beforeEach(() => {
      mockBudget = {
        _id: mockBudgetId,
        user: mockUserId,
        name: 'Original Budget',
        totalAmount: 1000,
        categoryAllocations: [
          { category: mockCategoryId, allocatedAmount: 500 }
        ],
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(true),
        calculateSpentAmount: jest.fn().mockResolvedValue(400),
        toObject: jest.fn().mockReturnValue({
          name: 'Original Budget',
          totalAmount: 1000,
          categoryAllocations: [{ category: mockCategoryId, allocatedAmount: 500 }]
        })
      };
    });

    test('should update budget successfully', async () => {
      const updateData = {
        name: 'Updated Budget',
        description: 'Updated description',
        tags: ['updated', 'BUDGET'],
        alertThreshold: 75,
        rolloverEnabled: true
      };

      Budget.findOne.mockResolvedValue(mockBudget);
      jest.spyOn(BudgetService, 'identifyChanges').mockReturnValue([
        { field: 'name', oldValue: 'Original Budget', newValue: 'Updated Budget' }
      ]);

      const result = await BudgetService.updateBudget(mockBudgetId, updateData, mockUserId);

      expect(mockBudget.name).toBe('Updated Budget');
      expect(mockBudget.description).toBe('Updated description');
      expect(mockBudget.tags).toEqual(['updated', 'budget']);
      expect(mockBudget.alertThreshold).toBe(75);
      expect(mockBudget.save).toHaveBeenCalled();
      expect(result).toHaveProperty('budget');
      expect(result).toHaveProperty('changes');
    });

    test('should update total amount with validation', async () => {
      const updateData = {
        totalAmount: 1200
      };

      Budget.findOne.mockResolvedValue(mockBudget);
      jest.spyOn(BudgetService, 'identifyChanges').mockReturnValue([]);

      await BudgetService.updateBudget(mockBudgetId, updateData, mockUserId);

      expect(mockBudget.totalAmount).toBe(1200);
    });

    test('should reject total amount less than current allocations', async () => {
      const updateData = {
        totalAmount: 400 // Less than current allocation of 500
      };

      Budget.findOne.mockResolvedValue(mockBudget);

      await expect(BudgetService.updateBudget(mockBudgetId, updateData, mockUserId))
        .rejects.toThrow(ValidationError);
    });

    test('should update category allocations', async () => {
      const updateData = {
        categoryAllocations: [
          { categoryId: mockCategoryId, amount: 600, notes: 'Updated allocation' },
          { categoryId: new mongoose.Types.ObjectId(), amount: 400, notes: 'New category' }
        ],
        totalAmount: 1000
      };

      Budget.findOne.mockResolvedValue(mockBudget);
      jest.spyOn(BudgetService, 'validateCategoryAllocations').mockResolvedValue();
      jest.spyOn(BudgetService, 'calculateAllocationImpact').mockReturnValue({
        added: 1,
        modified: 1,
        removed: 0
      });
      jest.spyOn(BudgetService, 'identifyChanges').mockReturnValue([]);

      await BudgetService.updateBudget(mockBudgetId, updateData, mockUserId);

      expect(mockBudget.categoryAllocations).toHaveLength(2);
      expect(mockBudget.categoryAllocations[0].allocatedAmount).toBe(600);
    });

    test('should throw NotFoundError for non-existent budget', async () => {
      Budget.findOne.mockResolvedValue(null);

      await expect(BudgetService.updateBudget(mockBudgetId, {}, mockUserId))
        .rejects.toThrow(NotFoundError);
    });

    test('should handle database errors', async () => {
      Budget.findOne.mockResolvedValue(mockBudget);
      mockBudget.save.mockRejectedValue(new Error('Database error'));

      await expect(BudgetService.updateBudget(mockBudgetId, { name: 'Test' }, mockUserId))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('deleteBudget', () => {
    let mockBudget;

    beforeEach(() => {
      mockBudget = {
        _id: mockBudgetId,
        user: mockUserId,
        name: 'Test Budget',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalAmount: 1000,
        totalSpent: 400,
        categoryAllocations: [
          { category: mockCategoryId }
        ],
        softDelete: jest.fn().mockResolvedValue(true)
      };
    });

    test('should perform soft delete by default', async () => {
      Budget.findOne.mockResolvedValue(mockBudget);
      Transaction.countDocuments.mockResolvedValue(15);

      const result = await BudgetService.deleteBudget(mockBudgetId, mockUserId);

      expect(mockBudget.softDelete).toHaveBeenCalled();
      expect(result.transactionsAffected).toBe(15);
      expect(result.hasTransactions).toBe(true);
      expect(result.totalAmount).toBe(1000);
      expect(result.totalSpent).toBe(400);
    });

    test('should perform permanent delete when specified', async () => {
      Budget.findOne.mockResolvedValue(mockBudget);
      Budget.findByIdAndDelete.mockResolvedValue(mockBudget);
      Transaction.countDocuments.mockResolvedValue(0);

      const result = await BudgetService.deleteBudget(mockBudgetId, mockUserId, true);

      expect(Budget.findByIdAndDelete).toHaveBeenCalledWith(mockBudgetId);
      expect(result.hasTransactions).toBe(false);
    });

    test('should throw NotFoundError for non-existent budget', async () => {
      Budget.findOne.mockResolvedValue(null);

      await expect(BudgetService.deleteBudget(mockBudgetId, mockUserId))
        .rejects.toThrow(NotFoundError);
    });

    test('should handle database errors', async () => {
      Budget.findOne.mockRejectedValue(new Error('Database error'));

      await expect(BudgetService.deleteBudget(mockBudgetId, mockUserId))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('getBudgets', () => {
    test('should get budgets with filtering and pagination', async () => {
      const queryParams = {
        page: 1,
        limit: 10,
        period: 'monthly',
        status: 'active',
        sortBy: 'startDate',
        sortOrder: 'desc'
      };

      const mockBudgets = [
        {
          _id: mockBudgetId,
          name: 'Test Budget',
          totalAmount: 1000,
          totalSpent: 400,
          isActive: true,
          endDate: new Date('2024-12-31')
        }
      ];

      const mockBudgetDoc = {
        getBudgetPerformance: jest.fn().mockResolvedValue({
          budget: { utilizationPercentage: 40 },
          variance: { status: 'on-track' },
          period: { daysRemaining: 20 },
          daily: { projectedSpending: 800 },
          alerts: []
        })
      };

      Budget.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockBudgets)
              })
            })
          })
        })
      });

      Budget.countDocuments.mockResolvedValue(1);
      Budget.findById.mockResolvedValue(mockBudgetDoc);

      const result = await BudgetService.getBudgets(mockUserId, queryParams);

      expect(result).toHaveProperty('budgets');
      expect(result).toHaveProperty('pagination');
      expect(result).toHaveProperty('summary');
      expect(result.budgets).toHaveLength(1);
      expect(result.budgets[0]).toHaveProperty('performance');
    });

    test('should handle search functionality', async () => {
      const queryParams = {
        search: 'monthly',
        page: 1,
        limit: 10
      };

      Budget.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([])
              })
            })
          })
        })
      });

      Budget.countDocuments.mockResolvedValue(0);

      const result = await BudgetService.getBudgets(mockUserId, queryParams);

      expect(Budget.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $and: expect.arrayContaining([
            expect.objectContaining({
              $or: expect.arrayContaining([
                { name: { $regex: 'monthly', $options: 'i' } }
              ])
            })
          ])
        })
      );
    });
  });

  describe('getBudgetDetails', () => {
    let mockBudget;

    beforeEach(() => {
      mockBudget = {
        _id: mockBudgetId,
        user: mockUserId,
        categoryAllocations: [{ category: { _id: mockCategoryId } }],
        getBudgetPerformance: jest.fn().mockResolvedValue({
          totalSpent: 400,
          utilizationRate: 40
        }),
        checkBudgetViolations: jest.fn().mockResolvedValue([]),
        getRemainingBudget: jest.fn().mockResolvedValue({
          total: 600,
          categories: {}
        }),
        toJSON: jest.fn().mockReturnValue({ _id: mockBudgetId })
      };
    });

    test('should get comprehensive budget details', async () => {
      const options = {
        includeTrends: true,
        includeProjections: true
      };

      Budget.findOne.mockResolvedValue(mockBudget);
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([])
            })
          })
        })
      });

      jest.spyOn(BudgetService, 'calculateSpendingTrends').mockResolvedValue({
        dailySpending: [],
        trends: {}
      });
      jest.spyOn(BudgetService, 'calculateBudgetProjections').mockResolvedValue({
        canProject: true,
        projections: {}
      });
      jest.spyOn(BudgetService, 'generateBudgetRecommendations').mockResolvedValue([]);

      const result = await BudgetService.getBudgetDetails(mockBudgetId, mockUserId, options);

      expect(result).toHaveProperty('budget');
      expect(result).toHaveProperty('performance');
      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('recentTransactions');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('trends');
      expect(result).toHaveProperty('projections');
    });

    test('should throw NotFoundError for non-existent budget', async () => {
      Budget.findOne.mockResolvedValue(null);

      await expect(BudgetService.getBudgetDetails(mockBudgetId, mockUserId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('generateOptimizationRecommendations', () => {
    test('should generate recommendations for overspending budgets', async () => {
      const mockBudgets = [
        {
          _id: mockBudgetId,
          name: 'Test Budget',
          categoryAllocations: [
            {
              category: { _id: mockCategoryId, name: 'Food' },
              allocatedAmount: 500,
              spentAmount: 600
            }
          ]
        }
      ];

      Budget.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBudgets)
      });

      jest.spyOn(BudgetService, 'calculateBudgetPerformance').mockResolvedValue({
        utilizationRate: 120,
        burnRateVariance: 25,
        projectedOverrun: 200
      });

      jest.spyOn(BudgetService, 'generateGlobalRecommendations').mockResolvedValue([]);

      const result = await BudgetService.generateOptimizationRecommendations(mockUserId);

      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('summary');
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      const overspendingRec = result.recommendations.find(r => r.category === 'overspending');
      expect(overspendingRec).toBeDefined();
      expect(overspendingRec.priority).toBe('high');
    });

    test('should generate recommendations for high burn rate', async () => {
      const mockBudgets = [
        {
          _id: mockBudgetId,
          name: 'Fast Spending Budget',
          categoryAllocations: []
        }
      ];

      Budget.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBudgets)
      });

      jest.spyOn(BudgetService, 'calculateBudgetPerformance').mockResolvedValue({
        utilizationRate: 70,
        burnRateVariance: 30,
        projectedOverrun: 0
      });

      jest.spyOn(BudgetService, 'generateGlobalRecommendations').mockResolvedValue([]);

      const result = await BudgetService.generateOptimizationRecommendations(mockUserId);

      const burnRateRec = result.recommendations.find(r => r.category === 'burn_rate');
      expect(burnRateRec).toBeDefined();
      expect(burnRateRec.type).toBe('warning');
    });
  });

  describe('calculateSpendingTrends', () => {
    test('should calculate daily and category spending trends', async () => {
      const mockBudget = {
        user: mockUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalAmount: 1000,
        categoryAllocations: [
          { category: mockCategoryId }
        ]
      };

      const dailyAggregateResult = [
        {
          _id: { year: 2024, month: 1, day: 15 },
          totalAmount: 50,
          count: 2
        }
      ];

      const categoryAggregateResult = [
        {
          _id: mockCategoryId,
          totalAmount: 200,
          count: 8,
          category: { name: 'Food', color: '#FF5733' }
        }
      ];

      Transaction.aggregate
        .mockResolvedValueOnce(dailyAggregateResult)
        .mockResolvedValueOnce(categoryAggregateResult);

      const result = await BudgetService.calculateSpendingTrends(mockBudget);

      expect(result).toHaveProperty('dailySpending');
      expect(result).toHaveProperty('categorySpending');
      expect(result).toHaveProperty('trends');
      expect(result.dailySpending).toHaveLength(1);
      expect(result.categorySpending).toHaveLength(1);
      expect(result.trends.averageDailySpending).toBeGreaterThan(0);
    });

    test('should handle budget with no transactions', async () => {
      const mockBudget = {
        user: mockUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalAmount: 1000,
        categoryAllocations: []
      };

      Transaction.aggregate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await BudgetService.calculateSpendingTrends(mockBudget);

      expect(result.dailySpending).toHaveLength(0);
      expect(result.categorySpending).toHaveLength(0);
      expect(result.trends.totalSpent).toBe(0);
      expect(result.trends.averageDailySpending).toBe(0);
    });
  });

  describe('calculateBudgetProjections', () => {
    test('should calculate accurate projections for active budget', async () => {
      const mockBudget = {
        user: mockUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalAmount: 1000,
        categoryAllocations: [
          { category: mockCategoryId, allocatedAmount: 500 }
        ]
      };

      const mockTransactions = [
        { amount: 100, category: mockCategoryId },
        { amount: 150, category: mockCategoryId }
      ];

      Transaction.find.mockResolvedValue(mockTransactions);

      const result = await BudgetService.calculateBudgetProjections(mockBudget);

      expect(result.canProject).toBe(true);
      expect(result).toHaveProperty('timeProgress');
      expect(result).toHaveProperty('spendingProjections');
      expect(result).toHaveProperty('categoryProjections');
      expect(result.spendingProjections.spentToDate).toBe(250);
      expect(result.categoryProjections).toHaveLength(1);
    });

    test('should return cannot project for future budget', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 2);

      const mockBudget = {
        startDate: futureDate,
        endDate: new Date(futureDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      };

      const result = await BudgetService.calculateBudgetProjections(mockBudget);

      expect(result.canProject).toBe(false);
      expect(result.reason).toBe('Budget has not started yet');
    });

    test('should return cannot project for expired budget', async () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 2);

      const mockBudget = {
        startDate: pastDate,
        endDate: new Date(pastDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      };

      const result = await BudgetService.calculateBudgetProjections(mockBudget);

      expect(result.canProject).toBe(false);
      expect(result.reason).toBe('Budget has already ended');
    });
  });

  describe('generateBudgetRecommendations', () => {
    test('should generate recommendations for over budget', async () => {
      const mockBudget = {
        name: 'Test Budget'
      };

      const mockPerformance = {
        budget: { utilizationPercentage: 110 },
        variance: { spendingRateVariance: 15 },
        categories: [
          {
            name: 'Food',
            utilizationPercentage: 120
          }
        ],
        period: { timeElapsedPercentage: 80 }
      };

      const result = await BudgetService.generateBudgetRecommendations(mockBudget, mockPerformance);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      const overBudgetRec = result.find(r => r.category === 'overspending');
      expect(overBudgetRec).toBeDefined();
      expect(overBudgetRec.type).toBe('warning');
    });

    test('should generate recommendations for approaching limit', async () => {
      const mockBudget = {
        name: 'Test Budget'
      };

      const mockPerformance = {
        budget: { utilizationPercentage: 92 },
        variance: { spendingRateVariance: 5 },
        categories: [],
        period: { timeElapsedPercentage: 85 }
      };

      const result = await BudgetService.generateBudgetRecommendations(mockBudget, mockPerformance);

      const approachingRec = result.find(r => r.category === 'approaching_limit');
      expect(approachingRec).toBeDefined();
      expect(approachingRec.type).toBe('warning');
    });

    test('should generate optimization suggestion for under budget', async () => {
      const mockBudget = {
        name: 'Test Budget'
      };

      const mockPerformance = {
        budget: { utilizationPercentage: 60 },
        variance: { 
          status: 'under-budget',
          spendingRateVariance: -10
        },
        categories: [],
        period: { timeElapsedPercentage: 85 }
      };

      const result = await BudgetService.generateBudgetRecommendations(mockBudget, mockPerformance);

      const optimizationRec = result.find(r => r.category === 'budget_optimization');
      expect(optimizationRec).toBeDefined();
      expect(optimizationRec.type).toBe('suggestion');
    });
  });

  describe('duplicateBudget', () => {
    test('should duplicate budget successfully', async () => {
      const newBudgetData = {
        name: 'Duplicated Budget',
        startDate: '2024-02-01',
        endDate: '2024-02-29',
        adjustmentMultiplier: 1.1,
        copyNotes: true,
        resetSpending: true
      };

      const mockSourceBudget = {
        _id: mockBudgetId,
        user: mockUserId,
        name: 'Original Budget',
        totalAmount: 1000,
        description: 'Original description',
        tags: ['original'],
        rolloverEnabled: true,
        autoAdjustAllocations: false,
        alertThreshold: 80,
        categoryAllocations: [
          {
            category: { _id: mockCategoryId },
            allocatedAmount: 500,
            notes: 'Original notes',
            spentAmount: 200
          }
        ]
      };

      const mockNewBudget = {
        _id: new mongoose.Types.ObjectId(),
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(true)
      };

      Budget.findOne.mockResolvedValue(mockSourceBudget);
      Budget.mockImplementation(() => mockNewBudget);

      const result = await BudgetService.duplicateBudget(mockBudgetId, mockUserId, newBudgetData);

      expect(Budget.findOne).toHaveBeenCalledWith({
        _id: mockBudgetId,
        user: mockUserId,
        isDeleted: { $ne: true }
      });
      expect(mockNewBudget.save).toHaveBeenCalled();
      expect(result).toBe(mockNewBudget);
    });

    test('should throw NotFoundError for non-existent source budget', async () => {
      Budget.findOne.mockResolvedValue(null);

      await expect(BudgetService.duplicateBudget(mockBudgetId, mockUserId, {}))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('calculateBudgetHealthScore', () => {
    test('should calculate excellent health score', async () => {
      const mockBudget = {
        categoryAllocations: [
          { allocatedAmount: 500, spentAmount: 450 },
          { allocatedAmount: 300, spentAmount: 280 }
        ]
      };

      jest.spyOn(BudgetService, 'calculateBudgetPerformance').mockResolvedValue({
        utilizationRate: 91,
        burnRateVariance: 5
      });

      const result = await BudgetService.calculateBudgetHealthScore(mockBudget);

      expect(result.score).toBeGreaterThan(85);
      expect(result.healthLevel).toBe('Excellent');
      expect(result.factors).toBeInstanceOf(Array);
    });

    test('should penalize over budget', async () => {
      const mockBudget = {
        categoryAllocations: [
          { allocatedAmount: 500, spentAmount: 600 }
        ]
      };

      jest.spyOn(BudgetService, 'calculateBudgetPerformance').mockResolvedValue({
        utilizationRate: 120,
        burnRateVariance: -5,
        timeProgress: 80
      });

      const result = await BudgetService.calculateBudgetHealthScore(mockBudget);

      expect(result.score).toBeLessThan(80);
      const overBudgetFactor = result.factors.find(f => f.factor === 'Over Budget');
      expect(overBudgetFactor).toBeDefined();
      expect(overBudgetFactor.impact).toBeLessThan(0);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large budget calculations efficiently', async () => {
      const startTime = process.hrtime();

      // Mock large dataset
      const largeBudget = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        totalAmount: 50000,
        daysRemaining: 180,
        getBudgetPerformance: jest.fn().mockResolvedValue({
          totalSpent: 25000,
          utilizationRate: 50
        })
      };

      await BudgetService.calculateBudgetPerformance(largeBudget);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const milliseconds = seconds * 1000 + nanoseconds / 1000000;

      expect(milliseconds).toBeLessThan(100); // Should complete within 100ms
    });

    test('should handle bulk budget operations efficiently', async () => {
      const startTime = process.hrtime();

      // Mock multiple budgets
      const mockBudgets = Array(50).fill().map((_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        name: `Budget ${i}`,
        totalAmount: 1000 + i * 100,
        totalSpent: 500 + i * 50,
        isActive: true,
        endDate: new Date('2024-12-31')
      }));

      Budget.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockBudgets)
              })
            })
          })
        })
      });

      Budget.countDocuments.mockResolvedValue(50);
      Budget.findById.mockResolvedValue({
        getBudgetPerformance: jest.fn().mockResolvedValue({
          budget: { utilizationPercentage: 50 },
          variance: { status: 'on-track' },
          period: { daysRemaining: 100 },
          daily: { projectedSpending: 1000 },
          alerts: []
        })
      });

      await BudgetService.getBudgets(mockUserId, { page: 1, limit: 50 });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const milliseconds = seconds * 1000 + nanoseconds / 1000000;

      expect(milliseconds).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('Edge Cases', () => {
    test('should handle budget with zero total amount', async () => {
      const budgetData = {
        name: 'Zero Budget',
        totalAmount: 0,
        period: 'monthly',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        categoryAllocations: []
      };

      Budget.find.mockResolvedValue([]);

      const result = await BudgetService.validateBudgetData(budgetData, mockUserId);

      expect(result.isValid).toBe(true);
    });

    test('should handle budget with past dates', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const budgetData = {
        startDate: pastDate.toISOString().split('T')[0],
        endDate: new Date(pastDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };

      Budget.find.mockResolvedValue([]);

      const result = await BudgetService.validateBudgetData(budgetData, mockUserId);

      expect(result.isValid).toBe(true);
    });

    test('should handle budget with single day duration', async () => {
      const singleDay = '2024-01-01';

      const budgetData = {
        startDate: singleDay,
        endDate: singleDay
      };

      Budget.find.mockResolvedValue([]);

      const result = await BudgetService.validateBudgetData(budgetData, mockUserId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start date must be before end date');
    });

    test('should handle extremely large budget amounts', async () => {
      const mockBudget = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalAmount: 999999999.99,
        daysRemaining: 15,
        getBudgetPerformance: jest.fn().mockResolvedValue({
          totalSpent: 500000000,
          utilizationRate: 50
        })
      };

      const result = await BudgetService.calculateBudgetPerformance(mockBudget);

      expect(result.totalSpent).toBe(500000000);
      expect(result.projectedOverrun).toBeGreaterThanOrEqual(0);
      expect(typeof result.dailySpendingRate).toBe('number');
      expect(isFinite(result.dailySpendingRate)).toBe(true);
    });

    test('should handle budget with very small amounts', async () => {
      const mockBudget = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        totalAmount: 0.01,
        daysRemaining: 15,
        getBudgetPerformance: jest.fn().mockResolvedValue({
          totalSpent: 0.005,
          utilizationRate: 50
        })
      };

      const result = await BudgetService.calculateBudgetPerformance(mockBudget);

      expect(result.totalSpent).toBe(0.005);
      expect(result.dailySpendingRate).toBeGreaterThan(0);
      expect(isFinite(result.dailySpendingRate)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle mongoose connection errors', async () => {
      Budget.find.mockRejectedValue(new Error('Connection timeout'));

      await expect(BudgetService.validateBudgetData({}, mockUserId))
        .rejects.toThrow('Connection timeout');
    });

    test('should handle invalid ObjectId formats', async () => {
      const invalidId = 'invalid-object-id';

      Budget.findOne.mockRejectedValue(new Error('Cast to ObjectId failed'));

      await expect(BudgetService.getBudgetDetails(invalidId, mockUserId))
        .rejects.toThrow('Cast to ObjectId failed');
    });

    test('should handle concurrent modification conflicts', async () => {
      const mockBudget = {
        _id: mockBudgetId,
        user: mockUserId,
        save: jest.fn().mockRejectedValue({ code: 11000 }),
        toObject: jest.fn().mockReturnValue({})
      };

      Budget.findOne.mockResolvedValue(mockBudget);

      await expect(BudgetService.updateBudget(mockBudgetId, { name: 'Test' }, mockUserId))
        .rejects.toThrow(DatabaseError);
    });
  });
});
