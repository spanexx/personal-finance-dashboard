/**
 * Export/Import Routes
 * Handles data export and import endpoints
 */

const express = require('express');
const router = express.Router();
const { exportImportController } = require('../controllers');
const authMiddleware = require('../middleware/auth.middleware');
const { importUpload } = require('../middleware/upload.middleware');
const { body, param, query } = require('express-validator');

// Apply authentication middleware to all routes
router.use(authMiddleware.verifyToken);

// Export data validation
const exportValidation = [
  body('format')
    .isIn(['csv', 'json', 'excel', 'pdf'])
    .withMessage('Format must be csv, json, excel, or pdf'),
  body('type')
    .isIn(['transactions', 'budgets', 'goals', 'categories', 'all'])
    .withMessage('Type must be transactions, budgets, goals, categories, or all'),
  body('dateRange')
    .optional()
    .isObject()
    .withMessage('Date range must be an object'),
  body('dateRange.startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('dateRange.endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  body('includeAttachments')
    .optional()
    .isBoolean()
    .withMessage('Include attachments must be a boolean')
];

// Import data validation
const importValidation = [
  body('type')
    .isIn(['transactions', 'budgets', 'goals', 'categories'])
    .withMessage('Type must be transactions, budgets, goals, or categories'),
  body('options')
    .optional()
    .isString()
    .withMessage('Options must be a JSON string')
];

// Pagination validation
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// ID parameter validation
const idValidation = [
  param('exportId')
    .isMongoId()
    .withMessage('Export ID must be a valid MongoDB ObjectId')
];

const operationValidation = [
  param('operationId')
    .isMongoId()
    .withMessage('Operation ID must be a valid MongoDB ObjectId'),
  param('type')
    .isIn(['export', 'import'])
    .withMessage('Type must be export or import')
];

/**
 * @route   POST /api/export-import/export
 * @desc    Export user data
 * @access  Private
 */
router.post('/export', exportValidation, exportImportController.exportData);

/**
 * @route   POST /api/export-import/import
 * @desc    Import data from file
 * @access  Private
 */
router.post('/import', 
  importUpload, 
  importValidation, 
  exportImportController.importData
);

/**
 * @route   GET /api/export-import/exports
 * @desc    Get export history
 * @access  Private
 */
router.get('/exports', paginationValidation, exportImportController.getExportHistory);

/**
 * @route   GET /api/export-import/imports
 * @desc    Get import history
 * @access  Private
 */
router.get('/imports', paginationValidation, exportImportController.getImportHistory);

/**
 * @route   GET /api/export-import/download/:exportId
 * @desc    Download exported file
 * @access  Private
 */
router.get('/download/:exportId', idValidation, exportImportController.downloadExport);

/**
 * @route   GET /api/export-import/export-options
 * @desc    Get available export formats and types
 * @access  Private
 */
router.get('/export-options', exportImportController.getExportOptions);

/**
 * @route   GET /api/export-import/import-options
 * @desc    Get supported import formats and validation rules
 * @access  Private
 */
router.get('/import-options', exportImportController.getImportOptions);

/**
 * @route   POST /api/export-import/validate
 * @desc    Validate import file before processing
 * @access  Private
 */
router.post('/validate', 
  importUpload,
  body('type')
    .isIn(['transactions', 'budgets', 'goals', 'categories'])
    .withMessage('Type must be transactions, budgets, goals, or categories'),
  exportImportController.validateImportFile
);

/**
 * @route   DELETE /api/export-import/cancel/:type/:operationId
 * @desc    Cancel ongoing export/import operation
 * @access  Private
 */
router.delete('/cancel/:type/:operationId', 
  operationValidation, 
  exportImportController.cancelOperation
);

module.exports = router;
