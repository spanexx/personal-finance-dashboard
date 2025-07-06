/**
 * Email Preferences Controller
 * Handles email preferences and notification settings
 */

const EmailPreferencesService = require('../services/emailPreferences.service');
const logger = require('../utils/logger');
const ApiResponse = require('../utils/apiResponse');
const { validationResult } = require('express-validator');
const { 
  ErrorHandler, 
  ValidationError, 
  NotFoundError 
} = require('../utils/errorHandler');

/**
 * Get user email preferences
 */
const getEmailPreferences = ErrorHandler.asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // Use service to get user email preferences
  const result = await EmailPreferencesService.getUserEmailPreferences(userId);

  return ApiResponse.success(res, {
    email: result.email,
    preferences: result.preferences
  });
});

/**
 * Update email preferences
 */
const updateEmailPreferences = ErrorHandler.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const userId = req.user.id;
  
  // Use service to update email preferences
  const result = await EmailPreferencesService.updateEmailPreferences(userId, req.body);

  logger.info('Email preferences updated', {
    userId,
    preferences: result.preferences
  });
  return ApiResponse.success(res, {
    preferences: result.preferences
  }, 'Email preferences updated successfully');
});

/**
 * Unsubscribe from all emails
 */
const unsubscribeAll = ErrorHandler.asyncHandler(async (req, res) => {
  const { token, email } = req.query;

  if (!token && !email) {
    throw new ValidationError('Token or email is required');
  }

  let user;
  
  // Find user by email or unsubscribe token
  if (email) {
    user = await User.findOne({ email });
  } else {
    // TODO: Implement unsubscribe token verification
    throw new ValidationError('Invalid unsubscribe method');
  }

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Disable all email notifications
  user.notificationPreferences.email.enabled = false;
  user.notificationPreferences.email.types = {
    security: false,
    marketing: false,
    transactional: true, // Keep transactional emails enabled
    reminders: false,
    reports: false
  };

  await user.save();

  logger.info('User unsubscribed from all emails', {
    userId: user._id,
    email: user.email
  });

  return ApiResponse.success(res, null, 'Successfully unsubscribed from all email notifications');
});

/**
 * Resubscribe to emails
 */
const resubscribe = ErrorHandler.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { email, types } = req.body;

  const user = await User.findOne({ email });
  
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Enable specified email types
  user.notificationPreferences.email.enabled = true;
  
  if (types && Array.isArray(types)) {
    types.forEach(type => {
      if (user.notificationPreferences.email.types.hasOwnProperty(type)) {
        user.notificationPreferences.email.types[type] = true;
      }
    });
  } else {
    // Enable all types if none specified
    user.notificationPreferences.email.types = {
      security: true,
      marketing: true,
      transactional: true,
      reminders: true,
      reports: true
    };
  }

  await user.save();

  logger.info('User resubscribed to emails', {
    userId: user._id,
    email: user.email,
    types
  });

  return ApiResponse.success(res, {
    preferences: user.notificationPreferences.email
  }, 'Successfully resubscribed to email notifications');
});

/**
 * Unsubscribe from specific email type
 */
const unsubscribeFromEmailType = ErrorHandler.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { type } = req.params;
  const { token, email } = req.body;

  // TODO: Verify unsubscribe token

  // Map route type to notification preference type
  const typeMapping = {
    security: 'security',
    marketing: 'marketing',
    transactional: 'transactional',
    reports: 'reports',
    alerts: 'alerts',
    reminders: 'reminders',
    updates: 'updates',
    newsletter: 'newsletter',
    all: 'all'
  };

  const prefType = typeMapping[type];
  if (!prefType) {
    throw new ValidationError('Invalid email type');
  }

  // Use service to unsubscribe user from email type
  const result = await EmailPreferencesService.unsubscribeUserFromEmailType(email, prefType);

  logger.info('User unsubscribed from email type', {
    email: result.email,
    type: result.unsubscribedFrom
  });

  return ApiResponse.success(res, null, `Successfully unsubscribed from ${type} emails`);
});

/**
 * Get email preferences by email (for unsubscribe page)
 */
const getPreferencesByEmail = ErrorHandler.asyncHandler(async (req, res) => {
  const { email } = req.params;

  const user = await User.findOne({ email }).select('notificationPreferences firstName lastName');
  
  if (!user) {
    throw new NotFoundError('User not found');
  }

  return ApiResponse.success(res, {
    name: `${user.firstName} ${user.lastName}`,
    email,
    preferences: user.notificationPreferences.email
  });
});

/**
 * Get bulk email settings (admin only)
 */
const getBulkEmailSettings = ErrorHandler.asyncHandler(async (req, res) => {
  // TODO: Check if user is admin
  
  // Return default bulk email settings
  const settings = {
    enabled: true,
    rateLimits: {
      daily: 10000,
      hourly: 1000,
      perUser: 50
    },
    templates: {
      enabled: true,
      defaultLanguage: 'en'
    },
    queue: {
      maxRetries: 3,
      retryDelay: 300000, // 5 minutes
      batchSize: 100
    }
  };

  return ApiResponse.success(res, settings);
});

/**
 * Update bulk email settings (admin only)
 */
const updateBulkEmailSettings = ErrorHandler.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  // TODO: Check if user is admin
  // TODO: Update bulk email settings in database/config

  const updatedSettings = req.body;

  logger.info('Bulk email settings updated', {
    updatedBy: req.user.id,
    settings: updatedSettings
  });

  return ApiResponse.success(res, updatedSettings, 'Bulk email settings updated successfully');
});

module.exports = {
  getEmailPreferences,
  updateEmailPreferences,
  unsubscribeFromEmails: unsubscribeAll,
  resubscribeToEmails: resubscribe,
  unsubscribeFromEmailType,
  getBulkEmailSettings,
  updateBulkEmailSettings
};
