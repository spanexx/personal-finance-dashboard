/**
 * Transaction Routes
 * Defines all API endpoints for transaction management
 */

const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/transaction.controller');
const { verifyToken, authorize } = require('../middleware/auth.middleware');
const ValidationMiddleware = require('../middleware/validation.middleware');

// Configure multer for file uploads
const upload = TransactionController.configureFileUpload();

/**
 * @route   GET /api/transactions
 * @desc    Get transactions with filtering, search, and pagination
 * @access  Private
 */
router.get('/',
  verifyToken,
  ValidationMiddleware.validateTransactionQuery(),
  ValidationMiddleware.validateDateRange,
  ValidationMiddleware.validateAmountRange,
  TransactionController.getTransactions
);

/**
 * @route   GET /api/transactions/stats
 * @desc    Get transaction statistics summary
 * @access  Private
 */
router.get('/stats',
  verifyToken,
  ValidationMiddleware.validateAnalyticsQuery(),
  TransactionController.getTransactionStats
);

/**
 * @route   GET /api/transactions/analytics
 * @desc    Get transaction analytics and insights
 * @access  Private
 */
router.get('/analytics',
  verifyToken,
  ValidationMiddleware.validateAnalyticsQuery(),
  TransactionController.getTransactionAnalytics
);

/**
 * @route   GET /api/transactions/recurring/due
 * @desc    Get recurring transactions due for processing
 * @access  Private
 */
router.get('/recurring/due',
  verifyToken,
  ValidationMiddleware.validateAnalyticsQuery(),
  TransactionController.getRecurringTransactionsDue
);

/**
 * @route   POST /api/transactions/recurring/process
 * @desc    Process recurring transactions (create instances)
 * @access  Private
 */
router.post('/recurring/process',
  verifyToken,
  ValidationMiddleware.validateBulkOperation(),
  TransactionController.processRecurringTransactions
);

/**
 * @route   GET /api/transactions/search/autocomplete
 * @desc    Get autocomplete suggestions for transaction search
 * @access  Private
 */
router.get('/search/autocomplete',
  verifyToken,
  ValidationMiddleware.validateTransactionQuery(),
  TransactionController.searchTransactionsAutocomplete
);

/**
 * @route   GET /api/transactions/:transactionId
 * @desc    Get single transaction by ID
 * @access  Private
 */
router.get('/:id',
  verifyToken,
  ValidationMiddleware.validateTransactionId(),
  ValidationMiddleware.validateTransactionOwnership,
  TransactionController.getTransactionById
);

/**
 * @route   POST /api/transactions
 * @desc    Create new transaction
 * @access  Private
 */
router.post('/',
  verifyToken,
  ValidationMiddleware.validateTransaction(),
  TransactionController.createTransaction
);

/**
 * @route   PUT /api/transactions/:transactionId
 * @desc    Update transaction
 * @access  Private
 */
router.put('/:id',
  verifyToken,
  ValidationMiddleware.validateTransactionId(),
  ValidationMiddleware.validateTransactionOwnership,
  ValidationMiddleware.validateTransaction(),
  TransactionController.updateTransaction
);

/**
 * @route   DELETE /api/transactions/:transactionId
 * @desc    Delete transaction (soft or hard delete)
 * @access  Private
 */
router.delete('/:id',
  verifyToken,
  ValidationMiddleware.validateTransactionId(),
  ValidationMiddleware.validateTransactionOwnership,
  TransactionController.deleteTransaction
);

/**
 * @route   POST /api/transactions/:transactionId/restore
 * @desc    Restore soft-deleted transaction
 * @access  Private
 */
router.post('/:id/restore',
  verifyToken,
  ValidationMiddleware.validateTransactionId(),
  ValidationMiddleware.validateTransactionOwnership,
  TransactionController.restoreTransaction
);

/**
 * @route   POST /api/transactions/bulk
 * @desc    Bulk operations on transactions
 * @access  Private
 */
router.post('/bulk',
  verifyToken,
  ValidationMiddleware.validateBulkOperation(),
  TransactionController.bulkOperations
);

/**
 * @route   POST /api/transactions/import
 * @desc    Import transactions from CSV/Excel file
 * @access  Private
 */
router.post('/import',
  verifyToken,
  upload.single('file'),
  ValidationMiddleware.validateUploadedFile,
  ValidationMiddleware.validateFileUpload(),
  TransactionController.importTransactions
);

/**
 * @route   POST /api/transactions/:transactionId/attachments
 * @desc    Upload attachment to transaction
 * @access  Private
 */
router.post('/:id/attachments',
  verifyToken,
  ValidationMiddleware.validateTransactionId(),
  ValidationMiddleware.validateTransactionOwnership,
  upload.array('attachments', 5), // Maximum 5 files
  TransactionController.uploadAttachment
);

/**
 * @route   GET /api/transactions/:transactionId/attachments/:attachmentId
 * @desc    Download attachment from transaction
 * @access  Private
 */
router.get('/:id/attachments/:attachmentId',
  verifyToken,
  ValidationMiddleware.validateTransactionId(),
  ValidationMiddleware.validateTransactionOwnership,
  TransactionController.downloadAttachment
);

/**
 * @route   DELETE /api/transactions/:transactionId/attachments/:attachmentId
 * @desc    Delete attachment from transaction
 * @access  Private
 */
router.delete('/:id/attachments/:attachmentId',
  verifyToken,
  ValidationMiddleware.validateTransactionId(),
  ValidationMiddleware.validateTransactionOwnership,
  TransactionController.deleteAttachment
);

module.exports = router;
