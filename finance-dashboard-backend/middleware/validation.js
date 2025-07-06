/**
 * Upload Validation Middleware
 * Validates upload requests and file metadata
 */

const { body, param, query, validationResult } = require('express-validator');
const { createResponse } = require('../utils/helpers');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(
      createResponse('error', 'Validation failed', {
        errors: errors.array()
      })
    );
  }
  next();
};

/**
 * Validation rules for single file upload
 */
const validateSingle = [
  body('entityType')
    .isIn(['transaction', 'user_avatar', 'document', 'receipt'])
    .withMessage('Invalid entity type'),
  
  body('entityId')
    .optional()
    .isMongoId()
    .withMessage('Invalid entity ID format'),
  
  body('generateThumbnail')
    .optional()
    .isBoolean()
    .withMessage('generateThumbnail must be a boolean'),
  
  handleValidationErrors
];

/**
 * Validation rules for multiple file upload
 */
const validateMultiple = [
  body('entityType')
    .isIn(['transaction', 'document', 'receipt'])
    .withMessage('Invalid entity type for multiple upload'),
  
  body('entityId')
    .optional()
    .isMongoId()
    .withMessage('Invalid entity ID format'),
  
  body('generateThumbnail')
    .optional()
    .isBoolean()
    .withMessage('generateThumbnail must be a boolean'),
  
  handleValidationErrors
];

/**
 * Validation rules for avatar upload
 */
const validateAvatar = [
  // Custom validation to check if file is an image
  (req, res, next) => {
    if (!req.file) {
      return res.status(400).json(
        createResponse('error', 'Avatar file is required', null)
      );
    }
    
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json(
        createResponse('error', 'Avatar must be an image file', null)
      );
    }
    
    next();
  }
];

/**
 * Validation rules for file update
 */
const validateUpdate = [
  param('id')
    .isMongoId()
    .withMessage('Invalid file ID format'),
  
  body('name')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('File name must be between 1 and 255 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags.length > 10) {
        throw new Error('Maximum 10 tags allowed');
      }
      tags.forEach(tag => {
        if (typeof tag !== 'string' || tag.length > 50) {
          throw new Error('Each tag must be a string with maximum 50 characters');
        }
      });
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Validation rules for getting files by entity
 */
const validateGetByEntity = [
  param('entityType')
    .isIn(['transaction', 'user_avatar', 'document', 'receipt'])
    .withMessage('Invalid entity type'),
  
  param('entityId')
    .isMongoId()
    .withMessage('Invalid entity ID format'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

/**
 * Validation rules for file ID parameter
 */
const validateFileId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid file ID format'),
  
  handleValidationErrors
];

/**
 * Custom middleware to validate file upload constraints
 */
const validateFileConstraints = (req, res, next) => {
  // Check if any files were uploaded
  const files = req.files || (req.file ? [req.file] : []);
  
  if (files.length === 0) {
    return res.status(400).json(
      createResponse('error', 'No files provided', null)
    );
  }
  
  // Validate file count for multiple uploads
  if (req.route.path.includes('multiple') && files.length > 10) {
    return res.status(400).json(
      createResponse('error', 'Maximum 10 files allowed per upload', null)
    );
  }
  
  // Validate individual file constraints
  for (const file of files) {
    // Check file size (this is also handled by multer, but double-check)
    const maxSize = getMaxFileSize(file.mimetype);
    if (file.size > maxSize) {
      return res.status(400).json(
        createResponse('error', `File ${file.originalname} exceeds maximum size limit`, null)
      );
    }
    
    // Validate file type
    if (!isAllowedFileType(file.mimetype)) {
      return res.status(400).json(
        createResponse('error', `File type ${file.mimetype} is not allowed`, null)
      );
    }
  }
  
  next();
};

/**
 * Get maximum file size based on MIME type
 */
function getMaxFileSize(mimetype) {
  if (mimetype.startsWith('image/')) {
    return 5 * 1024 * 1024; // 5MB for images
  } else if (mimetype === 'application/pdf') {
    return 10 * 1024 * 1024; // 10MB for PDFs
  } else {
    return 2 * 1024 * 1024; // 2MB for other files
  }
}

/**
 * Check if file type is allowed
 */
function isAllowedFileType(mimetype) {
  const allowedTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    
    // Archives
    'application/zip',
    'application/x-rar-compressed'
  ];
  
  return allowedTypes.includes(mimetype);
}

module.exports = {
  validateUpload: {
    single: validateSingle,
    multiple: validateMultiple,
    avatar: validateAvatar,
    update: validateUpdate,
    getByEntity: validateGetByEntity,
    fileId: validateFileId,
    constraints: validateFileConstraints
  }
};
