/**
 * Helper Functions
 * Common utility functions used across the application
 */

/**
 * Create standardized API response
 * @param {string} status - Response status (success, error, warning)
 * @param {string} message - Response message
 * @param {*} data - Response data
 * @param {Object} meta - Additional metadata
 * @returns {Object} Standardized response object
 */
function createResponse(status, message, data = null, meta = {}) {
  const response = {
    status,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  if (Object.keys(meta).length > 0) {
    response.meta = meta;
  }

  return response;
}

/**
 * Generate unique filename
 * @param {string} originalName - Original filename
 * @param {string} prefix - Optional prefix
 * @returns {string} Unique filename
 */
function generateUniqueFilename(originalName, prefix = '') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop();
  const baseName = originalName.split('.').slice(0, -1).join('.');
  
  return `${prefix}${prefix ? '_' : ''}${baseName}_${timestamp}_${random}.${extension}`;
}

/**
 * Format file size to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate file type
 * @param {string} mimeType - File MIME type
 * @param {Array} allowedTypes - Array of allowed MIME types
 * @returns {boolean} Is file type allowed
 */
function isAllowedFileType(mimeType, allowedTypes = []) {
  if (allowedTypes.length === 0) {
    // Default allowed types
    const defaultTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    return defaultTypes.includes(mimeType);
  }
  
  return allowedTypes.includes(mimeType);
}

/**
 * Generate secure random string
 * @param {number} length - String length
 * @returns {string} Random string
 */
function generateRandomString(length = 16) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

/**
 * Sanitize filename for safe storage
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  // Remove or replace dangerous characters
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Parse pagination parameters
 * @param {Object} query - Query parameters
 * @returns {Object} Parsed pagination
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

module.exports = {
  createResponse,
  generateUniqueFilename,
  formatFileSize,
  isAllowedFileType,
  generateRandomString,
  sanitizeFilename,
  parsePagination
};
