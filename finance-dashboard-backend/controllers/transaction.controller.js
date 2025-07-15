const { 
  transactionService, 
  budgetAlertService, 
  transactionAttachmentService,
  transactionImportService 
} = require('../services');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const ApiResponse = require('../utils/apiResponse');
const { 
  ErrorHandler, 
  ValidationError, 
  AuthenticationError, 
  ConflictError, 
  NotFoundError,
  RateLimitError 
} = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Comprehensive Transaction Management Controller
 * Handles all transaction-related operations with advanced features
 */
class TransactionController {
  /**
   * Configure multer for file uploads
   */
  static configureFileUpload() {
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/receipts', req.user._id.toString());
        try {
          await fs.mkdir(uploadDir, { recursive: true });
          cb(null, uploadDir);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `receipt-${uniqueSuffix}${ext}`);
      }
    });

    const fileFilter = (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, WebP, PDF, and TXT files are allowed.'), false);
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5 // Maximum 5 files per request
      }
    });
  }

  /**
   * Get transactions with advanced filtering, search, and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
    static getTransactions = ErrorHandler.asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      category,
      type,
      paymentMethod,
      searchTerm,
      sortBy = 'date',
      sortOrder = 'desc',
      includeDeleted = false
    } = req.query;

    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (pageNum < 1 || limitNum < 1 || limitNum > 500) {
      throw new ValidationError('Invalid pagination parameters. Page must be >= 1, limit must be 1-500');
    }

    // Prepare filters and pagination for service
    const filters = {
      type,
      categoryId: category,
      dateFrom: startDate,
      dateTo: endDate,
      amountMin: minAmount,
      amountMax: maxAmount,
      search: searchTerm,
      payee: paymentMethod,
      includeDeleted: includeDeleted === 'true'
    };

    const pagination = {
      page: pageNum,
      limit: limitNum,
      sort: sortBy,
      order: sortOrder
    };

    // Use service to get transactions
    const result = await transactionService.getTransactions(req.user.id, filters, pagination);

    // Defensive: ensure result.pagination is always an object
    const safePagination = result.pagination || {};

    // Calculate summary statistics for current page
    const summary = {
      totalIncome: result.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0),
      totalExpenses: result.transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0),
      netAmount: 0
    };
    summary.netAmount = summary.totalIncome - summary.totalExpenses;

    // Build correct pagination meta for frontend
    const paginationMeta = {
      page: safePagination.currentPage || 1,
      limit: parseInt(limit),
      total: safePagination.totalCount || 0,
      totalPages: safePagination.totalPages || 1,
      hasNext: safePagination.hasNext || false,
      hasPrev: safePagination.hasPrev || false,
      summary
    };

    // Log outgoing response for debugging
    console.log('[TRANSACTIONS RESPONSE]', {
      transactionsCount: result.transactions?.length,
      paginationMeta
    });

    return ApiResponse.paginated(res, result.transactions, paginationMeta, 'Transactions retrieved successfully');
  });
  /**
   * Get single transaction by ID with ownership verification
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getTransactionById = ErrorHandler.asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Use service to get transaction
    const transaction = await transactionService.getTransactionById(id, req.user.id);

    // Build response data
    const responseData = {
      transaction,
      attachments: transaction.attachments || []
    };

    return ApiResponse.success(res, responseData, 'Transaction retrieved successfully');
  });
  /**
   * Create new transaction with comprehensive validation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static createTransaction = ErrorHandler.asyncHandler(async (req, res) => {
    const {
      amount,
      type,
      category,
      description,
      date,
      paymentMethod,
      notes,
      tags,
      location,
      isRecurring,
      recurringConfig,
      transferToAccount,
      splitTransaction
    } = req.body;

    // Prepare transaction data for service
    const transactionData = {
      amount: parseFloat(amount),
      type,
      categoryId: category,
      description: description?.trim(),
      date: date ? new Date(date) : new Date(),
      paymentMethod: paymentMethod?.trim() || 'Cash',
      notes: notes?.trim() || '',
      tags: Array.isArray(tags) ? tags.filter(tag => tag.trim()) : [],
      isRecurring: Boolean(isRecurring),
      recurringConfig: isRecurring ? recurringConfig : null
    };

    // Defensive: Only set location if it is a non-empty object
    if (location && typeof location === 'object' && Object.keys(location).length > 0) {
      transactionData.location = location;
    }

    // Validate transfer-specific requirements
    if (type === 'transfer') {
      if (!transferToAccount) {
        throw new ValidationError('Transfer destination account is required for transfer transactions');
      }
      transactionData.toAccount = transferToAccount;
      transactionData.fromAccount = paymentMethod;
    }

    // Handle split transactions
    if (splitTransaction && Array.isArray(splitTransaction) && splitTransaction.length > 0) {
      const splitTotal = splitTransaction.reduce((sum, split) => sum + parseFloat(split.amount), 0);
      if (Math.abs(splitTotal - parseFloat(amount)) > 0.01) {
        throw new ValidationError('Split transaction amounts must equal the total amount');
      }
      transactionData.splitTransaction = splitTransaction;
    }

    // Use service to create transaction
    const transaction = await transactionService.createTransaction(req.user.id, transactionData);

    // After creating a transaction, recalculate spent amounts for the relevant budget (if expense and has category)
    if (type === 'expense' && category) {
      try {
        const Budget = require('../models/Budget');
        // Find all budgets that include this category and cover the transaction date
        const budgets = await Budget.find({
          user: req.user.id,
          isDeleted: { $ne: true },
          isActive: true,
          startDate: { $lte: transaction.date },
          endDate: { $gte: transaction.date },
          'categoryAllocations.category': category
        });
        for (const budget of budgets) {
          await budget.calculateSpentAmount();
          await budget.save(); // Persist recalculated values
        }
      } catch (err) {
        console.error('[TransactionController] Error recalculating budget spent amounts after transaction creation:', err);
      }
    }

    // Handle transfer transactions (create corresponding transaction) - keeping original logic
    let relatedTransaction = null;
    if (type === 'transfer' && transferToAccount) {
      const relatedTransactionData = {
        amount: parseFloat(amount),
        type: 'income',
        categoryId: category, // Use same category or find a transfer category
        description: `Transfer from ${paymentMethod || 'account'}`,
        date: transactionData.date,
        paymentMethod: transferToAccount,
        notes: `Related to transaction: ${transaction._id}`,
        relatedTransactionId: transaction._id
      };

      try {
        relatedTransaction = await transactionService.createTransaction(req.user.id, relatedTransactionData);
        
        // Update original transaction with related ID
        await transactionService.updateTransaction(transaction._id, req.user.id, {
          relatedTransactionId: relatedTransaction._id
        });
      } catch (error) {
        console.error('Error creating related transfer transaction:', error.message);
      }
    }

    // Trigger budget alerts for expense transactions - keeping original logic
    if (type === 'expense') {
      try {
        await budgetAlertService.checkBudgetLimits(req.user.id, transaction.category, transaction.amount);
      } catch (alertError) {
        console.error('Budget alert error after transaction creation:', alertError.message);
        // Don't disrupt transaction creation if alerts fail
      }
    }

    const responseData = {
      transaction,
      relatedTransaction,
      recurringSchedule: isRecurring ? recurringConfig : null
    };

    return ApiResponse.created(res, responseData, 'Transaction created successfully');
  });
  /**
   * Update transaction with ownership verification and audit trail
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
static updateTransaction = ErrorHandler.asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Use service to update transaction
  const result = await transactionService.updateTransaction(id, req.user.id, updateData);

  // Trigger budget alerts if this is an expense transaction update - keeping original logic
  if (result.transaction.type === 'expense') {
    try {
      await budgetAlertService.checkBudgetLimits(
        req.user.id, 
        result.transaction.category, 
        result.transaction.amount
      );
    } catch (alertError) {
      console.error('Budget alert error after transaction update:', alertError.message);
      // Don't disrupt transaction update if alerts fail
    }
  }

  return ApiResponse.success(res, result, 'Transaction updated successfully');
});
  /**
   * Delete transaction with soft/hard delete options
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
static deleteTransaction = ErrorHandler.asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { permanent = false } = req.query;

  // Use service to delete transaction
  const result = await transactionService.deleteTransaction(
    id, 
    req.user.id, 
    permanent === 'true' || permanent === true
  );

  return ApiResponse.success(res, result, 
    result.permanent ? 'Transaction permanently deleted' : 'Transaction moved to trash'
  );
});
  /**
   * Restore soft-deleted transaction
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
static restoreTransaction = ErrorHandler.asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Use service bulk operations to restore single transaction
  const result = await transactionService.bulkOperations(req.user.id, 'restore', [id]);

  return ApiResponse.success(res, { 
    ...result, 
    restoredAt: new Date() 
  }, 'Transaction restored successfully');
});
  /**
   * Bulk operations for transactions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
static bulkOperations = ErrorHandler.asyncHandler(async (req, res) => {
  const { operation, transactionIds, data } = req.body;

  // Use service to perform bulk operations
  const result = await transactionService.bulkOperations(req.user.id, operation, transactionIds, data);

  return ApiResponse.success(res, result, `Bulk ${operation} operation completed successfully`);
});

  /**
   * Import transactions from CSV/Excel file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
static importTransactions = ErrorHandler.asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { file } = req;
  const { 
    dateFormat = 'MM/DD/YYYY',
    skipFirstRow = true,
    categoryMapping = {},
    defaultCategoryId 
  } = req.body;

  if (!file) {
    throw new ValidationError('Import file is required');
  }

  // Use service to import transactions
  const responseData = await transactionImportService.importTransactions(
    userId,
    file,
    {
      dateFormat,
      skipFirstRow,
      categoryMapping,
      defaultCategoryId
    }
  );

  return ApiResponse.created(res, responseData, 'Transactions imported successfully');
});
  /**
   * Download attachment from transaction
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
static downloadAttachment = ErrorHandler.asyncHandler(async (req, res) => {
  const { transactionId, attachmentId } = req.params;
  const userId = req.user.id;

  // Use service to get attachment details
  const { path, mimeType, originalName, size } = await transactionAttachmentService.getAttachmentForDownload(
    transactionId, 
    attachmentId, 
    userId
  );

  // Set appropriate headers
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
  res.setHeader('Content-Length', size);

  // Stream the file
  const fileStream = require('fs').createReadStream(path);
  fileStream.pipe(res);
});

// NEW METHOD 9: uploadAttachment
static uploadAttachment = ErrorHandler.asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const userId = req.user.id;
  const { files } = req;

  if (!files || files.length === 0) {
    throw new ValidationError('No files uploaded');
  }

  // Use service to upload attachments
  const responseData = await transactionAttachmentService.uploadAttachments(
    transactionId,
    userId,
    files
  );

  return ApiResponse.created(res, responseData, 'Attachments uploaded successfully');
});

  /**
   * Delete attachment from transaction
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
static deleteAttachment = ErrorHandler.asyncHandler(async (req, res) => {
  const { transactionId, attachmentId } = req.params;
  const userId = req.user.id;

  // Use service to delete attachment
  const responseData = await transactionAttachmentService.deleteAttachment(
    transactionId,
    attachmentId,
    userId
  );

  return ApiResponse.success(res, responseData, 'Attachment deleted successfully');
});
  /**
   * Get transaction analytics and insights
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getTransactionAnalytics = ErrorHandler.asyncHandler(async (req, res) => {
    const options = req.query;
    console.log('🔍 [BACKEND-ANALYTICS] Transaction analytics request:', {
      userId: req.user.id,
      options,
      queryParams: req.query,
      method: req.method,
      url: req.url
    });
    
    logger.info('[Analytics] Incoming analytics request', { userId: req.user.id, options });
    try {
      // Use service to get transaction analytics
      console.log('📡 [BACKEND-ANALYTICS] Calling transactionService.getTransactionAnalytics...');
      const analyticsData = await transactionService.getTransactionAnalytics(req.user.id, options);
      
      console.log('✅ [BACKEND-ANALYTICS] Raw analytics data from service:', {
        dataType: typeof analyticsData,
        isArray: Array.isArray(analyticsData),
        keys: analyticsData ? Object.keys(analyticsData) : 'null/undefined',
        totalIncome: analyticsData?.totalIncome,
        totalExpenses: analyticsData?.totalExpenses,
        netIncome: analyticsData?.netIncome,
        transactionCount: analyticsData?.transactionCount
      });
      
      logger.info('[Analytics] Analytics data generated', { userId: req.user.id, analyticsData });
      // Defensive: ensure all expected fields are present
      const completeAnalytics = {
        totalIncome: analyticsData.totalIncome ?? 0,
        totalExpenses: analyticsData.totalExpenses ?? 0,
        netIncome: analyticsData.netIncome ?? 0,
        transactionCount: analyticsData.transactionCount ?? 0,
        averageTransaction: analyticsData.averageTransaction ?? 0,
        categoryBreakdown: analyticsData.categoryBreakdown ?? [],
        monthlyTrends: analyticsData.monthlyTrends ?? [],
        topMerchants: analyticsData.topMerchants ?? [],
        spendingPatterns: analyticsData.spendingPatterns ?? [],
        ...analyticsData // spread in any additional fields
      };
      
      console.log('📊 [BACKEND-ANALYTICS] Complete analytics being sent to frontend:', {
        totalIncome: completeAnalytics.totalIncome,
        totalExpenses: completeAnalytics.totalExpenses,
        netIncome: completeAnalytics.netIncome,
        transactionCount: completeAnalytics.transactionCount,
        categoryBreakdownLength: completeAnalytics.categoryBreakdown?.length,
        monthlyTrendsLength: completeAnalytics.monthlyTrends?.length,
        topMerchantsLength: completeAnalytics.topMerchants?.length,
        spendingPatternsLength: completeAnalytics.spendingPatterns?.length
      });
      return ApiResponse.success(res, completeAnalytics, 'Transaction analytics retrieved successfully');
    } catch (err) {
      logger.error('[Analytics] Error generating analytics', { userId: req.user.id, error: err.stack || err });
      return ApiResponse.error(res, err, 'Failed to generate transaction analytics');
    }
  });
  /**
   * Get recurring transactions due for processing
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
static getRecurringTransactionsDue = ErrorHandler.asyncHandler(async (req, res) => {
  const { upToDate, ...options } = req.query;

  // Use service to get recurring transactions due
  const result = await transactionService.getRecurringTransactionsDue(req.user.id, upToDate, options);

  return ApiResponse.paginated(res, result.transactions, result.pagination, 'Recurring transactions due retrieved successfully');
});
  /**
   * Process recurring transactions (create instances)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
static processRecurringTransactions = ErrorHandler.asyncHandler(async (req, res) => {
  const { processUpTo, transactionIds, ...options } = req.body;

  // Use service to process recurring transactions
  const result = await transactionService.processRecurringTransactions(
    req.user.id, 
    transactionIds, 
    processUpTo, 
    options
  );

  const message = result.dryRun 
    ? 'Recurring transactions processing simulation completed'
    : 'Recurring transactions processed successfully';

  return ApiResponse.success(res, result, message);
});
  /**
   * Get transaction statistics summary
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
static getTransactionStats = ErrorHandler.asyncHandler(async (req, res) => {
  const { period, ...options } = req.query;

  // Use service to get transaction statistics
  const statsData = await transactionService.getTransactionStats(req.user.id, period, options);

  return ApiResponse.success(res, statsData, 'Transaction statistics retrieved successfully');
});

  /**
   * Search transactions with autocomplete suggestions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
static searchTransactionsAutocomplete = ErrorHandler.asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { 
    query,
    field = 'description',
    limit = 10
  } = req.query;

  // Use service to get autocomplete suggestions
  const responseData = await transactionService.searchTransactionsAutocomplete(
    userId,
    query,
    field,
    parseInt(limit)
  );

  return ApiResponse.success(res, responseData, 'Autocomplete suggestions retrieved successfully');
});

  /**
   * Create missing transactions for a given date range
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static createMissingTransactions = ErrorHandler.asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.body;
    const userId = req.user.id;

    if (!startDate || !endDate) {
      throw new ValidationError('Start date and end date are required');
    }

    const result = await transactionService.createMissingTransactions(userId, startDate, endDate);

    return ApiResponse.success(res, result, 'Missing transactions created successfully');
  });
}

module.exports = TransactionController;
