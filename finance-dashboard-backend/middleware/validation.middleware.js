/**
 * Validation Middleware
 * Centralized validation middleware using standardized validators
 */

const { validationResult, body, param, query } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');
const { ValidationError } = require('../utils/errorHandler');
const { EntityValidators, QueryValidators, CommonValidators } = require('../utils/validators');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const mongoose = require('mongoose');

/**
 * Validation middleware class with standardized error handling and validation rules
 */
class ValidationMiddleware {  /**
   * Handle validation results and format errors consistently
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */  static handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      // Use the first error message as the main message for tests
      const firstErrorMsg = errors.array()[0].msg;
      const validationError = new Error(firstErrorMsg);
      validationError.type = 'ValidationError';
      validationError.errors = errors.array().map(error => ({
        path: error.path || error.param || 'unknown',
        msg: error.msg,
        value: error.value,
        location: error.location
      }));

      return next(validationError);
    }
    
    next();
  }

  // === AUTHENTICATION VALIDATORS ===
  
  /**
   * Validate user registration data
   */
  static validateUserRegistration() {
    return [
      ...EntityValidators.userRegistration(),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate user login data
   */
  static validateUserLogin() {
    return [
      ...EntityValidators.userLogin(),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate user profile update data
   */
  static validateUserProfile() {
    return [
      ...EntityValidators.userProfile(),
      this.handleValidationErrors
    ];
  }

  // === USER PROFILE VALIDATORS ===

  /**
   * Validate comprehensive user profile update data including address and preferences
   */
  static validateUserProfileUpdate() {
    return [
      body('firstName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),
      body('lastName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),
      body('phone')
        .optional()
        .isMobilePhone()
        .withMessage('Please provide a valid phone number'),
      body('dateOfBirth')
        .optional()
        .isISO8601()
        .withMessage('Please provide a valid date'),
      body('address.street')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Street address cannot exceed 100 characters'),
      body('address.city')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('City cannot exceed 50 characters'),
      body('address.state')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('State cannot exceed 50 characters'),
      body('address.postalCode')
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage('Postal code cannot exceed 20 characters'),
      body('address.country')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Country cannot exceed 50 characters'),
      body('preferences')
        .optional()
        .isObject()
        .withMessage('Preferences must be an object'),
      ValidationMiddleware.handleValidationErrors
    ];
  }

  /**
   * Validate account deactivation request
   */
  static validateAccountDeactivation() {
    return [
      body('reason')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Reason cannot exceed 500 characters'),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate account deletion confirmation
   */
  static validateAccountDeletion() {
    return [
      body('confirmationText')
        .equals('DELETE MY ACCOUNT')
        .withMessage('Please type "DELETE MY ACCOUNT" to confirm deletion'),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate user preferences update
   */
  static validateUserPreferences() {
    return [
      body('currency')
        .optional()
        .isIn(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'NGN'])
        .withMessage('Invalid currency'),
      body('dateFormat')
        .optional()
        .isIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'])
        .withMessage('Invalid date format'),
      body('language')
        .optional()
        .isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'])
        .withMessage('Invalid language'),
      body('theme')
        .optional()
        .isIn(['light', 'dark', 'system'])
        .withMessage('Invalid theme'),
      this.handleValidationErrors
    ];
  }

  // === PASSWORD VALIDATORS ===

  /**
   * Validate password strength check request
   */
  static validatePasswordStrengthCheck() {
    return [
      body('password')
        .notEmpty()
        .withMessage('Password is required'),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate forgot password request
   */
  static validateForgotPassword() {
    return [
      CommonValidators.email(),
      this.handleValidationErrors
    ];
  }
  /**
   * Validate password reset request
   */
  static validatePasswordReset() {
    return [
      body('token')
        .notEmpty()
        .withMessage('Reset token is required'),
      CommonValidators.password(),
      this.handleValidationErrors
    ];
  }
  /**
   * Validate password reset with token from URL parameter
   */
  static validatePasswordResetWithToken() {
    return [
      param('token')
        .notEmpty()
        .withMessage('Invalid or expired reset token')
        .isLength({ min: 32 })
        .withMessage('Invalid or expired reset token'),
      CommonValidators.password(),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate password change request
   */
  static validatePasswordChange() {
    return [
      body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
      body('newPassword')
        .isLength({ min: 8, max: 128 })
        .withMessage('New password must be between 8 and 128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
      this.handleValidationErrors
    ];
  }
  /**
   * Validate password generation request
   */
  static validatePasswordGeneration() {
    return [
      body('length')
        .optional()
        .isInt({ min: 8, max: 128 })
        .withMessage('Password length must be between 8 and 128 characters'),
      body('options')
        .optional()
        .isObject()
        .withMessage('Options must be an object'),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate password history check request
   */
  static validatePasswordHistoryCheck() {
    return [
      body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 1 })
        .withMessage('Password cannot be empty'),
      this.handleValidationErrors
    ];
  }

  // === TRANSACTION VALIDATORS ===

  /**
   * Validate transaction creation/update data
   */
  static validateTransaction() {
    return [
      ...EntityValidators.transaction(),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate transaction ID parameter
   */
  static validateTransactionId() {
    return [
      CommonValidators.mongoId('id'),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate transaction query parameters
   */
  static validateTransactionQuery() {
    return [
      ...QueryValidators.transactionFilters(),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate date range parameters
   */
  static validateDateRange(req, res, next) {
    const { startDate, endDate } = req.query;
    
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return ApiResponse.badRequest(res, 'Start date must be before end date');
    }
    
    next();
  }

  /**
   * Validate amount range parameters
   */
  static validateAmountRange(req, res, next) {
    const { minAmount, maxAmount } = req.query;
    
    if (minAmount && maxAmount && parseFloat(minAmount) > parseFloat(maxAmount)) {
      return ApiResponse.badRequest(res, 'Minimum amount must be less than maximum amount');
    }
    
    next();
  }

  /**
   * Validate transaction ownership (middleware function)
   */
  static async validateTransactionOwnership(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const transaction = await Transaction.findById(id);
      
      if (!transaction) {
        return ApiResponse.notFound(res, 'Transaction not found');
      }

      if (transaction.user.toString() !== userId) {
        return ApiResponse.forbidden(res, 'Access denied: Transaction belongs to another user');
      }

      req.transaction = transaction;
      next();
    } catch (error) {
      return ApiResponse.error(res, 'Error validating transaction ownership', error);
    }
  }

  // === BUDGET VALIDATORS ===

  /**
   * Validate budget creation/update data
   */
  static validateBudget() {
    return [
      ...EntityValidators.budget(),
      this.handleValidationErrors
    ];
  }
  /**
   * Validate budget ID parameter
   */
  static validateBudgetId() {
    return [
      (req, res, next) => {
        const id = req.params.id;
        const isValid = mongoose.Types.ObjectId.isValid(id);
        console.log(`[validateBudgetId] Incoming id: ${id}, isValid: ${isValid}`);
        if (!isValid) {
          console.error(`[validateBudgetId] Invalid ObjectId received:`, id);
        }
        next();
      },
      CommonValidators.mongoId('id'),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate budget creation data with comprehensive rules
   */
  static validateBudgetCreation() {
    return [
      body('name')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Budget name must be between 1 and 100 characters'),
      
      body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
      
      body('period')
        .isIn(['weekly', 'monthly', 'quarterly', 'yearly'])
        .withMessage('Invalid period'),
      
      body('startDate')
        .isISO8601()
        .withMessage('Invalid start date format'),
      
      body('endDate')
        .isISO8601()
        .withMessage('Invalid end date format'),
      
      body('totalAmount')
        .isFloat({ min: 0.01 })
        .withMessage('Total amount must be greater than 0'),
      
      body('categoryAllocations')
        .isArray({ min: 1 })
        .withMessage('At least one category allocation is required'),
      
      body('categoryAllocations.*.category')
        .isMongoId()
        .withMessage('Invalid category ID'),
      
      body('categoryAllocations.*.allocatedAmount')
        .isFloat({ min: 0.01 })
        .withMessage('Allocated amount must be greater than 0'),
      
      body('categoryAllocations.*.percentage')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Percentage must be between 0 and 100'),
      
      body('alertSettings.enabled')
        .optional()
        .isBoolean(),
      
      body('alertSettings.thresholds.warning')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Warning threshold must be between 0 and 100'),
      
      body('alertSettings.thresholds.critical')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Critical threshold must be between 0 and 100'),
      
      body('isActive')
        .optional()
        .isBoolean(),
      
      body('templateId')
        .optional()
        .isMongoId()
        .withMessage('Invalid template ID'),
      
      body('rolloverSettings.enabled')
        .optional()
        .isBoolean(),
      
      body('rolloverSettings.carryOverUnspent')
        .optional()
        .isBoolean(),
      
      body('rolloverSettings.adjustForInflation')
        .optional()
        .isBoolean(),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validate budget update data
   */
  static validateBudgetUpdate() {
    return [
      param('id').isMongoId().withMessage('Invalid budget ID'),
      
      body('name')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Budget name must be between 1 and 100 characters'),
      
      body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
      
      body('startDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date format'),
      
      body('endDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date format'),
      
      body('totalAmount')
        .optional()
        .isFloat({ min: 0.01 })
        .withMessage('Total amount must be greater than 0'),
      
      body('categoryAllocations')
        .optional()
        .isArray({ min: 1 })
        .withMessage('At least one category allocation is required'),
      
      body('categoryAllocations.*.category')
        .optional()
        .isMongoId()
        .withMessage('Invalid category ID'),
      
      body('categoryAllocations.*.allocatedAmount')
        .optional()
        .isFloat({ min: 0.01 })
        .withMessage('Allocated amount must be greater than 0'),
      
      body('alertSettings.enabled')
        .optional()
        .isBoolean(),
      
      body('alertSettings.thresholds.warning')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Warning threshold must be between 0 and 100'),
      
      body('alertSettings.thresholds.critical')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Critical threshold must be between 0 and 100'),
      
      body('isActive')
        .optional()
        .isBoolean(),
      
      this.handleValidationErrors
    ];
  }

  /**
   * Validate budget query parameters
   */
  static validateBudgetQuery() {
    return [
      query('period').optional().isIn(['weekly', 'monthly', 'quarterly', 'yearly']),
      query('status').optional().isIn(['active', 'inactive', 'expired', 'all']),
      query('includeExpired').optional().isBoolean(),
      query('includeInactive').optional().isBoolean(),
      query('page').optional().isInt({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 100 }),
      query('sortBy').optional().isIn(['name', 'startDate', 'endDate', 'totalAmount', 'createdAt']),
      query('sortOrder').optional().isIn(['asc', 'desc']),
      query('search').optional().isLength({ min: 1, max: 100 }),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate budget deletion parameters
   */
  static validateBudgetDeletion() {
    return [
      param('id').isMongoId().withMessage('Invalid budget ID'),
      query('permanent').optional().isBoolean(),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate budget analysis query parameters
   */
  static validateBudgetAnalysis() {
    return [
      param('id').isMongoId().withMessage('Invalid budget ID'),
      query('includeProjections').optional().isBoolean(),
      query('includeTrends').optional().isBoolean(),
      query('includeComparisons').optional().isBoolean(),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate optimization recommendations query
   */
  static validateOptimizationQuery() {
    return [
      query('budgetIds').optional().custom((value) => {
        if (typeof value === 'string') {
          const ids = value.split(',');
          return ids.every(id => require('mongoose').Types.ObjectId.isValid(id));
        }
        return false;
      }).withMessage('Invalid budget IDs format'),
      query('includeGlobal').optional().isBoolean(),
      query('timeframe').optional().isInt({ min: 1, max: 12 }),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate budget rollover data
   */
  static validateBudgetRollover() {
    return [
      param('id').isMongoId().withMessage('Invalid budget ID'),
      body('startDate').isISO8601().withMessage('Invalid start date format'),
      body('adjustments').optional().isObject(),
      body('carryOverUnspent').optional().isBoolean(),
      body('adjustForInflation').optional().isBoolean(),
      body('inflationRate').optional().isFloat({ min: 0, max: 50 }),
      this.handleValidationErrors
    ];
  }
  /**
   * Validate bulk budget operations
   */
  static validateBulkBudgetOperation() {
    return [
      body('budgetIds').isArray({ min: 1 }).withMessage('Budget IDs array is required'),
      body('budgetIds.*').isMongoId().withMessage('Invalid budget ID'),
      body('updates').isObject().withMessage('Updates object is required'),
      body('operation').isIn(['activate', 'deactivate', 'delete', 'update']).withMessage('Invalid operation'),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate optimization query parameters
   */
  static validateOptimizationQuery() {
    return [
      query('budgetIds').optional().custom((value) => {
        if (typeof value === 'string') {
          const ids = value.split(',');
          return ids.every(id => mongoose.Types.ObjectId.isValid(id));
        }
        return false;
      }).withMessage('Invalid budget IDs format'),
      query('includeGlobal').optional().isBoolean(),
      query('timeframe').optional().isInt({ min: 1, max: 12 }),
      this.handleValidationErrors
    ];
  }

  // === GOAL VALIDATORS ===

  /**
   * Validate goal creation/update data
   */
  static validateGoal() {
    return [
      ...EntityValidators.goal(),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate goal ID parameter
   */
  static validateGoalId() {
    return [
      CommonValidators.mongoId('id'),
      this.handleValidationErrors
    ];
  }

  // === CATEGORY VALIDATORS ===

  /**
   * Validate category creation/update data
   */
  static validateCategory() {
    return [
      ...EntityValidators.category(),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate category ID parameter
   */
  static validateCategoryId() {
    return [
      CommonValidators.mongoId('id'),
      this.handleValidationErrors
    ];
  }

  // === FILE UPLOAD VALIDATORS ===

  /**
   * Validate file upload data
   */
  static validateFileUpload() {
    return [
      // File validation is handled by multer middleware
      // Additional validation can be added here
      this.handleValidationErrors
    ];
  }

  /**
   * Validate uploaded file (middleware function)
   */
  static validateUploadedFile(req, res, next) {
    if (!req.file) {
      return ApiResponse.badRequest(res, 'No file uploaded');
    }

    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return ApiResponse.badRequest(res, 'Invalid file type. Only CSV and Excel files are allowed');
    }

    // Check file size (10MB limit)
    if (req.file.size > 10 * 1024 * 1024) {
      return ApiResponse.badRequest(res, 'File size too large. Maximum size is 10MB');
    }

    next();
  }

  // === BULK OPERATION VALIDATORS ===

  /**
   * Validate bulk operation data
   */
  static validateBulkOperation() {
    return [
      // Validate operation type
      CommonValidators.enum('operation', ['update', 'delete', 'restore', 'categorize']),
      
      // Validate transaction IDs array
      ...CommonValidators.array('transactionIds', (value) => {
        if (!value || typeof value !== 'string') {
          throw new Error('Each transaction ID must be a string');
        }
        // Validate MongoDB ObjectId format
        if (!/^[0-9a-fA-F]{24}$/.test(value)) {
          throw new Error('Each transaction ID must be a valid MongoDB ObjectId');
        }
        return true;
      }),
      
      this.handleValidationErrors
    ];
  }

  // === ANALYTICS VALIDATORS ===

  /**
   * Validate analytics query parameters
   */
  static validateAnalyticsQuery() {
    return [
      ...QueryValidators.dateRange(),
      QueryValidators.search()[0], // Only include search, not pagination
      this.handleValidationErrors
    ];
  }

  // === UTILITY VALIDATORS ===

  /**
   * Validate pagination parameters
   */
  static validatePagination() {
    return [
      ...QueryValidators.pagination(),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate sorting parameters
   */
  static validateSorting() {
    return [
      ...QueryValidators.sorting(),
      this.handleValidationErrors
    ];
  }

  /**
   * Custom validation for business rules
   */
  static async validateBusinessRules(req, res, next) {
    try {
      const { body, params, user } = req;

      // Example: Validate category ownership for transactions
      if (body.category) {
        const category = await Category.findOne({ 
          _id: body.category, 
          user: user.id 
        });
        
        if (!category) {
          return ApiResponse.badRequest(res, 'Category not found or access denied');
        }

        // Validate category type matches transaction type
        if (body.type && category.type !== body.type) {
          return ApiResponse.badRequest(res, 
            `Category type (${category.type}) does not match transaction type (${body.type})`
          );
        }
      }

      next();
    } catch (error) {
      return ApiResponse.error(res, 'Error validating business rules', error);
    }
  }

  // === EMAIL VERIFICATION VALIDATORS ===

  /**
   * Validate email for verification operations
   */
  static validateEmailVerificationRequest() {
    return [
      CommonValidators.email().normalizeEmail(),
      this.handleValidationErrors
    ];
  }
  /**
   * Validate email verification with token
   */
  static validateEmailVerification() {
    return [
      param('token')
        .notEmpty()
        .isLength({ min: 32, max: 64 })
        .withMessage('Invalid or expired verification token'),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate email parameter for verification status
   */
  static validateEmailVerificationStatus() {
    return [
      param('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
      this.handleValidationErrors
    ];
  }

  // === EMAIL PREFERENCES VALIDATORS ===

  /**
   * Validate email preferences update
   */
  static validateEmailPreferences() {
    return [
      body('securityAlerts').optional().isBoolean().withMessage('Security alerts must be a boolean'),
      body('marketingEmails').optional().isBoolean().withMessage('Marketing emails must be a boolean'),
      body('transactionalEmails').optional().isBoolean().withMessage('Transactional emails must be a boolean'),
      body('weeklyReports').optional().isBoolean().withMessage('Weekly reports must be a boolean'),
      body('budgetAlerts').optional().isBoolean().withMessage('Budget alerts must be a boolean'),
      body('goalReminders').optional().isBoolean().withMessage('Goal reminders must be a boolean'),
      body('productUpdates').optional().isBoolean().withMessage('Product updates must be a boolean'),
      body('newsletter').optional().isBoolean().withMessage('Newsletter must be a boolean'),
      body('frequency').optional().isIn(['immediate', 'daily', 'weekly']).withMessage('Invalid frequency'),
      body('unsubscribeToken').optional().isString().withMessage('Unsubscribe token must be a string'),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate email unsubscribe request
   */
  static validateEmailUnsubscribe() {
    return [
      body('reason').optional().isString().trim().isLength({ max: 500 }).withMessage('Reason must be a string with max 500 characters'),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate email unsubscribe by type
   */
  static validateEmailUnsubscribeByType() {
    return [
      param('type').isIn(['security', 'marketing', 'transactional', 'reports', 'alerts', 'reminders', 'updates', 'newsletter'])
        .withMessage('Invalid email type'),
      body('token').notEmpty().withMessage('Unsubscribe token is required'),
      CommonValidators.email(),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate bulk email settings update
   */
  static validateBulkEmailSettings() {
    return [
      body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
      body('rateLimits.daily').optional().isInt({ min: 0 }).withMessage('Daily rate limit must be a positive integer'),
      body('rateLimits.hourly').optional().isInt({ min: 0 }).withMessage('Hourly rate limit must be a positive integer'),
      body('rateLimits.perUser').optional().isInt({ min: 0 }).withMessage('Per user rate limit must be a positive integer'),
      body('templates.enabled').optional().isBoolean().withMessage('Templates enabled must be a boolean'),
      body('templates.defaultLanguage').optional().isString().withMessage('Default language must be a string'),
      body('queue.maxRetries').optional().isInt({ min: 0 }).withMessage('Max retries must be a positive integer'),
      body('queue.retryDelay').optional().isInt({ min: 0 }).withMessage('Retry delay must be a positive integer'),
      body('queue.batchSize').optional().isInt({ min: 1 }).withMessage('Batch size must be at least 1'),
      this.handleValidationErrors
    ];
  }
}

module.exports = ValidationMiddleware;