/**
 * Email Verification Controller
 * Handles email verification and related operations
 */

const EmailVerificationService = require('../services/emailVerification.service');
const emailQueue = require('../services/emailQueue.service');
const User = require('../models/User');
const logger = require('../utils/logger');
const ApiResponse = require('../utils/apiResponse');
const { validationResult } = require('express-validator');
const { 
  ErrorHandler, 
  ValidationError, 
  NotFoundError,
  RateLimitError 
} = require('../utils/errorHandler');

/**
 * Send email verification
 */
const sendEmailVerification = ErrorHandler.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { email } = req.body;
  
  // Use service to send verification email
  const result = await EmailVerificationService.sendVerificationEmail(email);

  logger.info('Email verification requested', {
    email,
    queueId: result.queueId
  });

  return ApiResponse.success(res, { queueId: result.queueId }, 'Verification email sent successfully');
});

/**
 * Verify email address
 */
const verifyEmail = ErrorHandler.asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { token, email } = req.body;

  // Use service to verify email
  const result = await EmailVerificationService.verifyEmail(token, email);

  // Send welcome email
  emailQueue.addToQueue({
    templateName: 'welcome',
    templateData: { 
      user: {
        _id: result.userId,
        email: result.email
      }
    }
  }, { priority: 'normal' });

  logger.info('Email verified successfully', {
    userId: result.userId,
    email: result.email
  });

  return ApiResponse.success(res, {
    user: {
      id: result.userId,
      email: result.email,
      isEmailVerified: true
    }
  }, 'Email verified successfully');
});

/**
 * Check email verification status
 */
const getVerificationStatus = ErrorHandler.asyncHandler(async (req, res) => {
  const { email } = req.params;
  
  // Use service to check verification status
  const result = await EmailVerificationService.checkVerificationStatus(email);

  return ApiResponse.success(res, {
    isEmailVerified: result.isVerified,
    attempts: result.attempts,
    canResend: result.canResend,
    nextAllowedAt: result.lastSent 
      ? new Date(result.lastSent.getTime() + 5 * 60 * 1000)
      : null,
    maxAttempts: 5
  });
});

/**
 * Resend email verification (alias for sendEmailVerification)
 */
const resendEmailVerification = async (req, res) => {
  return sendEmailVerification(req, res);
};

/**
 * Get email verification analytics (admin only)
 */
const getVerificationAnalytics = ErrorHandler.asyncHandler(async (req, res) => {
  // This still uses direct database access - would need a dedicated admin service
  const stats = await User.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        verifiedUsers: {
          $sum: { $cond: [{ $eq: ['$isEmailVerified', true] }, 1, 0] }
        },
        unverifiedUsers: {
          $sum: { $cond: [{ $eq: ['$isEmailVerified', false] }, 1, 0] }
        },
        avgVerificationAttempts: { $avg: '$emailVerificationAttempts' }
      }
    }
  ]);

  const queueStatus = emailQueue.getQueueStatus();
  const failedEmails = emailQueue.getFailedEmails();

  return ApiResponse.success(res, {
    userStats: stats[0] || {
      totalUsers: 0,
      verifiedUsers: 0,
      unverifiedUsers: 0,
      avgVerificationAttempts: 0
    },
    emailQueue: queueStatus,
    failedEmails: failedEmails.length,
    recentFailures: failedEmails.slice(0, 10).map(item => ({
      id: item.id,
      email: item.emailData.to,
      error: item.lastError,
      failedAt: item.failedAt
    }))
  });
});

module.exports = {
  sendEmailVerification,
  verifyEmail,
  getVerificationStatus,
  resendEmailVerification,
  getVerificationAnalytics
};
