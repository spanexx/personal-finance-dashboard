/**
 * Goal Service Unit Tests
 * Comprehensive test suite for goal.service.js
 */

const GoalService = require('../../services/goal.service');
const Goal = require('../../models/Goal');
const mongoose = require('mongoose');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  AuthorizationError,
  DatabaseError 
} = require('../../utils/errorHandler');

// Mock mongoose
jest.mock('mongoose', () => ({
  Types: {
    ObjectId: {
      isValid: jest.fn(),
      constructor: jest.fn()
    }
  }
}));

// Mock Goal model
jest.mock('../../models/Goal');

// Mock error handlers
jest.mock('../../utils/errorHandler', () => ({
  ValidationError: class ValidationError extends Error {
    constructor(message, errors) {
      super(message);
      this.name = 'ValidationError';
      this.errors = errors;
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ConflictError';
    }
  },
  AuthorizationError: class AuthorizationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AuthorizationError';
    }
  },
  DatabaseError: class DatabaseError extends Error {
    constructor(message, originalError) {
      super(message);
      this.name = 'DatabaseError';
      this.originalError = originalError;
    }
  }
}));

describe('GoalService', () => {
  let mockGoal;
  let mockUserId;
  let mockGoalId;
  let mockContributionId;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUserId = 'user123';
    mockGoalId = 'goal123';
    mockContributionId = 'contribution123';
    
    // Mock mongoose ObjectId validation
    mongoose.Types.ObjectId.isValid.mockReturnValue(true);
    mongoose.Types.ObjectId.mockImplementation(() => ({
      toString: () => mockContributionId
    }));
    
    // Default mock goal
    mockGoal = {
      _id: mockGoalId,
      user: mockUserId,
      name: 'Emergency Fund',
      description: 'Build emergency fund',
      targetAmount: 10000,
      currentAmount: 3000,
      startDate: new Date('2024-01-01'),
      targetDate: new Date('2024-12-31'),
      status: 'active',
      priority: 'high',
      goalType: 'savings',
      progressPercentage: 30,
      contributions: [
        {
          _id: 'contrib1',
          amount: 1000,
          date: new Date('2024-01-15'),
          notes: 'Initial deposit',
          method: 'manual'
        },
        {
          _id: 'contrib2',
          amount: 2000,
          date: new Date('2024-02-15'),
          notes: 'Monthly contribution',
          method: 'automatic'
        }
      ],
      milestonePercentages: [25, 50, 75, 100],
      colorTheme: '#3498db',
      icon: 'savings',
      tags: ['emergency', 'savings'],
      isDeleted: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-02-15'),
      save: jest.fn().mockResolvedValue(this),
      toObject: jest.fn().mockReturnValue({
        _id: mockGoalId,
        user: mockUserId,
        name: 'Emergency Fund',
        targetAmount: 10000,
        currentAmount: 3000,
        status: 'active'
      })
    };
  });

  describe('calculateProgressMetrics', () => {
    it('should calculate correct progress metrics for active goal', () => {
      const today = new Date();
      const goal = {
        targetAmount: 10000,
        currentAmount: 3000,
        startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        targetDate: new Date(today.getTime() + 70 * 24 * 60 * 60 * 1000)  // 70 days from now
      };

      const metrics = GoalService.calculateProgressMetrics(goal);

      expect(metrics.progressPercentage).toBe(30);
      expect(metrics.amountRemaining).toBe(7000);
      expect(metrics.daysElapsed).toBeGreaterThanOrEqual(30);
      expect(metrics.daysRemaining).toBeGreaterThanOrEqual(70);
      expect(metrics.isAchievable).toBe(true);
      expect(metrics.requiredMonthlyContribution).toBeGreaterThan(0);
    });

    it('should handle goal with zero target amount', () => {
      const goal = {
        targetAmount: 0,
        currentAmount: 100,
        startDate: new Date('2024-01-01'),
        targetDate: new Date('2024-12-31')
      };

      const metrics = GoalService.calculateProgressMetrics(goal);

      expect(metrics.progressPercentage).toBe(0);
      expect(metrics.amountRemaining).toBe(0);
    });

    it('should handle overachieved goal', () => {
      const goal = {
        targetAmount: 10000,
        currentAmount: 12000,
        startDate: new Date('2024-01-01'),
        targetDate: new Date('2024-12-31')
      };

      const metrics = GoalService.calculateProgressMetrics(goal);

      expect(metrics.progressPercentage).toBe(120);
      expect(metrics.amountRemaining).toBe(0);
    });

    it('should handle past due goal', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const goal = {
        targetAmount: 10000,
        currentAmount: 3000,
        startDate: new Date('2024-01-01'),
        targetDate: yesterday
      };

      const metrics = GoalService.calculateProgressMetrics(goal);

      expect(metrics.daysRemaining).toBe(0);
      expect(metrics.isAchievable).toBe(false);
    });

    it('should cap progress percentage at 200%', () => {
      const goal = {
        targetAmount: 1000,
        currentAmount: 5000,
        startDate: new Date('2024-01-01'),
        targetDate: new Date('2024-12-31')
      };

      const metrics = GoalService.calculateProgressMetrics(goal);

      expect(metrics.progressPercentage).toBe(200);
    });
  });

  describe('calculateAchievementProbability', () => {
    it('should return 100% for completed goals', () => {
      const goal = { status: 'completed' };
      const probability = GoalService.calculateAchievementProbability(goal);
      expect(probability).toBe(100);
    });

    it('should return 100% for goals with 100%+ progress', () => {
      const goal = { status: 'active' };
      const metrics = { progressPercentage: 100, timelineProgress: 50, daysRemaining: 30 };
      
      const probability = GoalService.calculateAchievementProbability(goal, metrics);
      expect(probability).toBe(100);
    });

    it('should return 0% for past due incomplete goals', () => {
      const goal = { status: 'active' };
      const metrics = { progressPercentage: 50, timelineProgress: 100, daysRemaining: 0 };
      
      const probability = GoalService.calculateAchievementProbability(goal, metrics);
      expect(probability).toBe(0);
    });

    it('should reduce probability when behind schedule', () => {
      const goal = { 
        status: 'active',
        averageMonthlyContribution: 1000
      };
      const metrics = { 
        progressPercentage: 30, 
        timelineProgress: 50, 
        daysRemaining: 180,
        requiredMonthlyContribution: 1000
      };
      
      const probability = GoalService.calculateAchievementProbability(goal, metrics);
      expect(probability).toBeLessThan(100);
      expect(probability).toBeGreaterThan(0);
    });

    it('should consider contribution trends', () => {
      const goal = { 
        status: 'active',
        averageMonthlyContribution: 500
      };
      const metrics = { 
        progressPercentage: 40, 
        timelineProgress: 40, 
        daysRemaining: 180,
        requiredMonthlyContribution: 1000
      };
      
      const probability = GoalService.calculateAchievementProbability(goal, metrics);
      expect(probability).toBeLessThan(60); // Should be reduced due to low contribution rate
    });

    it('should ensure probability is within 0-100 range', () => {
      const goal = { 
        status: 'active',
        averageMonthlyContribution: 100
      };
      const metrics = { 
        progressPercentage: 10, 
        timelineProgress: 90, 
        daysRemaining: 10,
        requiredMonthlyContribution: 5000
      };
      
      const probability = GoalService.calculateAchievementProbability(goal, metrics);
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(100);
    });
  });

  describe('generateMilestoneCheckpoints', () => {
    it('should generate milestones with achievement status', () => {
      const goal = {
        targetAmount: 10000,
        currentAmount: 3000,
        milestonePercentages: [25, 50, 75, 100],
        contributions: [
          { amount: 1000, date: new Date('2024-01-15') },
          { amount: 2000, date: new Date('2024-02-15') }
        ]
      };

      const milestones = GoalService.generateMilestoneCheckpoints(goal);

      expect(milestones).toHaveLength(4);
      expect(milestones[0]).toEqual({
        percentage: 25,
        amount: 2500,
        isAchieved: true,
        achievedDate: new Date('2024-02-15')
      });
      expect(milestones[1]).toEqual({
        percentage: 50,
        amount: 5000,
        isAchieved: false,
        achievedDate: null
      });
    });

    it('should use default milestones when none provided', () => {
      const goal = {
        targetAmount: 10000,
        currentAmount: 0,
        contributions: []
      };

      const milestones = GoalService.generateMilestoneCheckpoints(goal);

      expect(milestones).toHaveLength(4);
      expect(milestones.map(m => m.percentage)).toEqual([25, 50, 75, 100]);
    });

    it('should handle goals with no contributions', () => {
      const goal = {
        targetAmount: 10000,
        currentAmount: 0,
        milestonePercentages: [50, 100],
        contributions: []
      };

      const milestones = GoalService.generateMilestoneCheckpoints(goal);

      expect(milestones).toHaveLength(2);
      milestones.forEach(milestone => {
        expect(milestone.isAchieved).toBe(false);
        expect(milestone.achievedDate).toBeNull();
      });
    });

    it('should sort contributions by date when finding achievement date', () => {
      const goal = {
        targetAmount: 10000,
        currentAmount: 3000,
        milestonePercentages: [25],
        contributions: [
          { amount: 2000, date: new Date('2024-02-15') },
          { amount: 1000, date: new Date('2024-01-15') }
        ]
      };

      const milestones = GoalService.generateMilestoneCheckpoints(goal);

      expect(milestones[0].achievedDate).toEqual(new Date('2024-02-15'));
    });
  });

  describe('updateGoalAnalytics', () => {
    beforeEach(() => {
      Goal.findById.mockResolvedValue(mockGoal);
    });

    it('should update goal analytics correctly', async () => {
      const result = await GoalService.updateGoalAnalytics(mockGoalId);

      expect(Goal.findById).toHaveBeenCalledWith(mockGoalId);
      expect(mockGoal.save).toHaveBeenCalled();
      expect(mockGoal.currentAmount).toBe(3000);
      expect(mockGoal.progressPercentage).toBe(30);
    });

    it('should mark goal as completed when progress reaches 100%', async () => {
      mockGoal.currentAmount = 10000;
      mockGoal.progressPercentage = 100;
      mockGoal.status = 'active';

      await GoalService.updateGoalAnalytics(mockGoalId);

      expect(mockGoal.status).toBe('completed');
      expect(mockGoal.achievementDate).toBeInstanceOf(Date);
    });

    it('should calculate overachievement amount', async () => {
      mockGoal.currentAmount = 12000;

      await GoalService.updateGoalAnalytics(mockGoalId);

      expect(mockGoal.overachievementAmount).toBe(2000);
    });

    it('should throw NotFoundError when goal not found', async () => {
      Goal.findById.mockResolvedValue(null);

      await expect(GoalService.updateGoalAnalytics(mockGoalId))
        .rejects.toThrow(NotFoundError);
    });

    it('should calculate average monthly contribution', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      mockGoal.startDate = thirtyDaysAgo;

      await GoalService.updateGoalAnalytics(mockGoalId);

      expect(mockGoal.averageMonthlyContribution).toBeGreaterThan(0);
    });

    it('should estimate completion date', async () => {
      mockGoal.averageMonthlyContribution = 1000;
      mockGoal.currentAmount = 3000;
      mockGoal.targetAmount = 10000;

      await GoalService.updateGoalAnalytics(mockGoalId);

      expect(mockGoal.estimatedCompletionDate).toBeInstanceOf(Date);
    });
  });

  describe('getGoals', () => {
    const mockGoals = [mockGoal];
    
    beforeEach(() => {
      Goal.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockGoals)
            })
          })
        })
      });
      Goal.countDocuments.mockResolvedValue(1);
    });

    it('should get goals with default parameters', async () => {
      const result = await GoalService.getGoals(mockUserId);

      expect(result.goals).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.summary.totalGoals).toBe(1);
    });

    it('should filter goals by status', async () => {
      const queryParams = { status: 'active' };
      
      await GoalService.getGoals(mockUserId, queryParams);

      expect(Goal.find).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUserId,
          status: 'active',
          isDeleted: false
        })
      );
    });

    it('should filter goals by multiple statuses', async () => {
      const queryParams = { status: ['active', 'completed'] };
      
      await GoalService.getGoals(mockUserId, queryParams);

      expect(Goal.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: { $in: ['active', 'completed'] }
        })
      );
    });

    it('should filter goals by date range', async () => {
      const queryParams = {
        startDateFrom: '2024-01-01',
        startDateTo: '2024-12-31'
      };
      
      await GoalService.getGoals(mockUserId, queryParams);

      expect(Goal.find).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: {
            $gte: new Date('2024-01-01'),
            $lte: new Date('2024-12-31')
          }
        })
      );
    });

    it('should filter goals by amount range', async () => {
      const queryParams = {
        minAmount: 1000,
        maxAmount: 50000
      };
      
      await GoalService.getGoals(mockUserId, queryParams);

      expect(Goal.find).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAmount: {
            $gte: 1000,
            $lte: 50000
          }
        })
      );
    });

    it('should search goals by name, description, and tags', async () => {
      const queryParams = { search: 'emergency' };
      
      await GoalService.getGoals(mockUserId, queryParams);

      expect(Goal.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { name: { $regex: 'emergency', $options: 'i' } },
            { description: { $regex: 'emergency', $options: 'i' } },
            { tags: { $in: [new RegExp('emergency', 'i')] } }
          ]
        })
      );
    });

    it('should handle pagination correctly', async () => {
      const queryParams = { page: 2, limit: 5 };
      
      await GoalService.getGoals(mockUserId, queryParams);

      const mockChain = Goal.find().sort().skip();
      expect(mockChain.limit).toHaveBeenCalledWith(5);
    });

    it('should sort goals correctly', async () => {
      const queryParams = { sortBy: 'targetAmount', sortDirection: 'desc' };
      
      await GoalService.getGoals(mockUserId, queryParams);

      const mockChain = Goal.find();
      expect(mockChain.sort).toHaveBeenCalledWith({ targetAmount: -1 });
    });

    it('should throw DatabaseError on database failure', async () => {
      Goal.find.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(GoalService.getGoals(mockUserId))
        .rejects.toThrow(DatabaseError);
    });

    it('should calculate summary statistics', async () => {
      const result = await GoalService.getGoals(mockUserId);

      expect(result.summary).toEqual({
        totalGoals: 1,
        activeGoals: 1,
        completedGoals: 0,
        totalTargetAmount: 10000,
        totalCurrentAmount: 3000
      });
    });
  });

  describe('getGoalById', () => {
    beforeEach(() => {
      Goal.findOne.mockResolvedValue(mockGoal);
    });

    it('should get goal by ID with metrics', async () => {
      const result = await GoalService.getGoalById(mockGoalId, mockUserId);

      expect(Goal.findOne).toHaveBeenCalledWith({
        _id: mockGoalId,
        user: mockUserId,
        isDeleted: false
      });
      expect(result.goal).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.probability).toBeDefined();
      expect(result.milestones).toBeDefined();
      expect(result.recentContributions).toBeDefined();
      expect(result.contributionTrends).toBeDefined();
    });

    it('should validate goal ID format', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(GoalService.getGoalById('invalid-id', mockUserId))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when goal not found', async () => {
      Goal.findOne.mockResolvedValue(null);

      await expect(GoalService.getGoalById(mockGoalId, mockUserId))
        .rejects.toThrow(NotFoundError);
    });

    it('should return recent contributions limited to 5', async () => {
      mockGoal.contributions = Array.from({ length: 10 }, (_, i) => ({
        _id: `contrib${i}`,
        amount: 100,
        date: new Date(`2024-${String(i + 1).padStart(2, '0')}-01`),
        notes: `Contribution ${i}`,
        method: 'manual'
      }));

      const result = await GoalService.getGoalById(mockGoalId, mockUserId);

      expect(result.recentContributions).toHaveLength(5);
    });

    it('should handle database errors gracefully', async () => {
      Goal.findOne.mockRejectedValue(new Error('Database error'));

      await expect(GoalService.getGoalById(mockGoalId, mockUserId))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('calculateContributionTrends', () => {
    it('should calculate monthly contribution trends', () => {
      const goal = {
        contributions: [
          { amount: 1000, date: new Date('2024-01-15') },
          { amount: 500, date: new Date('2024-01-30') },
          { amount: 2000, date: new Date('2024-02-15') },
          { amount: 1500, date: new Date('2024-03-01') }
        ]
      };

      const trends = GoalService.calculateContributionTrends(goal);

      expect(trends).toHaveLength(3);
      expect(trends[0]).toEqual({
        month: '2024-01',
        totalAmount: 1500,
        contributionCount: 2,
        averageAmount: 750
      });
      expect(trends[1]).toEqual({
        month: '2024-02',
        totalAmount: 2000,
        contributionCount: 1,
        averageAmount: 2000
      });
    });

    it('should return empty array for goals with no contributions', () => {
      const goal = { contributions: [] };

      const trends = GoalService.calculateContributionTrends(goal);

      expect(trends).toEqual([]);
    });

    it('should handle null contributions', () => {
      const goal = { contributions: null };

      const trends = GoalService.calculateContributionTrends(goal);

      expect(trends).toEqual([]);
    });

    it('should sort trends by month chronologically', () => {
      const goal = {
        contributions: [
          { amount: 2000, date: new Date('2024-03-15') },
          { amount: 1000, date: new Date('2024-01-15') },
          { amount: 1500, date: new Date('2024-02-15') }
        ]
      };

      const trends = GoalService.calculateContributionTrends(goal);

      expect(trends.map(t => t.month)).toEqual(['2024-01', '2024-02', '2024-03']);
    });
  });

  describe('createGoal', () => {
    let mockGoalData;

    beforeEach(() => {
      mockGoalData = {
        name: 'New Goal',
        description: 'Goal description',
        targetAmount: 5000,
        currentAmount: 0,
        startDate: '2024-01-01',
        targetDate: '2024-12-31',
        status: 'active',
        priority: 'medium',
        goalType: 'savings'
      };

      Goal.mockImplementation(() => ({
        ...mockGoal,
        save: jest.fn().mockResolvedValue(mockGoal)
      }));
    });

    it('should create goal with valid data', async () => {
      jest.spyOn(GoalService, 'validateGoalData').mockImplementation(() => {});

      const result = await GoalService.createGoal(mockGoalData, mockUserId);

      expect(GoalService.validateGoalData).toHaveBeenCalledWith(mockGoalData);
      expect(Goal).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should add initial contribution if currentAmount > 0', async () => {
      mockGoalData.currentAmount = 1000;
      const mockGoalInstance = {
        ...mockGoal,
        contributions: [],
        save: jest.fn().mockResolvedValue(mockGoal)
      };
      Goal.mockImplementation(() => mockGoalInstance);
      jest.spyOn(GoalService, 'validateGoalData').mockImplementation(() => {});

      await GoalService.createGoal(mockGoalData, mockUserId);

      expect(mockGoalInstance.contributions).toHaveLength(1);
      expect(mockGoalInstance.contributions[0].amount).toBe(1000);
      expect(mockGoalInstance.contributions[0].notes).toBe('Initial amount');
    });

    it('should set default values for optional fields', async () => {
      const minimalGoalData = {
        name: 'Minimal Goal',
        targetAmount: 1000,
        startDate: '2024-01-01',
        targetDate: '2024-12-31'
      };

      const mockGoalInstance = {
        ...mockGoal,
        save: jest.fn().mockResolvedValue(mockGoal)
      };
      Goal.mockImplementation(() => mockGoalInstance);
      jest.spyOn(GoalService, 'validateGoalData').mockImplementation(() => {});

      await GoalService.createGoal(minimalGoalData, mockUserId);

      expect(Goal).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          priority: 'medium',
          goalType: 'savings',
          colorTheme: '#3498db',
          icon: 'savings'
        })
      );
    });

    it('should handle validation errors', async () => {
      jest.spyOn(GoalService, 'validateGoalData').mockImplementation(() => {
        throw new ValidationError('Validation failed');
      });

      await expect(GoalService.createGoal(mockGoalData, mockUserId))
        .rejects.toThrow(ValidationError);
    });

    it('should handle database errors', async () => {
      jest.spyOn(GoalService, 'validateGoalData').mockImplementation(() => {});
      Goal.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('Database error'))
      }));

      await expect(GoalService.createGoal(mockGoalData, mockUserId))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('validateGoalData', () => {
    let validGoalData;

    beforeEach(() => {
      validGoalData = {
        name: 'Valid Goal',
        targetAmount: 5000,
        startDate: '2024-01-01',
        targetDate: '2024-12-31',
        status: 'active',
        priority: 'medium',
        goalType: 'savings',
        currentAmount: 0
      };
    });

    it('should pass validation for valid data', () => {
      expect(() => GoalService.validateGoalData(validGoalData))
        .not.toThrow();
    });

    it('should throw ValidationError for missing name', () => {
      delete validGoalData.name;

      expect(() => GoalService.validateGoalData(validGoalData))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid target amount', () => {
      validGoalData.targetAmount = 0;

      expect(() => GoalService.validateGoalData(validGoalData))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for missing start date', () => {
      delete validGoalData.startDate;

      expect(() => GoalService.validateGoalData(validGoalData))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for missing target date', () => {
      delete validGoalData.targetDate;

      expect(() => GoalService.validateGoalData(validGoalData))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError when start date >= target date', () => {
      validGoalData.startDate = '2024-12-31';
      validGoalData.targetDate = '2024-01-01';

      expect(() => GoalService.validateGoalData(validGoalData))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid status', () => {
      validGoalData.status = 'invalid_status';

      expect(() => GoalService.validateGoalData(validGoalData))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid priority', () => {
      validGoalData.priority = 'invalid_priority';

      expect(() => GoalService.validateGoalData(validGoalData))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid goal type', () => {
      validGoalData.goalType = 'invalid_type';

      expect(() => GoalService.validateGoalData(validGoalData))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for negative current amount', () => {
      validGoalData.currentAmount = -100;

      expect(() => GoalService.validateGoalData(validGoalData))
        .toThrow(ValidationError);
    });

    it('should collect multiple validation errors', () => {
      const invalidData = {
        targetAmount: -100,
        status: 'invalid',
        priority: 'invalid',
        currentAmount: -50
      };

      expect(() => GoalService.validateGoalData(invalidData))
        .toThrow(ValidationError);
    });
  });

  describe('updateGoal', () => {
    beforeEach(() => {
      Goal.findOne.mockResolvedValue(mockGoal);
      jest.spyOn(GoalService, 'identifyChanges').mockReturnValue({});
    });

    it('should update goal successfully', async () => {
      const updateData = { name: 'Updated Goal Name' };

      const result = await GoalService.updateGoal(mockGoalId, updateData, mockUserId);

      expect(Goal.findOne).toHaveBeenCalledWith({
        _id: mockGoalId,
        user: mockUserId,
        isDeleted: false
      });
      expect(mockGoal.save).toHaveBeenCalled();
      expect(result.goal).toBeDefined();
      expect(result.changes).toBeDefined();
    });

    it('should validate goal ID format', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(GoalService.updateGoal('invalid-id', {}, mockUserId))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when goal not found', async () => {
      Goal.findOne.mockResolvedValue(null);

      await expect(GoalService.updateGoal(mockGoalId, {}, mockUserId))
        .rejects.toThrow(NotFoundError);
    });

    it('should validate target amount when updating', async () => {
      const updateData = { targetAmount: 0 };

      await expect(GoalService.updateGoal(mockGoalId, updateData, mockUserId))
        .rejects.toThrow(ValidationError);
    });

    it('should validate date consistency when updating dates', async () => {
      const updateData = { 
        startDate: '2024-12-31',
        targetDate: '2024-01-01'
      };

      await expect(GoalService.updateGoal(mockGoalId, updateData, mockUserId))
        .rejects.toThrow(ValidationError);
    });

    it('should handle status change to completed', async () => {
      const updateData = { status: 'completed' };

      await GoalService.updateGoal(mockGoalId, updateData, mockUserId);

      expect(mockGoal.status).toBe('completed');
      expect(mockGoal.achievementDate).toBeInstanceOf(Date);
    });

    it('should handle reverting from completed status', async () => {
      mockGoal.status = 'completed';
      mockGoal.achievementDate = new Date();
      const updateData = { status: 'active' };

      await GoalService.updateGoal(mockGoalId, updateData, mockUserId);

      expect(mockGoal.status).toBe('active');
      expect(mockGoal.achievementDate).toBeNull();
    });

    it('should validate status values', async () => {
      const updateData = { status: 'invalid_status' };

      await expect(GoalService.updateGoal(mockGoalId, updateData, mockUserId))
        .rejects.toThrow(ValidationError);
    });

    it('should update nested objects correctly', async () => {
      const updateData = {
        notificationSettings: { reminderFrequency: 'daily' }
      };

      await GoalService.updateGoal(mockGoalId, updateData, mockUserId);

      expect(mockGoal.notificationSettings).toEqual(
        expect.objectContaining({ reminderFrequency: 'daily' })
      );
    });

    it('should handle database save errors', async () => {
      mockGoal.save.mockRejectedValue(new Error('Database error'));

      await expect(GoalService.updateGoal(mockGoalId, { name: 'Test' }, mockUserId))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('identifyChanges', () => {
    it('should identify basic field changes', () => {
      const original = { name: 'Old Name', priority: 'low' };
      const updated = { name: 'New Name', priority: 'high' };

      const changes = GoalService.identifyChanges(original, updated);

      expect(changes.name).toEqual({
        from: 'Old Name',
        to: 'New Name'
      });
      expect(changes.priority).toEqual({
        from: 'low',
        to: 'high'
      });
    });

    it('should identify date changes', () => {
      const original = { startDate: new Date('2024-01-01') };
      const updated = { startDate: new Date('2024-02-01') };

      const changes = GoalService.identifyChanges(original, updated);

      expect(changes.startDate).toEqual({
        from: new Date('2024-01-01').toISOString(),
        to: new Date('2024-02-01').toISOString()
      });
    });

    it('should identify array changes', () => {
      const original = { tags: ['old', 'tags'] };
      const updated = { tags: ['new', 'tags'] };

      const changes = GoalService.identifyChanges(original, updated);

      expect(changes.tags).toEqual({
        from: ['old', 'tags'],
        to: ['new', 'tags']
      });
    });

    it('should identify nested object changes', () => {
      const original = { autoContributionSettings: { enabled: false } };
      const updated = { autoContributionSettings: { enabled: true } };

      const changes = GoalService.identifyChanges(original, updated);

      expect(changes.autoContributionSettings).toEqual({
        from: { enabled: false },
        to: { enabled: true }
      });
    });

    it('should return empty object when no changes', () => {
      const original = { name: 'Same Name', priority: 'medium' };
      const updated = { name: 'Same Name', priority: 'medium' };

      const changes = GoalService.identifyChanges(original, updated);

      expect(changes).toEqual({});
    });
  });

  describe('deleteGoal', () => {
    beforeEach(() => {
      Goal.findOne.mockResolvedValue(mockGoal);
      Goal.deleteOne.mockResolvedValue({ deletedCount: 1 });
    });

    it('should perform soft delete by default', async () => {
      const result = await GoalService.deleteGoal(mockGoalId, mockUserId);

      expect(mockGoal.isDeleted).toBe(true);
      expect(mockGoal.deletedAt).toBeInstanceOf(Date);
      expect(mockGoal.save).toHaveBeenCalled();
      expect(result.message).toContain('can be restored');
    });

    it('should perform permanent delete when specified', async () => {
      const result = await GoalService.deleteGoal(mockGoalId, mockUserId, true);

      expect(Goal.deleteOne).toHaveBeenCalledWith({ _id: mockGoalId });
      expect(result.message).toContain('permanently deleted');
    });

    it('should validate goal ID format', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(GoalService.deleteGoal('invalid-id', mockUserId))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when goal not found', async () => {
      Goal.findOne.mockResolvedValue(null);

      await expect(GoalService.deleteGoal(mockGoalId, mockUserId))
        .rejects.toThrow(NotFoundError);
    });

    it('should handle database errors during soft delete', async () => {
      mockGoal.save.mockRejectedValue(new Error('Database error'));

      await expect(GoalService.deleteGoal(mockGoalId, mockUserId))
        .rejects.toThrow(DatabaseError);
    });

    it('should handle database errors during permanent delete', async () => {
      Goal.deleteOne.mockRejectedValue(new Error('Database error'));

      await expect(GoalService.deleteGoal(mockGoalId, mockUserId, true))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('addContribution', () => {
    beforeEach(() => {
      Goal.findOne.mockResolvedValue(mockGoal);
      Goal.findById.mockResolvedValue(mockGoal);
      jest.spyOn(GoalService, 'validateContributionData').mockImplementation(() => {});
      jest.spyOn(GoalService, 'updateGoalAnalytics').mockResolvedValue(mockGoal);
    });

    it('should add contribution successfully', async () => {
      const contributionData = {
        amount: 500,
        date: '2024-03-01',
        notes: 'Monthly savings',
        method: 'manual'
      };

      const result = await GoalService.addContribution(mockGoalId, contributionData, mockUserId);

      expect(GoalService.validateContributionData).toHaveBeenCalledWith(contributionData);
      expect(mockGoal.contributions.push).toHaveBeenCalled();
      expect(GoalService.updateGoalAnalytics).toHaveBeenCalledWith(mockGoalId);
      expect(result.goal).toBeDefined();
      expect(result.contribution).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should validate goal ID format', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(GoalService.addContribution('invalid-id', {}, mockUserId))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when goal not found', async () => {
      Goal.findOne.mockResolvedValue(null);

      await expect(GoalService.addContribution(mockGoalId, {}, mockUserId))
        .rejects.toThrow(ValidationError);
    });

    it('should handle contribution validation errors', async () => {
      jest.spyOn(GoalService, 'validateContributionData').mockImplementation(() => {
        throw new ValidationError('Invalid contribution');
      });

      await expect(GoalService.addContribution(mockGoalId, {}, mockUserId))
        .rejects.toThrow(ValidationError);
    });

    it('should use current date when date not provided', async () => {
      const contributionData = { amount: 500 };

      // Mock the push method to capture the contribution
      let capturedContribution;
      mockGoal.contributions.push = jest.fn().mockImplementation((contribution) => {
        capturedContribution = contribution;
      });

      await GoalService.addContribution(mockGoalId, contributionData, mockUserId);

      expect(capturedContribution.date).toBeInstanceOf(Date);
    });

    it('should handle database errors', async () => {
      jest.spyOn(GoalService, 'updateGoalAnalytics').mockRejectedValue(new Error('Database error'));

      await expect(GoalService.addContribution(mockGoalId, { amount: 500 }, mockUserId))
        .rejects.toThrow(DatabaseError);
    });
  });

  describe('validateContributionData', () => {
    it('should pass validation for valid contribution data', () => {
      const validData = {
        amount: 500,
        date: '2024-03-01',
        method: 'manual',
        notes: 'Test contribution'
      };

      expect(() => GoalService.validateContributionData(validData))
        .not.toThrow();
    });

    it('should throw ValidationError for missing amount', () => {
      const invalidData = { date: '2024-03-01' };

      expect(() => GoalService.validateContributionData(invalidData))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for zero or negative amount', () => {
      const invalidData = { amount: 0 };

      expect(() => GoalService.validateContributionData(invalidData))
        .toThrow(ValidationError);

      invalidData.amount = -100;
      expect(() => GoalService.validateContributionData(invalidData))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid date', () => {
      const invalidData = { 
        amount: 500,
        date: 'invalid-date'
      };

      expect(() => GoalService.validateContributionData(invalidData))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid method', () => {
      const invalidData = { 
        amount: 500,
        method: 'invalid_method'
      };

      expect(() => GoalService.validateContributionData(invalidData))
        .toThrow(ValidationError);
    });

    it('should collect multiple validation errors', () => {
      const invalidData = { 
        amount: -100,
        date: 'invalid-date',
        method: 'invalid_method'
      };

      expect(() => GoalService.validateContributionData(invalidData))
        .toThrow(ValidationError);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large number of goals efficiently', async () => {
      const largeGoalSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockGoal,
        _id: `goal${i}`,
        name: `Goal ${i}`,
        targetAmount: 1000 + i
      }));

      Goal.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(largeGoalSet.slice(0, 50))
            })
          })
        })
      });
      Goal.countDocuments.mockResolvedValue(1000);

      const startTime = Date.now();
      const result = await GoalService.getGoals(mockUserId, { limit: 50 });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.goals).toHaveLength(50);
    });

    it('should handle complex goal metrics calculation efficiently', () => {
      const complexGoal = {
        targetAmount: 100000,
        currentAmount: 45000,
        startDate: new Date('2020-01-01'),
        targetDate: new Date('2025-12-31'),
        contributions: Array.from({ length: 200 }, (_, i) => ({
          amount: 225,
          date: new Date(2020 + Math.floor(i / 12), i % 12, 15)
        }))
      };

      const startTime = Date.now();
      const metrics = GoalService.calculateProgressMetrics(complexGoal);
      const trends = GoalService.calculateContributionTrends(complexGoal);
      const milestones = GoalService.generateMilestoneCheckpoints(complexGoal);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
      expect(metrics).toBeDefined();
      expect(trends).toBeDefined();
      expect(milestones).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle goals with extreme amounts', () => {
      const extremeGoal = {
        targetAmount: Number.MAX_SAFE_INTEGER,
        currentAmount: Number.MAX_SAFE_INTEGER / 2,
        startDate: new Date('2024-01-01'),
        targetDate: new Date('2024-12-31')
      };

      const metrics = GoalService.calculateProgressMetrics(extremeGoal);

      expect(metrics.progressPercentage).toBe(50);
      expect(metrics.amountRemaining).toBeGreaterThan(0);
    });

    it('should handle goals with very short timeframes', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const shortGoal = {
        targetAmount: 1000,
        currentAmount: 500,
        startDate: new Date(),
        targetDate: tomorrow
      };

      const metrics = GoalService.calculateProgressMetrics(shortGoal);

      expect(metrics.daysRemaining).toBeLessThanOrEqual(1);
      expect(metrics.requiredMonthlyContribution).toBeGreaterThan(0);
    });

    it('should handle goals with no target date in far future', () => {
      const farFuture = new Date('2099-12-31');

      const longTermGoal = {
        targetAmount: 1000000,
        currentAmount: 1000,
        startDate: new Date(),
        targetDate: farFuture
      };

      const metrics = GoalService.calculateProgressMetrics(longTermGoal);

      expect(metrics.daysRemaining).toBeGreaterThan(365 * 50); // More than 50 years
      expect(metrics.requiredMonthlyContribution).toBeGreaterThan(0);
    });

    it('should handle empty contribution arrays gracefully', () => {
      const emptyGoal = {
        targetAmount: 5000,
        currentAmount: 0,
        contributions: [],
        milestonePercentages: [25, 50, 75, 100]
      };

      const milestones = GoalService.generateMilestoneCheckpoints(emptyGoal);
      const trends = GoalService.calculateContributionTrends(emptyGoal);

      expect(milestones).toHaveLength(4);
      expect(trends).toEqual([]);
      milestones.forEach(milestone => {
        expect(milestone.isAchieved).toBe(false);
        expect(milestone.achievedDate).toBeNull();
      });
    });
  });
});
