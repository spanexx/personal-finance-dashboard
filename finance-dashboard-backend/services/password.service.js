/**
 * Password Security Service
 * Handles comprehensive password security features for the Personal Finance Dashboard
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const EmailService = require('./email.service');
const logger = require('../utils/logger');

/**
 * Common passwords list for validation
 * In production, this should be loaded from a more comprehensive list
 */
const COMMON_PASSWORDS = [
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
  'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'iloveyou',
  'princess', 'rockyou', '1234567', '12345678', 'sunshine', 'nicole',
  'daniel', 'babygirl', 'lovely', 'jessica', 'ashley', 'michael',
  'password1', '654321', 'master', 'jordan', 'superman', 'harley'
];

class PasswordService {
  /**
   * Hash password with proper salt rounds
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  static async hashPassword(password) {
    try {
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const salt = await bcrypt.genSalt(saltRounds);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      logger.error('Password hashing failed:', error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} - Verification result
   */
  static async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password verification failed:', error);
      throw new Error('Password verification failed');
    }
  }

  /**
   * Validate password strength and policies
   * @param {string} password - Password to validate
   * @param {Object} userInfo - User information for personal data check
   * @returns {Object} - Validation result with score and suggestions
   */
  static validatePasswordStrength(password, userInfo = {}) {
    const result = {
      isValid: false,
      score: 0,
      strength: 'Very Weak',
      errors: [],
      suggestions: []
    };

    // Check minimum length
    if (password.length < 8) {
      result.errors.push('Password must be at least 8 characters long');
    } else {
      result.score += 1;
    }

    // Check for lowercase letters
    if (!/[a-z]/.test(password)) {
      result.errors.push('Password must contain at least one lowercase letter');
    } else {
      result.score += 1;
    }

    // Check for uppercase letters
    if (!/[A-Z]/.test(password)) {
      result.errors.push('Password must contain at least one uppercase letter');
    } else {
      result.score += 1;
    }

    // Check for numbers
    if (!/\d/.test(password)) {
      result.errors.push('Password must contain at least one number');
    } else {
      result.score += 1;
    }

    // Check for special characters
    if (!/[@$!%*?&]/.test(password)) {
      result.errors.push('Password must contain at least one special character (@$!%*?&)');
    } else {
      result.score += 1;
    }

    // Check against common passwords
    if (this.isCommonPassword(password)) {
      result.errors.push('Password is too common. Please choose a more unique password');
    } else {
      result.score += 1;
    }

    // Check for personal information
    const personalDataCheck = this.containsPersonalData(password, userInfo);
    if (personalDataCheck.containsPersonalData) {
      result.errors.push(`Password should not contain personal information: ${personalDataCheck.found.join(', ')}`);
    } else {
      result.score += 1;
    }

    // Additional strength checks
    if (password.length >= 12) {
      result.score += 1;
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      result.score += 1;
    }

    // Calculate strength
    result.strength = this.calculateStrengthLevel(result.score);
    result.isValid = result.errors.length === 0 && result.score >= 5;

    // Add suggestions
    if (result.score < 7) {
      result.suggestions = this.generatePasswordSuggestions(password, result.score);
    }

    return result;
  }

  /**
   * Check if password is in common passwords list
   * @param {string} password - Password to check
   * @returns {boolean} - True if password is common
   */
  static isCommonPassword(password) {
    return COMMON_PASSWORDS.includes(password.toLowerCase());
  }

  /**
   * Check if password contains personal data
   * @param {string} password - Password to check
   * @param {Object} userInfo - User information
   * @returns {Object} - Result with boolean and found personal data
   */
  static containsPersonalData(password, userInfo) {
    const result = { containsPersonalData: false, found: [] };
    const passwordLower = password.toLowerCase();
    
    // Check common personal data fields
    const personalFields = ['firstName', 'lastName', 'email'];
    
    for (const field of personalFields) {
      if (userInfo[field]) {
        const value = userInfo[field].toLowerCase();
        if (passwordLower.includes(value) && value.length >= 3) {
          result.containsPersonalData = true;
          result.found.push(field);
        }
      }
    }

    // Check email username part
    if (userInfo.email) {
      const emailUsername = userInfo.email.split('@')[0].toLowerCase();
      if (passwordLower.includes(emailUsername) && emailUsername.length >= 3) {
        result.containsPersonalData = true;
        result.found.push('email username');
      }
    }

    return result;
  }

  /**
   * Calculate password strength level
   * @param {number} score - Password score
   * @returns {string} - Strength level
   */
  static calculateStrengthLevel(score) {
    if (score >= 8) return 'Very Strong';
    if (score >= 6) return 'Strong';
    if (score >= 4) return 'Medium';
    if (score >= 2) return 'Weak';
    return 'Very Weak';
  }

  /**
   * Generate password improvement suggestions
   * @param {string} password - Current password
   * @param {number} score - Current score
   * @returns {Array} - Array of suggestions
   */
  static generatePasswordSuggestions(password, score) {
    const suggestions = [];

    if (password.length < 12) {
      suggestions.push('Consider using a longer password (12+ characters)');
    }

    if (!/[a-z]/.test(password)) {
      suggestions.push('Add lowercase letters');
    }

    if (!/[A-Z]/.test(password)) {
      suggestions.push('Add uppercase letters');
    }

    if (!/\d/.test(password)) {
      suggestions.push('Include numbers');
    }

    if (!/[@$!%*?&]/.test(password)) {
      suggestions.push('Add special characters like @, $, !, %, *, ?, &');
    }

    if (score < 5) {
      suggestions.push('Consider using a passphrase with multiple words');
      suggestions.push('Avoid common words and personal information');
    }

    return suggestions;
  }

  /**
   * Check if password was recently used
   * @param {string} userId - User ID
   * @param {string} newPassword - New password to check
   * @returns {Promise<boolean>} - True if password was recently used
   */
  static async isPasswordRecentlyUsed(userId, newPassword) {
    try {
      const user = await User.findById(userId).select('+passwordHistory');
      if (!user || !user.passwordHistory) {
        return false;
      }

      // Check against last 5 passwords
      for (const oldPassword of user.passwordHistory) {
        const isMatch = await bcrypt.compare(newPassword, oldPassword.password);
        if (isMatch) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error checking password history:', error);
      throw new Error('Failed to check password history');
    }
  }

  /**
   * Generate secure password reset token
   * @returns {Object} - Token and hashed token
   */
  static generateResetToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    return {
      token,
      hashedToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    };
  }

  /**
   * Initiate password reset process
   * @param {string} email - User email
   * @returns {Promise<Object>} - Reset result
   */
  static async initiatePasswordReset(email) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        // Don't reveal if email exists or not for security
        logger.warn(`Password reset attempted for non-existent email: ${email}`);
        return { success: true, message: 'If the email exists, a reset link has been sent' };
      }

      if (!user.isVerified) {
        throw new Error('Account is not verified. Please verify your account first.');
      }

      // Generate reset token
      const resetData = this.generateResetToken();
      
      // Save reset token to user
      user.resetPasswordToken = resetData.hashedToken;
      user.resetPasswordExpires = resetData.expiresAt;
      await user.save();

      // Send reset email
      await EmailService.sendPasswordResetEmail(user, resetData.token);

      logger.info(`Password reset initiated for user: ${user.email}`);
      
      return {
        success: true,
        message: 'Password reset link has been sent to your email'
      };
    } catch (error) {
      logger.error('Password reset initiation failed:', error);
      throw error;
    }
  }

  /**
   * Verify password reset token
   * @param {string} token - Reset token
   * @returns {Promise<Object>} - User if token is valid
   */
  static async verifyResetToken(token) {
    try {
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      return user;
    } catch (error) {
      logger.error('Reset token verification failed:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} - Reset result
   */
  static async resetPassword(token, newPassword) {
    try {
      // Verify token
      const user = await this.verifyResetToken(token);
      
      // Validate new password
      const validation = this.validatePasswordStrength(newPassword, {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      });

      if (!validation.isValid) {
        throw new Error(`Password does not meet requirements: ${validation.errors.join(', ')}`);
      }

      // Check if password was recently used
      const isRecentlyUsed = await this.isPasswordRecentlyUsed(user._id, newPassword);
      if (isRecentlyUsed) {
        throw new Error('Password was recently used. Please choose a different password.');
      }

      // Update password (the pre-save middleware will handle hashing and history)
      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      
      await user.save();

      // Send confirmation email
      await EmailService.sendPasswordChangeConfirmation(user);

      logger.info(`Password reset completed for user: ${user.email}`);
      
      return {
        success: true,
        message: 'Password has been reset successfully'
      };
    } catch (error) {
      logger.error('Password reset failed:', error);
      throw error;
    }
  }

  /**
   * Change user password (authenticated user)
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} - Change result
   */
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+password +passwordHistory');
      
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await this.verifyPassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      const validation = this.validatePasswordStrength(newPassword, {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      });

      if (!validation.isValid) {
        throw new Error(`Password does not meet requirements: ${validation.errors.join(', ')}`);
      }

      // Check if new password is different from current
      const isSamePassword = await this.verifyPassword(newPassword, user.password);
      if (isSamePassword) {
        throw new Error('New password must be different from current password');
      }

      // Check if password was recently used
      const isRecentlyUsed = await this.isPasswordRecentlyUsed(userId, newPassword);
      if (isRecentlyUsed) {
        throw new Error('Password was recently used. Please choose a different password.');
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Send confirmation email
      await EmailService.sendPasswordChangeConfirmation(user);

      logger.info(`Password changed for user: ${user.email}`);
      
      return {
        success: true,
        message: 'Password has been changed successfully'
      };
    } catch (error) {
      logger.error('Password change failed:', error);
      throw error;
    }
  }

  /**
   * Generate a strong password suggestion
   * @param {number} length - Desired password length (default: 12)
   * @returns {string} - Generated password
   */
  static generateSecurePassword(length = 12) {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Get password strength meter data
   * @param {string} password - Password to analyze
   * @returns {Object} - Strength meter data
   */
  static getPasswordMeter(password) {
    const result = this.validatePasswordStrength(password);
    
    return {
      score: result.score,
      maxScore: 9,
      percentage: Math.round((result.score / 9) * 100),
      strength: result.strength,
      color: this.getStrengthColor(result.strength),
      suggestions: result.suggestions
    };
  }

  /**
   * Get color for password strength
   * @param {string} strength - Strength level
   * @returns {string} - Color code
   */
  static getStrengthColor(strength) {
    const colors = {
      'Very Weak': '#ff4444',
      'Weak': '#ff8800',
      'Medium': '#ffaa00',
      'Strong': '#88aa00',
      'Very Strong': '#00aa00'
    };
    
    return colors[strength] || '#ff4444';
  }

  /**
   * Clean up expired reset tokens
   * @returns {Promise<number>} - Number of cleaned tokens
   */
  static async cleanupExpiredResetTokens() {
    try {
      const result = await User.updateMany(
        { resetPasswordExpires: { $lt: new Date() } },
        { 
          $unset: { 
            resetPasswordToken: 1, 
            resetPasswordExpires: 1 
          } 
        }
      );

      logger.info(`Cleaned up ${result.modifiedCount} expired reset tokens`);
      return result.modifiedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired reset tokens:', error);
      throw error;
    }
  }
}

module.exports = PasswordService;
