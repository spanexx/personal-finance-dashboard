const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AuthService = require('../services/auth.service');
const PasswordService = require('../services/password.service');
const EmailService = require('../services/email.service');
const emailQueue = require('../services/emailQueue.service');
const securityMonitor = require('../services/securityMonitor.service');
const { createPasswordMeter } = require('../utils/passwordUtils');
const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');

const { 
  ErrorHandler, 
  ValidationError, 
  AuthenticationError, 
  ConflictError, 
  NotFoundError,
  RateLimitError 
} = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Authentication Controller
 * Handles all authentication-related business logic
 */
class AuthController {
  /**
   * Register a new user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static register = ErrorHandler.asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }    const { email, password, firstName, lastName, username } = req.body;
    const clientInfo = {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    try {
      // Register user through service layer
      const result = await AuthService.registerUser(
        { email, password, firstName, lastName, username },
        clientInfo
      );      // Set refresh token cookie
      AuthService.setRefreshTokenCookie(res, result.tokens.refreshToken);

      return ApiResponse.created(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken, // Include refreshToken in response for frontend state
        expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
        sessionId: result.sessionId || 'session_' + Date.now(), // Include sessionId for tracking
        emailVerificationSent: result.emailVerificationSent
      }, 'User registered successfully. Please check your email to verify your account.');
    } catch (error) {
      if (error.message.includes('already exists')) {
        throw new ConflictError(error.message);
      } else if (error.message.includes('security requirements')) {
        // Get detailed validation errors from password service
        const userInfo = { firstName, lastName, email };
        const passwordValidation = PasswordService.validatePasswordStrength(password, userInfo);
        
        throw new ValidationError('Password does not meet security requirements', {
          errors: passwordValidation.errors,
          suggestions: passwordValidation.suggestions
        });
      }
      throw error;
    }
  });  /**
   * Login user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */  static login = ErrorHandler.asyncHandler(async (req, res) => {
    console.log('🔐 LOGIN ATTEMPT:', {
      email: req.body.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ LOGIN VALIDATION FAILED:', errors.array());
      throw new ValidationError('Validation failed', errors.array());
    }

    const { email, password } = req.body;
    const clientInfo = {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    try {      
      console.log('🔍 CALLING AUTH SERVICE LOGIN...');
      // Login user through service layer
      const result = await AuthService.loginUser({ email, password }, clientInfo);
      console.log('✅ LOGIN SUCCESSFUL:', {
        userId: result.user.id,
        email: result.user.email,
        sessionId: result.sessionId,
        tokensGenerated: !!result.tokens
      });
      
      // Set refresh token cookie
      AuthService.setRefreshTokenCookie(res, result.tokens.refreshToken);

      return ApiResponse.success(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken, // Include refreshToken in response for frontend state
        expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
        sessionId: result.sessionId || 'session_' + Date.now() // Include sessionId for tracking
      }, 'Login successful');
    } catch (error) {
      console.log('❌ LOGIN ERROR:', {
        email,
        error: error.message,
        stack: error.stack
      });
      
      if (error.message.includes('Too many failed login attempts')) {
        throw new RateLimitError(error.message);
      } else if (error.message.includes('Invalid email or password')) {
        throw new AuthenticationError(error.message);
      }
      throw error;
    }
  });/**
   * Refresh access token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static refreshToken = ErrorHandler.asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      throw new AuthenticationError('Refresh token is required');
    }

    try {
      // Refresh token through service layer
      const newTokens = await AuthService.refreshUserToken(refreshToken);
      
      // Set new refresh token cookie
      AuthService.setRefreshTokenCookie(res, newTokens.refreshToken);

      return ApiResponse.success(res, {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken, // <-- Ensure refreshToken is included in response
        expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m'
      }, 'Token refreshed successfully');
    } catch (error) {
      if (error.message.includes('Invalid refresh token') || error.message.includes('Refresh token not found') || error.message.includes('Refresh token has been revoked')) {
        throw new AuthenticationError(error.message);
      }
      throw error; // Re-throw other errors to be handled by ErrorHandler
    }
  });
  /**
   * Logout user (revoke current refresh token)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */  
  static logout = ErrorHandler.asyncHandler(async (req, res) => {
    let refreshToken, accessToken;
    try {
      // Prefer refreshToken from body for API clients
      refreshToken = req.body.refreshToken || req.cookies.refreshToken;
      accessToken = AuthService.extractTokenFromHeader(req.headers.authorization);
    } catch (err) {
      logger.error('Logout error: Could not extract tokens', {
        error: err,
        ip: req.ip,
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        cookies: req.cookies,
        headers: req.headers
      });
      return ApiResponse.error(res, 'Logout failed: Could not extract tokens', 400, 'TokenExtractionError');
    }

    if (!refreshToken) {
      // Improved error log for missing refresh token
      logger.error('Logout failed: No refresh token provided', {
        userId: req.user?.id,
        ip: req.ip,
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        cookies: req.cookies,
        headers: req.headers
      });
      return ApiResponse.error(res, 'Logout failed: No refresh token provided', 400, 'MissingRefreshToken');
    }

    try {
      // Remove refresh token from database
      await AuthService.revokeRefreshToken(req.user?.id, refreshToken);
      if (accessToken) {
        // Add access token to blacklist
        await AuthService.blacklistToken(accessToken);
      }
      // Clear refresh token cookie
      AuthService.clearRefreshTokenCookie(res);
      return ApiResponse.success(res, null, 'Logout successful');
    } catch (err) {
      logger.error('Logout error', {
        error: err,
        userId: req.user?.id,
        ip: req.ip,
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        cookies: req.cookies,
        headers: req.headers
      });
      return ApiResponse.error(res, 'Logout failed: Internal server error', 500, 'LogoutError');
    }
  });
  /**
   * Logout from all devices (revoke all refresh tokens)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static logoutAll = ErrorHandler.asyncHandler(async (req, res) => {
    const accessToken = AuthService.extractTokenFromHeader(req.headers.authorization);

    // Revoke all refresh tokens
    await AuthService.revokeAllRefreshTokens(req.user.id);    if (accessToken) {
      // Add current access token to blacklist
      await AuthService.blacklistToken(accessToken);
    }// Clear refresh token cookie
    AuthService.clearRefreshTokenCookie(res);

    return ApiResponse.success(res, null, 'Logged out from all devices successfully');
  });
  /**
   * Get user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */  
  static getProfile = ErrorHandler.asyncHandler(async (req, res) => {
    return ApiResponse.success(res, {
      user: req.user
    }, 'Profile retrieved successfully');
  });  /**
   * Update user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static updateProfile = ErrorHandler.asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    // Use UserService to update profile
    const result = await require('../services/user.service').updateUserProfile(
      req.user.id, 
      req.body
    );

    return ApiResponse.success(res, {
      user: result.user
    }, 'Profile updated successfully');
  });/**
   * Get active sessions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getSessions = ErrorHandler.asyncHandler(async (req, res) => {
    try {
      const currentRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
      
      // Get sessions through service layer
      const result = await AuthService.getUserSessions(req.user.id, currentRefreshToken);
      
      return ApiResponse.success(res, {
        sessions: result.sessions,
        count: result.count
      }, 'Sessions retrieved successfully');
    } catch (error) {
      if (error.message.includes('User not found')) {
        throw new NotFoundError(error.message);
      }
      throw error;
    }
  });  /**
   * Revoke a specific session
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static revokeSession = ErrorHandler.asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    
    try {
      // Use service to revoke session by index
      await AuthService.revokeSessionByIndex(req.user.id, sessionId);
      return ApiResponse.success(res, null, 'Session revoked successfully');
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundError(error.message);
      }
      throw error;
    }
  });
  /**
   * Verify token endpoint
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */  
  static verifyToken = ErrorHandler.asyncHandler(async (req, res) => {
    return ApiResponse.success(res, {
      user: req.user,
      tokenInfo: {
        type: 'access',
        issuedAt: new Date(req.tokenPayload.iat * 1000),
        expiresAt: new Date(req.tokenPayload.exp * 1000)
      }
    }, 'Token is valid');
  });  /**
   * Update user password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static updatePassword = ErrorHandler.asyncHandler(async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { currentPassword, newPassword } = req.body;

    try {
      // Update password through the password service
      await PasswordService.changePassword(req.user.id, currentPassword, newPassword);
      
      // Send notification email
      EmailService.sendPasswordUpdateEmail(req.user.email, req.user.firstName);

      return ApiResponse.success(res, null, 'Password updated successfully');
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundError('User not found');
      } else if (error.message.includes('Current password is incorrect')) {
        throw new AuthenticationError(error.message);
      } else if (error.message.includes('requirements')) {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  });
  /**
   * Check password strength
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static checkPasswordStrength = ErrorHandler.asyncHandler(async (req, res) => {
    const { password } = req.body;
    
    if (!password) {
      throw new ValidationError('Password is required');
    }

    // Get user info for personal data validation if user is logged in
    const userInfo = req.user ? {
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email
    } : {};    const passwordMeter = createPasswordMeter(password, userInfo);

    return ApiResponse.success(res, passwordMeter);
  });
  /**
   * Initiate password reset
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static forgotPassword = ErrorHandler.asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }    const { email } = req.body;
    
    // Always return success to prevent email enumeration
    const successMessage = 'If an account with that email exists, a password reset link has been sent';

    try {
      await PasswordService.initiatePasswordReset(email);
    } catch (error) {
      // Log error but don't expose it to prevent information disclosure
      console.error('Password reset initiation error:', error);
    }

    return ApiResponse.success(res, null, successMessage);
  });
  /**
   * Reset password with token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static resetPassword = ErrorHandler.asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { token, password } = req.body;    try {
      const result = await PasswordService.resetPassword(token, password);

      return ApiResponse.success(res, {
        user: {
          id: result.user._id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName
        }
      }, 'Password reset successfully');
    } catch (error) {
      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        throw new ValidationError(error.message);
      }
      throw error; // Re-throw other errors to be handled by ErrorHandler
    }
  });
  /**
   * Change password (authenticated user)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static changePassword = ErrorHandler.asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;    try {
      const result = await PasswordService.changePassword(userId, currentPassword, newPassword);

      return ApiResponse.success(res, {
        user: {
          id: result.user._id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName
        }
      }, 'Password changed successfully');
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundError('User not found');
      } else if (error.message.includes('Current password is incorrect')) {
        throw new AuthenticationError('Current password is incorrect');
      } else if (error.message.includes('requirements') || error.message.includes('recently used')) {
        throw new ValidationError(error.message);
      }
      throw error; // Re-throw other errors to be handled by ErrorHandler
    }
  });
  /**
   * Generate secure password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static generatePassword = ErrorHandler.asyncHandler(async (req, res) => {
    const { length = 16, options = {} } = req.body;    const password = PasswordService.generateSecurePassword(length, options);
    const passwordMeter = createPasswordMeter(password);

    return ApiResponse.success(res, {
      password,
      strength: passwordMeter
    });
  });  /**
   * Get password strength
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getPasswordStrength = ErrorHandler.asyncHandler(async (req, res) => {
    const { password } = req.body;

    if (!password) {
      throw new ValidationError('Password is required for strength calculation');
    }

    // Calculate password strength
    const strength = createPasswordMeter(password);

    return ApiResponse.success(res, {
      strength
    }, 'Password strength calculated');
  });

  /**
   * Reset password with token (alternative endpoint)
   * @param {Object} req - Express request object  
   * @param {Object} res - Express response object
   */
  static resetPasswordWithToken = ErrorHandler.asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      throw new ValidationError('Token and password are required');
    }

    // Find user by reset token
    const User = require('../models/User');
    const user = await User.findByResetToken(token);
    
    if (!user) {
      throw new NotFoundError('Invalid or expired reset token');
    }

    // Use password service to reset password
    const result = await PasswordService.resetPassword(token, password);

    // Clear reset token
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Log password reset
    securityMonitor.logActivity(user._id.toString(), {
      type: 'password_reset',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    return ApiResponse.success(res, null, 'Password reset successfully');
  });

  /**
   * Verify email with token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static verifyEmail = ErrorHandler.asyncHandler(async (req, res) => {
    const { token } = req.params;

    if (!token) {
      throw new ValidationError('Verification token is required');
    }

    // Find user by verification token
    const User = require('../models/User');
    const user = await User.findByEmailVerificationToken(token);
    
    if (!user) {
      throw new NotFoundError('Invalid or expired verification token');
    }

    // Verify email
    user.isEmailVerified = true;
    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.verifiedAt = new Date();
    await user.save();

    // Log email verification
    securityMonitor.logActivity(user._id.toString(), {
      type: 'email_verification',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    return ApiResponse.success(res, {
      user: {
        id: user._id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        isVerified: user.isVerified
      }    }, 'Email verified successfully');
  });

  /**
   * Check password history to prevent reuse
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static checkPasswordHistory = ErrorHandler.asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const { password } = req.body;

    if (!password) {
      throw new ValidationError('Password is required');
    }

    // Check if password was recently used
    const isReused = await PasswordService.isPasswordRecentlyUsed(req.user.id, password);

    return ApiResponse.success(res, {
      isReused,
      message: isReused ? 'This password was recently used. Please choose a different password.' : 'Password is acceptable'
    });
  });
  /**
   * Resend email verification
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static resendEmailVerification = ErrorHandler.asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    // Find user by email
    const User = require('../models/User');
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      return ApiResponse.success(res, {
        message: 'Email is already verified'
      });
    }    // Check rate limiting - prevent spam
    if (!user.canResendEmailVerification()) {
      throw new RateLimitError('Please wait before requesting another verification email');
    }    try {
      // Generate new verification token (this also sets lastEmailVerificationSent)
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Send verification email
      await EmailService.sendVerificationEmail(user.email, verificationToken, user.firstName);

      // Log activity
      securityMonitor.logActivity(user._id.toString(), {
        type: 'resend_email_verification',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: true
      });

      return ApiResponse.success(res, {
        success: true,
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      // Log failed attempt
      securityMonitor.logActivity(user._id.toString(), {
        type: 'resend_email_verification',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        error: error.message
      });

      throw new Error('Failed to send verification email. Please try again later.');
    }
  });
}

module.exports = AuthController;
