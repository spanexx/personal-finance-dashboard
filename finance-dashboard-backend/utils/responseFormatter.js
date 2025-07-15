/**
 * Response Formatter Utility
 * Provides response objects for JSON responses without directly sending them
 */
class ResponseFormatter {
  /**
   * Success response object
   * @param {string} message - Success message
   * @param {*} data - Response data
   * @param {Object} meta - Additional metadata (pagination, etc.)
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  static success(message = 'Success', data = null, meta = null, statusCode = 200) {
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

    return response;
  }

  /**
   * Error response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 400)
   * @param {*} errors - Detailed error information
   * @param {string} code - Error code for client handling
   */
  static error(message = 'An error occurred', statusCode = 400, errors = null, code = null) {
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

    return response;
  }

  /**
   * Validation error response object
   * @param {Array|Object} validationErrors - Validation error details
   * @param {string} message - Error message
   */
  static validationError(validationErrors, message = 'Validation failed') {
    return this.error(message, 422, validationErrors, 'VALIDATION_ERROR');
  }

  /**
   * Not found response object
   * @param {string} message - Not found message
   * @param {string} resource - Resource type that was not found
   */
  static notFound(message = 'Resource not found', resource = null) {
    const errorMessage = resource ? `${resource} not found` : message;
    return this.error(errorMessage, 404, null, 'NOT_FOUND');
  }

  /**
   * Unauthorized response object
   * @param {string} message - Unauthorized message
   */
  static unauthorized(message = 'Unauthorized access') {
    return this.error(message, 401, null, 'UNAUTHORIZED');
  }

  /**
   * Forbidden response object
   * @param {string} message - Forbidden message
   */
  static forbidden(message = 'Access forbidden') {
    return this.error(message, 403, null, 'FORBIDDEN');
  }

  /**
   * Internal server error response object
   * @param {string} message - Error message
   * @param {*} error - Error object for logging
   */
  static serverError(message = 'Internal server error', error = null) {
    // Log the actual error for debugging (don't expose to client)
    if (error && process.env.NODE_ENV === 'development') {
      console.error('Server Error:', error);
    }
    
    return this.error(message, 500, null, 'INTERNAL_ERROR');
  }

  /**
   * Created response object (for successful resource creation)
   * @param {string} message - Success message
   * @param {*} data - Created resource data
   */
  static created(message = 'Resource created successfully', data = null) {
    return this.success(message, data, null, 201);
  }

  /**
   * No content response object (for successful deletion)
   * @param {string} message - Success message
   */
  static noContent(message = 'Resource deleted successfully') {
    return this.success(message, null, null, 204);
  }

  /**
   * Paginated response object
   * @param {string} message - Success message
   * @param {Array} data - Array of items
   * @param {Object} pagination - Pagination metadata
   */
  static paginated(message = 'Data retrieved successfully', data = [], pagination = {}) {
    const meta = {
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
        hasNext: (pagination.page || 1) < Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
        hasPrev: (pagination.page || 1) > 1
      }
    };

    return this.success(message, data, meta);
  }

  /**
   * File upload success response object
   * @param {Object} fileInfo - File information
   * @param {number} processedCount - Number of processed records
   * @param {Array} errors - Processing errors if any
   */
  static uploadSuccess(fileInfo, processedCount = 0, errors = []) {
    const data = {
      file: fileInfo,
      processedRecords: processedCount,
      hasErrors: errors.length > 0,
      errors: errors.length > 0 ? errors : undefined
    };

    const message = errors.length > 0 
      ? `File uploaded with ${errors.length} errors. ${processedCount} records processed.`
      : `File uploaded successfully. ${processedCount} records processed.`;

    return this.success(message, data);
  }

  /**
   * Bulk operation response object
   * @param {Object} results - Bulk operation results
   * @param {string} operation - Operation type (create, update, delete)
   */
  static bulkOperation(results, operation = 'operation') {
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

    return this.success(message, data);
  }
}

module.exports = ResponseFormatter;
