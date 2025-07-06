/**
 * Email Preferences Service
 * Handles email preferences and notification settings
 */

const User = require('../models/User');
const logger = require('../utils/logger');
const { 
  ValidationError, 
  NotFoundError 
} = require('../utils/errorHandler');

class EmailPreferencesService {
  /**
   * Get user email preferences
   * @param {string} userId - User ID
   * @returns {Object} User email preferences
   */
  static async getUserEmailPreferences(userId) {
    const user = await User.findById(userId).select('notificationPreferences email');
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      email: user.email,
      preferences: user.notificationPreferences
    };
  }

  /**
   * Update email preferences
   * @param {string} userId - User ID
   * @param {Object} preferencesData - Updated preferences
   * @returns {Object} Updated preferences
   */
  static async updateEmailPreferences(userId, preferencesData) {
    const {
      securityAlerts,
      marketingEmails,
      transactionalEmails,
      weeklyReports,
      budgetAlerts,
      goalReminders,
      productUpdates,
      newsletter,
      frequency
    } = preferencesData;

    const user = await User.findById(userId);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update email notification preferences
    if (typeof securityAlerts !== 'undefined') {
      user.notificationPreferences.email.types.security = securityAlerts;
    }
    if (typeof marketingEmails !== 'undefined') {
      user.notificationPreferences.email.types.marketing = marketingEmails;
    }
    if (typeof transactionalEmails !== 'undefined') {
      user.notificationPreferences.email.types.transactional = transactionalEmails;
    }
    if (typeof weeklyReports !== 'undefined') {
      user.notificationPreferences.email.types.reports = weeklyReports;
    }
    if (typeof budgetAlerts !== 'undefined') {
      user.notificationPreferences.budgetAlerts.enabled = budgetAlerts;
    }
    if (typeof goalReminders !== 'undefined') {
      user.notificationPreferences.goalReminders.enabled = goalReminders;
    }
    if (typeof productUpdates !== 'undefined') {
      user.notificationPreferences.email.types.marketing = productUpdates;
    }
    if (typeof newsletter !== 'undefined') {
      user.notificationPreferences.email.types.marketing = newsletter;
    }
    if (frequency) {
      user.notificationPreferences.email.frequency = frequency;
    }

    await user.save();

    logger.info('Email preferences updated', {
      userId,
      preferences: user.notificationPreferences
    });

    return {
      preferences: user.notificationPreferences
    };
  }

  /**
   * Unsubscribe user from specific email type
   * @param {string} email - User email
   * @param {string} type - Email type to unsubscribe from
   * @returns {Object} Updated preferences status
   */
  static async unsubscribeUserFromEmailType(email, type) {
    const user = await User.findOne({ email });
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!user.notificationPreferences?.email?.types) {
      throw new ValidationError('User notification preferences not properly configured');
    }

    const validTypes = ['marketing', 'transactional', 'security', 'reports', 'all'];
    if (!validTypes.includes(type)) {
      throw new ValidationError('Invalid email type specified');
    }

    if (type === 'all') {
      // Unsubscribe from all types except security
      Object.keys(user.notificationPreferences.email.types).forEach(key => {
        if (key !== 'security') { // Always keep security emails enabled
          user.notificationPreferences.email.types[key] = false;
        }
      });
    } else {
      user.notificationPreferences.email.types[type] = false;
    }

    // If it's a marketing unsubscribe, also disable newsletter and product updates
    if (type === 'marketing') {
      user.notificationPreferences.email.types.newsletter = false;
      user.notificationPreferences.email.types.productUpdates = false;
    }

    await user.save();

    logger.info('User unsubscribed from email type', {
      email,
      type,
      userId: user._id
    });

    return {
      email,
      unsubscribedFrom: type,
      success: true,
      preferences: user.notificationPreferences
    };
  }
}

module.exports = EmailPreferencesService;
