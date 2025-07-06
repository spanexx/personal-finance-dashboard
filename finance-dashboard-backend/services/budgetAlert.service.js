/**
 * Budget Alert Service
 * Handles budget-related alerts and notifications for the Personal Finance Dashboard
 * Integrates with EmailQueue service and checks user preferences
 */

const emailQueue = require('./emailQueue.service');
const Budget = require('../models/Budget');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');
const config = require('../config/environment');

class BudgetAlertService {
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
   * Check and send budget alerts for a specific user and budget
   * @param {string} userId - User ID
   * @param {string} budgetId - Budget ID
   * @param {Object} transaction - Transaction that triggered the check (optional)
   * @returns {Promise<Object>} - Alert results
   */
  async checkAndSendBudgetAlerts(userId, budgetId, transaction = null) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        logger.error(`User not found for budget alert check: ${userId}`);
        return { success: false, error: 'User not found' };
      }

      // Check if user has budget alerts enabled
      if (!user.notificationPreferences?.budgetAlerts?.enabled) {
        logger.debug(`Budget alerts disabled for user: ${userId}`);
        return { success: true, message: 'Budget alerts disabled for user' };
      }

      const budget = await Budget.findById(budgetId).populate('categoryAllocations.category');
      if (!budget) {
        logger.error(`Budget not found: ${budgetId}`);
        return { success: false, error: 'Budget not found' };
      }

      const alertsToSend = [];
      const budgetPerformance = await budget.getBudgetPerformance();
      const violations = await budget.checkBudgetViolations();

      // Check overall budget status
      const overallAlert = await this.checkOverallBudgetAlert(user, budget, budgetPerformance, violations);
      if (overallAlert) {
        alertsToSend.push(overallAlert);
      }

      // Check category-specific alerts
      const categoryAlerts = await this.checkCategoryAlerts(user, budget, budgetPerformance, violations);
      alertsToSend.push(...categoryAlerts);

      // Send alerts
      const results = [];
      for (const alert of alertsToSend) {
        const result = await this.sendBudgetAlert(alert);
        results.push(result);
      }

      logger.info(`Budget alert check completed for user ${userId}, budget ${budgetId}. Sent ${results.length} alerts.`);

      return {
        success: true,
        alertsSent: results.length,
        results
      };

    } catch (error) {
      logger.error('Error in budget alert check:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if overall budget alert should be sent
   * @param {Object} user - User object
   * @param {Object} budget - Budget object
   * @param {Object} performance - Budget performance data
   * @param {Object} violations - Budget violations data
   * @returns {Promise<Object|null>} - Alert object or null
   */
  async checkOverallBudgetAlert(user, budget, performance, violations) {
    const { totalSpent, totalBudget, utilizationPercentage } = performance;
    
    // Check if budget is exceeded
    if (violations.isOverBudget) {
      // Check if we've already sent an exceeded alert recently
      const recentExceededAlert = await this.hasRecentAlert(
        user._id, 
        budget._id, 
        'budget-exceeded', 
        24 // Don't send exceeded alerts more than once per day
      );

      if (!recentExceededAlert) {
        return {
          type: 'budget-exceeded',
          user,
          budget,
          data: {
            ...performance,
            overAmount: totalSpent - totalBudget,
            categoryBreakdown: await this.getCategoryBreakdown(budget, performance)
          }
        };
      }
    }

    // Check if budget warning threshold is reached
    const alertThreshold = budget.alertThreshold || 80;
    if (utilizationPercentage >= alertThreshold && utilizationPercentage < 100) {
      // Check if we've already sent a warning alert recently
      const recentWarningAlert = await this.hasRecentAlert(
        user._id, 
        budget._id, 
        'budget-warning', 
        12 // Don't send warning alerts more than twice per day
      );

      if (!recentWarningAlert) {
        const remainingAmount = totalBudget - totalSpent;
        const daysRemaining = this.calculateDaysRemaining(budget);
        
        return {
          type: 'budget-warning',
          user,
          budget,
          data: {
            ...performance,
            remainingAmount,
            alertThreshold,
            daysRemaining,
            avgDailyBudget: daysRemaining > 0 ? (remainingAmount / daysRemaining).toFixed(2) : 0,
            categoryBreakdown: await this.getCategoryBreakdown(budget, performance)
          }
        };
      }
    }

    return null;
  }

  /**
   * Check category-specific alerts
   * @param {Object} user - User object
   * @param {Object} budget - Budget object
   * @param {Object} performance - Budget performance data
   * @param {Object} violations - Budget violations data
   * @returns {Promise<Array>} - Array of category alert objects
   */
  async checkCategoryAlerts(user, budget, performance, violations) {
    const alerts = [];

    for (const violation of violations) {
      if (violation.type === 'category_exceeded' || violation.type === 'category_warning') {
        const categoryId = violation.category;
        const category = budget.categoryAllocations.find(alloc => alloc.category._id.toString() === categoryId.toString())?.category;

        if (!category) {
          logger.warn(`Category ${categoryId} not found in budget allocations for violation.`);
          continue;
        }

        // Check if we've already sent a category alert recently
        const recentCategoryAlert = await this.hasRecentAlert(
          user._id,
          budget._id,
          'category-overspend',
          12, // Don't send category alerts more than twice per day
          category._id
        );

        if (!recentCategoryAlert) {
          // Get recent transactions for this category
          const recentTransactions = await this.getRecentCategoryTransactions(
            user._id,
            category._id,
            budget.startDate
          );

          alerts.push({
            type: 'category-overspend',
            user,
            budget,
            category,
            data: {
              categoryName: category.name,
              categoryId: category._id,
              categoryColor: category.color,
              categoryIcon: category.icon,
              categoryBudget: violation.allocated,
              categorySpent: violation.spent,
              overAmount: violation.spent - violation.allocated,
              utilizationPercentage: ((violation.spent / violation.allocated) * 100).toFixed(1),
              budgetPeriod: this.formatBudgetPeriod(budget),
              startDate: this.formatDate(budget.startDate),
              endDate: this.formatDate(budget.endDate),
              recentTransactions: recentTransactions.slice(0, 5) // Show only last 5 transactions
            }
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Send a budget alert via email queue
   * @param {Object} alert - Alert object
   * @returns {Promise<Object>} - Send result
   */
  async sendBudgetAlert(alert) {
    try {
      const { type, user, budget, category, data } = alert;
      
      // Prepare email template data
      const templateData = {
        firstName: user.firstName,
        currency: user.preferences?.currency || '$',
        budgetName: budget.name,
        budgetId: budget._id,
        budgetPeriod: this.formatBudgetPeriod(budget),
        startDate: this.formatDate(budget.startDate),
        endDate: this.formatDate(budget.endDate),
        dashboardUrl: this.appConfig.frontendUrl,
        supportUrl: this.appConfig.supportUrl,
        appName: this.appConfig.name,
        ...data
      };

      // Determine email subject
      const subjects = {
        'budget-exceeded': `🚨 Budget Exceeded Alert - ${budget.name}`,
        'budget-warning': `⚠️ Budget Warning Alert - ${budget.name}`,
        'category-overspend': `📊 Category Overspend Alert - ${data.categoryName}`
      };      // Queue the email
      const emailId = await this.emailQueue.addToQueue({
        to: user.email,
        subject: subjects[type],
        templateName: type,
        templateData
      }, {
        priority: type === 'budget-exceeded' ? 'high' : 'medium',
        metadata: {
          alertType: type,
          budgetId: budget._id.toString(),
          categoryId: category?._id?.toString(),
          userId: user._id.toString()
        }
      });

      // Log the alert
      await this.logAlert(user._id, budget._id, type, category?._id);

      logger.info(`Budget alert queued successfully: ${type} for user ${user._id}`);      return {
        success: true,
        type,
        emailId
      };

    } catch (error) {
      logger.error('Error sending budget alert:', error);
      return {
        success: false,
        type: alert.type,
        error: error.message
      };
    }
  }

  /**
   * Send monthly budget summary
   * @param {string} userId - User ID
   * @param {Date} month - Month to summarize (defaults to previous month)
   * @returns {Promise<Object>} - Send result
   */  async sendMonthlyBudgetSummary(userId, month = null) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.notificationPreferences?.budgetAlerts?.monthlyEnabled) {
        return { success: false, message: 'Monthly summaries disabled for user' };
      }

      // Default to previous month if not specified
      if (!month) {
        month = new Date();
        month.setMonth(month.getMonth() - 1);
      }

      const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
      const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      // Find budget for the month
      const budget = await Budget.findOne({
        user: userId,
        startDate: { $lte: endDate },
        endDate: { $gte: startDate }
      }).populate('categoryAllocations.category');

      if (!budget) {
        logger.info(`No budget found for user ${userId} for month ${month.toISOString()}`);
        return { success: false, message: 'No budget found for specified month' };
      }

      const performance = await budget.getBudgetPerformance();
      const categoryBreakdown = await this.getCategoryBreakdownForSummary(budget, performance);
      const insights = await this.generateBudgetInsights(budget, performance, categoryBreakdown);

      const templateData = {
        firstName: user.firstName,
        currency: user.preferences?.currency || '$',
        monthYear: month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        totalSpent: performance.totalSpent.toFixed(2),
        totalBudget: performance.totalBudget.toFixed(2),
        utilizationPercentage: performance.utilizationPercentage.toFixed(1),
        overallPerformance: {
          isPositive: !performance.isOverBudget
        },
        remainingBudget: Math.max(0, performance.totalBudget - performance.totalSpent).toFixed(2),
        overBudget: Math.max(0, performance.totalSpent - performance.totalBudget).toFixed(2),
        categoriesOnTrack: categoryBreakdown.filter(cat => !cat.isOverBudget).length,
        totalCategories: categoryBreakdown.length,
        avgDailySpending: (performance.totalSpent / new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate()).toFixed(2),
        savingsRate: this.calculateSavingsRate(user, performance),
        categoryBreakdown,
        insights,
        dashboardUrl: this.appConfig.frontendUrl,
        supportUrl: this.appConfig.supportUrl,
        appName: this.appConfig.name
      };      const emailId = await this.emailQueue.addToQueue({
        to: user.email,
        subject: `📊 Monthly Budget Summary - ${templateData.monthYear}`,
        templateName: 'monthly-budget-summary',
        templateData
      }, {
        priority: 'low',
        metadata: {
          alertType: 'monthly-summary',
          budgetId: budget._id.toString(),
          month: month.toISOString(),
          userId: user._id.toString()
        }
      });

      logger.info(`Monthly budget summary queued for user ${userId}`);      return {
        success: true,
        emailId
      };

    } catch (error) {
      logger.error('Error sending monthly budget summary:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user has received a recent alert
   * @param {string} userId - User ID
   * @param {string} budgetId - Budget ID
   * @param {string} alertType - Alert type
   * @param {number} hoursBack - Hours to look back
   * @param {string} categoryId - Category ID (optional)
   * @returns {Promise<boolean>} - True if recent alert exists
   */
  async hasRecentAlert(userId, budgetId, alertType, hoursBack, categoryId = null) {
    // This would ideally check a dedicated alerts/notifications log table
    // For now, we'll implement a simple in-memory cache or database query
    // In a production environment, you'd want to store alert history in the database
    
    try {
      // Check the email queue for recent similar emails
      const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
      
      // This is a simplified check - in production you'd have a proper alerts log table
      const recentEmails = await this.emailQueue.getRecentEmails(userId, cutoffTime, {
        alertType,
        budgetId,
        ...(categoryId && { categoryId })
      });

      return recentEmails.length > 0;
    } catch (error) {
      logger.error('Error checking recent alerts:', error);
      return false; // If we can't check, allow the alert to be sent
    }
  }

  /**
   * Log alert to prevent duplicate alerts
   * @param {string} userId - User ID
   * @param {string} budgetId - Budget ID
   * @param {string} alertType - Alert type
   * @param {string} categoryId - Category ID (optional)
   */
  async logAlert(userId, budgetId, alertType, categoryId = null) {
    // In a production environment, you'd store this in a dedicated alerts log table
    // For now, we'll rely on the email queue metadata for tracking
    logger.info(`Budget alert logged: ${alertType} for user ${userId}, budget ${budgetId}${categoryId ? `, category ${categoryId}` : ''}`);
  }

  /**
   * Get category breakdown for email templates
   * @param {Object} budget - Budget object
   * @param {Object} performance - Budget performance data
   * @returns {Promise<Array>} - Category breakdown array
   */
  async getCategoryBreakdown(budget, performance) {
    const breakdown = [];
    
    for (const allocation of budget.categoryAllocations) {
      const spent = performance.categorySpending?.[allocation.category._id] || 0;
      const percentage = allocation.allocated > 0 ? ((spent / allocation.allocated) * 100) : 0;
      
      breakdown.push({
        name: allocation.category.name,
        allocated: allocation.allocated.toFixed(2),
        spent: spent.toFixed(2),
        percentage: percentage.toFixed(1),
        isOverBudget: spent > allocation.allocated,
        isNearLimit: percentage >= 80 && percentage < 100,
        overAmount: Math.max(0, spent - allocation.allocated).toFixed(2)
      });
    }

    return breakdown.sort((a, b) => parseFloat(b.spent) - parseFloat(a.spent));
  }

  /**
   * Get enhanced category breakdown for monthly summary
   * @param {Object} budget - Budget object
   * @param {Object} performance - Budget performance data
   * @returns {Promise<Array>} - Enhanced category breakdown array
   */
  async getCategoryBreakdownForSummary(budget, performance) {
    const breakdown = [];
    
    for (const allocation of budget.categoryAllocations) {
      const spent = performance.categorySpending?.[allocation.category._id] || 0;
      const percentage = allocation.allocated > 0 ? ((spent / allocation.allocated) * 100) : 0;
      
      breakdown.push({
        name: allocation.category.name,
        color: allocation.category.color,
        icon: allocation.category.icon,
        budget: allocation.allocated.toFixed(2),
        spent: spent.toFixed(2),
        percentage: percentage.toFixed(1),
        isOverBudget: spent > allocation.allocated
      });
    }

    return breakdown.sort((a, b) => parseFloat(b.spent) - parseFloat(a.spent));
  }

  /**
   * Get recent transactions for a category
   * @param {string} userId - User ID
   * @param {string} categoryId - Category ID
   * @param {Date} startDate - Start date for search
   * @returns {Promise<Array>} - Recent transactions
   */
  async getRecentCategoryTransactions(userId, categoryId, startDate) {
    try {
      const transactions = await Transaction.find({
        user: userId,
        category: categoryId,
        date: { $gte: startDate },
        type: 'expense',
        isDeleted: false
      })
      .sort({ date: -1 })
      .limit(10)
      .select('description amount date');

      return transactions.map(t => ({
        description: t.description,
        amount: t.amount.toFixed(2),
        date: this.formatDate(t.date)
      }));
    } catch (error) {
      logger.error('Error fetching recent category transactions:', error);
      return [];
    }
  }

  /**
   * Generate budget insights for monthly summary
   * @param {Object} budget - Budget object
   * @param {Object} performance - Budget performance data
   * @param {Array} categoryBreakdown - Category breakdown
   * @returns {Array} - Array of insights
   */
  generateBudgetInsights(budget, performance, categoryBreakdown) {
    const insights = [];

    // Overall performance insight
    if (performance.isOverBudget) {
      insights.push(`You exceeded your budget by ${performance.totalSpent - performance.totalBudget > 0 ? '$' + (performance.totalSpent - performance.totalBudget).toFixed(2) : '$0'}. Consider reviewing your spending patterns.`);
    } else {
      insights.push(`Great job! You stayed within budget and saved ${performance.totalBudget > performance.totalSpent ? '$' + (performance.totalBudget - performance.totalSpent).toFixed(2) : '$0'}.`);
    }

    // Category insights
    const overBudgetCategories = categoryBreakdown.filter(cat => cat.isOverBudget);
    if (overBudgetCategories.length > 0) {
      insights.push(`${overBudgetCategories.length} categories exceeded their budgets. Focus on: ${overBudgetCategories.slice(0, 2).map(cat => cat.name).join(', ')}.`);
    }

    // Top spending category
    const topCategory = categoryBreakdown[0];
    if (topCategory) {
      insights.push(`Your highest spending category was ${topCategory.name} at $${topCategory.spent} (${topCategory.percentage}% of its budget).`);
    }

    // Spending trend insight
    const utilizationPercentage = performance.utilizationPercentage;
    if (utilizationPercentage < 70) {
      insights.push('Your spending was well below budget. Consider increasing your savings goals or adjusting next month\'s budget.');
    } else if (utilizationPercentage > 95) {
      insights.push('You used almost all of your budget. Consider setting aside an emergency buffer for next month.');
    }

    return insights;
  }

  /**
   * Calculate savings rate
   * @param {Object} user - User object
   * @param {Object} performance - Budget performance data
   * @returns {string} - Savings rate percentage
   */
  calculateSavingsRate(user, performance) {
    // This would ideally calculate based on income vs spending
    // For now, we'll use budget vs spending as a proxy
    if (performance.totalBudget > performance.totalSpent) {
      const savingsAmount = performance.totalBudget - performance.totalSpent;
      const savingsRate = (savingsAmount / performance.totalBudget) * 100;
      return savingsRate.toFixed(1);
    }
    return '0.0';
  }

  /**
   * Calculate days remaining in budget period
   * @param {Object} budget - Budget object
   * @returns {number} - Days remaining
   */
  calculateDaysRemaining(budget) {
    const now = new Date();
    const endDate = new Date(budget.endDate);
    const timeDiff = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
  }

  /**
   * Format budget period for display
   * @param {Object} budget - Budget object
   * @returns {string} - Formatted period
   */
  formatBudgetPeriod(budget) {
    const periods = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly'
    };
    return periods[budget.period] || 'Custom';
  }

  /**
   * Format date for display
   * @param {Date} date - Date to format
   * @returns {string} - Formatted date
   */
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

module.exports = BudgetAlertService;
