const cron = require('node-cron');
const BudgetAlertService = require('./budgetAlert.service');
const GoalReminderService = require('./goalReminder.service');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Scheduler Service
 * Handles automated background tasks including monthly budget summaries
 */
class SchedulerService {
  constructor() {
    this.budgetAlertService = new BudgetAlertService();
    this.goalReminderService = new GoalReminderService();
  }
  
  isInitialized = false;

  /**
   * Initialize scheduled tasks
   */
  initialize() {
    if (this.isInitialized) {
      logger.warn('Scheduler already initialized');
      return;
    }

    try {
      // Monthly budget summary - Run on the 1st of every month at 9:00 AM
      cron.schedule('0 9 1 * *', () => {
        this.sendMonthlyBudgetSummaries();
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      // Weekly budget check - Run every Monday at 8:00 AM
      cron.schedule('0 8 * * 1', () => {
        this.weeklyBudgetCheck();
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      // Daily budget violation check - Run every day at 6:00 PM
      cron.schedule('0 18 * * *', () => {
        this.dailyBudgetViolationCheck();
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      // Daily goal reminder check - Run every day at 10:00 AM
      cron.schedule('0 10 * * *', () => {
        this.processGoalReminders();
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      // Weekly goal reminder check - Run every Monday at 9:00 AM
      cron.schedule('0 9 * * 1', () => {
        this.processWeeklyGoalReminders();
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      // Monthly goal reminder check - Run on the 1st of every month at 10:00 AM
      cron.schedule('0 10 1 * *', () => {
        this.processMonthlyGoalReminders();
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      this.isInitialized = true;
      logger.info('Scheduler service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize scheduler service:', error);
      throw error;
    }
  }
  /**
   * Send monthly budget summaries to all users
   */
  async sendMonthlyBudgetSummaries() {
    const startTime = new Date();
    logger.info('Starting monthly budget summary task');

    try {
      const users = await User.find({ 
        isEmailVerified: true,
        'settings.budgetAlerts.enabled': true,
        'settings.budgetAlerts.monthlySummary': true
      }).select('_id email firstName lastName settings');

      let successCount = 0;
      let errorCount = 0;

      for (const user of users) {
        try {
          await this.budgetAlertService.sendMonthlyBudgetSummary(user._id);
          successCount++;
        } catch (error) {
          errorCount++;
          logger.error(`Failed to send monthly summary to user ${user._id}:`, error);
        }
      }

      const duration = new Date() - startTime;
      logger.info(`Monthly budget summary task completed in ${duration}ms. Success: ${successCount}, Errors: ${errorCount}`);
    } catch (error) {
      logger.error('Monthly budget summary task failed:', error);
    }
  }
  /**
   * Perform weekly budget check
   */
  async weeklyBudgetCheck() {
    const startTime = new Date();
    logger.info('Starting weekly budget check task');

    try {
      const users = await User.find({ 
        isEmailVerified: true,
        'settings.budgetAlerts.enabled': true,
        'settings.budgetAlerts.weeklyCheck': true
      }).select('_id email firstName lastName settings');

      let alertCount = 0;      for (const user of users) {
        try {
          const result = await this.budgetAlertService.checkAndSendBudgetAlerts(user._id);
          if (result.alertsSent > 0) {
            alertCount += result.alertsSent;
          }
        } catch (error) {
          logger.error(`Failed to check weekly budget for user ${user._id}:`, error);
        }
      }

      const duration = new Date() - startTime;
      logger.info(`Weekly budget check completed in ${duration}ms. Alerts sent: ${alertCount}`);
    } catch (error) {
      logger.error('Weekly budget check task failed:', error);
    }
  }
  /**
   * Perform daily budget violation check
   */
  async dailyBudgetViolationCheck() {
    const startTime = new Date();
    logger.info('Starting daily budget violation check task');

    try {
      const users = await User.find({ 
        isEmailVerified: true,
        'settings.budgetAlerts.enabled': true,
        'settings.budgetAlerts.dailyCheck': true
      }).select('_id email firstName lastName settings');

      let alertCount = 0;

      for (const user of users) {        try {
          const result = await this.budgetAlertService.checkAndSendBudgetAlerts(user._id);
          if (result.alertsSent > 0) {
            alertCount += result.alertsSent;
          }
        } catch (error) {
          logger.error(`Failed to check daily budget for user ${user._id}:`, error);
        }
      }

      const duration = new Date() - startTime;
      logger.info(`Daily budget violation check completed in ${duration}ms. Alerts sent: ${alertCount}`);
    } catch (error) {
      logger.error('Daily budget violation check task failed:', error);
    }
  }  /**
   * Stop all scheduled tasks
   */
  destroy() {
    try {
      cron.getTasks().forEach((task, name) => {
        task.destroy();
      });
      this.isInitialized = false;
      logger.info('Scheduler service stopped');
    } catch (error) {
      logger.error('Failed to stop scheduler service:', error);
    }
  }

  /**
   * Process daily goal reminders
   */
  async processGoalReminders() {
    const startTime = new Date();
    logger.info('Starting daily goal reminder processing');

    try {
      const result = await this.goalReminderService.processGoalReminders();
      
      const duration = new Date() - startTime;
      logger.info(`Daily goal reminder processing completed in ${duration}ms. Reminders sent: ${result.remindersSent}, Errors: ${result.errors}`);
    } catch (error) {
      logger.error('Daily goal reminder processing failed:', error);
    }
  }

  /**
   * Process weekly goal reminders
   */
  async processWeeklyGoalReminders() {
    const startTime = new Date();
    logger.info('Starting weekly goal reminder processing');

    try {
      const result = await this.goalReminderService.processGoalReminders('weekly');
      
      const duration = new Date() - startTime;
      logger.info(`Weekly goal reminder processing completed in ${duration}ms. Reminders sent: ${result.remindersSent}, Errors: ${result.errors}`);
    } catch (error) {
      logger.error('Weekly goal reminder processing failed:', error);
    }
  }

  /**
   * Process monthly goal reminders
   */
  async processMonthlyGoalReminders() {
    const startTime = new Date();
    logger.info('Starting monthly goal reminder processing');

    try {
      const result = await this.goalReminderService.processGoalReminders('monthly');
      
      const duration = new Date() - startTime;
      logger.info(`Monthly goal reminder processing completed in ${duration}ms. Reminders sent: ${result.remindersSent}, Errors: ${result.errors}`);
    } catch (error) {
      logger.error('Monthly goal reminder processing failed:', error);
    }
  }

  /**
   * Get status of all scheduled tasks
   */
  getStatus() {
    const tasks = [];
    cron.getTasks().forEach((task, name) => {
      tasks.push({
        name,
        running: task.running,
        scheduled: task.scheduled
      });
    });
    
    return {
      initialized: this.isInitialized,
      tasks
    };
  }
}

// Create singleton instance
const schedulerService = new SchedulerService();

module.exports = schedulerService;
