const AIService = require('../services/ai.service');
const TransactionService = require('../services/transaction.service');
const CategoryService = require('../services/category.service');
const BudgetService = require('../services/budget.service');
const GoalService = require('../services/goal.service');
const ReportService = require('../services/report.service');
const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');
const { 
  ErrorHandler, 
  ValidationError, 
  AuthenticationError, 
  ConflictError, 
  NotFoundError,
  RateLimitError,
  DatabaseError 
} = require('../utils/errorHandler');
const ResponseFormatter = require('../utils/responseFormatter');

/**
 * AI Controller
 * Handles all AI-related operations with comprehensive features
 */
class AIController {
  /**
   * Get AI insights for user
   */
  static getInsights = ErrorHandler.asyncHandler(async (req, res) => {
    const insights = await AIService.getInsights(req.user.id);
    
    return ApiResponse.success(
      res,
      { insights },
      'AI insights generated successfully',
      200,
      { 
        timestamp: new Date().toISOString(),
        generatedAt: new Date().toISOString()
      }
    );
  });

  /**
   * Get AI response for user input
   */
  static getAIResponse = ErrorHandler.asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid input', errors.array());
    }

    const { userInput, sessionId } = req.body;
    
    if (!userInput || userInput.trim().length === 0) {
      throw new ValidationError('User input is required');
    }

    const response = await AIService.getAIResponse(req.user.id, userInput, sessionId);
    
    // Try to parse if it's a structured response
    let parsedResponse;
    try {
      parsedResponse = typeof response === 'string' ? JSON.parse(response) : response;
    } catch (e) {
      parsedResponse = { type: 'text', content: response };
    }

    return ApiResponse.success(
      res,
      { response: parsedResponse },
      'AI response generated successfully',
      200,
      { 
        timestamp: new Date().toISOString(),
        responseType: parsedResponse.action ? 'action' : 'text'
      }
    );
  });

  /**
   * Get chat history for user
   */
  static getChatHistory = ErrorHandler.asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const history = await AIService.getChatHistory(req.user.id, parseInt(page), parseInt(limit));
    
    return ApiResponse.success(
      res,
      { history },
      'Chat history retrieved successfully',
      200,
      {
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: history.length
        }
      }
    );
  });

  /**
   * Execute AI-suggested action
   */
  static executeAIAction = ErrorHandler.asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid action data', errors.array());
    }

    const { action } = req.body;
    
    if (!action || !action.type || !action.data) {
      throw new ValidationError('Invalid action format. Required: type, action, data');
    }

    const result = await AIService.executeAction(req.user.id, action);
    
    return ApiResponse.success(
      res,
      { result },
      'Action executed successfully',
      201,
      {
        actionType: action.type,
        actionExecuted: action.action,
        timestamp: new Date().toISOString()
      }
    );
  });

  /**
   * Get user AI preferences
   */
  static getUserPreferences = ErrorHandler.asyncHandler(async (req, res) => {
    const preferences = await AIService.getUserPreferences(req.user.id);
    
    return ApiResponse.success(
      res,
      { preferences },
      'AI preferences retrieved successfully'
    );
  });

  /**
   * Update user AI preferences
   */
  static updateUserPreferences = ErrorHandler.asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid preferences data', errors.array());
    }

    const updates = req.body;
    const preferences = await AIService.updateUserPreferences(req.user.id, updates);
    
    return ApiResponse.success(
      res,
      { preferences },
      'AI preferences updated successfully'
    );
  });

  // =====================
  // AI DATA METHODS
  // =====================

  // =====================
  // TRANSACTION METHODS
  // =====================

  static getTransactions = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { 
      limit = 200, 
      page = 1, 
      type, 
      category, 
      startDate, 
      endDate,
      minAmount,
      maxAmount
    } = req.query;

    console.log(`🤖 [AI-DATA] Getting transactions for user ${userId} with filters:`, {
      limit, page, type, category, startDate, endDate, minAmount, maxAmount
    });

    const transactions = await TransactionService.getTransactions(userId, {
      limit: parseInt(limit),
      page: parseInt(page),
      type,
      category,
      startDate,
      endDate,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined
    });

    console.log(`✅ [AI-DATA] Retrieved ${transactions.transactions?.length || 0} transactions`);

    return ApiResponse.success(
      res,
      transactions,
      'Transactions retrieved for AI'
    );
  });

  static createTransaction = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const transactionData = req.body;

    console.log(`🤖 [AI-DATA] Creating transaction for user ${userId}:`, transactionData);

    // Validate required fields
    if (!transactionData.description || !transactionData.amount || !transactionData.type) {
      throw new ValidationError('Missing required fields: description, amount, type');
    }

    // Handle category - create if doesn't exist (only if it's a string, not already an ObjectId)
    if (transactionData.category && typeof transactionData.category === 'string') {
      const categoryResult = await CategoryService.getCategories(userId);
      const existingCategory = categoryResult.categories.find(cat => 
        cat.name.toLowerCase() === transactionData.category.toLowerCase()
      );

      if (!existingCategory) {
        console.log(`🔧 [AI-DATA] Creating new category: ${transactionData.category}`);
        const newCategory = await CategoryService.createCategory(userId, {
          name: transactionData.category,
          color: AIController.getDefaultCategoryColor(transactionData.category),
          icon: AIController.getDefaultCategoryIcon(transactionData.category)
        });
        transactionData.categoryId = newCategory.category._id;
      } else {
        transactionData.categoryId = existingCategory._id;
      }
      // Remove the original category field since TransactionService expects categoryId
      delete transactionData.category;
    } else if (transactionData.category) {
      // If category is already an ObjectId, rename it to categoryId
      transactionData.categoryId = transactionData.category;
      delete transactionData.category;
    }

    const transaction = await TransactionService.createTransaction(userId, transactionData);

    console.log(`✅ [AI-DATA] Transaction created with ID: ${transaction._id}`);

    return ApiResponse.success(
      res,
      { transaction },
      'Transaction created successfully via AI',
      201
    );
  });

  static updateTransaction = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const transactionId = req.params.id;
    const updateData = req.body;

    console.log(`🤖 [AI-DATA] Updating transaction ${transactionId} for user ${userId}`);

    const transaction = await TransactionService.updateTransaction(userId, transactionId, updateData);

    console.log(`✅ [AI-DATA] Transaction updated successfully`);

    return ApiResponse.success(
      res,
      transaction,
      'Transaction updated successfully via AI'
    );
  });

  static deleteTransaction = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const transactionId = req.params.id;

    console.log(`🤖 [AI-DATA] Deleting transaction ${transactionId} for user ${userId}`);

    await TransactionService.deleteTransaction(userId, transactionId);

    console.log(`✅ [AI-DATA] Transaction deleted successfully`);

    return ApiResponse.success(
      res,
      null,
      'Transaction deleted successfully via AI'
    );
  });

  static getTransactionById = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const transactionId = req.params.id;

    console.log(`🤖 [AI-DATA] Getting transaction ${transactionId} for user ${userId}`);

    const transaction = await TransactionService.getTransactionById(userId, transactionId);

    return ApiResponse.success(
      res,
      transaction,
      'Transaction retrieved via AI'
    );
  });

  // ==================
  // CATEGORY METHODS
  // ==================

  static getCategories = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { limit = 100, page = 1 } = req.query;

    console.log(`🤖 [AI-DATA] Getting categories for user ${userId}`);

    const categories = await CategoryService.getCategories(userId, {
      limit: parseInt(limit),
      page: parseInt(page)
    });

    console.log(`✅ [AI-DATA] Retrieved ${categories.categories?.length || 0} categories`);

    return ApiResponse.success(
      res,
      categories,
      'Categories retrieved for AI'
    );
  });

  static createCategory = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const categoryData = req.body;

    console.log(`🤖 [AI-DATA] Creating category for user ${userId}:`, categoryData);

    if (!categoryData.name) {
      throw new ValidationError('Category name is required');
    }

    // Add default color and icon if not provided
    if (!categoryData.color) {
      categoryData.color = AIController.getDefaultCategoryColor(categoryData.name);
    }
    if (!categoryData.icon) {
      categoryData.icon = AIController.getDefaultCategoryIcon(categoryData.name);
    }

    const category = await CategoryService.createCategory(userId, categoryData);

    console.log(`✅ [AI-DATA] Category created with ID: ${category.category._id}`);

    return ApiResponse.success(
      res,
      category,
      'Category created successfully via AI',
      201
    );
  });

  static updateCategory = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const categoryId = req.params.id;
    const updateData = req.body;

    console.log(`🤖 [AI-DATA] Updating category ${categoryId} for user ${userId}`);

    const category = await CategoryService.updateCategory(userId, categoryId, updateData);

    return ApiResponse.success(
      res,
      category,
      'Category updated successfully via AI'
    );
  });

  static deleteCategory = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const categoryId = req.params.id;

    console.log(`🤖 [AI-DATA] Deleting category ${categoryId} for user ${userId}`);

    await CategoryService.deleteCategory(userId, categoryId);

    return ApiResponse.success(
      res,
      null,
      'Category deleted successfully via AI'
    );
  });

  static getCategoryById = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const categoryId = req.params.id;

    const category = await CategoryService.getCategoryById(userId, categoryId);

    return ApiResponse.success(
      res,
      category,
      'Category retrieved via AI'
    );
  });

  // ================
  // BUDGET METHODS
  // ================

  static getBudgets = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { limit = 100, page = 1, status, period } = req.query;

    console.log(`🤖 [AI-DATA] Getting budgets for user ${userId}`);

    const budgets = await BudgetService.getBudgets(userId, {
      limit: parseInt(limit),
      page: parseInt(page),
      status,
      period
    });

    console.log(`✅ [AI-DATA] Retrieved ${budgets.budgets?.length || 0} budgets`);

    return ApiResponse.success(
      res,
      budgets,
      'Budgets retrieved for AI'
    );
  });

  static createBudget = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const budgetData = req.body;

    console.log(`🤖 [AI-DATA] Creating budget for user ${userId}:`, budgetData);

    if (!budgetData.name || !budgetData.amount || !budgetData.period) {
      throw new ValidationError('Missing required fields: name, amount, period');
    }

    const budget = await BudgetService.createBudget(userId, budgetData);

    console.log(`✅ [AI-DATA] Budget created with ID: ${budget.budget._id}`);

    return ApiResponse.success(
      res,
      budget,
      'Budget created successfully via AI',
      201
    );
  });

  static updateBudget = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const budgetId = req.params.id;
    const updateData = req.body;

    console.log(`🤖 [AI-DATA] Updating budget ${budgetId} for user ${userId}`);

    const budget = await BudgetService.updateBudget(userId, budgetId, updateData);

    return ApiResponse.success(
      res,
      budget,
      'Budget updated successfully via AI'
    );
  });

  static deleteBudget = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const budgetId = req.params.id;

    console.log(`🤖 [AI-DATA] Deleting budget ${budgetId} for user ${userId}`);

    await BudgetService.deleteBudget(userId, budgetId);

    return ApiResponse.success(
      res,
      null,
      'Budget deleted successfully via AI'
    );
  });

  static getBudgetById = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const budgetId = req.params.id;

    const budget = await BudgetService.getBudgetById(userId, budgetId);

    return ApiResponse.success(
      res,
      budget,
      'Budget retrieved via AI'
    );
  });

  // ==============
  // GOAL METHODS
  // ==============

  static getGoals = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { limit = 100, page = 1, status, type } = req.query;

    console.log(`🤖 [AI-DATA] Getting goals for user ${userId}`);

    const goals = await GoalService.getGoals(userId, {
      limit: parseInt(limit),
      page: parseInt(page),
      status,
      type
    });

    console.log(`✅ [AI-DATA] Retrieved ${goals.goals?.length || 0} goals`);

    return ApiResponse.success(
      res,
      goals,
      'Goals retrieved for AI'
    );
  });

  static createGoal = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const goalData = req.body;

    console.log(`🤖 [AI-DATA] Creating goal for user ${userId}:`, goalData);

    if (!goalData.name || !goalData.targetAmount || !goalData.targetDate) {
      throw new ValidationError('Missing required fields: name, targetAmount, targetDate');
    }

    // Add required startDate if not provided (default to current date)
    if (!goalData.startDate) {
      goalData.startDate = new Date().toISOString();
    }

    // Set default values for optional fields if not provided
    if (!goalData.currentAmount) {
      goalData.currentAmount = 0;
    }

    if (!goalData.status) {
      goalData.status = 'active';
    }

    if (!goalData.priority) {
      goalData.priority = 'medium';
    }

    if (!goalData.goalType) {
      // Try to determine goal type from name/description
      const nameAndDesc = (goalData.name + ' ' + (goalData.description || '')).toLowerCase();
      if (nameAndDesc.includes('emergency')) {
        goalData.goalType = 'emergency_fund';
      } else if (nameAndDesc.includes('debt') || nameAndDesc.includes('pay off')) {
        goalData.goalType = 'debt_payoff';
      } else if (nameAndDesc.includes('invest') || nameAndDesc.includes('retirement') || nameAndDesc.includes('401k')) {
        goalData.goalType = 'investment';
      } else if (nameAndDesc.includes('car') || nameAndDesc.includes('house') || nameAndDesc.includes('vacation')) {
        goalData.goalType = 'purchase';
      } else {
        goalData.goalType = 'savings';
      }
    }

    console.log(`🔧 [AI-DATA] Final goal data before service call:`, goalData);

    const goal = await GoalService.createGoal(goalData, userId);

    if (!goal || !goal._id) {
      throw new DatabaseError('Goal creation failed - no goal returned or missing ID');
    }

    console.log(`✅ [AI-DATA] Goal created with ID: ${goal._id}`);

    return ApiResponse.success(
      res,
      { goal },
      'Goal created successfully via AI',
      201
    );
  });

  static updateGoal = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const goalId = req.params.id;
    const updateData = req.body;

    console.log(`🤖 [AI-DATA] Updating goal ${goalId} for user ${userId}`);

    const goal = await GoalService.updateGoal(goalId, updateData, userId);

    return ApiResponse.success(
      res,
      goal,
      'Goal updated successfully via AI'
    );
  });

  static deleteGoal = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const goalId = req.params.id;

    console.log(`🤖 [AI-DATA] Deleting goal ${goalId} for user ${userId}`);

    await GoalService.deleteGoal(goalId, userId);

    return ApiResponse.success(
      res,
      null,
      'Goal deleted successfully via AI'
    );
  });

  static getGoalById = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const goalId = req.params.id;

    const goal = await GoalService.getGoalById(goalId, userId);

    return ApiResponse.success(
      res,
      goal,
      'Goal retrieved via AI'
    );
  });

  // ===================
  // UTILITY METHODS
  // ===================

  static getDefaultCategoryColor(categoryName) {
    const colorMap = {
      'salary': '#4CAF50',
      'income': '#4CAF50',
      'food': '#FF9800',
      'groceries': '#FF9800',
      'restaurant': '#FF5722',
      'transport': '#2196F3',
      'gas': '#2196F3',
      'entertainment': '#9C27B0',
      'shopping': '#E91E63',
      'utilities': '#607D8B',
      'rent': '#795548',
      'health': '#00BCD4',
      'education': '#3F51B5',
      'investment': '#8BC34A',
      'savings': '#4CAF50'
    };

    const lowerName = categoryName.toLowerCase();
    for (const [key, color] of Object.entries(colorMap)) {
      if (lowerName.includes(key)) {
        return color;
      }
    }

    // Default colors for unknown categories
    const defaultColors = ['#9E9E9E', '#757575', '#616161', '#424242'];
    return defaultColors[Math.floor(Math.random() * defaultColors.length)];
  }

  static getDefaultCategoryIcon(categoryName) {
    const iconMap = {
      'salary': 'work',
      'income': 'trending_up',
      'food': 'restaurant',
      'groceries': 'shopping_cart',
      'restaurant': 'restaurant_menu',
      'transport': 'directions_car',
      'gas': 'local_gas_station',
      'entertainment': 'movie',
      'shopping': 'shopping_bag',
      'utilities': 'home',
      'rent': 'home',
      'health': 'local_hospital',
      'education': 'school',
      'investment': 'show_chart',
      'savings': 'savings'
    };

    const lowerName = categoryName.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (lowerName.includes(key)) {
        return icon;
      }
    }

    return 'category'; // Default icon
  }

  // ==================
  // ANALYTICS METHODS
  // ==================

  /**
   * Get financial summary for AI
   */
  static getFinancialSummary = ErrorHandler.asyncHandler(async (req, res) => {
    const { period = 'monthly', startDate, endDate } = req.query;
    
    const options = {};
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    
    // Get comprehensive financial summary
    const dashboardSummary = await ReportService.getDashboardSummary(req.user.id, period);
    
    return ApiResponse.success(
      res,
      dashboardSummary,
      'Financial summary retrieved successfully',
      200,
      { timestamp: new Date().toISOString() }
    );
  });

  /**
   * Get spending patterns for AI
   */
  static getSpendingPatterns = ErrorHandler.asyncHandler(async (req, res) => {
    const { startDate, endDate, groupBy = 'category' } = req.query;
    
    const options = {};
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    
    const spendingReport = await ReportService.generateSpendingReport(req.user.id, options);
    
    return ApiResponse.success(
      res,
      {
        summary: spendingReport.summary,
        categoryAnalysis: spendingReport.categoryAnalysis,
        timeBasedAnalysis: spendingReport.timeBasedAnalysis,
        trends: spendingReport.trends,
        topMerchants: spendingReport.topMerchants,
        period: spendingReport.period
      },
      'Spending patterns retrieved successfully',
      200,
      { timestamp: new Date().toISOString() }
    );
  });

  /**
   * Get spending breakdown by category for AI
   */
  static getSpendingBreakdown = ErrorHandler.asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    // Default to last month if no dates provided
    const endDateObj = endDate ? new Date(endDate) : new Date();
    const startDateObj = startDate ? new Date(startDate) : new Date(endDateObj.getFullYear(), endDateObj.getMonth() - 1, 1);
    
    const options = {
      startDate: startDateObj,
      endDate: endDateObj
    };
    
    const spendingReport = await ReportService.generateSpendingReport(req.user.id, options);
    
    // Format for AI consumption - spending breakdown by category
    const categoryBreakdown = (spendingReport.categoryAnalysis || []).map(category => ({
      category: category.categoryName || 'Uncategorized',
      amount: category.totalAmount || 0,
      percentage: category.percentage || 0,
      transactionCount: category.transactionCount || 0,
      averageAmount: category.averageAmount || 0,
      color: category.categoryColor || '#cccccc'
    }));
    
    const summary = {
      totalSpending: spendingReport.summary?.totalSpending || 0,
      totalCategories: categoryBreakdown.length,
      period: {
        startDate: startDateObj.toISOString(),
        endDate: endDateObj.toISOString()
      }
    };
    
    return ApiResponse.success(
      res,
      {
        summary,
        categoryBreakdown,
        insights: {
          topCategory: categoryBreakdown[0] || null,
          diversificationScore: categoryBreakdown.length > 0 ? 1 / categoryBreakdown.length : 0
        }
      },
      categoryBreakdown.length > 0 ? 
        `Found spending across ${categoryBreakdown.length} categories for the selected period` :
        'No spending data found for the selected period',
      200,
      { timestamp: new Date().toISOString() }
    );
  });

  /**
   * Get transaction analytics for AI
   */
  static getTransactionAnalytics = ErrorHandler.asyncHandler(async (req, res) => {
    const analytics = await TransactionService.getTransactionAnalytics(req.user.id, req.query);
    
    return ApiResponse.success(
      res,
      analytics,
      'Transaction analytics retrieved successfully',
      200,
      { timestamp: new Date().toISOString() }
    );
  });
}

module.exports = AIController;
