/**
 * Email Verification Routes
 * Routes for email verification and related operations
 */

const express = require('express');
const emailVerificationController = require('../controllers/emailVerification.controller');
const { verifyToken, optionalAuth } = require('../middleware/auth.middleware');
const ValidationMiddleware = require('../middleware/validation.middleware');

const router = express.Router();

/**
 * @route   POST /api/email-verification/send
 * @desc    Send email verification
 * @access  Public
 */
router.post('/send', 
  ValidationMiddleware.validateEmailVerificationRequest(),
  emailVerificationController.sendEmailVerification
);

/**
 * @route   POST /api/email-verification/verify
 * @desc    Verify email address
 * @access  Public
 */
router.post('/verify', 
  ValidationMiddleware.validateEmailVerification(),
  emailVerificationController.verifyEmail
);

/**
 * @route   POST /api/email-verification/resend
 * @desc    Resend email verification
 * @access  Public
 */
router.post('/resend', 
  ValidationMiddleware.validateEmailVerificationRequest(),
  emailVerificationController.resendEmailVerification
);

/**
 * @route   GET /api/email-verification/status/:email
 * @desc    Get email verification status
 * @access  Public
 */
router.get('/status/:email', 
  ValidationMiddleware.validateEmailVerificationStatus(),
  emailVerificationController.getVerificationStatus
);

/**
 * @route   GET /api/email-verification/analytics
 * @desc    Get email verification analytics (admin only)
 * @access  Private (Admin)
 */
router.get('/analytics', 
  verifyToken, 
  // TODO: Add admin middleware when implemented
  emailVerificationController.getVerificationAnalytics
);

module.exports = router;
