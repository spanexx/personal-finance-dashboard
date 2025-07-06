/**
 * User Service
 * Handles user-related business logic and database operations
 */

const User = require('../models/User');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');
const PasswordService = require('./password.service');
const EmailService = require('./email.service');
const AuthService = require('./auth.service');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  AuthenticationError 
} = require('../utils/errorHandler');

class UserService {
  /**
   * Get user profile by ID with completeness calculation
   * @param {string} userId - User ID
   * @returns {Object} User profile with completeness data
   */
  static async getUserProfile(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    const user = await User.findById(userId).select('-password -refreshTokens');
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Calculate profile completeness
    const completeness = this.calculateProfileCompleteness(user);
    
    return {
      user,
      profileCompleteness: completeness
    };
  }

  /**
   * Update user profile with change tracking
   * @param {string} userId - User ID
   * @param {Object} updateData - Profile update data
   * @returns {Object} Updated user with changes tracking
   */
  static async updateUserProfile(userId, updateData) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    const allowedUpdates = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'address', 'preferences'];
    const updates = {};
    const changes = [];

    // Get current user data for change tracking
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      throw new NotFoundError('User not found');
    }

    // Process updates and track changes
    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key)) {
        // Deep comparison for nested objects like address
        const currentValue = key === 'address' || key === 'preferences' 
          ? JSON.stringify(currentUser[key]) 
          : currentUser[key];
        const newValue = key === 'address' || key === 'preferences' 
          ? JSON.stringify(updateData[key]) 
          : updateData[key];

        if (currentValue !== newValue) {
          changes.push({
            field: key,
            oldValue: currentUser[key],
            newValue: updateData[key],
            changedAt: new Date()
          });
        }
        updates[key] = updateData[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    // Add change tracking and update timestamp
    updates.lastUpdated = new Date();
    if (changes.length > 0) {
      updates.$push = { changeHistory: { $each: changes, $slice: -10 } }; // Keep last 10 changes
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password -refreshTokens');

    return {
      user,
      changes: changes.map(c => c.field)
    };
  }

  /**
   * Update user profile image
   * @param {string} userId - User ID
   * @param {string} filename - New profile image filename
   * @returns {Object} Updated user and image URL
   */
  static async updateProfileImage(userId, filename) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Delete old profile image if exists
    if (user.profileImage) {
      try {
        const oldImagePath = path.join(__dirname, '../uploads/profiles/', user.profileImage);
        await fs.unlink(oldImagePath);
      } catch (error) {
        console.log('Old profile image not found or already deleted');
      }
    }

    // Update user with new profile image
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        profileImage: filename,
        lastUpdated: new Date()
      },
      { new: true }
    ).select('-password -refreshTokens');

    return {
      user: updatedUser,
      imageUrl: `/uploads/profiles/${filename}`
    };
  }
  /**
   * Change user password with validation and history tracking
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {Object} clientInfo - Optional client information for logging
   * @returns {Object} Success result
   */
  static async changePassword(userId, currentPassword, newPassword, clientInfo = {}) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    // Get user with password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Check password history (prevent reuse)
    if (user.passwordHistory && user.passwordHistory.length > 0) {
      for (const oldPassword of user.passwordHistory.slice(-5)) { // Check last 5 passwords
        const isReused = await bcrypt.compare(newPassword, oldPassword.password);
        if (isReused) {
          throw new ValidationError('Cannot reuse a recent password');
        }
      }
    }

    // Validate new password strength
    const userInfo = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    };
    
    const passwordValidation = PasswordService.validatePasswordStrength(newPassword, userInfo);
    if (!passwordValidation.isValid) {
      throw new ValidationError('Password does not meet security requirements', {
        errors: passwordValidation.errors,
        suggestions: passwordValidation.suggestions
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and add to history
    const passwordHistoryEntry = {
      password: user.password, // Store current password in history
      changedAt: new Date()
    };

    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      passwordChangedAt: new Date(),
      $push: { 
        passwordHistory: { 
          $each: [passwordHistoryEntry], 
          $slice: -5 // Keep only last 5 passwords
        } 
      }
    });

    return { 
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    };
  }

  /**
   * Deactivate user account (soft delete)
   * @param {string} userId - User ID
   * @param {string} reason - Deactivation reason
   * @returns {Object} Deactivation result
   */
  static async deactivateAccount(userId, reason) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    const user = await User.findByIdAndUpdate(userId, {
      isActive: false,
      deactivatedAt: new Date(),
      deactivationReason: reason || 'User requested deactivation',
      lastUpdated: new Date()
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return { success: true };
  }

  /**
   * Export user data (GDPR compliance)
   * @param {string} userId - User ID
   * @returns {Object} User data export
   */
  static async exportUserData(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    const user = await User.findById(userId).select('-password -refreshTokens');
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    // Note: In a real application, you would also export related data from other collections
    // like transactions, budgets, goals, etc.
    const exportData = {
      exportedAt: new Date(),
      exportVersion: '1.0',
      userData: {
        profile: user,
        // transactions: await Transaction.find({ userId }),
        // budgets: await Budget.find({ userId }),
        // goals: await Goal.find({ userId })
      }
    };

    return exportData;
  }
  /**
   * Permanently delete user account and all data
   * @param {string} userId - User ID
   * @returns {Object} Deletion result
   */
  static async deleteAccount(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Delete profile image if exists
    if (user.profileImage) {
      try {
        const imagePath = path.join(__dirname, '../uploads/profiles/', user.profileImage);
        await fs.unlink(imagePath);
      } catch (error) {
        console.log('Profile image not found or already deleted');
      }
    }

    // Permanently delete user
    await User.findByIdAndDelete(userId);

    // Note: In a real application, you would also delete related data
    // await Transaction.deleteMany({ userId });
    // await Budget.deleteMany({ userId });
    // await Goal.deleteMany({ userId });

    return { success: true };
  }

  /**
   * Get user preferences
   * @param {string} userId - User ID
   * @returns {Object} User preferences
   */
  static async getUserPreferences(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    const user = await User.findById(userId).select('preferences firstName lastName');
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Provide default preferences if none exist
    const defaultPreferences = {
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      language: 'en',
      theme: 'light',
      notifications: {
        email: true,
        push: true,
        desktop: true
      },
      privacy: {
        showProfile: true,
        allowAnalytics: true
      }
    };

    const preferences = {
      ...defaultPreferences,
      ...user.preferences
    };

    return {
      preferences,
      user: {
        firstName: user.firstName,
        lastName: user.lastName
      }
    };
  }

  /**
   * Update user preferences
   * @param {string} userId - User ID
   * @param {Object} preferencesData - Preferences data
   * @returns {Object} Updated preferences
   */
  static async updateUserPreferences(userId, preferencesData) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    const allowedPreferences = [
      'currency', 'dateFormat', 'language', 'theme', 
      'notifications', 'privacy', 'timezone', 'locale'
    ];
    
    const preferences = {};
    Object.keys(preferencesData).forEach(key => {
      if (allowedPreferences.includes(key)) {
        preferences[key] = preferencesData[key];
      }
    });

    if (Object.keys(preferences).length === 0) {
      throw new ValidationError('No valid preferences to update');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { preferences: { ...preferences } } },
      { new: true, runValidators: true }
    ).select('preferences firstName lastName');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      preferences: user.preferences,
      user: {
        firstName: user.firstName,
        lastName: user.lastName
      },
      changes: Object.keys(preferences)
    };
  }

  /**
   * Calculate profile completeness percentage
   * @param {Object} user - User object
   * @returns {Object} Completeness data
   */
  static calculateProfileCompleteness(user) {
    const requiredFields = [
      'firstName',
      'lastName', 
      'email',
      'phone',
      'dateOfBirth',
      'profileImage'
    ];

    const optionalFields = [
      'address',
      'preferences'
    ];

    let completedRequired = 0;
    let completedOptional = 0;
    const missingFields = [];

    // Check required fields
    requiredFields.forEach(field => {
      if (user[field] && user[field] !== '') {
        completedRequired++;
      } else {
        missingFields.push(field);
      }
    });

    // Check optional fields
    optionalFields.forEach(field => {
      if (user[field] && user[field] !== '') {
        completedOptional++;
      }
    });

    // Calculate percentages (required fields weighted 80%, optional 20%)
    const requiredPercentage = (completedRequired / requiredFields.length) * 80; // 80% weight for required
    const optionalPercentage = (completedOptional / optionalFields.length) * 20; // 20% weight for optional
    const totalPercentage = Math.round(requiredPercentage + optionalPercentage);

    return {
      percentage: totalPercentage,
      requiredCompleted: completedRequired,
      requiredTotal: requiredFields.length,
      optionalCompleted: completedOptional,
      optionalTotal: optionalFields.length,
      missingFields,
      isComplete: totalPercentage === 100
    };
  }
}

module.exports = UserService;
