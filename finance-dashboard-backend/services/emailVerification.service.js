/**
 * Email Verification Service
 * Handles email verification-related business logic
 */

const User = require('../models/User');
const emailQueue = require('./emailQueue.service');
const logger = require('../utils/logger');
const { 
  ValidationError, 
  NotFoundError,
  RateLimitError 
} = require('../utils/errorHandler');

class EmailVerificationService {
  /**
   * Sends email verification to a user
   * @param {string} email - The user's email address
   * @returns {Object} Result with queueId
   */
  static async sendVerificationEmail(email) {
    const user = await User.findOne({ email });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.isEmailVerified) {
      throw new ValidationError('Email is already verified');
    }

    // Check if verification can be resent
    if (!user.canResendEmailVerification()) {
      throw new RateLimitError('Please wait 5 minutes before requesting another verification email', {
        nextAllowedAt: new Date(user.lastEmailVerificationSent.getTime() + 5 * 60 * 1000)
      });
    }

    // Check verification attempts
    if (user.emailVerificationAttempts >= 5) {
      throw new RateLimitError('Maximum verification attempts exceeded. Please contact support.');
    }

    // Generate verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Add to email queue
    const queueId = emailQueue.addToQueue({
      templateName: 'email-verification',
      templateData: {
        user,
        token: verificationToken
      }
    }, { priority: 'high' });

    logger.info('Email verification requested', {
      userId: user._id,
      email: user.email,
      queueId,
      attempts: user.emailVerificationAttempts
    });

    return { queueId };
  }

  /**
   * Verifies a user's email using the provided token
   * @param {string} token - The verification token
   * @param {string} email - The email to verify
   * @returns {Object} Result with user info
   */
  static async verifyEmail(token, email) {
    // Find user by verification token
    const user = await User.findByEmailVerificationToken(token);

    if (!user) {
      throw new ValidationError('Invalid or expired verification token');
    }

    // Verify email matches
    if (user.email !== email) {
      throw new ValidationError('Email does not match verification token');
    }

    if (user.isEmailVerified) {
      throw new ValidationError('Email is already verified');
    }

    // Verify email
    await user.verifyEmail();

    return {
      verified: true,
      userId: user._id,
      email: user.email
    };
  }

  /**
   * Check verification status of an email
   * @param {string} email - The email to check
   * @returns {Object} Verification status
   */
  static async checkVerificationStatus(email) {
    const user = await User.findOne({ email }).select('isEmailVerified emailVerificationAttempts lastEmailVerificationSent');
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      isVerified: user.isEmailVerified,
      attempts: user.emailVerificationAttempts,
      lastSent: user.lastEmailVerificationSent,
      canResend: user.canResendEmailVerification()
    };
  }
}

module.exports = EmailVerificationService;
