const express = require('express');
const UserController = require('../controllers/user.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const ValidationMiddleware = require('../middleware/validation.middleware');

const router = express.Router();

// All user routes require authentication
router.use(verifyToken);

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile with completeness indicators
 * @access  Private
 */
router.get('/profile', UserController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  ...ValidationMiddleware.validateUserProfileUpdate(),
  UserController.updateProfile
);

/**
 * @route   POST /api/users/upload-profile-image
 * @desc    Upload profile image
 * @access  Private
 */
router.post('/upload-profile-image', 
  UserController.getUploadMiddleware(),
  UserController.uploadProfileImage
);

/**
 * @route   PUT /api/users/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', 
  ValidationMiddleware.validatePasswordChange(),
  UserController.changePassword
);

/**
 * @route   POST /api/users/deactivate
 * @desc    Deactivate user account (soft delete)
 * @access  Private
 */
router.post('/deactivate', 
  ValidationMiddleware.validateAccountDeactivation(),
  UserController.deactivateAccount
);

/**
 * @route   GET /api/users/export-data
 * @desc    Export user data (GDPR compliance)
 * @access  Private
 */
router.get('/export-data', UserController.exportData);

/**
 * @route   DELETE /api/users/account
 * @desc    Permanently delete user account and all data
 * @access  Private
 */
router.delete('/account', 
  ValidationMiddleware.validateAccountDeletion(),
  UserController.deleteAccount
);

/**
 * @route   GET /api/users/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get('/preferences', UserController.getPreferences);

/**
 * @route   PUT /api/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', 
  ValidationMiddleware.validateUserPreferences(),
  UserController.updatePreferences
);

module.exports = router;
