/**
 * Unit Tests for Budget Alert Service
 * Tests budget alert checking, notification sending, and alert management functionality
 */

const BudgetAlertService = require('../../services/budgetAlert.service');
const emailQueue = require('../../services/emailQueue.service');
const Budget = require('../../models/Budget');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const logger = require('../../utils/logger');
const config = require('../../config/environment');

// Mock dependencies
jest.mock('../../services/emailQueue.service');
jest.mock('../../models/Budget');
jest.mock('../../models/User');
jest.mock('../../models/Transaction');
jest.mock('../../utils/logger');
jest.mock('../../config/environment');

describe('BudgetAlertService', () => {
  let budgetAlertService;
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockBudgetId = '507f1f77bcf86cd799439012';

  const mockUser = {
    _id: mockUserId,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    notificationPreferences: {
      budgetAlerts: {
        enabled: true,
        warningThreshold: 80,
        exceedanceAlerts: true,
        categoryAlerts: true
      }
    }
  };

  const mockBudget = {
    _id: mockBudgetId,
    user: mockUserId,
    name: 'Monthly Budget',
    amount: 1000,
    period: 'monthly',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    alertThreshold: 80,
    categoryAllocations: [
      {
        category: {
          _id: '507f1f77bcf86cd799439013',
          name: 'Food & Dining',
          type: 'expense'
        },
        allocatedAmount: 400,
        spentAmount: 350
      },
      {
        category: {
          _id: '507f1f77bcf86cd799439014',
          name: 'Transportation',
          type: 'expense'
        },
        allocatedAmount: 300,
        spentAmount: 280
      }
    ],
    getBudgetPerformance: jest.fn(),
    checkBudgetViolations: jest.fn()
  };

  const mockBudgetPerformance = {
    totalSpent: 850,
    totalBudget: 1000,
    utilizationPercentage: 85,
    categoryPerformance: {
      'Food & Dining': { spent: 350, budget: 400, percentage: 87.5 },
      'Transportation': { spent: 280, budget: 300, percentage: 93.3 }
    }
  };

  const mockViolations = {
    isOverBudget: false,
    overBudgetAmount: 0,
    categoriesOverBudget: [],
    warningCategories: ['Transportation']
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock config
    config.getConfig.mockReturnValue({
      app: { name: 'Personal Finance Dashboard' }
    });

    // Mock environment variables
    process.env.FRONTEND_URL = 'http://localhost:4200';
    process.env.SUPPORT_URL = 'mailto:support@test.com';

    // Initialize service
    budgetAlertService = new BudgetAlertService();

    // Mock User model
    User.findById = jest.fn().mockResolvedValue(mockUser);

    // Mock Budget model
    Budget.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockBudget)
    });

    // Mock budget methods
    mockBudget.getBudgetPerformance.mockResolvedValue(mockBudgetPerformance);
    mockBudget.checkBudgetViolations.mockResolvedValue(mockViolations);

    // Mock email queue
    emailQueue.queueEmail = jest.fn().mockResolvedValue({ success: true, id: 'email-123' });

    // Mock logger
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
    logger.debug = jest.fn();
  });

  describe('checkAndSendBudgetAlerts', () => {
    it('should successfully check and send budget alerts', async () => {
      const result = await budgetAlertService.checkAndSendBudgetAlerts(mockUserId, mockBudgetId);

      expect(result.success).toBe(true);
      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(Budget.findById).toHaveBeenCalledWith(mockBudgetId);
      expect(mockBudget.getBudgetPerformance).toHaveBeenCalled();
      expect(mockBudget.checkBudgetViolations).toHaveBeenCalled();
    });

    it('should return error when user not found', async () => {
      User.findById.mockResolvedValue(null);

      const result = await budgetAlertService.checkAndSendBudgetAlerts(mockUserId, mockBudgetId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`User not found for budget alert check: ${mockUserId}`)
      );
    });

    it('should return error when budget not found', async () => {
      Budget.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      const result = await budgetAlertService.checkAndSendBudgetAlerts(mockUserId, mockBudgetId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Budget not found');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Budget not found: ${mockBudgetId}`)
      );
    });

    it('should skip alerts when user has budget alerts disabled', async () => {
      const userWithDisabledAlerts = {
        ...mockUser,
        notificationPreferences: {
          budgetAlerts: { enabled: false }
        }
      };
      User.findById.mockResolvedValue(userWithDisabledAlerts);

      const result = await budgetAlertService.checkAndSendBudgetAlerts(mockUserId, mockBudgetId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Budget alerts disabled for user');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Budget alerts disabled for user: ${mockUserId}`)
      );
    });

    it('should send warning alert when budget threshold is exceeded', async () => {
      // Mock methods to simulate warning alert
      jest.spyOn(budgetAlertService, 'checkOverallBudgetAlert').mockResolvedValue({
        type: 'budget-warning',
        user: mockUser,
        budget: mockBudget,
        data: mockBudgetPerformance
      });
      jest.spyOn(budgetAlertService, 'checkCategoryAlerts').mockResolvedValue([]);
      jest.spyOn(budgetAlertService, 'sendBudgetAlert').mockResolvedValue({
        success: true,
        type: 'budget-warning'
      });

      const result = await budgetAlertService.checkAndSendBudgetAlerts(mockUserId, mockBudgetId);

      expect(result.success).toBe(true);
      expect(result.alertsSent).toBe(1);
      expect(budgetAlertService.sendBudgetAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'budget-warning',
          user: mockUser,
          budget: mockBudget
        })
      );
    });

    it('should send exceeded alert when budget is over limit', async () => {
      const exceededViolations = { ...mockViolations, isOverBudget: true };
      mockBudget.checkBudgetViolations.mockResolvedValue(exceededViolations);

      jest.spyOn(budgetAlertService, 'checkOverallBudgetAlert').mockResolvedValue({
        type: 'budget-exceeded',
        user: mockUser,
        budget: mockBudget,
        data: { ...mockBudgetPerformance, overAmount: 50 }
      });
      jest.spyOn(budgetAlertService, 'checkCategoryAlerts').mockResolvedValue([]);
      jest.spyOn(budgetAlertService, 'sendBudgetAlert').mockResolvedValue({
        success: true,
        type: 'budget-exceeded'
      });

      const result = await budgetAlertService.checkAndSendBudgetAlerts(mockUserId, mockBudgetId);

      expect(result.success).toBe(true);
      expect(result.alertsSent).toBe(1);
      expect(budgetAlertService.sendBudgetAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'budget-exceeded'
        })
      );
    });

    it('should handle multiple category alerts', async () => {
      jest.spyOn(budgetAlertService, 'checkOverallBudgetAlert').mockResolvedValue(null);
      jest.spyOn(budgetAlertService, 'checkCategoryAlerts').mockResolvedValue([
        {
          type: 'category-warning',
          category: 'Food & Dining',
          user: mockUser,
          budget: mockBudget
        },
        {
          type: 'category-exceeded',
          category: 'Transportation',
          user: mockUser,
          budget: mockBudget
        }
      ]);
      jest.spyOn(budgetAlertService, 'sendBudgetAlert')
        .mockResolvedValueOnce({ success: true, type: 'category-warning' })
        .mockResolvedValueOnce({ success: true, type: 'category-exceeded' });

      const result = await budgetAlertService.checkAndSendBudgetAlerts(mockUserId, mockBudgetId);

      expect(result.success).toBe(true);
      expect(result.alertsSent).toBe(2);
      expect(budgetAlertService.sendBudgetAlert).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during alert checking', async () => {
      const error = new Error('Database connection failed');
      User.findById.mockRejectedValue(error);

      const result = await budgetAlertService.checkAndSendBudgetAlerts(mockUserId, mockBudgetId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(logger.error).toHaveBeenCalledWith('Error in budget alert check:', error);
    });
  });

  describe('checkOverallBudgetAlert', () => {
    beforeEach(() => {
      jest.spyOn(budgetAlertService, 'hasRecentAlert').mockResolvedValue(false);
      jest.spyOn(budgetAlertService, 'getCategoryBreakdown').mockResolvedValue([]);
      jest.spyOn(budgetAlertService, 'calculateDaysRemaining').mockReturnValue(10);
    });

    it('should return exceeded alert when budget is over limit', async () => {
      const exceededViolations = { isOverBudget: true };
      const exceededPerformance = {
        totalSpent: 1100,
        totalBudget: 1000,
        utilizationPercentage: 110
      };

      const alert = await budgetAlertService.checkOverallBudgetAlert(
        mockUser, mockBudget, exceededPerformance, exceededViolations
      );

      expect(alert).toEqual({
        type: 'budget-exceeded',
        user: mockUser,
        budget: mockBudget,
        data: expect.objectContaining({
          totalSpent: 1100,
          totalBudget: 1000,
          utilizationPercentage: 110,
          overAmount: 100
        })
      });
    });

    it('should return warning alert when threshold is reached', async () => {
      const warningPerformance = {
        totalSpent: 850,
        totalBudget: 1000,
        utilizationPercentage: 85
      };

      const alert = await budgetAlertService.checkOverallBudgetAlert(
        mockUser, mockBudget, warningPerformance, mockViolations
      );

      expect(alert).toEqual({
        type: 'budget-warning',
        user: mockUser,
        budget: mockBudget,
        data: expect.objectContaining({
          totalSpent: 850,
          totalBudget: 1000,
          utilizationPercentage: 85,
          remainingAmount: 150,
          alertThreshold: 80,
          daysRemaining: 10,
          avgDailyBudget: '15.00'
        })
      });
    });

    it('should return null when no alert is needed', async () => {
      const lowPerformance = {
        totalSpent: 500,
        totalBudget: 1000,
        utilizationPercentage: 50
      };

      const alert = await budgetAlertService.checkOverallBudgetAlert(
        mockUser, mockBudget, lowPerformance, { isOverBudget: false }
      );

      expect(alert).toBeNull();
    });

    it('should not send duplicate alerts when recent alert exists', async () => {
      jest.spyOn(budgetAlertService, 'hasRecentAlert').mockResolvedValue(true);

      const exceededViolations = { isOverBudget: true };
      const exceededPerformance = {
        totalSpent: 1100,
        totalBudget: 1000,
        utilizationPercentage: 110
      };

      const alert = await budgetAlertService.checkOverallBudgetAlert(
        mockUser, mockBudget, exceededPerformance, exceededViolations
      );

      expect(alert).toBeNull();
    });

    it('should handle custom alert threshold', async () => {
      const customBudget = { ...mockBudget, alertThreshold: 90 };
      const performance = {
        totalSpent: 920,
        totalBudget: 1000,
        utilizationPercentage: 92
      };

      const alert = await budgetAlertService.checkOverallBudgetAlert(
        mockUser, customBudget, performance, { isOverBudget: false }
      );

      expect(alert).toEqual(
        expect.objectContaining({
          type: 'budget-warning',
          data: expect.objectContaining({
            alertThreshold: 90
          })
        })
      );
    });
  });

  describe('checkCategoryAlerts', () => {
    beforeEach(() => {
      jest.spyOn(budgetAlertService, 'hasRecentAlert').mockResolvedValue(false);
    });

    it('should return category warning alerts', async () => {
      const categoryPerformance = {
        categoryPerformance: {
          'Food & Dining': { spent: 350, budget: 400, percentage: 87.5 },
          'Transportation': { spent: 270, budget: 300, percentage: 90 }
        }
      };

      const alerts = await budgetAlertService.checkCategoryAlerts(
        mockUser, mockBudget, categoryPerformance, mockViolations
      );

      expect(alerts).toHaveLength(2);
      expect(alerts[0]).toEqual(
        expect.objectContaining({
          type: 'category-warning',
          category: expect.objectContaining({
            name: 'Food & Dining'
          })
        })
      );
    });

    it('should return category exceeded alerts', async () => {
      const exceededViolations = {
        ...mockViolations,
        categoriesOverBudget: ['Transportation']
      };
      const categoryPerformance = {
        categoryPerformance: {
          'Transportation': { spent: 350, budget: 300, percentage: 116.7 }
        }
      };

      const alerts = await budgetAlertService.checkCategoryAlerts(
        mockUser, mockBudget, categoryPerformance, exceededViolations
      );

      expect(alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'category-exceeded',
            category: expect.objectContaining({
              name: 'Transportation'
            })
          })
        ])
      );
    });

    it('should skip alerts when user has category alerts disabled', async () => {
      const userWithDisabledCategoryAlerts = {
        ...mockUser,
        notificationPreferences: {
          budgetAlerts: {
            enabled: true,
            categoryAlerts: false
          }
        }
      };

      const alerts = await budgetAlertService.checkCategoryAlerts(
        userWithDisabledCategoryAlerts, mockBudget, mockBudgetPerformance, mockViolations
      );

      expect(alerts).toHaveLength(0);
    });

    it('should not send duplicate category alerts', async () => {
      jest.spyOn(budgetAlertService, 'hasRecentAlert').mockResolvedValue(true);

      const categoryPerformance = {
        categoryPerformance: {
          'Food & Dining': { spent: 380, budget: 400, percentage: 95 }
        }
      };

      const alerts = await budgetAlertService.checkCategoryAlerts(
        mockUser, mockBudget, categoryPerformance, mockViolations
      );

      expect(alerts).toHaveLength(0);
    });
  });

  describe('sendBudgetAlert', () => {
    it('should send budget exceeded alert email', async () => {
      const alert = {
        type: 'budget-exceeded',
        user: mockUser,
        budget: mockBudget,
        data: {
          totalSpent: 1100,
          totalBudget: 1000,
          overAmount: 100,
          categoryBreakdown: []
        }
      };

      const result = await budgetAlertService.sendBudgetAlert(alert);

      expect(result.success).toBe(true);
      expect(emailQueue.queueEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Budget Exceeded'),
        template: 'budget-exceeded-alert',
        data: expect.objectContaining({
          userName: 'John',
          budgetName: 'Monthly Budget',
          totalBudget: 1000,
          totalSpent: 1100,
          overAmount: 100
        })
      });
    });

    it('should send budget warning alert email', async () => {
      const alert = {
        type: 'budget-warning',
        user: mockUser,
        budget: mockBudget,
        data: {
          totalSpent: 850,
          totalBudget: 1000,
          utilizationPercentage: 85,
          remainingAmount: 150,
          daysRemaining: 10,
          avgDailyBudget: '15.00'
        }
      };

      const result = await budgetAlertService.sendBudgetAlert(alert);

      expect(result.success).toBe(true);
      expect(emailQueue.queueEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Budget Warning'),
        template: 'budget-warning-alert',
        data: expect.objectContaining({
          userName: 'John',
          budgetName: 'Monthly Budget',
          utilizationPercentage: 85,
          remainingAmount: 150,
          daysRemaining: 10
        })
      });
    });

    it('should send category alert email', async () => {
      const alert = {
        type: 'category-exceeded',
        user: mockUser,
        budget: mockBudget,
        category: {
          name: 'Food & Dining',
          allocatedAmount: 400,
          spentAmount: 450
        },
        data: {
          overAmount: 50,
          percentage: 112.5
        }
      };

      const result = await budgetAlertService.sendBudgetAlert(alert);

      expect(result.success).toBe(true);
      expect(emailQueue.queueEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: expect.stringContaining('Category Budget Exceeded'),
        template: 'category-budget-alert',
        data: expect.objectContaining({
          userName: 'John',
          categoryName: 'Food & Dining',
          categoryBudget: 400,
          categorySpent: 450,
          overAmount: 50
        })
      });
    });

    it('should handle email sending errors', async () => {
      emailQueue.queueEmail.mockResolvedValue({ success: false, error: 'Email service unavailable' });

      const alert = {
        type: 'budget-warning',
        user: mockUser,
        budget: mockBudget,
        data: mockBudgetPerformance
      };

      const result = await budgetAlertService.sendBudgetAlert(alert);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service unavailable');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send budget alert email')
      );
    });

    it('should throw error for unknown alert type', async () => {
      const alert = {
        type: 'unknown-type',
        user: mockUser,
        budget: mockBudget,
        data: {}
      };

      await expect(budgetAlertService.sendBudgetAlert(alert)).rejects.toThrow(
        'Unknown alert type: unknown-type'
      );
    });
  });

  describe('Utility Methods', () => {
    describe('hasRecentAlert', () => {
      beforeEach(() => {
        // Mock the AlertHistory model or similar tracking mechanism
        jest.spyOn(budgetAlertService, 'getRecentAlerts').mockResolvedValue([]);
      });

      it('should return false when no recent alerts exist', async () => {
        const hasRecent = await budgetAlertService.hasRecentAlert(
          mockUserId, mockBudgetId, 'budget-warning', 12
        );

        expect(hasRecent).toBe(false);
      });

      it('should return true when recent alert exists', async () => {
        const recentAlert = {
          userId: mockUserId,
          budgetId: mockBudgetId,
          type: 'budget-warning',
          sentAt: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
        };

        jest.spyOn(budgetAlertService, 'getRecentAlerts').mockResolvedValue([recentAlert]);

        const hasRecent = await budgetAlertService.hasRecentAlert(
          mockUserId, mockBudgetId, 'budget-warning', 12
        );

        expect(hasRecent).toBe(true);
      });
    });

    describe('calculateDaysRemaining', () => {
      it('should calculate days remaining in budget period', () => {
        const budget = {
          ...mockBudget,
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days from now
        };

        const daysRemaining = budgetAlertService.calculateDaysRemaining(budget);

        expect(daysRemaining).toBe(10);
      });

      it('should return 0 for expired budgets', () => {
        const budget = {
          ...mockBudget,
          endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        };

        const daysRemaining = budgetAlertService.calculateDaysRemaining(budget);

        expect(daysRemaining).toBe(0);
      });
    });

    describe('getCategoryBreakdown', () => {
      it('should return formatted category breakdown', async () => {
        const performance = {
          categoryPerformance: {
            'Food & Dining': { spent: 350, budget: 400, percentage: 87.5 },
            'Transportation': { spent: 280, budget: 300, percentage: 93.3 }
          }
        };

        const breakdown = await budgetAlertService.getCategoryBreakdown(mockBudget, performance);

        expect(breakdown).toEqual([
          {
            name: 'Transportation',
            spent: 280,
            budget: 300,
            percentage: 93.3,
            remaining: 20,
            status: 'warning'
          },
          {
            name: 'Food & Dining',
            spent: 350,
            budget: 400,
            percentage: 87.5,
            remaining: 50,
            status: 'warning'
          }
        ]);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      User.findById.mockRejectedValue(new Error('Database connection timeout'));

      const result = await budgetAlertService.checkAndSendBudgetAlerts(mockUserId, mockBudgetId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection timeout');
      expect(logger.error).toHaveBeenCalledWith(
        'Error in budget alert check:',
        expect.any(Error)
      );
    });

    it('should handle budget performance calculation errors', async () => {
      mockBudget.getBudgetPerformance.mockRejectedValue(new Error('Performance calculation failed'));

      const result = await budgetAlertService.checkAndSendBudgetAlerts(mockUserId, mockBudgetId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Performance calculation failed');
    });

    it('should handle email queue service errors', async () => {
      emailQueue.queueEmail.mockRejectedValue(new Error('Email queue is full'));

      jest.spyOn(budgetAlertService, 'checkOverallBudgetAlert').mockResolvedValue({
        type: 'budget-warning',
        user: mockUser,
        budget: mockBudget,
        data: mockBudgetPerformance
      });
      jest.spyOn(budgetAlertService, 'checkCategoryAlerts').mockResolvedValue([]);

      const result = await budgetAlertService.checkAndSendBudgetAlerts(mockUserId, mockBudgetId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email queue is full');
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent alert checks efficiently', async () => {
      const userIds = Array.from({ length: 10 }, (_, i) => `user-${i}`);
      const budgetIds = Array.from({ length: 10 }, (_, i) => `budget-${i}`);

      const promises = userIds.map((userId, index) =>
        budgetAlertService.checkAndSendBudgetAlerts(userId, budgetIds[index])
      );

      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should optimize alert checking for large numbers of categories', async () => {
      const largeBudget = {
        ...mockBudget,
        categoryAllocations: Array.from({ length: 50 }, (_, i) => ({
          category: {
            _id: `category-${i}`,
            name: `Category ${i}`,
            type: 'expense'
          },
          allocatedAmount: 100,
          spentAmount: 85
        }))
      };

      Budget.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(largeBudget)
      });

      const startTime = Date.now();
      await budgetAlertService.checkAndSendBudgetAlerts(mockUserId, mockBudgetId);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});
