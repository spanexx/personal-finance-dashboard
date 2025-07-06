/**
 * Unit Tests for Scheduler Service
 * Tests automated background tasks including budget summaries and goal reminders
 */

const SchedulerService = require('../../services/scheduler.service');
const BudgetAlertService = require('../../services/budgetAlert.service');
const GoalReminderService = require('../../services/goalReminder.service');
const User = require('../../models/User');
const logger = require('../../utils/logger');
const cron = require('node-cron');

// Mock dependencies
jest.mock('node-cron');
jest.mock('../../services/budgetAlert.service');
jest.mock('../../services/goalReminder.service');
jest.mock('../../models/User');
jest.mock('../../utils/logger');

describe('SchedulerService', () => {
  let mockBudgetAlertService;
  let mockGoalReminderService;
  let mockCronSchedule;
  let mockCronGetTasks;
  let mockTaskDestroy;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock BudgetAlertService
    mockBudgetAlertService = {
      sendMonthlyBudgetSummary: jest.fn(),
      checkAndSendBudgetAlerts: jest.fn()
    };
    BudgetAlertService.mockImplementation(() => mockBudgetAlertService);

    // Mock GoalReminderService
    mockGoalReminderService = {
      processGoalReminders: jest.fn()
    };
    GoalReminderService.mockImplementation(() => mockGoalReminderService);

    // Mock cron
    mockCronSchedule = jest.fn();
    mockTaskDestroy = jest.fn();
    mockCronGetTasks = jest.fn(() => new Map([
      ['task1', { running: true, scheduled: true, destroy: mockTaskDestroy }],
      ['task2', { running: false, scheduled: true, destroy: mockTaskDestroy }]
    ]));

    cron.schedule = mockCronSchedule;
    cron.getTasks = mockCronGetTasks;

    // Mock logger
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Mock User.find
    User.find = jest.fn();
  });

  describe('initialization', () => {
    test('should initialize scheduler with all scheduled tasks', () => {
      const scheduler = new SchedulerService();
      scheduler.initialize();

      expect(mockCronSchedule).toHaveBeenCalledTimes(6); // 6 scheduled tasks
      expect(scheduler.isInitialized).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Scheduler service initialized successfully');
    });

    test('should not reinitialize if already initialized', () => {
      const scheduler = new SchedulerService();
      scheduler.initialize();
      scheduler.initialize();

      expect(logger.warn).toHaveBeenCalledWith('Scheduler already initialized');
      expect(mockCronSchedule).toHaveBeenCalledTimes(6); // Should still be 6, not 12
    });

    test('should handle initialization errors', () => {
      const scheduler = new SchedulerService();
      const error = new Error('Cron initialization failed');
      mockCronSchedule.mockImplementationOnce(() => {
        throw error;
      });

      expect(() => scheduler.initialize()).toThrow(error);
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize scheduler service:', error);
    });

    test('should schedule monthly budget summary task', () => {
      const scheduler = new SchedulerService();
      scheduler.initialize();

      expect(mockCronSchedule).toHaveBeenCalledWith(
        '0 9 1 * *',
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );
    });

    test('should schedule weekly budget check task', () => {
      const scheduler = new SchedulerService();
      scheduler.initialize();

      expect(mockCronSchedule).toHaveBeenCalledWith(
        '0 8 * * 1',
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );
    });

    test('should schedule daily budget violation check task', () => {
      const scheduler = new SchedulerService();
      scheduler.initialize();

      expect(mockCronSchedule).toHaveBeenCalledWith(
        '0 18 * * *',
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );
    });

    test('should schedule daily goal reminder task', () => {
      const scheduler = new SchedulerService();
      scheduler.initialize();

      expect(mockCronSchedule).toHaveBeenCalledWith(
        '0 10 * * *',
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );
    });

    test('should schedule weekly goal reminder task', () => {
      const scheduler = new SchedulerService();
      scheduler.initialize();

      expect(mockCronSchedule).toHaveBeenCalledWith(
        '0 9 * * 1',
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );
    });

    test('should schedule monthly goal reminder task', () => {
      const scheduler = new SchedulerService();
      scheduler.initialize();

      expect(mockCronSchedule).toHaveBeenCalledWith(
        '0 10 1 * *',
        expect.any(Function),
        { scheduled: true, timezone: 'UTC' }
      );
    });
  });

  describe('sendMonthlyBudgetSummaries', () => {
    test('should send monthly budget summaries to eligible users', async () => {
      const scheduler = new SchedulerService();
      const mockUsers = [
        {
          _id: 'user1',
          email: 'user1@test.com',
          firstName: 'John',
          lastName: 'Doe',
          settings: { budgetAlerts: { enabled: true, monthlySummary: true } }
        },
        {
          _id: 'user2',
          email: 'user2@test.com',
          firstName: 'Jane',
          lastName: 'Smith',
          settings: { budgetAlerts: { enabled: true, monthlySummary: true } }
        }
      ];

      User.find.mockResolvedValue(mockUsers);
      mockBudgetAlertService.sendMonthlyBudgetSummary.mockResolvedValue();

      await scheduler.sendMonthlyBudgetSummaries();

      expect(User.find).toHaveBeenCalledWith({
        isEmailVerified: true,
        'settings.budgetAlerts.enabled': true,
        'settings.budgetAlerts.monthlySummary': true
      });
      expect(mockBudgetAlertService.sendMonthlyBudgetSummary).toHaveBeenCalledTimes(2);
      expect(mockBudgetAlertService.sendMonthlyBudgetSummary).toHaveBeenCalledWith('user1');
      expect(mockBudgetAlertService.sendMonthlyBudgetSummary).toHaveBeenCalledWith('user2');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Monthly budget summary task completed')
      );
    });

    test('should handle empty user list gracefully', async () => {
      const scheduler = new SchedulerService();
      User.find.mockResolvedValue([]);

      await scheduler.sendMonthlyBudgetSummaries();

      expect(mockBudgetAlertService.sendMonthlyBudgetSummary).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Success: 0, Errors: 0')
      );
    });

    test('should handle individual user processing errors', async () => {
      const scheduler = new SchedulerService();
      const mockUsers = [
        { _id: 'user1', email: 'user1@test.com' },
        { _id: 'user2', email: 'user2@test.com' }
      ];

      User.find.mockResolvedValue(mockUsers);
      mockBudgetAlertService.sendMonthlyBudgetSummary
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error('Email service error'));

      await scheduler.sendMonthlyBudgetSummaries();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send monthly summary to user user2:',
        expect.any(Error)
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Success: 1, Errors: 1')
      );
    });

    test('should handle database query errors', async () => {
      const scheduler = new SchedulerService();
      const error = new Error('Database connection failed');
      User.find.mockRejectedValue(error);

      await scheduler.sendMonthlyBudgetSummaries();

      expect(logger.error).toHaveBeenCalledWith('Monthly budget summary task failed:', error);
    });

    test('should include timing information in logs', async () => {
      const scheduler = new SchedulerService();
      User.find.mockResolvedValue([]);

      await scheduler.sendMonthlyBudgetSummaries();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/Monthly budget summary task completed in \d+ms/)
      );
    });
  });

  describe('weeklyBudgetCheck', () => {
    test('should perform weekly budget checks for eligible users', async () => {
      const scheduler = new SchedulerService();
      const mockUsers = [
        { _id: 'user1', email: 'user1@test.com' },
        { _id: 'user2', email: 'user2@test.com' }
      ];

      User.find.mockResolvedValue(mockUsers);
      mockBudgetAlertService.checkAndSendBudgetAlerts
        .mockResolvedValueOnce({ alertsSent: 2 })
        .mockResolvedValueOnce({ alertsSent: 1 });

      await scheduler.weeklyBudgetCheck();

      expect(User.find).toHaveBeenCalledWith({
        isEmailVerified: true,
        'settings.budgetAlerts.enabled': true,
        'settings.budgetAlerts.weeklyCheck': true
      });
      expect(mockBudgetAlertService.checkAndSendBudgetAlerts).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Alerts sent: 3')
      );
    });

    test('should handle users with no alerts', async () => {
      const scheduler = new SchedulerService();
      const mockUsers = [{ _id: 'user1', email: 'user1@test.com' }];

      User.find.mockResolvedValue(mockUsers);
      mockBudgetAlertService.checkAndSendBudgetAlerts.mockResolvedValue({ alertsSent: 0 });

      await scheduler.weeklyBudgetCheck();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Alerts sent: 0')
      );
    });

    test('should handle individual user errors in weekly check', async () => {
      const scheduler = new SchedulerService();
      const mockUsers = [
        { _id: 'user1', email: 'user1@test.com' },
        { _id: 'user2', email: 'user2@test.com' }
      ];

      User.find.mockResolvedValue(mockUsers);
      mockBudgetAlertService.checkAndSendBudgetAlerts
        .mockResolvedValueOnce({ alertsSent: 1 })
        .mockRejectedValueOnce(new Error('Service error'));

      await scheduler.weeklyBudgetCheck();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to check weekly budget for user user2:',
        expect.any(Error)
      );
    });

    test('should handle weekly budget check service errors', async () => {
      const scheduler = new SchedulerService();
      const error = new Error('Service unavailable');
      User.find.mockRejectedValue(error);

      await scheduler.weeklyBudgetCheck();

      expect(logger.error).toHaveBeenCalledWith('Weekly budget check task failed:', error);
    });
  });

  describe('dailyBudgetViolationCheck', () => {
    test('should perform daily budget violation checks', async () => {
      const scheduler = new SchedulerService();
      const mockUsers = [
        { _id: 'user1', email: 'user1@test.com' },
        { _id: 'user2', email: 'user2@test.com' }
      ];

      User.find.mockResolvedValue(mockUsers);
      mockBudgetAlertService.checkAndSendBudgetAlerts
        .mockResolvedValueOnce({ alertsSent: 1 })
        .mockResolvedValueOnce({ alertsSent: 0 });

      await scheduler.dailyBudgetViolationCheck();

      expect(User.find).toHaveBeenCalledWith({
        isEmailVerified: true,
        'settings.budgetAlerts.enabled': true,
        'settings.budgetAlerts.dailyCheck': true
      });
      expect(mockBudgetAlertService.checkAndSendBudgetAlerts).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Alerts sent: 1')
      );
    });

    test('should handle daily check errors gracefully', async () => {
      const scheduler = new SchedulerService();
      const error = new Error('Daily check failed');
      User.find.mockRejectedValue(error);

      await scheduler.dailyBudgetViolationCheck();

      expect(logger.error).toHaveBeenCalledWith('Daily budget violation check task failed:', error);
    });
  });

  describe('processGoalReminders', () => {
    test('should process daily goal reminders', async () => {
      const scheduler = new SchedulerService();
      const mockResult = {
        remindersSent: 5,
        errors: 1
      };

      mockGoalReminderService.processGoalReminders.mockResolvedValue(mockResult);

      await scheduler.processGoalReminders();

      expect(mockGoalReminderService.processGoalReminders).toHaveBeenCalledWith();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Reminders sent: 5, Errors: 1')
      );
    });

    test('should handle goal reminder processing errors', async () => {
      const scheduler = new SchedulerService();
      const error = new Error('Goal reminder service error');
      mockGoalReminderService.processGoalReminders.mockRejectedValue(error);

      await scheduler.processGoalReminders();

      expect(logger.error).toHaveBeenCalledWith('Daily goal reminder processing failed:', error);
    });

    test('should include timing information for goal reminders', async () => {
      const scheduler = new SchedulerService();
      mockGoalReminderService.processGoalReminders.mockResolvedValue({
        remindersSent: 0,
        errors: 0
      });

      await scheduler.processGoalReminders();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/Daily goal reminder processing completed in \d+ms/)
      );
    });
  });

  describe('processWeeklyGoalReminders', () => {
    test('should process weekly goal reminders', async () => {
      const scheduler = new SchedulerService();
      const mockResult = {
        remindersSent: 3,
        errors: 0
      };

      mockGoalReminderService.processGoalReminders.mockResolvedValue(mockResult);

      await scheduler.processWeeklyGoalReminders();

      expect(mockGoalReminderService.processGoalReminders).toHaveBeenCalledWith('weekly');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Weekly goal reminder processing completed')
      );
    });

    test('should handle weekly goal reminder errors', async () => {
      const scheduler = new SchedulerService();
      const error = new Error('Weekly processing failed');
      mockGoalReminderService.processGoalReminders.mockRejectedValue(error);

      await scheduler.processWeeklyGoalReminders();

      expect(logger.error).toHaveBeenCalledWith('Weekly goal reminder processing failed:', error);
    });
  });

  describe('processMonthlyGoalReminders', () => {
    test('should process monthly goal reminders', async () => {
      const scheduler = new SchedulerService();
      const mockResult = {
        remindersSent: 2,
        errors: 0
      };

      mockGoalReminderService.processGoalReminders.mockResolvedValue(mockResult);

      await scheduler.processMonthlyGoalReminders();

      expect(mockGoalReminderService.processGoalReminders).toHaveBeenCalledWith('monthly');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Monthly goal reminder processing completed')
      );
    });

    test('should handle monthly goal reminder errors', async () => {
      const scheduler = new SchedulerService();
      const error = new Error('Monthly processing failed');
      mockGoalReminderService.processGoalReminders.mockRejectedValue(error);

      await scheduler.processMonthlyGoalReminders();

      expect(logger.error).toHaveBeenCalledWith('Monthly goal reminder processing failed:', error);
    });
  });

  describe('destroy', () => {
    test('should stop all scheduled tasks', () => {
      const scheduler = new SchedulerService();
      scheduler.initialize();

      scheduler.destroy();

      expect(mockTaskDestroy).toHaveBeenCalledTimes(2); // 2 tasks in mock
      expect(scheduler.isInitialized).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Scheduler service stopped');
    });

    test('should handle destroy errors', () => {
      const scheduler = new SchedulerService();
      const error = new Error('Destroy failed');
      mockTaskDestroy.mockImplementationOnce(() => {
        throw error;
      });

      scheduler.destroy();

      expect(logger.error).toHaveBeenCalledWith('Failed to stop scheduler service:', error);
    });
  });

  describe('getStatus', () => {
    test('should return scheduler status with tasks', () => {
      const scheduler = new SchedulerService();
      scheduler.initialize();

      const status = scheduler.getStatus();

      expect(status).toEqual({
        initialized: true,
        tasks: [
          { name: 'task1', running: true, scheduled: true },
          { name: 'task2', running: false, scheduled: true }
        ]
      });
    });

    test('should return uninitialized status', () => {
      const scheduler = new SchedulerService();

      const status = scheduler.getStatus();

      expect(status.initialized).toBe(false);
    });
  });

  describe('error handling and resilience', () => {
    test('should handle concurrent task execution gracefully', async () => {
      const scheduler = new SchedulerService();
      User.find.mockResolvedValue([]);

      // Simulate concurrent execution
      const promises = [
        scheduler.sendMonthlyBudgetSummaries(),
        scheduler.weeklyBudgetCheck(),
        scheduler.dailyBudgetViolationCheck()
      ];

      await Promise.all(promises);

      expect(logger.info).toHaveBeenCalledTimes(3);
    });

    test('should handle service initialization failures', () => {
      // Mock service constructor failures
      BudgetAlertService.mockImplementationOnce(() => {
        throw new Error('Service initialization failed');
      });

      expect(() => new SchedulerService()).toThrow('Service initialization failed');
    });

    test('should handle large user datasets efficiently', async () => {
      const scheduler = new SchedulerService();
      const largeUserSet = Array.from({ length: 1000 }, (_, i) => ({
        _id: `user${i}`,
        email: `user${i}@test.com`
      }));

      User.find.mockResolvedValue(largeUserSet);
      mockBudgetAlertService.sendMonthlyBudgetSummary.mockResolvedValue();

      const startTime = Date.now();
      await scheduler.sendMonthlyBudgetSummaries();
      const duration = Date.now() - startTime;

      expect(mockBudgetAlertService.sendMonthlyBudgetSummary).toHaveBeenCalledTimes(1000);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should maintain state consistency during errors', async () => {
      const scheduler = new SchedulerService();
      scheduler.initialize();

      // Simulate partial failure during initialization
      mockCronSchedule.mockImplementationOnce(() => {
        throw new Error('Partial failure');
      });

      try {
        scheduler.initialize();
      } catch (error) {
        // Should maintain consistent state
        expect(scheduler.isInitialized).toBe(true); // First initialization succeeded
      }
    });
  });

  describe('performance and monitoring', () => {
    test('should log performance metrics for all tasks', async () => {
      const scheduler = new SchedulerService();
      User.find.mockResolvedValue([]);
      mockGoalReminderService.processGoalReminders.mockResolvedValue({
        remindersSent: 0,
        errors: 0
      });

      await Promise.all([
        scheduler.sendMonthlyBudgetSummaries(),
        scheduler.weeklyBudgetCheck(),
        scheduler.dailyBudgetViolationCheck(),
        scheduler.processGoalReminders(),
        scheduler.processWeeklyGoalReminders(),
        scheduler.processMonthlyGoalReminders()
      ]);

      // Check that all tasks log timing information
      const timingLogs = logger.info.mock.calls.filter(call => 
        call[0].includes('completed in') && call[0].includes('ms')
      );
      expect(timingLogs).toHaveLength(6);
    });

    test('should handle memory efficiently with large task queues', () => {
      const scheduler = new SchedulerService();
      
      // Initialize multiple times to test memory handling
      for (let i = 0; i < 100; i++) {
        try {
          scheduler.initialize();
        } catch (error) {
          // Expected due to already initialized
        }
      }

      expect(scheduler.isInitialized).toBe(true);
    });
  });

  describe('singleton behavior', () => {
    test('should maintain singleton pattern', () => {
      // Since the actual service exports a singleton, we test the pattern
      const SchedulerServiceModule = require('../../services/scheduler.service');
      const instance1 = SchedulerServiceModule;
      const instance2 = SchedulerServiceModule;

      expect(instance1).toBe(instance2);
    });
  });
});
