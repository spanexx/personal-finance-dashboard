/**
 * Password Validation Middleware
 * Provides middleware functions for password validation and security
 */

const PasswordService = require('../services/password.service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

class PasswordValidationMiddleware {
  /**
   * Validate password strength middleware
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static validatePasswordStrength(req, res, next) {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required',
          errors: ['Password field is missing']
        });
      }

      // Get user info for personal data validation
      const userInfo = {
        firstName: req.body.firstName || req.user?.firstName,
        lastName: req.body.lastName || req.user?.lastName,
        email: req.body.email || req.user?.email
      };

      const validation = PasswordService.validatePasswordStrength(password, userInfo);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet security requirements',
          errors: validation.errors,
          suggestions: validation.suggestions,
          strength: validation.strength,
          score: validation.score
        });
      }

      // Add validation result to request for use in controllers
      req.passwordValidation = validation;
      next();
    } catch (error) {
      logger.error('Password validation middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Password validation failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Check password history middleware
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static async checkPasswordHistory(req, res, next) {
    try {
      const { password } = req.body;
      const userId = req.user?.id || req.params.userId;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User identification required'
        });
      }

      const isRecentlyUsed = await PasswordService.isPasswordRecentlyUsed(userId, password);
      
      if (isRecentlyUsed) {
        return res.status(400).json({
          success: false,
          message: 'Password was recently used',
          error: 'Please choose a different password. You cannot reuse any of your last 5 passwords.'
        });
      }

      next();
    } catch (error) {
      logger.error('Password history check middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Password history validation failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Validate password reset token middleware
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static async validateResetToken(req, res, next) {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Reset token is required'
        });
      }

      const user = await PasswordService.verifyResetToken(token);
      
      // Add user to request for use in controllers
      req.resetUser = user;
      next();
    } catch (error) {
      logger.error('Reset token validation middleware error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Invalid or expired reset token'
      });
    }
  }

  /**
   * Rate limit password reset requests
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static rateLimitPasswordReset(req, res, next) {
    // This middleware works with express-rate-limit
    // Implementation depends on your rate limiting strategy
    
    const rateLimitStore = req.app.get('passwordResetRateLimit');
    const clientId = req.ip || req.connection.remoteAddress;
    const key = `password_reset:${clientId}`;
    
    // Check if this IP has exceeded password reset attempts
    // This is a simple in-memory implementation
    // In production, use Redis or similar
    if (!rateLimitStore) {
      req.app.set('passwordResetRateLimit', new Map());
    }
    
    const store = req.app.get('passwordResetRateLimit');
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour
    const maxAttempts = 3;
    
    const record = store.get(key) || { attempts: 0, resetTime: now + windowMs };
    
    if (now > record.resetTime) {
      // Reset the window
      record.attempts = 0;
      record.resetTime = now + windowMs;
    }
    
    if (record.attempts >= maxAttempts) {
      const timeUntilReset = Math.ceil((record.resetTime - now) / 1000 / 60);
      return res.status(429).json({
        success: false,
        message: `Too many password reset attempts. Please try again in ${timeUntilReset} minutes.`,
        retryAfter: timeUntilReset
      });
    }
    
    record.attempts += 1;
    store.set(key, record);
    
    next();
  }

  /**
   * Validate current password middleware (for password changes)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static async validateCurrentPassword(req, res, next) {
    try {
      const { currentPassword } = req.body;
      
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required'
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // The actual password verification will be done in the service
      // This middleware just ensures the field is present
      next();
    } catch (error) {
      logger.error('Current password validation middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Current password validation failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Security logging middleware for password operations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static logPasswordOperation(req, res, next) {
    const originalSend = res.send;
    const operation = req.route?.path || req.path;
    const userInfo = {
      userId: req.user?.id || 'anonymous',
      email: req.user?.email || req.body.email || 'unknown',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    res.send = function(data) {
      const statusCode = res.statusCode;
      const isSuccess = statusCode >= 200 && statusCode < 300;
      
      logger.info('Password operation attempt', {
        operation,
        success: isSuccess,
        statusCode,
        ...userInfo,
        timestamp: new Date().toISOString()
      });

      // Log security events
      if (!isSuccess && statusCode === 401) {
        logger.warn('Unauthorized password operation attempt', userInfo);
      } else if (!isSuccess && statusCode === 429) {
        logger.warn('Rate limited password operation', userInfo);
      } else if (isSuccess) {
        logger.info('Successful password operation', {
          operation,
          ...userInfo
        });
      }

      originalSend.call(this, data);
    };

    next();
  }

  /**
   * Sanitize password fields in request/response
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static sanitizePasswordFields(req, res, next) {
    // Remove password fields from request logging
    if (req.body) {
      const sanitizedBody = { ...req.body };
      
      // List of password fields to sanitize
      const passwordFields = [
        'password', 
        'currentPassword', 
        'newPassword', 
        'confirmPassword'
      ];
      
      passwordFields.forEach(field => {
        if (sanitizedBody[field]) {
          sanitizedBody[field] = '[REDACTED]';
        }
      });
      
      req.sanitizedBody = sanitizedBody;
    }

    // Override res.json to remove sensitive data from responses
    const originalJson = res.json;
    res.json = function(data) {
      if (data && typeof data === 'object') {
        const sanitizedData = { ...data };
        
        // Remove any password fields that might be in the response
        delete sanitizedData.password;
        delete sanitizedData.currentPassword;
        delete sanitizedData.newPassword;
        delete sanitizedData.confirmPassword;
        
        return originalJson.call(this, sanitizedData);
      }
      
      return originalJson.call(this, data);
    };

    next();
  }

  /**
   * Combine multiple validation middleware
   * @returns {Array} - Array of middleware functions
   */
  static validatePasswordChange() {
    return [
      this.sanitizePasswordFields,
      this.logPasswordOperation,
      this.validateCurrentPassword,
      this.validatePasswordStrength,
      this.checkPasswordHistory
    ];
  }

  /**
   * Combine validation middleware for password reset
   * @returns {Array} - Array of middleware functions
   */
  static validatePasswordReset() {
    return [
      this.sanitizePasswordFields,
      this.logPasswordOperation,
      this.validateResetToken,
      this.validatePasswordStrength,
      this.checkPasswordHistory
    ];
  }

  /**
   * Combine validation middleware for registration
   * @returns {Array} - Array of middleware functions
   */
  static validateRegistrationPassword() {
    return [
      this.sanitizePasswordFields,
      this.logPasswordOperation,
      this.validatePasswordStrength
    ];
  }
}

module.exports = PasswordValidationMiddleware;
