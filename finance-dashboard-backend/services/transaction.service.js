/**
 * Transaction Service
 * Business logic layer for transaction operations
 */

const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const mongoose = require('mongoose');
const AIService = require('./ai.service');
const FeedbackService = require('./feedback.service');

class TransactionService {
  /**
   * Create a new transaction with validation
   * @param {string} userId - User ID
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  static async createTransaction(userId, transactionData) {
    let categoryId = transactionData.categoryId;
    let predictedCategoryId = null;

    // If no category is provided, try to predict it using the ML model
    if (!categoryId && transactionData.description) {
      predictedCategoryId = await AIService.predictCategory(transactionData.description);
      if (predictedCategoryId) {
        categoryId = predictedCategoryId;
        console.log(`AI predicted category for "${transactionData.description}": ${categoryId}`);
      }
    }

    // Validate category ownership
    const category = await Category.findOne({
      _id: categoryId,
      user: userId
    });

    if (!category) {
      throw new Error('Category not found or not owned by user');
    }

    // Validate category type matches transaction type (except for transfers)
    if (transactionData.type !== 'transfer' && category.type !== transactionData.type) {
      throw new Error('Category type must match transaction type');
    }

    const transaction = new Transaction({
      ...transactionData,
      user: userId,
      category: categoryId
    });

    await transaction.save();
    await transaction.populate('category', 'name type color icon');

    // If a prediction was made, store feedback
    if (predictedCategoryId) {
      await FeedbackService.createFeedback({
        transaction: transaction._id,
        predictedCategory: predictedCategoryId,
        actualCategory: category._id, // The category that was ultimately used
        user: userId
      });
    }

    return transaction;
  }

  /**
   * Update transaction with validation
   * @param {string} transactionId - Transaction ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated transaction
   */
  static async updateTransaction(transactionId, userId, updateData) {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId,
      isDeleted: { $ne: true }
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Validate category if being updated
    if (updateData.categoryId && updateData.categoryId !== transaction.category.toString()) {
      const category = await Category.findOne({
        _id: updateData.categoryId,
        user: userId
      });

      if (!category) {
        throw new Error('Category not found or not owned by user');
      }
    }

    Object.assign(transaction, updateData);
    await transaction.save();
    await transaction.populate('category', 'name type color icon');

    return transaction;
  }

  /**
   * Get transaction by ID with ownership verification
   * @param {string} transactionId - Transaction ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Transaction
   */
  static async getTransactionById(transactionId, userId) {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId,
      isDeleted: { $ne: true }
    })
    .populate('category', 'name type color icon description')
    .populate('parentTransaction', 'description amount date type');

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

  /**
   * Delete transaction (soft or hard delete)
   * @param {string} transactionId - Transaction ID
   * @param {string} userId - User ID
   * @param {boolean} permanent - Whether to permanently delete
   * @returns {Promise<Object>} Deletion result
   */
  static async deleteTransaction(transactionId, userId, permanent = false) {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (permanent) {
      await Transaction.deleteOne({ _id: transactionId });
      return { deleted: true, permanent: true };
    } else {
      await transaction.softDelete();
      return { deleted: true, permanent: false };
    }
  }

  /**
   * Get transactions with advanced filtering
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Transactions and metadata
   */
  static async getTransactions(userId, filters = {}, pagination = {}) {
    const {
      type,
      categoryId,
      dateFrom,
      dateTo,
      amountMin,
      amountMax,
      search,
      status = 'completed',
      tags,
      payee,
      includeDeleted = false
    } = filters;

    const {
      page = 1,
      limit = 20,
      sort = 'date',
      order = 'desc'
    } = pagination;

    // Build filter object
    const filter = {
      user: userId,
      isDeleted: includeDeleted ? { $in: [true, false] } : { $ne: true }
    };

    if (type) filter.type = type;
    if (categoryId) filter.category = categoryId;
    if (status) filter.status = status;

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }

    if (amountMin || amountMax) {
      filter.amount = {};
      if (amountMin) filter.amount.$gte = parseFloat(amountMin);
      if (amountMax) filter.amount.$lte = parseFloat(amountMax);
    }

    if (tags && tags.length > 0) {
      filter.tags = { $in: tags };
    }

    if (payee) {
      filter.payee = { $regex: payee, $options: 'i' };
    }

    // Handle search
    let query;
    if (search) {
      query = Transaction.searchTransactions(userId, search, {
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        type,
        categoryId,
        dateFrom,
        dateTo,
        status,
        includeDeleted
      });
    } else {
      const sortObj = {};
      sortObj[sort] = order === 'desc' ? -1 : 1;

      query = Transaction.find(filter)
        .populate('category', 'name type color icon')
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));
    }

    const transactions = await query;
    const totalCount = await Transaction.countDocuments(filter);

    return {
      transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      }
    };
  }

  /**
   * Get transaction analytics
   * @param {string} userId - User ID
   * @param {Object} options - Analytics options
   * @returns {Promise<Object>} Analytics data
   */
  static async getTransactionAnalytics(userId, options = {}) {
    const logger = require('../utils/logger');
    
    const {
      period = 'monthly',
      count = 12,
      dateFrom = options.startDate,  // Support both dateFrom and startDate
      dateTo = options.endDate,      // Support both dateTo and endDate
      startDate,                     // Also destructure these for logging
      endDate,
      type,
      categoryId
    } = options;

    const filter = {
      user: userId,
      isDeleted: { $ne: true },
      status: 'completed'
    };

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }

    if (type) filter.type = type;
    if (categoryId) filter.category = categoryId;

    try {
      logger.info('[Analytics] Running spending trends aggregation', { userId, period, count });
      const spendingTrends = await Transaction.getSpendingTrends(userId, period, parseInt(count));
      
      logger.info('[Analytics] Running category breakdown aggregation', { userId, filter });
      const categoryBreakdownOptions = {
        dateFrom: filter.date?.$gte,
        dateTo: filter.date?.$lte,
        type,
        includeDeleted: false
      };
      
      const categoryBreakdown = await Transaction.getTransactionsByCategory(userId, categoryBreakdownOptions);

      console.log('🥧 [CATEGORY-BREAKDOWN] Category breakdown processing:', {
        optionsUsed: categoryBreakdownOptions,
        resultCount: categoryBreakdown?.length || 0,
        rawCategoryData: categoryBreakdown?.slice(0, 3).map(cat => ({
          _id: cat._id,
          totalAmount: cat.totalAmount,
          transactionCount: cat.transactionCount,
          categoryName: cat.category?.name,
          categoryType: cat.category?.type,
          keys: Object.keys(cat)
        }))
      });

      // Calculate summary fields
      let totalIncome = 0, totalExpenses = 0, netIncome = 0, transactionCount = 0, averageTransaction = 0;
      let monthlyTrends = [];
      let topMerchants = [];
      let spendingPatterns = [];

      // Calculate from categoryBreakdown and spendingTrends if available
      if (Array.isArray(categoryBreakdown)) {
        for (const cat of categoryBreakdown) {
          if (cat.category && cat.category.type === 'income') {
            totalIncome += cat.totalAmount;
          }
          if (cat.category && cat.category.type === 'expense') {
            totalExpenses += cat.totalAmount;
          }
          transactionCount += cat.transactionCount;
        }
        averageTransaction = transactionCount > 0 ? (totalIncome + totalExpenses) / transactionCount : 0;
      }
      netIncome = totalIncome - totalExpenses;

      // Map spendingTrends to monthlyTrends
      if (Array.isArray(spendingTrends)) {
        monthlyTrends = spendingTrends.map(trend => ({
          month: trend._id.month || '',
          income: trend.totalIncome || 0,
          expenses: trend.totalSpent || 0,
          net: (trend.totalIncome || 0) - (trend.totalSpent || 0)
        }));
      }

      // Get top merchants by payee
      logger.info('[Analytics] Running top merchants aggregation', { userId, filter });
      const merchantOptions = {
        dateFrom: filter.date?.$gte,
        dateTo: filter.date?.$lte,
        type: 'expense', // Focus on expense transactions for merchant spending
        includeDeleted: false,
        limit: 10
      };
      
      try {
        const merchantAnalysis = await Transaction.getTopMerchantsByPayee(userId, merchantOptions);
        
        if (Array.isArray(merchantAnalysis)) {
          topMerchants = merchantAnalysis.map(merchant => ({
            name: merchant.name || 'Unknown Merchant',
            amount: merchant.totalAmount || 0,
            count: merchant.transactionCount || 0,
            averageAmount: merchant.averageAmount || 0,
            lastTransaction: merchant.lastTransaction
          }));
        }
        
        logger.info('[Analytics] Top merchants aggregation completed', { 
          userId, 
          merchantCount: topMerchants.length,
          totalMerchantSpending: topMerchants.reduce((sum, m) => sum + m.amount, 0)
        });
      } catch (err) {
        logger.error('[Analytics] Error in top merchants aggregation', { userId, error: err.stack || err });
        topMerchants = [];
      }

      // Get spending patterns by day of week
      logger.info('[Analytics] Running spending patterns by day of week aggregation', { userId, filter });
      const spendingPatternOptions = {
        dateFrom: filter.date?.$gte,
        dateTo: filter.date?.$lte,
        type: 'expense', // Focus on expense patterns for spending analysis
        includeDeleted: false
      };
      
      try {
        const dayOfWeekPatterns = await Transaction.getSpendingPatternsByDayOfWeek(userId, spendingPatternOptions);
        
        console.log('📊 [SPENDING-PATTERNS] Day of week patterns processing:', {
          optionsUsed: spendingPatternOptions,
          resultCount: dayOfWeekPatterns?.length || 0,
          rawPatternData: dayOfWeekPatterns?.slice(0, 3).map(pattern => ({
            _id: pattern._id,
            dayOfWeek: pattern.dayOfWeek,
            totalAmount: pattern.totalAmount,
            averageAmount: pattern.averageAmount,
            transactionCount: pattern.transactionCount,
            keys: Object.keys(pattern)
          }))
        });
        
        if (Array.isArray(dayOfWeekPatterns)) {
          spendingPatterns = dayOfWeekPatterns.map(pattern => ({
            dayOfWeek: pattern.dayOfWeek,
            averageAmount: pattern.averageAmount || 0,
            transactionCount: pattern.transactionCount || 0,
            totalAmount: pattern.totalAmount || 0
          }));
        }
      } catch (patternError) {
        logger.error('[Analytics] Error getting spending patterns by day of week', { userId, error: patternError.message });
        spendingPatterns = []; // Default to empty array on error
      }

      const result = {
        totalIncome,
        totalExpenses,
        netIncome,
        transactionCount,
        averageTransaction,
        categoryBreakdown,
        monthlyTrends,
        topMerchants,
        spendingPatterns,
        period: {
          type: period,
          count: parseInt(count),
          dateFrom: filter.date?.$gte,
          dateTo: filter.date?.$lte
        }
      };
      
      return result;
    } catch (err) {
      logger.error('[Analytics] Error in getTransactionAnalytics', { userId, error: err.stack || err });
      // Return a safe default object
      return {
        totalIncome: 0,
        totalExpenses: 0,
        netIncome: 0,
        transactionCount: 0,
        averageTransaction: 0,
        categoryBreakdown: [],
        monthlyTrends: [],
        topMerchants: [],
        spendingPatterns: [],
        period: {
          type: period,
          count: parseInt(count),
          dateFrom: filter.date?.$gte,
          dateTo: filter.date?.$lte
        },
        error: err.message || 'Unknown error in analytics service'
      };
    }
  }

  /**
   * Process bulk operations on transactions
   * @param {string} userId - User ID
   * @param {string} operation - Operation type
   * @param {Array} transactionIds - Transaction IDs
   * @param {Object} data - Operation data
   * @returns {Promise<Object>} Operation result
   */
  static async bulkOperations(userId, operation, transactionIds, data = {}) {
    // Verify ownership
    const ownedTransactions = await Transaction.find({
      _id: { $in: transactionIds },
      user: userId
    }).select('_id');

    const ownedIds = ownedTransactions.map(t => t._id.toString());
    const unauthorizedIds = transactionIds.filter(id => !ownedIds.includes(id));

    if (unauthorizedIds.length > 0) {
      throw new Error(`Access denied to transactions: ${unauthorizedIds.join(', ')}`);
    }

    let result = {};

    switch (operation) {
      case 'delete':
        const { permanent = false } = data;
        if (permanent) {
          result = await Transaction.deleteMany({
            _id: { $in: transactionIds },
            user: userId
          });
        } else {
          result = await Transaction.updateMany(
            {
              _id: { $in: transactionIds },
              user: userId,
              isDeleted: { $ne: true }
            },
            {
              $set: {
                isDeleted: true,
                deletedAt: new Date()
              }
            }
          );
        }
        break;

      case 'restore':
        result = await Transaction.updateMany(
          {
            _id: { $in: transactionIds },
            user: userId,
            isDeleted: true
          },
          {
            $set: { isDeleted: false },
            $unset: { deletedAt: 1 }
          }
        );
        break;

      case 'updateCategory':
        const { categoryId } = data;
        
        // Verify category ownership
        const category = await Category.findOne({
          _id: categoryId,
          user: userId
        });

        if (!category) {
          throw new Error('Category not found or not owned by user');
        }

        result = await Transaction.updateMany(
          {
            _id: { $in: transactionIds },
            user: userId,
            isDeleted: { $ne: true }
          },
          { $set: { category: categoryId } }
        );
        break;

      case 'updateStatus':
        const { status } = data;
        result = await Transaction.updateMany(
          {
            _id: { $in: transactionIds },
            user: userId,
            isDeleted: { $ne: true }
          },
          { $set: { status } }
        );
        break;

      case 'addTags':
        const { tags } = data;
        const sanitizedTags = tags.map(tag => tag.toLowerCase().trim()).filter(Boolean);
        result = await Transaction.updateMany(
          {
            _id: { $in: transactionIds },
            user: userId,
            isDeleted: { $ne: true }
          },
          { $addToSet: { tags: { $each: sanitizedTags } } }
        );
        break;

      default:
        throw new Error('Invalid bulk operation');
    }

    return {
      operation,
      processedCount: result.modifiedCount || result.deletedCount || 0,
      requestedCount: transactionIds.length
    };
  }

  /**
   * Get recurring transactions due for processing
   * @param {string} userId - User ID
   * @param {Date} upToDate - Process up to this date
   * @returns {Promise<Array>} Due recurring transactions
   */
  static async getRecurringTransactionsDue(userId, upToDate = new Date()) {
    const dueTransactions = await Transaction.find({
      user: userId,
      isRecurring: true,
      'recurringConfig.isActive': true,
      'recurringConfig.nextDueDate': { $lte: upToDate },
      isDeleted: { $ne: true },
      $or: [
        { 'recurringConfig.endDate': { $exists: false } },
        { 'recurringConfig.endDate': null },
        { 'recurringConfig.endDate': { $gte: upToDate } }
      ]
    })
    .populate('category', 'name type color icon')
    .sort({ 'recurringConfig.nextDueDate': 1 });

    // Filter by max occurrences
    return dueTransactions.filter(transaction => {
      const config = transaction.recurringConfig;
      return !config.maxOccurrences || config.occurrenceCount < config.maxOccurrences;
    });
  }

  /**
   * Process recurring transactions
   * @param {string} userId - User ID
   * @param {Array} transactionIds - Specific transaction IDs (optional)
   * @param {Date} upToDate - Process up to this date
   * @returns {Promise<Object>} Processing results
   */
  static async processRecurringTransactions(userId, transactionIds = null, upToDate = new Date()) {
    let filter = {
      user: userId,
      isRecurring: true,
      'recurringConfig.isActive': true,
      'recurringConfig.nextDueDate': { $lte: upToDate },
      isDeleted: { $ne: true }
    };

    if (transactionIds) {
      filter._id = { $in: transactionIds };
    }

    const recurringTransactions = await Transaction.find(filter).populate('category');
    const processedResults = [];
    let totalInstancesCreated = 0;

    for (const transaction of recurringTransactions) {
      try {
        const config = transaction.recurringConfig;
        
        // Check max occurrences
        if (config.maxOccurrences && config.occurrenceCount >= config.maxOccurrences) {
          processedResults.push({
            transactionId: transaction._id,
            description: transaction.description,
            status: 'skipped',
            reason: 'Max occurrences reached',
            instancesCreated: 0
          });
          continue;
        }

        // Generate instances
        const instances = await transaction.generateRecurringTransactions(upToDate);
        totalInstancesCreated += instances.length;

        processedResults.push({
          transactionId: transaction._id,
          description: transaction.description,
          status: 'processed',
          instancesCreated: instances.length,
          nextDueDate: transaction.recurringConfig.nextDueDate
        });
      } catch (error) {
        processedResults.push({
          transactionId: transaction._id,
          description: transaction.description,
          status: 'error',
          error: error.message,
          instancesCreated: 0
        });
      }
    }

    return {
      processedCount: processedResults.length,
      totalInstancesCreated,
      upToDate,
      results: processedResults
    };
  }

  /**
   * Get transaction statistics
   * @param {string} userId - User ID
   * @param {string} period - Time period
   * @returns {Promise<Object>} Statistics
   */
  static async getTransactionStats(userId, period = 'month') {
    let dateFilter;
    const now = new Date();

    switch (period) {
      case 'week':
        dateFilter = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case 'month':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        dateFilter = quarterStart;
        break;
      case 'year':
        dateFilter = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const stats = await Transaction.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: dateFilter },
          isDeleted: { $ne: true },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalIncome: {
            $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
          },
          totalExpenses: {
            $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
          },
          avgTransactionAmount: { $avg: '$amount' },
          maxTransaction: { $max: '$amount' },
          minTransaction: { $min: '$amount' }
        }
      }
    ]);

    const result = stats[0] || {
      totalTransactions: 0,
      totalIncome: 0,
      totalExpenses: 0,
      avgTransactionAmount: 0,
      maxTransaction: 0,
      minTransaction: 0
    };

    result.netAmount = result.totalIncome - result.totalExpenses;
    result.period = period;
    result.dateFrom = dateFilter;
    result.dateTo = now;

    return result;
  }

  /**
   * Validate transaction data
   * @param {Object} transactionData - Transaction data to validate
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Validation result
   */
  static async validateTransaction(transactionData, userId) {
    const errors = [];

    // Required fields
    if (!transactionData.amount) errors.push('Amount is required');
    if (!transactionData.type) errors.push('Type is required');
    if (!transactionData.date) errors.push('Date is required');
    if (!transactionData.description) errors.push('Description is required');
    if (!transactionData.categoryId) errors.push('Category is required');

    // Amount validation
    if (transactionData.amount && (isNaN(transactionData.amount) || parseFloat(transactionData.amount) <= 0)) {
      errors.push('Amount must be a positive number');
    }

    // Type validation
    if (transactionData.type && !['income', 'expense', 'transfer'].includes(transactionData.type)) {
      errors.push('Type must be income, expense, or transfer');
    }

    // Category validation
    if (transactionData.categoryId) {
      const category = await Category.findOne({
        _id: transactionData.categoryId,
        user: userId
      });

      if (!category) {
        errors.push('Category not found or not owned by user');
      } else if (transactionData.type !== 'transfer' && category.type !== transactionData.type) {
        errors.push('Category type must match transaction type');
      }
    }

    // Transfer validation
    if (transactionData.type === 'transfer') {
      if (!transactionData.toAccount) errors.push('To account is required for transfers');
      if (!transactionData.fromAccount) errors.push('From account is required for transfers');
    }

    // Recurring validation
    if (transactionData.isRecurring) {
      if (!transactionData.recurringConfig || !transactionData.recurringConfig.frequency) {
        errors.push('Recurring configuration is required for recurring transactions');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
    }

  /**
   * Search transactions with autocomplete suggestions
   * @param {string} userId - User ID
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Search results
   */
  static async searchTransactionsAutocomplete(userId, searchParams) {
    const { 
      query,
      field = 'description',
      limit = 10
    } = searchParams;

    if (!query || query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }

    const validFields = ['description', 'category', 'paymentMethod', 'notes'];
    if (!validFields.includes(field)) {
      throw new Error(`Invalid search field. Valid options: ${validFields.join(', ')}`);
    }

    const limitNum = parseInt(limit);
    if (limitNum < 1 || limitNum > 50) {
      throw new Error('Limit must be between 1 and 50');
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    const matchStage = {
      user: new mongoose.Types.ObjectId(userId),
      isDeleted: { $ne: true },
      [field]: { $regex: searchRegex }
    };

    // Get unique suggestions based on the field
    const suggestions = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: `$${field}`,
          count: { $sum: 1 },
          lastUsed: { $max: '$date' },
          avgAmount: { $avg: '$amount' }
        }
      },
      { $sort: { count: -1, lastUsed: -1 } },
      { $limit: limitNum }
    ]);

    // Get recent transactions for context
    const recentTransactions = await Transaction.find(matchStage)
      .select('description category amount date type')
      .sort({ date: -1 })
      .limit(5)
      .lean();

    return {
      query: query.trim(),
      field,
      suggestions: suggestions.map(suggestion => ({
        value: suggestion._id,
        count: suggestion.count,
        lastUsed: suggestion.lastUsed,
        avgAmount: suggestion.avgAmount
      })),
      recentMatches: recentTransactions,
      totalMatches: suggestions.length
    };
  }

  /**
   * Create missing transactions for a given date range
   * @param {string} userId - User ID
   * @param {string} startDate - Start date of the range
   * @param {string} endDate - End date of the range
   * @returns {Promise<Object>} Result of the operation
   */
  static async createMissingTransactions(userId, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all dates with existing transactions in the range
    const existingDates = await Transaction.distinct('date', {
      user: userId,
      date: { $gte: start, $lte: end }
    });

    const existingDateSet = new Set(existingDates.map(d => d.toISOString().split('T')[0]));

    const missingTransactions = [];
    let currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (!existingDateSet.has(dateStr)) {
        missingTransactions.push({
          user: userId,
          amount: 0,
          type: 'expense', // or a default type
          category: null, // or a default category
          description: 'Missing transaction',
          date: new Date(currentDate),
          status: 'pending'
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (missingTransactions.length > 0) {
      await Transaction.insertMany(missingTransactions);
    }

    return {
      createdCount: missingTransactions.length,
      dateRange: {
        start,
        end
      }
    };
  }
}

module.exports = TransactionService;
