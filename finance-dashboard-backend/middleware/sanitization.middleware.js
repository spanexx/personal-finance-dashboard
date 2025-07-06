/**
 * Input Sanitization Middleware
 * Provides comprehensive input sanitization against XSS, NoSQL injection, and other attacks
 */

const mongoSanitize = require('express-mongo-sanitize');
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * HTML entities for XSS prevention
 */
const htmlEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
  '=': '&#x3D;'
};

/**
 * Escape HTML entities to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
const escapeHtml = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'`=\/]/g, (s) => htmlEntities[s]);
};

/**
 * Deep sanitize object recursively
 * @param {*} obj - Object to sanitize
 * @param {Object} options - Sanitization options
 * @returns {*} - Sanitized object
 */
const deepSanitize = (obj, options = {}) => {
  const {
    escapeHtml: shouldEscapeHtml = true,
    trimStrings = true,
    removeEmptyStrings = false,
    maxStringLength = 10000,
    allowedFields = null // Array of allowed field names
  } = options;

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item, options));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Skip disallowed fields if allowedFields is specified
      if (allowedFields && !allowedFields.includes(key)) {
        continue;
      }
      
      // Sanitize the key itself
      const sanitizedKey = shouldEscapeHtml ? escapeHtml(key) : key;
      
      // Recursively sanitize the value
      sanitized[sanitizedKey] = deepSanitize(value, options);
    }
    
    return sanitized;
  }

  // Handle strings
  if (typeof obj === 'string') {
    let sanitized = obj;
    
    // Trim whitespace
    if (trimStrings) {
      sanitized = sanitized.trim();
    }
    
    // Remove empty strings if requested
    if (removeEmptyStrings && sanitized === '') {
      return undefined;
    }
    
    // Limit string length
    if (sanitized.length > maxStringLength) {
      sanitized = sanitized.substring(0, maxStringLength);
      logger.warn('String truncated due to length limit', {
        originalLength: obj.length,
        maxLength: maxStringLength
      });
    }
    
    // Escape HTML entities
    if (shouldEscapeHtml) {
      sanitized = escapeHtml(sanitized);
    }
    
    return sanitized;
  }

  // Return primitive values as-is
  return obj;
};

/**
 * Remove potentially dangerous patterns
 * @param {*} obj - Object to clean
 * @returns {*} - Cleaned object
 */
const removeDangerousPatterns = (obj) => {
  if (typeof obj === 'string') {
    // Remove script tags and event handlers
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:text\/html/gi, '');
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeDangerousPatterns);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = removeDangerousPatterns(value);
    }
    return cleaned;
  }
  
  return obj;
};

/**
 * Request size validation middleware
 */
const validateRequestSize = (maxSize = 1024 * 1024) => { // 1MB default
  return (req, res, next) => {
    const contentLength = parseInt(req.get('content-length') || 0);
    
    if (contentLength > maxSize) {
      logger.warn('Request size exceeded limit', {
        contentLength,
        maxSize,
        ip: req.ip,
        path: req.path
      });
      
      return res.status(413).json({
        success: false,
        error: 'Request too large',
        message: 'Request size exceeds maximum allowed limit'
      });
    }
    
    next();
  };
};

/**
 * Input sanitization middleware
 */
const sanitizeInput = (options = {}) => {
  return (req, res, next) => {
    try {
      // Sanitize request body
      if (req.body) {
        req.body = deepSanitize(req.body, options);
        req.body = removeDangerousPatterns(req.body);
      }
      
      // Sanitize query parameters
      if (req.query) {
        req.query = deepSanitize(req.query, { ...options, escapeHtml: false }); // Don't escape HTML in query params
      }
      
      // Sanitize route parameters
      if (req.params) {
        req.params = deepSanitize(req.params, { ...options, escapeHtml: false });
      }
      
      next();
    } catch (error) {
      logger.error('Error during input sanitization:', error);
      res.status(400).json({
        success: false,
        error: 'Invalid input format',
        message: 'Request contains invalid or malformed data'
      });
    }
  };
};

/**
 * NoSQL injection prevention middleware
 */
const preventNoSQLInjection = mongoSanitize({
  replaceWith: '_', // Replace prohibited characters with underscore
  onSanitize: ({ req, key }) => {
    logger.warn('NoSQL injection attempt detected', {
      ip: req.ip,
      path: req.path,
      key,
      userAgent: req.get('user-agent')
    });
  }
});

/**
 * Common validation rules
 */
const commonValidationRules = {
  // Email validation
  email: () => body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  // Password validation
  password: () => body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  // Name validation
  name: (field) => body(field)
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage(`${field} must be between 1 and 50 characters`)
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(`${field} can only contain letters, spaces, hyphens, and apostrophes`),
  
  // Amount validation (for financial data)
  amount: (field = 'amount') => body(field)
    .isFloat({ min: 0.01, max: 999999999.99 })
    .withMessage(`${field} must be a positive number with up to 2 decimal places`)
    .toFloat(),
  
  // Date validation
  date: (field) => body(field)
    .isISO8601()
    .withMessage(`${field} must be a valid date in ISO 8601 format`)
    .toDate(),
  
  // ID validation (MongoDB ObjectId)
  objectId: (field) => param(field)
    .isMongoId()
    .withMessage(`${field} must be a valid ID`),
  
  // Optional text field
  optionalText: (field, maxLength = 500) => body(field)
    .optional()
    .trim()
    .isLength({ max: maxLength })
    .withMessage(`${field} cannot exceed ${maxLength} characters`),
  
  // Required text field
  requiredText: (field, minLength = 1, maxLength = 500) => body(field)
    .trim()
    .isLength({ min: minLength, max: maxLength })
    .withMessage(`${field} must be between ${minLength} and ${maxLength} characters`),
  
  // Enum validation
  enum: (field, allowedValues) => body(field)
    .isIn(allowedValues)
    .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`),
  
  // Boolean validation
  boolean: (field) => body(field)
    .isBoolean()
    .withMessage(`${field} must be true or false`)
    .toBoolean(),
  
  // Array validation
  array: (field, maxItems = 100) => body(field)
    .isArray({ max: maxItems })
    .withMessage(`${field} must be an array with at most ${maxItems} items`),
  
  // URL validation
  url: (field) => body(field)
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage(`${field} must be a valid URL`),
  
  // Phone number validation
  phone: (field) => body(field)
    .optional()
    .isMobilePhone()
    .withMessage(`${field} must be a valid phone number`),
  
  // Currency code validation
  currency: (field = 'currency') => body(field)
    .isLength({ min: 3, max: 3 })
    .isAlpha()
    .toUpperCase()
    .withMessage(`${field} must be a valid 3-letter currency code`),
  
  // Pagination parameters
  page: () => query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a positive integer between 1 and 1000')
    .toInt(),
  
  limit: () => query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  // Search query
  search: () => query('q')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query cannot exceed 100 characters')
    .escape() // Escape HTML entities
};

/**
 * Validation error handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));
    
    logger.warn('Validation errors in request', {
      ip: req.ip,
      path: req.path,
      errors: formattedErrors
    });
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'Please check your input and try again',
      details: formattedErrors
    });
  }
  
  next();
};

/**
 * Content type validation middleware
 */
const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    // Skip for GET requests
    if (req.method === 'GET') {
      return next();
    }
    
    const contentType = req.get('content-type');
    
    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing content type',
        message: 'Content-Type header is required'
      });
    }
    
    const isAllowed = allowedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );
    
    if (!isAllowed) {
      return res.status(415).json({
        success: false,
        error: 'Unsupported media type',
        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`
      });
    }
    
    next();
  };
};

module.exports = {
  sanitizeInput,
  preventNoSQLInjection,
  validateRequestSize,
  handleValidationErrors,
  validateContentType,
  commonValidationRules,
  deepSanitize,
  removeDangerousPatterns,
  escapeHtml
};
