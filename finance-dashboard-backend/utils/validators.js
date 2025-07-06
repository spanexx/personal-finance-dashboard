/**
 * Custom Validators Utility
 * Centralized validation rules and custom validators
 */

const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Common field validators that can be reused across different entities
 */
class CommonValidators {
  // Email validation
  static email() {
    return body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address');
  }

  // Password validation
  static password() {
    return body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
  }

  // Name validation
  static name(field) {
    return body(field)
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage(`${field} must be between 2 and 50 characters`)
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage(`${field} can only contain letters, spaces, hyphens, and apostrophes`);
  }

  // MongoDB ObjectId validation
  static mongoId(field = 'id') {
    return param(field)
      .isMongoId()
      .withMessage(`${field} must be a valid MongoDB ObjectId`);
  }

  // Amount validation (for financial amounts)
  static amount(field = 'amount') {
    return body(field)
      .isFloat({ min: 0.01 })
      .withMessage(`${field} must be a positive number`)
      .custom((value) => {
        // Check for reasonable decimal precision (2 decimal places)
        const decimalPlaces = (value.toString().split('.')[1] || '').length;
        if (decimalPlaces > 2) {
          throw new Error(`${field} cannot have more than 2 decimal places`);
        }
        return true;
      });
  }

  // Date validation
  static date(field = 'date') {
    return body(field)
      .optional()
      .isISO8601()
      .withMessage(`${field} must be a valid ISO 8601 date`)
      .toDate();
  }

  // String length validation
  static string(field, minLength = 1, maxLength = 255) {
    return body(field)
      .trim()
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${field} must be between ${minLength} and ${maxLength} characters`);
  }

  // Optional string validation
  static optionalString(field, maxLength = 255) {
    return body(field)
      .optional()
      .trim()
      .isLength({ max: maxLength })
      .withMessage(`${field} must not exceed ${maxLength} characters`);
  }

  // Array validation
  static array(field, itemValidator = null) {
    const validators = [
      body(field)
        .optional()
        .isArray()
        .withMessage(`${field} must be an array`)
    ];

    if (itemValidator) {
      validators.push(
        body(`${field}.*`)
          .custom(itemValidator)
      );
    }

    return validators;
  }

  // Enum validation
  static enum(field, allowedValues) {
    return body(field)
      .isIn(allowedValues)
      .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`);
  }

  // URL validation
  static url(field) {
    return body(field)
      .optional()
      .isURL()
      .withMessage(`${field} must be a valid URL`);
  }

  // Boolean validation
  static boolean(field) {
    return body(field)
      .optional()
      .isBoolean()
      .withMessage(`${field} must be a boolean value`);
  }

  // Phone number validation
  static phone(field = 'phone') {
    return body(field)
      .optional()
      .isMobilePhone()
      .withMessage(`${field} must be a valid phone number`);
  }

  // Currency validation
  static currency(field = 'currency') {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR'];
    return body(field)
      .optional()
      .isIn(validCurrencies)
      .withMessage(`${field} must be a valid currency code`);
  }

  // Language validation
  static language(field = 'language') {
    const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ar'];
    return body(field)
      .optional()
      .isIn(validLanguages)
      .withMessage(`${field} must be a valid language code`);
  }

  // Timezone validation
  static timezone(field = 'timezone') {
    return body(field)
      .optional()
      .custom((value) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: value });
          return true;
        } catch (error) {
          throw new Error(`${field} must be a valid timezone`);
        }
      });
  }
}

/**
 * Entity-specific validation rules
 */
class EntityValidators {
  // User validation rules
  static userRegistration() {
    return [
      CommonValidators.email(),
      CommonValidators.password(),
      CommonValidators.name('firstName'),
      CommonValidators.name('lastName')
    ];
  }

  static userLogin() {
    return [
      CommonValidators.email(),
      body('password').notEmpty().withMessage('Password is required')
    ];
  }

  static userProfile() {
    return [
      CommonValidators.name('firstName'),
      CommonValidators.name('lastName'),
      CommonValidators.phone(),
      CommonValidators.currency(),
      CommonValidators.language(),
      CommonValidators.timezone()
    ];
  }

  // Transaction validation rules
  static transaction() {
    return [
      CommonValidators.amount(),
      CommonValidators.enum('type', ['income', 'expense', 'transfer']),
      body('category').isMongoId().withMessage('Category must be a valid category ID'),
      CommonValidators.string('description', 1, 500),
      CommonValidators.date(),
      CommonValidators.optionalString('notes', 1000),
      CommonValidators.optionalString('payee', 100),
      CommonValidators.optionalString('location', 200),
      ...CommonValidators.array('tags', (value) => {
        if (typeof value !== 'string' || value.length < 1 || value.length > 50) {
          throw new Error('Each tag must be between 1 and 50 characters');
        }
        return true;
      })
    ];
  }

  // Budget validation rules
  static budget() {
    return [
      CommonValidators.string('name', 1, 100),
      CommonValidators.amount('totalAmount'),
      CommonValidators.enum('period', ['weekly', 'monthly', 'quarterly', 'yearly']),
      CommonValidators.date('startDate'),
      CommonValidators.date('endDate'),
      CommonValidators.boolean('rolloverEnabled'),
      body('categoryAllocations')
        .optional()
        .isArray()
        .withMessage('Category allocations must be an array'),
      body('categoryAllocations.*.category')
        .isMongoId()
        .withMessage('Each category allocation must have a valid category ID'),
      body('categoryAllocations.*.allocatedAmount')
        .isFloat({ min: 0 })
        .withMessage('Each allocated amount must be a positive number')
    ];
  }

  // Goal validation rules
  static goal() {
    return [
      CommonValidators.string('name', 1, 100),
      CommonValidators.optionalString('description', 500),
      CommonValidators.amount('targetAmount'),
      CommonValidators.amount('currentAmount'),
      CommonValidators.date('startDate'),
      CommonValidators.date('targetDate'),
      CommonValidators.enum('priority', ['low', 'medium', 'high']),
      CommonValidators.enum('type', ['savings', 'debt_payoff', 'investment', 'purchase', 'emergency_fund', 'other']),
      CommonValidators.enum('status', ['active', 'completed', 'paused', 'cancelled']),
      body('category')
        .optional()
        .isMongoId()
        .withMessage('Category must be a valid category ID')
    ];
  }

  // Category validation rules
  static category() {
    return [
      CommonValidators.string('name', 1, 50),
      CommonValidators.enum('type', ['income', 'expense']),
      body('color')
        .optional()
        .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
        .withMessage('Color must be a valid hex color code'),
      body('icon')
        .optional()
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Icon must contain only alphanumeric characters, underscores, and hyphens'),
      body('parent')
        .optional()
        .isMongoId()
        .withMessage('Parent must be a valid category ID')
    ];
  }
}

/**
 * Query parameter validators
 */
class QueryValidators {
  static pagination() {
    return [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .toInt(),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
        .toInt()
    ];
  }

  static sorting() {
    return [
      query('sortBy')
        .optional()
        .isString()
        .withMessage('Sort field must be a string'),
      query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be "asc" or "desc"')
    ];
  }

  static dateRange() {
    return [
      query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date')
        .toDate(),
      query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date')
        .toDate()
    ];
  }

  static search() {
    return [
      query('search')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search term must be between 1 and 100 characters')
    ];
  }

  static transactionFilters() {
    return [
      ...this.pagination(),
      ...this.sorting(),
      ...this.dateRange(),
      ...this.search(),
      query('category')
        .optional()
        .isMongoId()
        .withMessage('Category filter must be a valid category ID'),
      query('type')
        .optional()
        .isIn(['income', 'expense', 'transfer'])
        .withMessage('Type filter must be income, expense, or transfer'),
      query('minAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Minimum amount must be a positive number')
        .toFloat(),
      query('maxAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Maximum amount must be a positive number')
        .toFloat()
    ];
  }
}

module.exports = {
  CommonValidators,
  EntityValidators,
  QueryValidators
};
