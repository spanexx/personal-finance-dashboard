const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/category.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const ValidationMiddleware = require('../middleware/validation.middleware');
const { param, query, body } = require('express-validator');

// Apply authentication middleware to all category routes
router.use(verifyToken);

/**
 * Validation middleware for category operations
 */
const validateCategoryId = () => [
  param('id', 'Invalid category ID').isMongoId(),
  ValidationMiddleware.handleValidationErrors
];

const validateCategoryCreation = () => [
  body('name', 'Category name is required and must be 2-100 characters')
    .trim()
    .isLength({ min: 2, max: 100 })
    .custom((value) => {
      // Check for valid characters (letters, numbers, spaces, common punctuation)
      const validPattern = /^[a-zA-Z0-9\s\-_&.,()]+$/;
      if (!validPattern.test(value)) {
        throw new Error('Category name contains invalid characters');
      }
      return true;
    }),
  body('type', 'Category type must be either "income" or "expense"')
    .isIn(['income', 'expense'])
    .toLowerCase(),
  body('description', 'Description cannot exceed 500 characters')
    .optional()
    .trim()
    .isLength({ max: 500 }),
  body('color', 'Color must be a valid hex color code')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  body('icon', 'Icon name cannot exceed 50 characters')
    .optional()
    .trim()
    .isLength({ max: 50 }),
  body('parent', 'Parent category ID must be a valid MongoDB ObjectId')
    .optional()
    .isMongoId(),
  body('sortOrder', 'Sort order must be a number')
    .optional()
    .isInt({ min: 0, max: 9999 }),
  body('budgetAllocation', 'Budget allocation must be a non-negative number')
    .optional()
    .isFloat({ min: 0 }),
  ValidationMiddleware.handleValidationErrors
];

const validateCategoryUpdate = () => [
  body('name', 'Category name must be 2-100 characters if provided')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .custom((value) => {
      const validPattern = /^[a-zA-Z0-9\s\-_&.,()]+$/;
      if (!validPattern.test(value)) {
        throw new Error('Category name contains invalid characters');
      }
      return true;
    }),
  body('type', 'Category type must be either "income" or "expense" if provided')
    .optional()
    .isIn(['income', 'expense'])
    .toLowerCase(),
  body('description', 'Description cannot exceed 500 characters')
    .optional()
    .trim()
    .isLength({ max: 500 }),
  body('color', 'Color must be a valid hex color code')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  body('icon', 'Icon name cannot exceed 50 characters')
    .optional()
    .trim()
    .isLength({ max: 50 }),
  body('parent', 'Parent category ID must be a valid MongoDB ObjectId or null')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return true;
      return require('mongoose').isValidObjectId(value);
    }),
  body('sortOrder', 'Sort order must be a number')
    .optional()
    .isInt({ min: 0, max: 9999 }),
  body('budgetAllocation', 'Budget allocation must be a non-negative number')
    .optional()
    .isFloat({ min: 0 }),
  body('isActive', 'isActive must be a boolean')
    .optional()
    .isBoolean(),
  ValidationMiddleware.handleValidationErrors
];

const validateCategoryQuery = () => [
  query('type', 'Type must be either "income" or "expense"')
    .optional()
    .isIn(['income', 'expense']),
  query('includeInactive', 'includeInactive must be a boolean')
    .optional()
    .isBoolean(),
  query('includeStats', 'includeStats must be a boolean')
    .optional()
    .isBoolean(),
  query('parentId', 'Parent ID must be a valid MongoDB ObjectId, "null", or "root"')
    .optional()
    .custom((value) => {
      if (value === 'null' || value === 'root') return true;
      return require('mongoose').isValidObjectId(value);
    }),
  query('search', 'Search term must be at least 2 characters')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }),
  query('page', 'Page must be a positive integer')
    .optional()
    .isInt({ min: 1 }),
  query('limit', 'Limit must be between 1 and 100')
    .optional()
    .isInt({ min: 1, max: 100 }),
  query('sortBy', 'Invalid sort field')
    .optional()
    .isIn(['name', 'type', 'level', 'sortOrder', 'createdAt', 'updatedAt']),
  query('sortOrder', 'Sort order must be "asc" or "desc"')
    .optional()
    .isIn(['asc', 'desc']),
  ValidationMiddleware.handleValidationErrors
];

const validateStatisticsQuery = () => [
  query('startDate', 'Start date must be a valid ISO date')
    .optional()
    .isISO8601()
    .toDate(),
  query('endDate', 'End date must be a valid ISO date')
    .optional()
    .isISO8601()
    .toDate()
    .custom((endDate, { req }) => {
      if (req.query.startDate && endDate < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  query('includeSubcategories', 'includeSubcategories must be a boolean')
    .optional()
    .isBoolean(),
  ValidationMiddleware.handleValidationErrors
];

const validateSearchQuery = () => [
  query('q', 'Search query is required and must be at least 2 characters')
    .trim()
    .isLength({ min: 2, max: 100 }),
  query('type', 'Type must be either "income" or "expense"')
    .optional()
    .isIn(['income', 'expense']),
  query('limit', 'Limit must be between 1 and 50')
    .optional()
    .isInt({ min: 1, max: 50 }),
  ValidationMiddleware.handleValidationErrors
];

/**
 * @route   GET /api/categories
 * @desc    Get all categories for the current user with filtering and pagination
 * @access  Private
 * @query   type, includeInactive, includeStats, parentId, search, page, limit, sortBy, sortOrder
 */
router.get('/', 
  validateCategoryQuery(),
  CategoryController.getCategories
);

/**
 * @route   GET /api/categories/hierarchy
 * @desc    Get category hierarchy (tree structure) for the current user
 * @access  Private
 * @query   type (optional)
 */
router.get('/hierarchy', 
  query('type', 'Type must be either "income" or "expense"')
    .optional()
    .isIn(['income', 'expense']),
  ValidationMiddleware.handleValidationErrors,
  CategoryController.getCategoryHierarchy
);

/**
 * @route   GET /api/categories/search
 * @desc    Search categories by name
 * @access  Private
 * @query   q (required), type, limit
 */
router.get('/search', 
  validateSearchQuery(),
  CategoryController.searchCategories
);

/**
 * @route   GET /api/categories/usage-summary
 * @desc    Get category usage summary with transaction statistics
 * @access  Private
 * @query   type, startDate, endDate
 */
router.get('/usage-summary', 
  query('type', 'Type must be either "income" or "expense"')
    .optional()
    .isIn(['income', 'expense']),
  query('startDate', 'Start date must be a valid ISO date')
    .optional()
    .isISO8601()
    .toDate(),
  query('endDate', 'End date must be a valid ISO date')
    .optional()
    .isISO8601()
    .toDate(),
  ValidationMiddleware.handleValidationErrors,
  CategoryController.getCategoryUsageSummary
);

/**
 * @route   GET /api/categories/:id
 * @desc    Get a specific category by ID with detailed information
 * @access  Private
 */
router.get('/:id', 
  validateCategoryId(),
  CategoryController.getCategoryById
);

/**
 * @route   POST /api/categories
 * @desc    Create a new category
 * @access  Private
 */
router.post('/', 
  validateCategoryCreation(),
  CategoryController.createCategory
);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update an existing category
 * @access  Private
 */
router.put('/:id', 
  validateCategoryId(),
  validateCategoryUpdate(),
  CategoryController.updateCategory
);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete a category (soft delete)
 * @access  Private
 * @query   force (optional boolean) - Force delete even if category is in use
 */
router.delete('/:id', 
  validateCategoryId(),
  query('force', 'Force parameter must be a boolean')
    .optional()
    .isBoolean(),
  ValidationMiddleware.handleValidationErrors,
  CategoryController.deleteCategory
);

/**
 * @route   GET /api/categories/:id/statistics
 * @desc    Get detailed statistics for a specific category
 * @access  Private
 * @query   startDate, endDate, includeSubcategories
 */
router.get('/:id/statistics', 
  validateCategoryId(),
  validateStatisticsQuery(),
  CategoryController.getCategoryStatistics
);

module.exports = router;
