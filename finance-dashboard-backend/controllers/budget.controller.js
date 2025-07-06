const { budgetService, budgetAlertService } = require('../services');
const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');
const { 
  ErrorHandler, 
  ValidationError, 
  AuthorizationError, 
  NotFoundError,
  ConflictError,
  DatabaseError 
} = require('../utils/errorHandler');

/**
 * Budget Controller
 * Handles comprehensive budget management operations
 */
class BudgetController {
  /**
   * Get user budgets with filtering and performance analysis
   */
  static getBudgets = ErrorHandler.asyncHandler(async (req, res) => {
    const result = await budgetService.getBudgets(req.user.id, req.query);
    
    return ApiResponse.paginated(
      res, 
      result.budgets, 
      result.pagination, 
      'Budgets retrieved successfully', 
      { summary: result.summary }
    );
  });

  /**
   * Get detailed budget information with real-time calculations
   */
  static getBudgetDetails = ErrorHandler.asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { includeProjections, includeTrends } = req.query;
    console.log('[BudgetController] getBudgetDetails incoming id:', id);
    let result;
    try {
      result = await require('../services').budgetService.getBudgetDetails(
        id,
        req.user.id,
        { includeProjections, includeTrends }
      );
      console.log('[BudgetController] getBudgetDetails result:', JSON.stringify(result, null, 2));
      return ApiResponse.success(
        res,
        result,
        'Budget details retrieved successfully'
      );
    } catch (err) {
      console.error('[BudgetController] getBudgetDetails error:', err);
      return ApiResponse.error(
        res,
        err,
        'Failed to retrieve budget details'
      );
    }
  });

  /**
   * Create a new budget
   */
  static createBudget = ErrorHandler.asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid budget data', errors.array());
    }

    // Log incoming request body and user
    console.log('[BudgetController] Incoming createBudget request:', JSON.stringify(req.body, null, 2));
    console.log('[BudgetController] User:', req.user && req.user.id);

    const budgetData = {
      ...req.body,
      userId: req.user.id
    };

    const result = await budgetService.createBudget(budgetData, req.user.id);
    
    return ApiResponse.created(
      res,
      result,
      'Budget created successfully'
    );
  });

  /**
   * Update an existing budget
   */
  static updateBudget = ErrorHandler.asyncHandler(async (req, res) => {
    console.log('[BudgetController] Incoming updateBudget request:', {
      params: req.params,
      body: req.body,
      user: req.user && req.user.id
    });
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('[BudgetController] Validation errors:', errors.array());
      throw new ValidationError('Invalid budget data', errors.array());
    }
    const { id } = req.params;
    const updateData = req.body;

    try {
      const result = await budgetService.updateBudget(id, updateData, req.user.id);
      console.log('[BudgetController] updateBudget result:', result);
      return ApiResponse.success(
        res,
        result,
        'Budget updated successfully'
      );
    } catch (error) {
      console.error('[BudgetController] Error in updateBudget:', error);
      if (error instanceof NotFoundError) {
        return ApiResponse.notFound(res, error.message);
      }
      if (error instanceof AuthorizationError) {
        return ApiResponse.forbidden(res, error.message);
      }
      // Generic error for any other issues during the update process
      return ApiResponse.error(res, error.message || 'Failed to update budget');
    }
  });

  /**
   * Delete a budget
   */
  static deleteBudget = ErrorHandler.asyncHandler(async (req, res) => {
    const { budgetId } = req.params;

    await budgetService.deleteBudget(budgetId, req.user.id);
    
    return ApiResponse.success(
      res,
      null,
      'Budget deleted successfully'
    );
  });

  /**
   * Duplicate an existing budget
   */
  static duplicateBudget = ErrorHandler.asyncHandler(async (req, res) => {
    const { budgetId } = req.params;
    const { name, period } = req.body;

    const result = await budgetService.duplicateBudget(budgetId, req.user.id, { name, period });
    
    return ApiResponse.created(
      res,
      result,
      'Budget duplicated successfully'
    );
  });

  /**
   * Get budget analysis with performance metrics
   */
  static getBudgetAnalysis = ErrorHandler.asyncHandler(async (req, res) => {
    const { budgetId } = req.params;
    const { period, includeComparisons } = req.query;

    const result = await budgetService.getBudgetAnalysis(
      budgetId, 
      req.user.id, 
      { period, includeComparisons }
    );
    
    return ApiResponse.success(
      res,
      result,
      'Budget analysis retrieved successfully'
    );
  });

  /**
   * Generate optimization recommendations
   */
  static generateOptimizationRecommendations = ErrorHandler.asyncHandler(async (req, res) => {
    const { budgetId } = req.params;
    const { analysisType, priorityLevel } = req.query;

    const result = await budgetService.generateOptimizationRecommendations(
      budgetId, 
      req.user.id,
      { analysisType, priorityLevel }
    );
    
    return ApiResponse.success(
      res,
      result,
      'Optimization recommendations generated successfully'
    );
  });

  /**
   * Calculate spending projections
   */
  static calculateSpendingProjections = ErrorHandler.asyncHandler(async (req, res) => {
    const { budgetId } = req.params;
    const { months, scenarios } = req.query;

    const result = await budgetService.calculateSpendingProjections(
      budgetId, 
      req.user.id,
      { months, scenarios }
    );
    
    return ApiResponse.success(
      res,
      result,
      'Spending projections calculated successfully'
    );
  });

  /**
   * Calculate period comparisons
   */
  static calculatePeriodComparisons = ErrorHandler.asyncHandler(async (req, res) => {
    const { budgetId } = req.params;
    const { comparePeriod, metrics } = req.query;

    const result = await budgetService.calculatePeriodComparisons(
      budgetId, 
      req.user.id,
      { comparePeriod, metrics }
    );
    
    return ApiResponse.success(
      res,
      result,
      'Period comparisons calculated successfully'
    );
  });

  /**
   * Calculate budget health score
   */
  static calculateBudgetHealthScore = ErrorHandler.asyncHandler(async (req, res) => {
    const { budgetId } = req.params;

    const result = await budgetService.calculateBudgetHealthScore(budgetId, req.user.id);
    
    return ApiResponse.success(
      res,
      result,
      'Budget health score calculated successfully'
    );
  });

  /**
   * Trigger budget alerts
   */
  static triggerBudgetAlerts = ErrorHandler.asyncHandler(async (req, res) => {
    const { budgetId } = req.params;
    const { alertTypes, forceCheck } = req.body;

    const result = await budgetAlertService.triggerBudgetAlerts(
      budgetId, 
      req.user.id,
      { alertTypes, forceCheck }
    );
    
    return ApiResponse.success(
      res,
      result,
      'Budget alerts triggered successfully'
    );
  });

  /**
   * Send monthly budget summary
   */
  static sendMonthlySummary = ErrorHandler.asyncHandler(async (req, res) => {
    const { month, year, includeRecommendations } = req.body;

    const result = await budgetAlertService.sendMonthlySummary(
      req.user.id,
      { month, year, includeRecommendations }
    );
    
    return ApiResponse.success(
      res,
      result,
      'Monthly summary sent successfully'
    );
  });

  /**
   * Get budget alert preferences
   */
  static getBudgetAlertPreferences = ErrorHandler.asyncHandler(async (req, res) => {
    const result = await budgetAlertService.getAlertPreferences(req.user.id);
    
    return ApiResponse.success(
      res,
      result,
      'Budget alert preferences retrieved successfully'
    );
  });

  /**
   * Update budget alert preferences
   */
  static updateBudgetAlertPreferences = ErrorHandler.asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid alert preferences data', errors.array());
    }

    const result = await budgetAlertService.updateAlertPreferences(req.user.id, req.body);
    
    return ApiResponse.success(
      res,
      result,
      'Budget alert preferences updated successfully'
    );
  });
}

module.exports = BudgetController;
