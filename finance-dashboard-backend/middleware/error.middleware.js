/**
 * Global Error Handling Middleware
 * Provides centralized error handling with security-focused error responses
 */

const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');

/**
 * Error types for classification
 */
const ERROR_TYPES = {
  VALIDATION: 'ValidationError',
  AUTHENTICATION: 'AuthenticationError',
  AUTHORIZATION: 'AuthorizationError',
  NOT_FOUND: 'NotFoundError',
  CONFLICT: 'ConflictError',
  RATE_LIMIT: 'RateLimitError',
  DATABASE: 'DatabaseError',
  NETWORK: 'NetworkError',
  FILE_SYSTEM: 'FileSystemError',
  EXTERNAL_API: 'ExternalAPIError',
  INTERNAL_SERVER: 'InternalServerError'
};

/**
 * Security error classifications
 */
const SECURITY_ERRORS = [
  ERROR_TYPES.AUTHENTICATION,
  ERROR_TYPES.AUTHORIZATION,
  ERROR_TYPES.RATE_LIMIT
];

/**
 * Create standardized error response
 * @param {Error} error - The error object
 * @param {string} requestId - Unique request identifier
 * @returns {Object} Standardized error response
 */
const createErrorResponse = (error, requestId) => {
  const baseResponse = {
    success: false,
    timestamp: new Date().toISOString(),
    requestId,
    message: error.message || 'An unexpected error occurred'
  };

  // For validation errors, include the errors array that tests expect
  if (error.type === ERROR_TYPES.VALIDATION) {
    if (error.errors && Array.isArray(error.errors)) {
      // From express-validator
      baseResponse.errors = error.errors.map(err => ({
        path: err.path || err.param,
        msg: err.msg || err.message,
        value: err.value,
        location: err.location
      }));
    } else if (error.details && Array.isArray(error.details)) {
      // From custom validation
      baseResponse.errors = error.details.map(detail => ({
        path: detail.field,
        msg: detail.message,
        value: detail.value
      }));
    } else {
      // Fallback for other validation errors
      baseResponse.errors = [{ 
        path: 'general', 
        msg: error.message,
        value: null 
      }];
    }
  }

  // Add additional fields for development environment
  if (process.env.NODE_ENV === 'development') {
    baseResponse.error = {
      type: error.type || ERROR_TYPES.INTERNAL_SERVER,
      stack: error.stack,
      details: error.details
    };
  }

  return baseResponse;
};

/**
 * Determine HTTP status code from error type
 * @param {string} errorType - Error type
 * @returns {number} HTTP status code
 */
const getStatusCode = (errorType) => {
  const statusMap = {
    [ERROR_TYPES.VALIDATION]: StatusCodes.UNPROCESSABLE_ENTITY, // 422 for validation errors
    [ERROR_TYPES.AUTHENTICATION]: StatusCodes.UNAUTHORIZED,
    [ERROR_TYPES.AUTHORIZATION]: StatusCodes.FORBIDDEN,
    [ERROR_TYPES.NOT_FOUND]: StatusCodes.NOT_FOUND,
    [ERROR_TYPES.CONFLICT]: StatusCodes.CONFLICT,
    [ERROR_TYPES.RATE_LIMIT]: StatusCodes.TOO_MANY_REQUESTS,
    [ERROR_TYPES.DATABASE]: StatusCodes.INTERNAL_SERVER_ERROR,
    [ERROR_TYPES.NETWORK]: StatusCodes.BAD_GATEWAY,
    [ERROR_TYPES.FILE_SYSTEM]: StatusCodes.INTERNAL_SERVER_ERROR,
    [ERROR_TYPES.EXTERNAL_API]: StatusCodes.BAD_GATEWAY,
    [ERROR_TYPES.INTERNAL_SERVER]: StatusCodes.INTERNAL_SERVER_ERROR
  };

  return statusMap[errorType] || StatusCodes.INTERNAL_SERVER_ERROR;
};

/**
 * Log security events
 * @param {Error} error - The error object
 * @param {Object} req - Express request object
 */
const logSecurityEvent = (error, req) => {
  if (SECURITY_ERRORS.includes(error.type)) {
    logger.security('Security error occurred', {
      errorType: error.type,
      message: error.message,
      userId: req.user?.id,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      endpoint: `${req.method} ${req.originalUrl}`,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Handle JWT errors
 * @param {Error} error - JWT error
 * @returns {Error} Standardized error
 */
const handleJWTError = (error) => {
  const jwtError = new Error();
  
  if (error.name === 'JsonWebTokenError') {
    jwtError.type = ERROR_TYPES.AUTHENTICATION;
    jwtError.message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    jwtError.type = ERROR_TYPES.AUTHENTICATION;
    jwtError.message = 'Authentication token has expired';
  } else if (error.name === 'NotBeforeError') {
    jwtError.type = ERROR_TYPES.AUTHENTICATION;
    jwtError.message = 'Authentication token not active';
  } else {
    jwtError.type = ERROR_TYPES.AUTHENTICATION;
    jwtError.message = 'Authentication failed';
  }
  
  return jwtError;
};

/**
 * Handle database errors
 * @param {Error} error - Database error
 * @returns {Error} Standardized error
 */
const handleDatabaseError = (error) => {
  const dbError = new Error();
  
  if (error.code === 11000) {
    // MongoDB duplicate key error
    dbError.type = ERROR_TYPES.CONFLICT;
    
    // Extract field name from error
    let field = 'resource';
    if (error.keyPattern) {
      field = Object.keys(error.keyPattern)[0];
    } else if (error.message && error.message.includes('email')) {
      field = 'email';
    } else if (error.message && error.message.includes('username')) {
      field = 'username';
    }
    
    if (field === 'email') {
      dbError.message = 'Email already exists';
    } else if (field === 'username') {
      dbError.message = 'Username already exists';
    } else {
      dbError.message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    }
  } else if (error.name === 'ValidationError') {
    dbError.type = ERROR_TYPES.VALIDATION;
    dbError.message = 'Invalid data provided';
    dbError.errors = Object.values(error.errors).map(err => ({
      path: err.path,
      msg: err.message,
      value: err.value
    }));
  } else if (error.name === 'CastError') {
    dbError.type = ERROR_TYPES.VALIDATION;
    dbError.message = 'Invalid data format';
  } else if (error.name === 'MongoNetworkError') {
    dbError.type = ERROR_TYPES.DATABASE;
    dbError.message = 'Database connection failed';
  } else {
    dbError.type = ERROR_TYPES.DATABASE;
    dbError.message = 'Database operation failed';
  }
  
  return dbError;
};

/**
 * Handle validation errors from express-validator
 * @param {Error} error - Validation error
 * @returns {Error} Standardized error
 */
const handleValidationError = (error) => {
  const validationError = new Error();
  validationError.type = ERROR_TYPES.VALIDATION;
  
  if (error.errors && Array.isArray(error.errors)) {
    validationError.message = 'Validation failed';
    validationError.details = error.errors.map(err => ({
      field: err.path || err.param,
      message: err.msg || err.message,
      value: err.value
    }));
  } else {
    validationError.message = error.message || 'Invalid input data';
  }
  
  return validationError;
};

/**
 * Transform and classify errors
 * @param {Error} error - Original error
 * @returns {Error} Transformed error with proper classification
 */
const transformError = (error) => {
  // Handle custom error classes from utils/errorHandler.js
  if (error.name && ['ValidationError', 'AuthenticationError', 'AuthorizationError', 'NotFoundError', 'ConflictError', 'RateLimitError'].includes(error.name)) {
    // These errors already have proper statusCode and structure
    return error;
  }

  // Already transformed error
  if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
    return error;
  }

  // Handle validation errors from ValidationMiddleware
  if (error.type === 'ValidationError' || error.message === 'Validation failed') {
    const transformedError = new Error(error.message);
    transformedError.type = ERROR_TYPES.VALIDATION;
    transformedError.errors = error.errors || [];
    return transformedError;
  }

  // JWT errors
  if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
    return handleJWTError(error);
  }

  // Database errors
  if (['ValidationError', 'CastError', 'MongoError', 'MongoNetworkError'].includes(error.name) || error.code === 11000) {
    return handleDatabaseError(error);
  }

  // Express-validator errors (backup check)
  if (error.errors && Array.isArray(error.errors)) {
    return handleValidationError(error);
  }

  // Rate limiting errors
  if (error.message && (error.message.includes('rate limit') || error.message.includes('Too many requests'))) {
    const rateLimitError = new Error('Too many requests');
    rateLimitError.type = ERROR_TYPES.RATE_LIMIT;
    return rateLimitError;
  }

  // Conflict errors (e.g., duplicate email)
  if (error.message && (error.message.includes('already exists') || error.message.includes('duplicate'))) {
    const conflictError = new Error(error.message);
    conflictError.type = ERROR_TYPES.CONFLICT;
    return conflictError;
  }

  // Authentication errors
  if (error.message && (error.message.includes('Invalid credentials') || error.message.includes('Authentication'))) {
    const authError = new Error(error.message);
    authError.type = ERROR_TYPES.AUTHENTICATION;
    return authError;
  }

  // Authorization errors
  if (error.message && (error.message.includes('Access denied') || error.message.includes('Forbidden'))) {
    const authzError = new Error(error.message);
    authzError.type = ERROR_TYPES.AUTHORIZATION;
    return authzError;
  }

  // Not found errors
  if (error.message && error.message.includes('not found')) {
    const notFoundError = new Error(error.message);
    notFoundError.type = ERROR_TYPES.NOT_FOUND;
    return notFoundError;
  }

  // File system errors
  if (error.code && ['ENOENT', 'EACCES', 'EMFILE', 'ENOTDIR'].includes(error.code)) {
    const fsError = new Error('File system operation failed');
    fsError.type = ERROR_TYPES.FILE_SYSTEM;
    return fsError;
  }

  // Network errors
  if (error.code && ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'].includes(error.code)) {
    const networkError = new Error('Network operation failed');
    networkError.type = ERROR_TYPES.NETWORK;
    return networkError;
  }

  // Default to internal server error
  const internalError = new Error('Internal server error');
  internalError.type = ERROR_TYPES.INTERNAL_SERVER;
  return internalError;
};

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const globalErrorHandler = (err, req, res, next) => {
  // Generate unique request ID if not present
  const requestId = req.requestId || require('crypto').randomUUID();

  // Transform and classify the error
  const transformedError = transformError(err);

  // Log the error to the console for immediate visibility
  console.error('Global error handler caught error:', {
    error: {
      type: transformedError.type,
      message: transformedError.message,
      stack: err.stack,
      details: transformedError.details
    },
    request: {
      id: requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    },
    timestamp: new Date().toISOString()
  });

  // Log the error (file/logger)
  logger.error('Global error handler caught error', {
    error: {
      type: transformedError.type,
      message: transformedError.message,
      stack: err.stack,
      details: transformedError.details
    },
    request: {
      id: requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    },
    timestamp: new Date().toISOString()
  });
  // Log security events
  logSecurityEvent(transformedError, req);

  // Determine status code - use statusCode from custom error classes if available
  const statusCode = transformedError.statusCode || getStatusCode(transformedError.type);

  // Create standardized response
  const errorResponse = createErrorResponse(transformedError, requestId);

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Handle 404 Not Found errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Resource not found: ${req.originalUrl}`);
  error.type = ERROR_TYPES.NOT_FOUND;
  next(error);
};

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function with error handling
 */
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create custom error with type
 * @param {string} message - Error message
 * @param {string} type - Error type
 * @param {Object} details - Additional error details
 * @returns {Error} Custom error object
 */
const createError = (message, type = ERROR_TYPES.INTERNAL_SERVER, details = null) => {
  const error = new Error(message);
  error.type = type;
  if (details) {
    error.details = details;
  }
  return error;
};

module.exports = {
  globalErrorHandler,
  notFoundHandler,
  asyncErrorHandler,
  createError,
  ERROR_TYPES
};
