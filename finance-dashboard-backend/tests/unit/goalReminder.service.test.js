/**
 * Goal Reminder Service Unit Tests
 * Tests for goal reminder notifications and progress tracking
 */

const GoalReminderService = require('../../services/goalReminder.service');
const Goal = require('../../models/Goal');
const User = require('../../models/User');
const emailQueue = require('../../services/emailQueue.service');
const logger = require('../../utils/logger');
const config = require('../../config/environment');

// Mock dependencies
jest.mock('../../models/Goal');
jest.mock('../../models/User');
jest.mock('../../services/emailQueue.service');
jest.mock('../../utils/logger');
jest.mock('../../config/environment');

describe('GoalReminderService', () => {
  let goalReminderService;
  let mockConfig;
  let originalEnv;

  beforeAll(() => {
    // Store original environment variables
    originalEnv = {
      FRONTEND_URL: process.env.FRONTEND_URL,
      SUPPORT_URL: process.env.SUPPORT_URL
    };
  });

  afterAll(() => {
    // Restore original environment variables
    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Setup config mock
    mockConfig = {
      app: {
        name: 'Personal Finance Dashboard'
      }
    };
    config.getConfig = jest.fn().mockReturnValue(mockConfig);

    // Setup logger mocks
    logger.info = jest.fn();
    logger.debug = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Setup email queue mock
    emailQueue.addToQueue = jest.fn().mockResolvedValue('email123');

    // Create service instance
    goalReminderService = new GoalReminderService();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      // Act
      const service = new GoalReminderService();

      // Assert
      expect(service.emailQueue).toBe(emailQueue);
      expect(service.appConfig.name).toBe('Personal Finance Dashboard');
      expect(service.appConfig.frontendUrl).toBe('http://localhost:4200');
      expect(service.appConfig.supportUrl).toBe('mailto:support@personalfinancedashboard.com');
    });

    it('should use environment variables when available', () => {
      // Arrange
      process.env.FRONTEND_URL = 'https://myapp.com';
      process.env.SUPPORT_URL = 'https://support.myapp.com';

      // Act
      const service = new GoalReminderService();

      // Assert
      expect(service.appConfig.frontendUrl).toBe('https://myapp.com');
      expect(service.appConfig.supportUrl).toBe('https://support.myapp.com');
    });
  });

  describe('sendDueReminders', () => {
    it('should successfully send reminders for all due goals', async () => {
      // Arrange
      const mockGoals = [
        {
          _id: 'goal1',
          name: 'Emergency Fund',
          user: {
            _id: 'user1',
            notificationPreferences: { goalReminders: { enabled: true } }
          },
          lastReminderSent: new Date(),
          calculateNextReminderDate: jest.fn(),
          save: jest.fn().mockResolvedValue()
        },
        {
          _id: 'goal2',
          name: 'Vacation Fund',
          user: {
            _id: 'user2',
            notificationPreferences: { goalReminders: { enabled: true } }
          },
          lastReminderSent: new Date(),
          calculateNextReminderDate: jest.fn(),
          save: jest.fn().mockResolvedValue()
        }
      ];

      Goal.findGoalsNeedingReminders = jest.fn().mockResolvedValue(mockGoals);

      // Mock sendGoalReminder to succeed
      jest.spyOn(goalReminderService, 'sendGoalReminder').mockResolvedValue({
        success: true,
        emailId: 'email123'
      });

      // Act
      const result = await goalReminderService.sendDueReminders();

      // Assert
      expect(Goal.findGoalsNeedingReminders).toHaveBeenCalled();
      expect(goalReminderService.sendGoalReminder).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        success: true,
        totalGoals: 2,
        remindersSent: 2,
        errors: []
      });
      expect(mockGoals[0].save).toHaveBeenCalled();
      expect(mockGoals[1].save).toHaveBeenCalled();
    });

    it('should return early when no goals need reminders', async () => {
      // Arrange
      Goal.findGoalsNeedingReminders = jest.fn().mockResolvedValue([]);

      // Act
      const result = await goalReminderService.sendDueReminders();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('No goals need reminders at this time');
      expect(result).toEqual({
        success: true,
        totalGoals: 0,
        remindersSent: 0,
        errors: []
      });
    });

    it('should skip goals for users with reminders disabled', async () => {
      // Arrange
      const mockGoals = [
        {
          _id: 'goal1',
          name: 'Emergency Fund',
          user: {
            _id: 'user1',
            notificationPreferences: { goalReminders: { enabled: false } }
          }
        }
      ];

      Goal.findGoalsNeedingReminders = jest.fn().mockResolvedValue(mockGoals);

      // Act
      const result = await goalReminderService.sendDueReminders();

      // Assert
      expect(logger.debug).toHaveBeenCalledWith('Goal reminders disabled for user user1');
      expect(result.remindersSent).toBe(0);
    });

    it('should handle errors for individual goals and continue processing', async () => {
      // Arrange
      const mockGoals = [
        {
          _id: 'goal1',
          name: 'Emergency Fund',
          user: {
            _id: 'user1',
            notificationPreferences: { goalReminders: { enabled: true } }
          },
          lastReminderSent: new Date(),
          calculateNextReminderDate: jest.fn(),
          save: jest.fn().mockResolvedValue()
        },
        {
          _id: 'goal2',
          name: 'Vacation Fund',
          user: {
            _id: 'user2',
            notificationPreferences: { goalReminders: { enabled: true } }
          }
        }
      ];

      Goal.findGoalsNeedingReminders = jest.fn().mockResolvedValue(mockGoals);

      // Mock sendGoalReminder to succeed for first, fail for second
      jest.spyOn(goalReminderService, 'sendGoalReminder')
        .mockResolvedValueOnce({ success: true, emailId: 'email123' })
        .mockRejectedValueOnce(new Error('Email service unavailable'));

      // Act
      const result = await goalReminderService.sendDueReminders();

      // Assert
      expect(result.remindersSent).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        goalId: 'goal2',
        goalName: 'Vacation Fund',
        userId: 'user2',
        error: 'Email service unavailable'
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      Goal.findGoalsNeedingReminders = jest.fn().mockRejectedValue(dbError);

      // Act
      const result = await goalReminderService.sendDueReminders();

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Error in sendDueReminders:', dbError);
      expect(result).toEqual({
        success: false,
        totalGoals: 0,
        remindersSent: 0,
        errors: [{ error: 'Database connection failed' }]
      });
    });
  });

  describe('sendGoalReminder', () => {
    let mockGoal, mockUser;

    beforeEach(() => {
      mockUser = {
        _id: 'user123',
        firstName: 'John',
        email: 'john@example.com',
        preferences: { currency: '$' }
      };

      mockGoal = {
        _id: 'goal123',
        name: 'Emergency Fund',
        description: 'Save for emergencies',
        user: mockUser,
        currentAmount: 5000,
        targetAmount: 10000,
        remainingAmount: 5000,
        progressPercentage: 50,
        timeRemaining: 90,
        targetDate: new Date('2024-12-31'),
        estimatedCompletionDate: new Date('2024-11-30'),
        reminderFrequency: 'weekly',
        averageMonthlyContribution: 500,
        achievementProbability: 85,
        getRequiredMonthlyContribution: jest.fn().mockReturnValue(556)
      };
    });

    it('should successfully send goal reminder email', async () => {
      // Arrange
      jest.spyOn(goalReminderService, 'generateGoalInsights').mockReturnValue(['Great progress!']);
      jest.spyOn(goalReminderService, 'generateMotivationalMessage').mockReturnValue('Keep it up!');
      jest.spyOn(goalReminderService, 'calculateUpcomingMilestones').mockReturnValue([]);
      jest.spyOn(goalReminderService, 'generateEmailSubject').mockReturnValue('Goal Progress Update');
      jest.spyOn(goalReminderService, 'determineEmailPriority').mockReturnValue('medium');

      // Act
      const result = await goalReminderService.sendGoalReminder(mockGoal);

      // Assert
      expect(emailQueue.addToQueue).toHaveBeenCalledWith({
        to: 'john@example.com',
        subject: 'Goal Progress Update',
        templateName: 'goal-reminder',
        templateData: expect.objectContaining({
          firstName: 'John',
          goalName: 'Emergency Fund',
          progressPercentage: 50,
          motivationalMessage: 'Keep it up!',
          insights: ['Great progress!']
        })
      }, {
        priority: 'medium',
        metadata: expect.objectContaining({
          goalId: 'goal123',
          userId: 'user123',
          reminderType: 'goal-progress'
        })
      });

      expect(result).toEqual({
        success: true,
        emailId: 'email123',
        goalId: 'goal123',
        userId: 'user123'
      });
    });

    it('should handle missing user currency preference', async () => {
      // Arrange
      mockUser.preferences = undefined;

      // Act
      const result = await goalReminderService.sendGoalReminder(mockGoal);

      // Assert
      expect(emailQueue.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          templateData: expect.objectContaining({
            currency: '$'
          })
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });

    it('should handle email queue errors', async () => {
      // Arrange
      emailQueue.addToQueue = jest.fn().mockRejectedValue(new Error('Queue full'));

      // Act
      const result = await goalReminderService.sendGoalReminder(mockGoal);

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Error sending goal reminder:', expect.any(Error));
      expect(result).toEqual({
        success: false,
        goalId: 'goal123',
        error: 'Queue full'
      });
    });

    it('should handle missing goal methods gracefully', async () => {
      // Arrange
      delete mockGoal.getRequiredMonthlyContribution;

      // Act
      const result = await goalReminderService.sendGoalReminder(mockGoal);

      // Assert
      expect(emailQueue.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          templateData: expect.objectContaining({
            requiredMonthlyContribution: null
          })
        }),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
    });
  });

  describe('isGoalReminderEnabled', () => {
    it('should return true when goal reminders are explicitly enabled', () => {
      // Arrange
      const user = {
        notificationPreferences: {
          goalReminders: { enabled: true }
        }
      };

      // Act
      const result = goalReminderService.isGoalReminderEnabled(user);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true when goal reminders are not explicitly disabled (default)', () => {
      // Arrange
      const user = {
        notificationPreferences: {
          goalReminders: {}
        }
      };

      // Act
      const result = goalReminderService.isGoalReminderEnabled(user);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when goal reminders are explicitly disabled', () => {
      // Arrange
      const user = {
        notificationPreferences: {
          goalReminders: { enabled: false }
        }
      };

      // Act
      const result = goalReminderService.isGoalReminderEnabled(user);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when notification preferences are missing', () => {
      // Arrange
      const user = {};

      // Act
      const result = goalReminderService.isGoalReminderEnabled(user);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('generateGoalInsights', () => {
    it('should generate insights for low progress with short time remaining', () => {
      // Arrange
      const goal = {
        progressPercentage: 20,
        timeRemaining: 60,
        achievementProbability: 40
      };

      // Act
      const insights = goalReminderService.generateGoalInsights(goal);

      // Assert
      expect(insights).toContain('Consider increasing your contribution frequency to stay on track');
      expect(insights).toContain('Your current pace may not reach the target - consider adjusting your contribution strategy');
    });

    it('should generate insights for high progress', () => {
      // Arrange
      const goal = {
        progressPercentage: 85,
        timeRemaining: 30,
        achievementProbability: 95
      };

      // Act
      const insights = goalReminderService.generateGoalInsights(goal);

      // Assert
      expect(insights).toContain('You\'re in the final stretch! Maintain your current pace to reach your goal');
      expect(insights).toContain('Excellent! You\'re on track to achieve this goal ahead of schedule');
    });

    it('should generate time-based insights for urgent goals', () => {
      // Arrange
      const goal = {
        progressPercentage: 50,
        timeRemaining: 5,
        achievementProbability: 60
      };

      // Act
      const insights = goalReminderService.generateGoalInsights(goal);

      // Assert
      expect(insights).toContain('Final week! Make any last contributions to maximize your progress');
    });

    it('should generate contribution insights when behind pace', () => {
      // Arrange
      const goal = {
        progressPercentage: 50,
        timeRemaining: 180,
        achievementProbability: 75,
        averageMonthlyContribution: 400,
        getRequiredMonthlyContribution: jest.fn().mockReturnValue(600)
      };

      jest.spyOn(goalReminderService, 'formatCurrency').mockReturnValue('600.00');

      // Act
      const insights = goalReminderService.generateGoalInsights(goal);

      // Assert
      expect(insights).toContain('Try to increase monthly contributions to 600.00 to stay on target');
    });

    it('should return default message when no specific insights apply', () => {
      // Arrange
      const goal = {
        progressPercentage: 60,
        timeRemaining: 120,
        achievementProbability: 80
      };

      // Act
      const insights = goalReminderService.generateGoalInsights(goal);

      // Assert
      expect(insights).toEqual(['Keep up the great work towards your financial goal!']);
    });
  });

  describe('generateMotivationalMessage', () => {
    it('should generate early-stage message for low progress', () => {
      // Arrange
      const goal = {
        progressPercentage: 15,
        achievementProbability: 60
      };

      // Act
      const message = goalReminderService.generateMotivationalMessage(goal);

      // Assert
      expect(message).toMatch(/Every journey begins|Building wealth takes|Small contributions/);
    });

    it('should generate middle-stage message for moderate progress', () => {
      // Arrange
      const goal = {
        progressPercentage: 55,
        achievementProbability: 70
      };

      // Act
      const message = goalReminderService.generateMotivationalMessage(goal);

      // Assert
      expect(message).toMatch(/making great progress|Halfway there|building great financial/);
    });

    it('should generate late-stage message for high progress', () => {
      // Arrange
      const goal = {
        progressPercentage: 85,
        achievementProbability: 80
      };

      // Act
      const message = goalReminderService.generateMotivationalMessage(goal);

      // Assert
      expect(message).toMatch(/Almost there|finish line|persistence is about/);
    });

    it('should generate excellent message for outstanding progress', () => {
      // Arrange
      const goal = {
        progressPercentage: 95,
        achievementProbability: 98
      };

      // Act
      const message = goalReminderService.generateMotivationalMessage(goal);

      // Assert
      expect(message).toMatch(/Outstanding progress|discipline and commitment|amazing financial discipline/);
    });
  });

  describe('calculateUpcomingMilestones', () => {
    it('should return empty array when milestone alerts are disabled', () => {
      // Arrange
      const goal = {
        milestoneAlerts: false,
        progressPercentage: 30
      };

      // Act
      const milestones = goalReminderService.calculateUpcomingMilestones(goal);

      // Assert
      expect(milestones).toEqual([]);
    });

    it('should return upcoming milestones above current progress', () => {
      // Arrange
      const goal = {
        milestoneAlerts: true,
        milestonePercentages: [25, 50, 75, 90, 100],
        progressPercentage: 35,
        targetAmount: 10000
      };

      jest.spyOn(goalReminderService, 'formatCurrency')
        .mockReturnValueOnce('5000.00')
        .mockReturnValueOnce('7500.00')
        .mockReturnValueOnce('9000.00');

      // Act
      const milestones = goalReminderService.calculateUpcomingMilestones(goal);

      // Assert
      expect(milestones).toEqual([
        { percentage: 50, amount: '5000.00', isNext: true },
        { percentage: 75, amount: '7500.00', isNext: false },
        { percentage: 90, amount: '9000.00', isNext: false }
      ]);
    });

    it('should limit to next 3 milestones', () => {
      // Arrange
      const goal = {
        milestoneAlerts: true,
        milestonePercentages: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        progressPercentage: 5,
        targetAmount: 10000
      };

      // Act
      const milestones = goalReminderService.calculateUpcomingMilestones(goal);

      // Assert
      expect(milestones).toHaveLength(3);
      expect(milestones[0].percentage).toBe(10);
      expect(milestones[1].percentage).toBe(20);
      expect(milestones[2].percentage).toBe(30);
    });
  });

  describe('generateEmailSubject', () => {
    it('should generate final week subject for urgent goals', () => {
      // Arrange
      const goal = {
        name: 'Emergency Fund',
        progressPercentage: 75,
        timeRemaining: 5,
        reminderFrequency: 'daily'
      };

      // Act
      const subject = goalReminderService.generateEmailSubject(goal);

      // Assert
      expect(subject).toBe('🎯 Final Week! Emergency Fund - 75% Complete');
    });

    it('should generate approaching deadline subject', () => {
      // Arrange
      const goal = {
        name: 'Vacation Fund',
        progressPercentage: 60,
        timeRemaining: 20,
        reminderFrequency: 'weekly'
      };

      // Act
      const subject = goalReminderService.generateEmailSubject(goal);

      // Assert
      expect(subject).toBe('⏰ Goal Deadline Approaching: Vacation Fund - 60% Complete');
    });

    it('should generate almost there subject for high progress', () => {
      // Arrange
      const goal = {
        name: 'Car Fund',
        progressPercentage: 92,
        timeRemaining: 60,
        reminderFrequency: 'monthly'
      };

      // Act
      const subject = goalReminderService.generateEmailSubject(goal);

      // Assert
      expect(subject).toBe('🌟 Almost There! Car Fund - 92% Complete');
    });

    it('should generate great progress subject', () => {
      // Arrange
      const goal = {
        name: 'House Fund',
        progressPercentage: 80,
        timeRemaining: 120,
        reminderFrequency: 'weekly'
      };

      // Act
      const subject = goalReminderService.generateEmailSubject(goal);

      // Assert
      expect(subject).toBe('🚀 Great Progress! House Fund - 80% Complete');
    });

    it('should generate regular reminder subject', () => {
      // Arrange
      const goal = {
        name: 'Retirement Fund',
        progressPercentage: 45,
        timeRemaining: 200,
        reminderFrequency: 'monthly'
      };

      // Act
      const subject = goalReminderService.generateEmailSubject(goal);

      // Assert
      expect(subject).toBe('💪 Monthly Goal Reminder: Retirement Fund');
    });
  });

  describe('determineEmailPriority', () => {
    it('should return high priority for urgent goals', () => {
      // Arrange
      const goal = {
        timeRemaining: 5,
        achievementProbability: 70
      };

      // Act
      const priority = goalReminderService.determineEmailPriority(goal);

      // Assert
      expect(priority).toBe('high');
    });

    it('should return high priority for low achievement probability', () => {
      // Arrange
      const goal = {
        timeRemaining: 60,
        achievementProbability: 25
      };

      // Act
      const priority = goalReminderService.determineEmailPriority(goal);

      // Assert
      expect(priority).toBe('high');
    });

    it('should return medium priority for approaching deadlines', () => {
      // Arrange
      const goal = {
        timeRemaining: 25,
        achievementProbability: 80,
        priority: 'medium'
      };

      // Act
      const priority = goalReminderService.determineEmailPriority(goal);

      // Assert
      expect(priority).toBe('medium');
    });

    it('should return medium priority for high priority goals', () => {
      // Arrange
      const goal = {
        timeRemaining: 100,
        achievementProbability: 85,
        priority: 'high'
      };

      // Act
      const priority = goalReminderService.determineEmailPriority(goal);

      // Assert
      expect(priority).toBe('medium');
    });

    it('should return low priority for standard goals', () => {
      // Arrange
      const goal = {
        timeRemaining: 180,
        achievementProbability: 75,
        priority: 'low'
      };

      // Act
      const priority = goalReminderService.determineEmailPriority(goal);

      // Assert
      expect(priority).toBe('low');
    });
  });

  describe('formatCurrency', () => {
    it('should format whole numbers correctly', () => {
      // Act
      const formatted = goalReminderService.formatCurrency(1000);

      // Assert
      expect(formatted).toBe('1000.00');
    });

    it('should format decimal numbers correctly', () => {
      // Act
      const formatted = goalReminderService.formatCurrency(1234.567);

      // Assert
      expect(formatted).toBe('1234.57');
    });

    it('should handle zero correctly', () => {
      // Act
      const formatted = goalReminderService.formatCurrency(0);

      // Assert
      expect(formatted).toBe('0.00');
    });

    it('should handle negative numbers correctly', () => {
      // Act
      const formatted = goalReminderService.formatCurrency(-500.5);

      // Assert
      expect(formatted).toBe('-500.50');
    });
  });

  describe('sendMilestoneNotification', () => {
    it('should log milestone notification and return success', async () => {
      // Arrange
      const goal = {
        _id: 'goal123',
        name: 'Emergency Fund'
      };

      // Act
      const result = await goalReminderService.sendMilestoneNotification(goal, 50);

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Milestone notification needed: Emergency Fund reached 50%');
      expect(result).toEqual({
        success: true,
        type: 'milestone',
        percentage: 50
      });
    });

    it('should handle errors in milestone notification', async () => {
      // Arrange
      const goal = {
        _id: 'goal123',
        name: 'Emergency Fund'
      };

      // Force an error by making logger.info throw
      logger.info.mockImplementation(() => {
        throw new Error('Logging failed');
      });

      // Act
      const result = await goalReminderService.sendMilestoneNotification(goal, 75);

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Error sending milestone notification:', expect.any(Error));
      expect(result).toEqual({
        success: false,
        error: 'Logging failed'
      });
    });
  });

  describe('sendCompletionNotification', () => {
    it('should log completion notification and return success', async () => {
      // Arrange
      const goal = {
        _id: 'goal123',
        name: 'Emergency Fund'
      };

      // Act
      const result = await goalReminderService.sendCompletionNotification(goal);

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Goal completion notification needed: Emergency Fund');
      expect(result).toEqual({
        success: true,
        type: 'completion'
      });
    });

    it('should handle errors in completion notification', async () => {
      // Arrange
      const goal = {
        _id: 'goal123',
        name: 'Emergency Fund'
      };

      // Force an error by making logger.info throw
      logger.info.mockImplementation(() => {
        throw new Error('Logging failed');
      });

      // Act
      const result = await goalReminderService.sendCompletionNotification(goal);

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Error sending completion notification:', expect.any(Error));
      expect(result).toEqual({
        success: false,
        error: 'Logging failed'
      });
    });
  });

  describe('processGoalReminders', () => {
    it('should process weekly goal reminders successfully', async () => {
      // Arrange
      const mockGoals = [
        {
          _id: 'goal1',
          reminderFrequency: 'weekly',
          user: {
            _id: 'user1',
            notificationPreferences: { goalReminders: { enabled: true } }
          },
          lastReminderSent: new Date(),
          calculateNextReminderDate: jest.fn(),
          save: jest.fn().mockResolvedValue()
        }
      ];

      Goal.findGoalsNeedingReminders = jest.fn().mockResolvedValue(mockGoals);
      jest.spyOn(goalReminderService, 'sendGoalReminder').mockResolvedValue({
        success: true,
        emailId: 'email123'
      });

      // Act
      const result = await goalReminderService.processGoalReminders('weekly');

      // Assert
      expect(Goal.findGoalsNeedingReminders).toHaveBeenCalledWith('weekly');
      expect(result).toEqual({
        success: true,
        frequency: 'weekly',
        totalGoals: 1,
        remindersSent: 1,
        errors: 0
      });
    });

    it('should skip goals with different frequency', async () => {
      // Arrange
      const mockGoals = [
        {
          _id: 'goal1',
          reminderFrequency: 'monthly',
          user: {
            _id: 'user1',
            notificationPreferences: { goalReminders: { enabled: true } }
          }
        }
      ];

      Goal.findGoalsNeedingReminders = jest.fn().mockResolvedValue(mockGoals);

      // Act
      const result = await goalReminderService.processGoalReminders('weekly');

      // Assert
      expect(result.remindersSent).toBe(0);
    });

    it('should handle database errors in processing', async () => {
      // Arrange
      Goal.findGoalsNeedingReminders = jest.fn().mockRejectedValue(new Error('Database error'));

      // Act
      const result = await goalReminderService.processGoalReminders('daily');

      // Assert
      expect(result).toEqual({
        success: false,
        frequency: 'daily',
        totalGoals: 0,
        remindersSent: 0,
        errors: 1
      });
    });
  });

  describe('static processGoalReminders', () => {
    it('should create service instance and process reminders', async () => {
      // Arrange
      Goal.findGoalsNeedingReminders = jest.fn().mockResolvedValue([]);

      // Act
      const result = await GoalReminderService.processGoalReminders('monthly');

      // Assert
      expect(result).toEqual({
        success: true,
        frequency: 'monthly',
        totalGoals: 0,
        remindersSent: 0,
        errors: 0
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large number of goals efficiently', async () => {
      // Arrange
      const largeGoalSet = Array.from({ length: 100 }, (_, i) => ({
        _id: `goal${i}`,
        name: `Goal ${i}`,
        user: {
          _id: `user${i}`,
          notificationPreferences: { goalReminders: { enabled: true } }
        },
        lastReminderSent: new Date(),
        calculateNextReminderDate: jest.fn(),
        save: jest.fn().mockResolvedValue()
      }));

      Goal.findGoalsNeedingReminders = jest.fn().mockResolvedValue(largeGoalSet);
      jest.spyOn(goalReminderService, 'sendGoalReminder').mockResolvedValue({
        success: true,
        emailId: 'email123'
      });

      // Act
      const startTime = Date.now();
      const result = await goalReminderService.sendDueReminders();
      const endTime = Date.now();

      // Assert
      expect(result.remindersSent).toBe(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle rapid insight generation efficiently', () => {
      // Arrange
      const goal = {
        progressPercentage: 50,
        timeRemaining: 90,
        achievementProbability: 75
      };

      // Act
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        goalReminderService.generateGoalInsights(goal);
      }
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Edge Cases', () => {
    it('should handle goals with missing user data', async () => {
      // Arrange
      const incompleteGoal = {
        _id: 'goal123',
        name: 'Test Goal',
        user: null
      };

      // Act & Assert
      await expect(goalReminderService.sendGoalReminder(incompleteGoal))
        .rejects.toThrow();
    });

    it('should handle extremely large progress percentages', () => {
      // Arrange
      const goal = {
        progressPercentage: 150,
        timeRemaining: 30,
        achievementProbability: 100
      };

      // Act
      const insights = goalReminderService.generateGoalInsights(goal);

      // Assert
      expect(insights).toContain('You\'re in the final stretch! Maintain your current pace to reach your goal');
    });

    it('should handle negative time remaining', () => {
      // Arrange
      const goal = {
        name: 'Overdue Goal',
        progressPercentage: 60,
        timeRemaining: -5,
        reminderFrequency: 'daily'
      };

      // Act
      const subject = goalReminderService.generateEmailSubject(goal);

      // Assert
      expect(subject).toBe('🎯 Final Week! Overdue Goal - 60% Complete');
    });

    it('should handle null achievement probability', () => {
      // Arrange
      const goal = {
        progressPercentage: 50,
        timeRemaining: 90,
        achievementProbability: null
      };

      // Act
      const insights = goalReminderService.generateGoalInsights(goal);

      // Assert
      expect(insights).toHaveLength(1); // Should still return default message
    });

    it('should handle empty milestone percentages array', () => {
      // Arrange
      const goal = {
        milestoneAlerts: true,
        milestonePercentages: [],
        progressPercentage: 50,
        targetAmount: 10000
      };

      // Act
      const milestones = goalReminderService.calculateUpcomingMilestones(goal);

      // Assert
      expect(milestones).toEqual([]);
    });
  });
});
