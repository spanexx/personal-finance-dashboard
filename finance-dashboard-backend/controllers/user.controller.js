const UserService = require('../services/user.service');
const securityMonitor = require('../services/securityMonitor.service');
const { validationResult } = require('express-validator');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const ApiResponse = require('../utils/apiResponse');
const { 
  ErrorHandler, 
  ValidationError
} = require('../utils/errorHandler');

/**
 * User Controller
 * Handles user management operations
 */

// Ensure upload directory exists
const ensureUploadDir = async () => {
  const uploadDir = path.join(__dirname, '../uploads/profiles/');
  try {
    await fs.access(uploadDir);
  } catch (error) {
    await fs.mkdir(uploadDir, { recursive: true });
  }
};

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    await ensureUploadDir();
    cb(null, path.join(__dirname, '../uploads/profiles/'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + uuidv4();
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

/**
 * User Controller
 * Handles user management operations
 */
class UserController {
  /**
   * Get user profile with completeness indicators
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getProfile = ErrorHandler.asyncHandler(async (req, res) => {
    // Use service to get user profile with completeness data
    const result = await UserService.getUserProfile(req.user.id);
    
    return ApiResponse.success(res, result, 'Profile retrieved successfully');
  });
  /**
   * Update user profile with change tracking
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static updateProfile = ErrorHandler.asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    // Use service to update user profile
    const result = await UserService.updateUserProfile(req.user.id, req.body);

    // Log profile update
    securityMonitor.logActivity(req.user.id, {
      type: 'profile_update',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      changes: result.changes,
      success: true
    });

    return ApiResponse.success(res, { user: result.user }, 'Profile updated successfully');
  });
  /**
   * Upload profile image
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static uploadProfileImage = ErrorHandler.asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('No image file provided');
    }

    // Use service to update profile image
    const result = await UserService.updateProfileImage(req.user.id, req.file.filename);

    // Log profile image update
    securityMonitor.logActivity(req.user.id, {
      type: 'profile_image_update',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    return ApiResponse.success(res, result, 'Profile image uploaded successfully');
  });
  /**
   * Change user password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static changePassword = ErrorHandler.asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { currentPassword, newPassword } = req.body;

    // Use service to change password
    const result = await UserService.changePassword(req.user.id, currentPassword, newPassword, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Log successful password change
    securityMonitor.logActivity(req.user.id, {
      type: 'password_change',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    return ApiResponse.success(res, {
      tokenInvalidated: true
    }, 'Password changed successfully. Please log in again.');
  });
  /**
   * Deactivate user account (soft delete)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static deactivateAccount = ErrorHandler.asyncHandler(async (req, res) => {
    const { reason } = req.body;

    // Use service to deactivate account
    await UserService.deactivateAccount(req.user.id, reason);

    // Log account deactivation
    securityMonitor.logActivity(req.user.id, {
      type: 'account_deactivation',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      reason: reason,
      success: true
    });

    return ApiResponse.success(res, null, 'Account deactivated successfully. Your data has been retained and can be reactivated by contacting support.');
  });
  /**
   * Export user data (GDPR compliance)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static exportData = ErrorHandler.asyncHandler(async (req, res) => {
    // Use service to export user data
    const exportData = await UserService.exportUserData(req.user.id);

    // Log data export
    securityMonitor.logActivity(req.user.id, {
      type: 'data_export',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    return ApiResponse.success(res, exportData, 'Data exported successfully');
  });
  /**
   * Permanently delete user account and all data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static deleteAccount = ErrorHandler.asyncHandler(async (req, res) => {
    const { confirmationText } = req.body;

    // Require explicit confirmation
    if (confirmationText !== 'DELETE MY ACCOUNT') {
      throw new ValidationError('Please type "DELETE MY ACCOUNT" to confirm permanent deletion');
    }

    // Use service to delete account
    await UserService.deleteAccount(req.user.id);

    // Log account deletion
    securityMonitor.logActivity(req.user.id, {
      type: 'account_deletion',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    return ApiResponse.success(res, null, 'Account and all associated data have been permanently deleted');
  });
  /**
   * Get multer upload middleware
   */
  static getUploadMiddleware() {
    return upload.single('profileImage');
  }/**
   * Get user preferences
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getPreferences = ErrorHandler.asyncHandler(async (req, res) => {
    // Use service to get user preferences
    const result = await UserService.getUserPreferences(req.user.id);

    return ApiResponse.success(res, result, 'Preferences retrieved successfully');
  });
  /**
   * Update user preferences
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static updatePreferences = ErrorHandler.asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    // Use service to update user preferences
    const result = await UserService.updateUserPreferences(req.user.id, req.body);

    // Log preferences update
    securityMonitor.logActivity(req.user.id, {
      type: 'preferences_update',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      changes: result.changes,
      success: true
    });

    return ApiResponse.success(res, result, 'Preferences updated successfully');
  });
}

module.exports = UserController;
