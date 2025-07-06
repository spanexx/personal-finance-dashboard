const express = require('express');
const AuthController = require('../controllers/auth.controller');
const { verifyToken, verifyRefreshToken, securityHeaders } = require('../middleware/auth.middleware');
const { 
  validatePasswordStrength, 
  checkPasswordHistory, 
  validateResetToken, 
  rateLimitPasswordReset,
  sanitizePasswordFields
} = require('../middleware/password.middleware');
const ValidationMiddleware = require('../middleware/validation.middleware');

const router = express.Router();

// Apply security headers to all auth routes
router.use(securityHeaders);

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', [
  sanitizePasswordFields,
  ...ValidationMiddleware.validateUserRegistration(),
  validatePasswordStrength
], AuthController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', ValidationMiddleware.validateUserLogin(), AuthController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public (requires refresh token)
 */
router.post('/refresh', AuthController.refreshToken);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token (alternative endpoint)
 * @access  Public (requires refresh token)
 */
router.post('/refresh-token', AuthController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (revoke current refresh token)
 * @access  Private
 */
router.post('/logout', verifyToken, AuthController.logout);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all devices (revoke all refresh tokens)
 * @access  Private
 */
router.post('/logout-all', verifyToken, AuthController.logoutAll);

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', verifyToken, AuthController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', [
  verifyToken,
  ...ValidationMiddleware.validateUserProfile()
], AuthController.updateProfile);

/**
 * @route   GET /api/auth/sessions
 * @desc    Get active sessions
 * @access  Private
 */
router.get('/sessions', verifyToken, AuthController.getSessions);

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    Revoke a specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId', verifyToken, AuthController.revokeSession);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify token
 * @access  Private
 */
router.get('/verify', verifyToken, AuthController.verifyToken);

// Password Security Routes

/**
 * @route   POST /api/auth/password/check-strength
 * @desc    Check password strength
 * @access  Public
 */
router.post('/password/check-strength', [
  sanitizePasswordFields,
  ...ValidationMiddleware.validatePasswordStrengthCheck()
], AuthController.checkPasswordStrength);

/**
 * @route   POST /api/auth/password/forgot
 * @desc    Initiate password reset
 * @access  Public
 */
router.post('/password/forgot', [
  rateLimitPasswordReset,
  ...ValidationMiddleware.validateForgotPassword()
], AuthController.forgotPassword);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Initiate password reset (alternative endpoint)
 * @access  Public
 */
router.post('/forgot-password', [
  rateLimitPasswordReset,
  ...ValidationMiddleware.validateForgotPassword()
], AuthController.forgotPassword);

/**
 * @route   POST /api/auth/password/reset
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/password/reset', [
  sanitizePasswordFields,
  validateResetToken,
  ...ValidationMiddleware.validatePasswordReset(),
  validatePasswordStrength
], AuthController.resetPassword);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password with token (alternative endpoint)
 * @access  Public
 */
router.post('/reset-password/:token', [
  sanitizePasswordFields,
  ...ValidationMiddleware.validatePasswordResetWithToken(),
  validatePasswordStrength
], AuthController.resetPasswordWithToken);

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify email with token
 * @access  Public
 */
router.get('/verify-email/:token', [
  ...ValidationMiddleware.validateEmailVerification()
], AuthController.verifyEmail);

/**
 * @route   POST /api/auth/password/check-history
 * @desc    Check if password was recently used
 * @access  Private
 */
router.post('/password/check-history', [
  verifyToken,
  sanitizePasswordFields,
  ...ValidationMiddleware.validatePasswordHistoryCheck()
], AuthController.checkPasswordHistory);

/**
 * @route   POST /api/auth/password/change
 * @desc    Change password (authenticated user)
 * @access  Private
 */
router.post('/password/change', [
  verifyToken,
  sanitizePasswordFields,
  ...ValidationMiddleware.validatePasswordChange(),
  validatePasswordStrength,
  checkPasswordHistory
], AuthController.changePassword);

/**
 * @route   POST /api/auth/password/generate
 * @desc    Generate secure password
 * @access  Public
 */
router.post('/password/generate', ValidationMiddleware.validatePasswordGeneration(), AuthController.generatePassword);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification
 * @access  Public
 */
router.post('/resend-verification', [
  ...ValidationMiddleware.validateEmailVerificationRequest()
], AuthController.resendEmailVerification);

module.exports = router;
