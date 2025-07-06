const express = require('express');
const router = express.Router();
const BudgetController = require('../controllers/budget.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const ValidationMiddleware = require('../middleware/validation.middleware');

// Apply authentication middleware to all budget routes
router.use(verifyToken);

/**
 * @route   GET /api/budgets
 * @desc    Get user budgets with filtering and analytics
 * @access  Private
 */
router.get('/', 
  ValidationMiddleware.validateBudgetQuery(),
  BudgetController.getBudgets
);

/**
 * @route   GET /api/budgets/:id
 * @desc    Get detailed budget information with performance analysis
 * @access  Private
 */
router.get('/:id', 
  ValidationMiddleware.validateBudgetId(),
  BudgetController.getBudgetDetails
);

/**
 * @route   POST /api/budgets
 * @desc    Create a new budget
 * @access  Private
 */
router.post('/', 
  ValidationMiddleware.validateBudgetCreation(),
  BudgetController.createBudget
);

/**
 * @route   PUT /api/budgets/:id
 * @desc    Update budget with impact analysis
 * @access  Private
 */
router.put('/:id', 
  ValidationMiddleware.validateBudgetUpdate(),
  BudgetController.updateBudget
);

/**
 * @route   DELETE /api/budgets/:id
 * @desc    Delete budget with impact assessment
 * @access  Private
 */
router.delete('/:id', 
  ValidationMiddleware.validateBudgetDeletion(),
  BudgetController.deleteBudget
);

/**
 * @route   GET /api/budgets/:id/analysis
 * @desc    Get comprehensive budget analysis and insights
 * @access  Private
 */
router.get('/:id/analysis', 
  ValidationMiddleware.validateBudgetAnalysis(),
  BudgetController.getBudgetAnalysis
);

/**
 * @route   GET /api/budgets/recommendations/optimization
 * @desc    Get AI-driven budget optimization recommendations
 * @access  Private
 */
router.get('/recommendations/optimization', 
  ValidationMiddleware.validateOptimizationQuery(),
  BudgetController.generateOptimizationRecommendations
);

/**
 * @route   POST /api/budgets/:id/rollover
 * @desc    Create new budget based on existing budget template
 * @access  Private
 */
router.post('/:id/rollover', 
  ValidationMiddleware.validateBudgetRollover(),
  BudgetController.createBudget
);

/**
 * @route   GET /api/budgets/analytics/performance
 * @desc    Get overall budget performance analytics
 * @access  Private
 */
router.get('/analytics/performance', 
  ValidationMiddleware.validateBudgetQuery(),
  BudgetController.getBudgetAnalysis
);

/**
 * @route   PUT /api/budgets/:id/toggle-status
 * @desc    Toggle budget active/inactive status
 * @access  Private
 */
router.put('/:id/toggle-status', 
  ValidationMiddleware.validateBudgetId(),
  BudgetController.updateBudget
);

/**
 * @route   POST /api/budgets/bulk-update
 * @desc    Bulk update multiple budgets
 * @access  Private
 */
router.post('/bulk-update', 
  ValidationMiddleware.validateBulkBudgetOperation(),
  BudgetController.updateBudget
);

/**
 * @route   POST /api/budgets/:id/trigger-alerts
 * @desc    Manually trigger budget alerts for a specific budget
 * @access  Private
 */
router.post('/:id/trigger-alerts', 
  ValidationMiddleware.validateBudgetId(),
  BudgetController.triggerBudgetAlerts
);

/**
 * @route   POST /api/budgets/monthly-summary
 * @desc    Send monthly budget summary
 * @access  Private
 */
router.post('/monthly-summary', 
  BudgetController.sendMonthlySummary
);

/**
 * @route   GET /api/budgets/alert-preferences
 * @desc    Get user's budget alert preferences
 * @access  Private
 */
router.get('/alert-preferences', 
  BudgetController.getBudgetAlertPreferences
);

/**
 * @route   PUT /api/budgets/alert-preferences
 * @desc    Update user's budget alert preferences
 * @access  Private
 */
router.put('/alert-preferences', 
  BudgetController.updateBudgetAlertPreferences
);

module.exports = router;
