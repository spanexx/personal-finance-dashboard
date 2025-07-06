/**
 * Email Preferences Routes
 * Routes for managing user email preferences and notifications
 */

const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth } = require('../middleware/auth.middleware');
const ValidationMiddleware = require('../middleware/validation.middleware');
const {
  getEmailPreferences,
  updateEmailPreferences,
  unsubscribeFromEmails,
  resubscribeToEmails,
  unsubscribeFromEmailType,
  getBulkEmailSettings,
  updateBulkEmailSettings
} = require('../controllers/emailPreferences.controller');

/**
 * @route   GET /api/email-preferences
 * @desc    Get user's email preferences
 * @access  Private
 */
router.get('/', verifyToken, getEmailPreferences);

/**
 * @route   PUT /api/email-preferences
 * @desc    Update user's email preferences
 * @access  Private
 */
router.put(
  '/',
  verifyToken,
  ValidationMiddleware.validateEmailPreferences(),
  updateEmailPreferences
);

/**
 * @route   POST /api/email-preferences/unsubscribe
 * @desc    Unsubscribe from all emails
 * @access  Private
 */
router.post(
  '/unsubscribe',
  verifyToken,
  ValidationMiddleware.validateEmailUnsubscribe(),
  unsubscribeFromEmails
);

/**
 * @route   POST /api/email-preferences/resubscribe
 * @desc    Resubscribe to emails
 * @access  Private
 */
router.post('/resubscribe', verifyToken, resubscribeToEmails);

/**
 * @route   POST /api/email-preferences/unsubscribe/:type
 * @desc    Unsubscribe from specific email type
 * @access  Public (with token)
 */
router.post(
  '/unsubscribe/:type',
  ValidationMiddleware.validateEmailUnsubscribeByType(),
  unsubscribeFromEmailType
);

/**
 * @route   GET /api/email-preferences/bulk-settings
 * @desc    Get bulk email settings (admin only)
 * @access  Private (Admin)
 */
router.get('/bulk-settings', verifyToken, getBulkEmailSettings);

/**
 * @route   PUT /api/email-preferences/bulk-settings
 * @desc    Update bulk email settings (admin only)
 * @access  Private (Admin)
 */
router.put(
  '/bulk-settings',
  verifyToken,
  ValidationMiddleware.validateBulkEmailSettings(),
  updateBulkEmailSettings
);

module.exports = router;
