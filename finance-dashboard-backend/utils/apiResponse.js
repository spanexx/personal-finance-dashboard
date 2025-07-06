// Standardized API responses

/**
 * Standardized API Response utility
 * Provides consistent response format across all endpoints
 */
class ApiResponse {
  /**
   * Success response
   * @param {Object} res - Express response object
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code (default: 200)
   * @param {Object} meta - Additional metadata (pagination, etc.)
   */
  static success(res, data = null, message = 'Success', statusCode = 200, meta = null) {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      statusCode
    };

    if (meta) {
      response.meta = meta;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 400)
   * @param {*} errors - Detailed error information
   * @param {string} code - Error code for client handling
   */
  static error(res, message = 'An error occurred', statusCode = 400, errors = null, code = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
      statusCode
    };

    if (errors) {
      response.errors = errors;
    }

    if (code) {
      response.code = code;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Validation error response
   * @param {Object} res - Express response object
   * @param {Array|Object} validationErrors - Validation error details
   * @param {string} message - Error message
   */
  static validationError(res, validationErrors, message = 'Validation failed') {
    return this.error(res, message, 422, validationErrors, 'VALIDATION_ERROR');
  }

  /**
   * Not found response
   * @param {Object} res - Express response object
   * @param {string} message - Not found message
   * @param {string} resource - Resource type that was not found
   */
  static notFound(res, message = 'Resource not found', resource = null) {
    const errorMessage = resource ? `${resource} not found` : message;
    return this.error(res, errorMessage, 404, null, 'NOT_FOUND');
  }

  /**
   * Unauthorized response
   * @param {Object} res - Express response object
   * @param {string} message - Unauthorized message
   */
  static unauthorized(res, message = 'Unauthorized access') {
    return this.error(res, message, 401, null, 'UNAUTHORIZED');
  }

  /**
   * Forbidden response
   * @param {Object} res - Express response object
   * @param {string} message - Forbidden message
   */
  static forbidden(res, message = 'Access forbidden') {
    return this.error(res, message, 403, null, 'FORBIDDEN');
  }

  /**
   * Internal server error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {*} error - Error object for logging
   */
  static serverError(res, message = 'Internal server error', error = null) {
    // Log the actual error for debugging (don't expose to client)
    if (error && process.env.NODE_ENV === 'development') {
      console.error('Server Error:', error);
    }
    
    return this.error(res, message, 500, null, 'INTERNAL_ERROR');
  }

  /**
   * Created response (for successful resource creation)
   * @param {Object} res - Express response object
   * @param {*} data - Created resource data
   * @param {string} message - Success message
   */
  static created(res, data, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  }

  /**
   * No content response (for successful deletion)
   * @param {Object} res - Express response object
   * @param {string} message - Success message
   */
  static noContent(res, message = 'Resource deleted successfully') {
    return this.success(res, null, message, 204);
  }

  /**
   * Paginated response
   * @param {Object} res - Express response object
   * @param {Array} data - Array of items
   * @param {Object} pagination - Pagination metadata
   * @param {string} message - Success message
   */
  static paginated(res, data, pagination, message = 'Data retrieved successfully') {
    const meta = {
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1
      }
    };

    return this.success(res, data, message, 200, meta);
  }

  /**
   * File upload success response
   * @param {Object} res - Express response object
   * @param {Object} fileInfo - File information
   * @param {number} processedCount - Number of processed records
   * @param {Array} errors - Processing errors if any
   */
  static uploadSuccess(res, fileInfo, processedCount = 0, errors = []) {
    const data = {
      file: fileInfo,
      processedRecords: processedCount,
      hasErrors: errors.length > 0,
      errors: errors.length > 0 ? errors : undefined
    };

    const message = errors.length > 0 
      ? `File uploaded with ${errors.length} errors. ${processedCount} records processed.`
      : `File uploaded successfully. ${processedCount} records processed.`;

    return this.success(res, data, message, 200);
  }

  /**
   * Bulk operation response
   * @param {Object} res - Express response object
   * @param {Object} results - Bulk operation results
   * @param {string} operation - Operation type (create, update, delete)
   */
  static bulkOperation(res, results, operation = 'operation') {
    const { successful, failed, total } = results;
    
    const data = {
      total,
      successful: successful.length,
      failed: failed.length,
      successfulItems: successful,
      failedItems: failed.length > 0 ? failed : undefined
    };

    const message = failed.length > 0
      ? `Bulk ${operation} completed with ${failed.length} failures. ${successful.length}/${total} items processed successfully.`
      : `Bulk ${operation} completed successfully. ${successful.length}/${total} items processed.`;

    return this.success(res, data, message);
  }
}

module.exports = ApiResponse;
