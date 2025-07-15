const express = require('express');
const router = express.Router();
const AIController = require('../controllers/ai.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Apply authentication middleware to all AI data routes
router.use(verifyToken);

// =====================
// TRANSACTION ENDPOINTS
// =====================

// GET: Retrieve transactions for AI
router.get('/transactions', AIController.getTransactions);

// POST: Create transaction via AI
router.post('/transactions', AIController.createTransaction);

// PUT: Update transaction via AI
router.put('/transactions/:id', AIController.updateTransaction);

// DELETE: Delete transaction via AI
router.delete('/transactions/:id', AIController.deleteTransaction);

// GET: Get transaction by ID for AI
router.get('/transactions/:id', AIController.getTransactionById);

// ==================
// CATEGORY ENDPOINTS
// ==================

// GET: Retrieve categories for AI
router.get('/categories', AIController.getCategories);

// POST: Create category via AI
router.post('/categories', AIController.createCategory);

// PUT: Update category via AI
router.put('/categories/:id', AIController.updateCategory);

// DELETE: Delete category via AI
router.delete('/categories/:id', AIController.deleteCategory);

// GET: Get category by ID for AI
router.get('/categories/:id', AIController.getCategoryById);

// ================
// BUDGET ENDPOINTS
// ================

// GET: Retrieve budgets for AI
router.get('/budgets', AIController.getBudgets);

// POST: Create budget via AI
router.post('/budgets', AIController.createBudget);

// PUT: Update budget via AI
router.put('/budgets/:id', AIController.updateBudget);

// DELETE: Delete budget via AI
router.delete('/budgets/:id', AIController.deleteBudget);

// GET: Get budget by ID for AI
router.get('/budgets/:id', AIController.getBudgetById);

// ==============
// GOAL ENDPOINTS
// ==============

// GET: Retrieve goals for AI
router.get('/goals', AIController.getGoals);

// POST: Create goal via AI
router.post('/goals', AIController.createGoal);

// PUT: Update goal via AI
router.put('/goals/:id', AIController.updateGoal);

// DELETE: Delete goal via AI
router.delete('/goals/:id', AIController.deleteGoal);

// GET: Get goal by ID for AI
router.get('/goals/:id', AIController.getGoalById);

// ==================
// ANALYTICS ENDPOINTS
// ==================

// GET: Get financial summary for AI
router.get('/analytics/financial-summary', AIController.getFinancialSummary);

// GET: Get spending patterns for AI
router.get('/analytics/spending-patterns', AIController.getSpendingPatterns);

// GET: Get spending breakdown by category for AI
router.get('/analytics/spending-breakdown', AIController.getSpendingBreakdown);

// GET: Get transaction analytics for AI
router.get('/analytics/transaction-analytics', AIController.getTransactionAnalytics);

// GET: Get comprehensive transaction data for AI
router.get('/transactions/comprehensive', async (req, res) => {
  try {
    const aiDataAccessService = require('../services/aiDataAccess.service');
    const userId = req.user.id;
    const {
      limit = 100,
      includeRecent = true,
      timeframe = 'last-3-months'
    } = req.query;

    const options = {
      limit: parseInt(limit),
      includeRecent: includeRecent === 'true',
      timeframe
    };

    const data = await aiDataAccessService.getComprehensiveTransactions(userId, options);

    return res.json({
      success: true,
      message: 'Comprehensive transaction data retrieved successfully',
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in comprehensive transactions endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve comprehensive transaction data',
      code: 'INTERNAL_ERROR'
    });
  }
});

// GET: Get recent transactions for AI (for spending breakdown)
router.get('/transactions/recent/:count?', async (req, res) => {
  try {
    const aiDataAccessService = require('../services/aiDataAccess.service');
    const userId = req.user.id;
    const count = Math.min(parseInt(req.params.count) || 50, 200);

    const data = await aiDataAccessService.getComprehensiveTransactions(userId, {
      limit: count,
      includeRecent: true
    });

    // Format for AI consumption
    const formattedTransactions = data.recentTransactions.map(transaction => ({
      id: transaction._id,
      date: transaction.date,
      description: transaction.description,
      category: transaction.category?.name || 'Uncategorized',
      type: transaction.type,
      amount: transaction.amount,
      paymentMethod: transaction.paymentMethod,
      payee: transaction.payee,
      notes: transaction.notes,
      tags: transaction.tags || []
    }));

    return res.json({
      success: true,
      message: `Retrieved ${formattedTransactions.length} recent transactions`,
      data: {
        transactions: formattedTransactions,
        count: formattedTransactions.length,
        summary: data.summary
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in recent transactions endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve recent transactions',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
