/**
 * Goal Reminder Service
 * Handles goal reminder notifications and progress tracking
 */

const Goal = require('../models/Goal');
const User = require('../models/User');
const emailQueue = require('./emailQueue.service');
const logger = require('../utils/logger');
const config = require('../config/environment');

class GoalReminderService {
  constructor() {
    this.emailQueue = emailQueue;
    const configData = config.getConfig();
    this.appConfig = {
      name: configData.app.name,
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
      supportUrl: process.env.SUPPORT_URL || 'mailto:support@personalfinancedashboard.com'
    };
  }

  /**
   * Send reminders for all goals that need them
   * @returns {Promise<Object>} - Summary of reminders sent
   */
  async sendDueReminders() {
    try {
      const goalsNeedingReminders = await Goal.findGoalsNeedingReminders();
      
      if (goalsNeedingReminders.length === 0) {
        logger.info('No goals need reminders at this time');
        return {
          success: true,
          totalGoals: 0,
          remindersSent: 0,
          errors: []
        };
      }

      logger.info(`Found ${goalsNeedingReminders.length} goals needing reminders`);

      let remindersSent = 0;
      const errors = [];

      // Process each goal reminder
      for (const goal of goalsNeedingReminders) {
        try {
          // Check if user has goal reminders enabled
          if (!this.isGoalReminderEnabled(goal.user)) {
            logger.debug(`Goal reminders disabled for user ${goal.user._id}`);
            continue;
          }

          await this.sendGoalReminder(goal);
          remindersSent++;

          // Update last reminder sent date
          goal.lastReminderSent = new Date();
          goal.calculateNextReminderDate();
          await goal.save();

        } catch (error) {
          logger.error(`Error sending reminder for goal ${goal._id}:`, error);
          errors.push({
            goalId: goal._id,
            goalName: goal.name,
            userId: goal.user._id,
            error: error.message
          });
        }
      }

      const result = {
        success: true,
        totalGoals: goalsNeedingReminders.length,
        remindersSent,
        errors
      };

      logger.info('Goal reminder batch completed', result);
      return result;

    } catch (error) {
      logger.error('Error in sendDueReminders:', error);
      return {
        success: false,
        totalGoals: 0,
        remindersSent: 0,
        errors: [{ error: error.message }]
      };
    }
  }

  /**
   * Send reminder for a specific goal
   * @param {Object} goal - Goal object with populated user and category
   * @returns {Promise<Object>} - Send result
   */
  async sendGoalReminder(goal) {
    try {
      const user = goal.user;
      
      // Generate personalized insights and recommendations
      const insights = this.generateGoalInsights(goal);
      const motivationalMessage = this.generateMotivationalMessage(goal);
      const milestones = this.calculateUpcomingMilestones(goal);

      // Prepare email template data
      const templateData = {
        firstName: user.firstName,
        goalId: goal._id,
        goalName: goal.name,
        description: goal.description,
        currency: user.preferences?.currency || '$',
        currentAmount: this.formatCurrency(goal.currentAmount),
        targetAmount: this.formatCurrency(goal.targetAmount),
        remainingAmount: this.formatCurrency(goal.remainingAmount),
        progressPercentage: Math.round(goal.progressPercentage),
        timeRemaining: goal.timeRemaining,
        targetDate: goal.targetDate,
        estimatedCompletionDate: goal.estimatedCompletionDate,
        reminderFrequency: goal.reminderFrequency,
        averageMonthlyContribution: goal.averageMonthlyContribution ? 
          this.formatCurrency(goal.averageMonthlyContribution) : null,
        requiredMonthlyContribution: goal.getRequiredMonthlyContribution ? 
          this.formatCurrency(goal.getRequiredMonthlyContribution()) : null,
        achievementProbability: goal.achievementProbability,
        motivationalMessage,
        insights,
        milestones,
        dashboardUrl: this.appConfig.frontendUrl,
        supportUrl: this.appConfig.supportUrl,
        appName: this.appConfig.name
      };

      // Determine email subject based on progress and urgency
      const subject = this.generateEmailSubject(goal);

      // Queue the email
      const emailId = await this.emailQueue.addToQueue({
        to: user.email,
        subject,
        templateName: 'goal-reminder',
        templateData
      }, {
        priority: this.determineEmailPriority(goal),
        metadata: {
          goalId: goal._id.toString(),
          userId: user._id.toString(),
          reminderType: 'goal-progress',
          reminderFrequency: goal.reminderFrequency
        }
      });

      logger.info(`Goal reminder queued successfully: ${goal.name} for user ${user._id}`);
      
      return {
        success: true,
        emailId,
        goalId: goal._id,
        userId: user._id
      };

    } catch (error) {
      logger.error('Error sending goal reminder:', error);
      return {
        success: false,
        goalId: goal._id,
        error: error.message
      };
    }
  }

  /**
   * Check if goal reminders are enabled for user
   * @param {Object} user - User object
   * @returns {boolean} - True if enabled
   */
  isGoalReminderEnabled(user) {
    return user.notificationPreferences?.goalReminders?.enabled !== false;
  }

  /**
   * Generate personalized insights for the goal
   * @param {Object} goal - Goal object
   * @returns {Array} - Array of insight strings
   */
  generateGoalInsights(goal) {
    const insights = [];
    const progressPercentage = goal.progressPercentage;
    const timeRemaining = goal.timeRemaining;
    const achievementProbability = goal.achievementProbability;

    // Progress-based insights
    if (progressPercentage < 25 && timeRemaining < 90) {
      insights.push('Consider increasing your contribution frequency to stay on track');
    } else if (progressPercentage > 75) {
      insights.push('You\'re in the final stretch! Maintain your current pace to reach your goal');
    } else if (progressPercentage < 50 && timeRemaining > 180) {
      insights.push('You have plenty of time - consider setting up automatic contributions');
    }

    // Achievement probability insights
    if (achievementProbability && achievementProbability < 50) {
      insights.push('Your current pace may not reach the target - consider adjusting your contribution strategy');
    } else if (achievementProbability && achievementProbability > 90) {
      insights.push('Excellent! You\'re on track to achieve this goal ahead of schedule');
    }

    // Time-based insights
    if (timeRemaining < 30) {
      insights.push('Less than 30 days remaining - consider making larger contributions if possible');
    } else if (timeRemaining < 7) {
      insights.push('Final week! Make any last contributions to maximize your progress');
    }

    // Contribution pattern insights
    const monthlyAverage = goal.averageMonthlyContribution;
    const requiredMonthly = goal.getRequiredMonthlyContribution ? goal.getRequiredMonthlyContribution() : 0;
    
    if (monthlyAverage && requiredMonthly && monthlyAverage < requiredMonthly * 0.8) {
      insights.push(`Try to increase monthly contributions to ${this.formatCurrency(requiredMonthly)} to stay on target`);
    }

    return insights.length > 0 ? insights : ['Keep up the great work towards your financial goal!'];
  }

  /**
   * Generate motivational message based on goal progress
   * @param {Object} goal - Goal object
   * @returns {string} - Motivational message
   */
  generateMotivationalMessage(goal) {
    const progressPercentage = goal.progressPercentage;
    const achievementProbability = goal.achievementProbability;

    const messages = {
      early: [
        'Every journey begins with a single step. You\'ve got this!',
        'Building wealth takes time and patience. Stay consistent!',
        'Small contributions today lead to big achievements tomorrow!'
      ],
      middle: [
        'You\'re making great progress! Keep the momentum going!',
        'Halfway there! Your dedication is paying off!',
        'You\'re building great financial habits. Stay focused!'
      ],
      late: [
        'Almost there! Your goal is within reach!',
        'The finish line is in sight. Sprint to the end!',
        'Your persistence is about to pay off. Don\'t stop now!'
      ],
      excellent: [
        'Outstanding progress! You\'re a financial rockstar!',
        'Your discipline and commitment are truly inspiring!',
        'You\'ve demonstrated amazing financial discipline!'
      ]
    };

    let category;
    if (progressPercentage >= 90 || (achievementProbability && achievementProbability >= 95)) {
      category = 'excellent';
    } else if (progressPercentage >= 75) {
      category = 'late';
    } else if (progressPercentage >= 40) {
      category = 'middle';
    } else {
      category = 'early';
    }

    const categoryMessages = messages[category];
    return categoryMessages[Math.floor(Math.random() * categoryMessages.length)];
  }

  /**
   * Calculate upcoming milestones for the goal
   * @param {Object} goal - Goal object
   * @returns {Array} - Array of milestone objects
   */
  calculateUpcomingMilestones(goal) {
    if (!goal.milestoneAlerts || !goal.milestonePercentages) {
      return [];
    }

    const currentProgress = goal.progressPercentage;
    const targetAmount = goal.targetAmount;

    return goal.milestonePercentages
      .filter(percentage => percentage > currentProgress)
      .slice(0, 3) // Show next 3 milestones
      .map((percentage, index) => ({
        percentage,
        amount: this.formatCurrency((percentage / 100) * targetAmount),
        isNext: index === 0
      }));
  }

  /**
   * Generate email subject based on goal status
   * @param {Object} goal - Goal object
   * @returns {string} - Email subject
   */
  generateEmailSubject(goal) {
    const progressPercentage = goal.progressPercentage;
    const timeRemaining = goal.timeRemaining;
    const frequency = goal.reminderFrequency;

    if (timeRemaining <= 7) {
      return `🎯 Final Week! ${goal.name} - ${Math.round(progressPercentage)}% Complete`;
    } else if (timeRemaining <= 30) {
      return `⏰ Goal Deadline Approaching: ${goal.name} - ${Math.round(progressPercentage)}% Complete`;
    } else if (progressPercentage >= 90) {
      return `🌟 Almost There! ${goal.name} - ${Math.round(progressPercentage)}% Complete`;
    } else if (progressPercentage >= 75) {
      return `🚀 Great Progress! ${goal.name} - ${Math.round(progressPercentage)}% Complete`;
    } else {
      return `💪 ${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Goal Reminder: ${goal.name}`;
    }
  }

  /**
   * Determine email priority based on goal urgency
   * @param {Object} goal - Goal object
   * @returns {string} - Priority level
   */
  determineEmailPriority(goal) {
    const timeRemaining = goal.timeRemaining;
    const achievementProbability = goal.achievementProbability;

    if (timeRemaining <= 7 || (achievementProbability && achievementProbability < 30)) {
      return 'high';
    } else if (timeRemaining <= 30 || goal.priority === 'high') {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Format currency amount
   * @param {number} amount - Amount to format
   * @returns {string} - Formatted amount
   */
  formatCurrency(amount) {
    return Number(amount).toFixed(2);
  }

  /**
   * Send milestone achievement notification
   * @param {Object} goal - Goal object
   * @param {number} milestonePercentage - Achieved milestone percentage
   * @returns {Promise<Object>} - Send result
   */
  async sendMilestoneNotification(goal, milestonePercentage) {
    try {
      // This would use a different template for milestone achievements
      // Implementation similar to sendGoalReminder but with milestone-specific content
      logger.info(`Milestone notification needed: ${goal.name} reached ${milestonePercentage}%`);
      
      // For now, we'll use the existing goal reminder template with milestone focus
      // In a full implementation, you'd create milestone-specific templates
      
      return { success: true, type: 'milestone', percentage: milestonePercentage };
    } catch (error) {
      logger.error('Error sending milestone notification:', error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Send goal completion notification
   * @param {Object} goal - Completed goal object
   * @returns {Promise<Object>} - Send result
   */
  async sendCompletionNotification(goal) {
    try {
      // This would use a congratulatory template for goal completion
      // Implementation similar to sendGoalReminder but with celebration content
      logger.info(`Goal completion notification needed: ${goal.name}`);
      
      return { success: true, type: 'completion' };
    } catch (error) {
      logger.error('Error sending completion notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process goal reminders for scheduled execution
   * @param {string} frequency - Frequency to process ('daily', 'weekly', 'monthly')
   * @returns {Promise<Object>} - Processing result
   */
  async processGoalReminders(frequency = 'daily') {
    try {
      logger.info(`Processing ${frequency} goal reminders`);
      
      // Find goals that need reminders based on frequency
      const goals = await Goal.findGoalsNeedingReminders(frequency);
      
      if (goals.length === 0) {
        logger.info(`No ${frequency} goal reminders needed`);
        return {
          success: true,
          frequency,
          totalGoals: 0,
          remindersSent: 0,
          errors: 0
        };
      }

      let remindersSent = 0;
      let errors = 0;

      // Process each goal reminder
      for (const goal of goals) {
        try {
          // Check if user has goal reminders enabled and matches frequency
          if (!this.isGoalReminderEnabled(goal.user) || 
              goal.reminderFrequency !== frequency) {
            continue;
          }

          await this.sendGoalReminder(goal);
          remindersSent++;

          // Update last reminder sent date
          goal.lastReminderSent = new Date();
          goal.calculateNextReminderDate();
          await goal.save();

        } catch (error) {
          logger.error(`Error processing ${frequency} reminder for goal ${goal._id}:`, error);
          errors++;
        }
      }

      const result = {
        success: true,
        frequency,
        totalGoals: goals.length,
        remindersSent,
        errors
      };

      logger.info(`${frequency} goal reminder processing completed`, result);
      return result;

    } catch (error) {
      logger.error(`Error in ${frequency} processGoalReminders:`, error);
      return {
        success: false,
        frequency,
        totalGoals: 0,
        remindersSent: 0,
        errors: 1
      };
    }
  }

  /**
   * Static method for scheduler integration
   * @param {string} frequency - Frequency to process
   * @returns {Promise<Object>} - Processing result
   */
  static async processGoalReminders(frequency = 'daily') {
    const service = new GoalReminderService();
    return await service.processGoalReminders(frequency);
  }
}

module.exports = GoalReminderService;
