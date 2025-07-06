// Error handling utilities

const ApiResponse = require('./apiResponse');

/**
 * Custom error classes for different types of application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = [], suggestions = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
    this.suggestions = suggestions;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(message = null, resource = 'Resource', id = null) {
    // If a custom message is provided, use it, otherwise generate one
    const errorMessage = message || (id ? `${resource} with ID ${id} not found` : `${resource} not found`);
    super(errorMessage, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
    this.resource = resource;
    this.resourceId = id;
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = null) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

class FileProcessingError extends AppError {
  constructor(message = 'File processing failed', details = null) {
    super(message, 422, 'FILE_PROCESSING_ERROR');
    this.name = 'FileProcessingError';
    this.details = details;
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message = 'External service error', statusCode = 503) {
    super(message, statusCode, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
    this.service = service;
  }
}

/**
 * Error Handler utility class
 */
class ErrorHandler {  /**
   * Handle and format errors for API responses
   * @param {Error} error - The error to handle
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */  static handleError(error, req, res, next) {
    // Log error based on type
    if (this.isOperationalError(error)) {
      console.warn('Operational Error:', {
        message: error.message,
        statusCode: error.statusCode,
        path: req ? req.url : undefined,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('Unexpected Error:', {
        message: error.message,
        stack: error.stack,
        path: req ? req.url : undefined,
        timestamp: new Date().toISOString()
      });
    }

    // Create common response properties
    const baseResponse = {
      success: false,
      timestamp: new Date().toISOString(),
      path: req ? req.url : undefined
    };

    // Handle known error types
    if (error instanceof ValidationError) {
      const response = {
        ...baseResponse,
        message: error.message,
        errors: error.errors
      };
      
      if (error.suggestions) {
        response.suggestions = error.suggestions;
      }
      
      return res.status(error.statusCode).json(response);
    }

    if (error instanceof AuthenticationError) {
      return res.status(error.statusCode).json({
        ...baseResponse,
        message: error.message
      });
    }

    if (error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        ...baseResponse,
        message: error.message
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({
        ...baseResponse,
        message: error.message,
        resource: error.resource
      });
    }

    if (error instanceof ConflictError) {
      return res.status(error.statusCode).json({
        ...baseResponse,
        message: error.message,
        code: error.code
      });
    }    if (error instanceof RateLimitError) {
      const response = {
        ...baseResponse,
        message: error.message
      };
      
      if (error.retryAfter) {
        response.retryAfter = error.retryAfter;
      }
      
      return res.status(error.statusCode).json(response);
    }

    if (error instanceof FileProcessingError) {
      return res.status(error.statusCode).json({
        ...baseResponse,
        message: error.message,
        details: error.details,
        code: error.code
      });
    }

    if (error instanceof DatabaseError) {
      const message = process.env.NODE_ENV === 'production' 
        ? 'Database operation failed' 
        : error.message;
      return res.status(error.statusCode).json({
        ...baseResponse,
        message,
        ...(process.env.NODE_ENV !== 'production' && error.originalError && {
          details: error.originalError
        })
      });
    }

    if (error instanceof ExternalServiceError) {
      return res.status(error.statusCode).json({
        ...baseResponse,
        message: error.message,
        service: error.service,
        code: error.code
      });
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = this.formatMongooseValidationError(error);
      return res.status(400).json({
        ...baseResponse,
        message: 'Validation failed',
        errors: validationErrors
      });
    }    // Handle Mongoose cast errors (invalid ObjectId, etc.)
    if (error.name === 'CastError') {
      const message = `Invalid data format`;
      return res.status(400).json({
        ...baseResponse,
        message,
        field: error.path,
        value: error.value
      });
    }    // Handle Mongoose duplicate key errors
    if (error.code === 11000) {
      const { message, field } = this.formatDuplicateKeyError(error);
      return res.status(409).json({
        ...baseResponse,
        message,
        field
      });
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        ...baseResponse,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        ...baseResponse,
        message: 'Token expired'
      });
    }

    // Handle multer errors (file upload)
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        ...baseResponse,
        message: 'File too large',
        code: 'FILE_TOO_LARGE'
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        ...baseResponse,
        message: 'Unexpected file field',
        code: 'INVALID_FILE_FIELD'
      });
    }

    // Handle operational vs programming errors
    if (error.isOperational === false) {
      // Programming error - log it but don't expose details
      this.logError(error, req, 'PROGRAMMING_ERROR');
      return res.status(500).json({
        ...baseResponse,
        message: 'Something went wrong'
      });
    }    // Generic error handling
    const statusCode = error.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Something went wrong'
      : error.message || 'Something went wrong';

    return res.status(statusCode).json({
      ...baseResponse,
      message,
      ...(error.code && { code: error.code }),
      ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && {
        stack: error.stack
      })
    });
  }

  /**
   * Format Mongoose validation errors
   * @param {Error} error - Mongoose validation error
   * @returns {Object} Formatted validation errors
   */  static formatMongooseValidationError(error) {
    const errors = [];
    
    Object.keys(error.errors).forEach(key => {
      const err = error.errors[key];
      errors.push({
        field: key,
        message: err.message,
        value: err.value,
        kind: err.kind
      });
    });

    return errors;
  }  /**
   * Format MongoDB duplicate key errors
   * @param {Error} error - MongoDB duplicate key error
   * @returns {string} Formatted error message
   */
  static formatDuplicateKeyError(error) {
    if (error.keyPattern && typeof error.keyPattern === 'object') {
      const field = Object.keys(error.keyPattern)[0];
      return { message: 'Resource already exists', field };
    }
    if (error.keyValue && typeof error.keyValue === 'object') {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      return { message: `${field} '${value}' already exists`, field };
    }
    return { message: 'Resource already exists', field: 'unknown' };
  }
  /**
   * Log errors for debugging and monitoring
   * @param {Error} error - The error to log
   * @param {Object} req - Express request object
   * @param {string} type - Error type for categorization
   */
  static logError(error, req = null, type = 'APPLICATION_ERROR') {
    const errorLog = {
      type,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      statusCode: error.statusCode,
      code: error.code
    };

    if (req) {
      errorLog.request = {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
        userAgent: req.get ? req.get('User-Agent') : req.headers?.['user-agent'],
        userId: req.user?.id || 'anonymous'
      };
    }

    // In production, you might want to send this to a logging service
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Log:', JSON.stringify(errorLog, null, 2));
    } else {
      // For production, log to file or external service
      console.error(`[${type}] ${error.message}`);
    }
  }
  /**
   * Async error wrapper for route handlers
   * @param {Function} fn - Async function to wrap
   * @returns {Function} Wrapped function with error handling
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      try {
        Promise.resolve(fn(req, res, next)).catch(next);
      } catch (error) {
        next(error);
      }
    };
  }
  /**
   * Create a middleware function for handling specific error types
   * @param {Function} errorClass - Error class constructor
   * @param {string} message - Default error message
   * @returns {Function} Middleware function
   */
  static createErrorMiddleware(errorClass, message) {
    return (req, res, next) => {
      next(new errorClass(message));
    };
  }

  /**
   * Check if an error is operational (expected) or programming error
   * @param {Error} error - The error to check
   * @returns {boolean} True if error is operational
   */
  static isOperationalError(error) {
    if (!error) return false;
    return error.isOperational === true;
  }
}

// Export error classes and handler
module.exports = {
  ErrorHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  FileProcessingError,
  DatabaseError,
  ExternalServiceError
};
