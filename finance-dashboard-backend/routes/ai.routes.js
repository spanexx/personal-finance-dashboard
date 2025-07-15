const express = require('express');
const router = express.Router();
const AIController = require('../controllers/ai.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { body, query, param } = require('express-validator');

// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================

// Validation middleware for chat input
const validateChatInput = [
  body('userInput')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('User input must be between 1 and 1000 characters'),
  body('sessionId')
    .optional()
    .isUUID()
    .withMessage('Session ID must be a valid UUID')
];

// Validation middleware for action execution
const validateActionExecution = [
  body('action.type')
    .isIn(['transaction', 'budget', 'goal', 'category'])
    .withMessage('Action type must be one of: transaction, budget, goal, category'),
  body('action.action')
    .isIn(['create', 'update', 'delete'])
    .withMessage('Action must be one of: create, update, delete'),
  body('action.data')
    .isObject()
    .withMessage('Action data must be an object')
];

// Validation middleware for preferences
const validatePreferences = [
  body('responseStyle')
    .optional()
    .isIn(['concise', 'detailed', 'conversational', 'professional'])
    .withMessage('Response style must be one of: concise, detailed, conversational, professional'),
  body('insightFrequency')
    .optional()
    .isIn(['daily', 'weekly', 'monthly', 'manual'])
    .withMessage('Insight frequency must be one of: daily, weekly, monthly, manual')
];

// Validation middleware for pagination
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Limit must be between 1 and 200')
];

// Validation middleware for transaction creation
const validateTransactionData = [
  body('description')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Description is required and must be 1-255 characters'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('type')
    .isIn(['income', 'expense', 'transfer'])
    .withMessage('Type must be income, expense, or transfer'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be in ISO format'),
  body('category')
    .optional()
    .trim(),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'bank_transfer', 'check', 'digital_wallet', 'other'])
    .withMessage('Invalid payment method')
];

// Validation middleware for budget creation
const validateBudgetData = [
  body('name')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Budget name is required and must be 1-100 characters'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('period')
    .isIn(['weekly', 'monthly', 'quarterly', 'yearly', 'custom'])
    .withMessage('Period must be weekly, monthly, quarterly, yearly, or custom')
];

// Validation middleware for goal creation
const validateGoalData = [
  body('name')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Goal name is required and must be 1-100 characters'),
  body('targetAmount')
    .isFloat({ min: 0.01 })
    .withMessage('Target amount must be a positive number'),
  body('targetDate')
    .isISO8601()
    .withMessage('Target date must be in ISO format')
];

// Validation middleware for category creation
const validateCategoryData = [
  body('name')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Category name is required and must be 1-50 characters'),
  body('type')
    .isIn(['income', 'expense'])
    .withMessage('Category type must be income or expense')
];

// Enhanced logging middleware for AI endpoints
const aiLogger = (endpoint) => (req, res, next) => {
  const timestamp = new Date().toISOString();
  const userId = req.user?.id || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  console.log(`🤖 [AI-ENDPOINT] ${timestamp} - ${endpoint}`);
  console.log(`   └─ User: ${userId}`);
  console.log(`   └─ Method: ${req.method}`);
  console.log(`   └─ User-Agent: ${userAgent}`);
  
  if (req.method === 'POST' && req.body) {
    console.log(`   └─ Body:`, JSON.stringify(req.body, null, 2));
  }
  
  if (req.query && Object.keys(req.query).length > 0) {
    console.log(`   └─ Query:`, req.query);
  }
  
  next();
};

// Middleware to ensure only AI service can access certain endpoints
const aiServiceOnly = (req, res, next) => {
  const userAgent = req.get('User-Agent');
  const aiServiceHeader = req.get('X-AI-Service');
  
  if (aiServiceHeader !== 'finance-ai-assistant' && !userAgent?.includes('AI-Service')) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: AI service endpoints only',
      code: 'AI_SERVICE_ONLY'
    });
  }
  
  next();
};

// ==========================================
// CORE AI FUNCTIONALITY ROUTES
// ==========================================

/**
 * @route GET /api/ai/insights
 * @desc Get AI insights for user
 * @access Private
 */
router.get('/insights', verifyToken, aiLogger('insights'), AIController.getInsights);

/**
 * @route POST /api/ai/chat
 * @desc Chat with AI assistant
 * @access Private
 */
router.post('/chat', verifyToken, validateChatInput, aiLogger('chat'), AIController.getAIResponse);

/**
 * @route GET /api/ai/chat/history
 * @desc Get chat history
 * @access Private
 */
router.get('/chat/history', verifyToken, validatePagination, AIController.getChatHistory);

/**
 * @route POST /api/ai/execute-action
 * @desc Execute AI-suggested action
 * @access Private
 */
router.post('/execute-action', verifyToken, validateActionExecution, aiLogger('execute-action'), AIController.executeAIAction);

/**
 * @route GET /api/ai/preferences
 * @desc Get user AI preferences
 * @access Private
 */
router.get('/preferences', verifyToken, AIController.getUserPreferences);

/**
 * @route PUT /api/ai/preferences
 * @desc Update user AI preferences
 * @access Private
 */
router.put('/preferences', verifyToken, validatePreferences, AIController.updateUserPreferences);

// ==========================================
// TRANSACTION ROUTES
// ==========================================

/**
 * @route GET /api/ai/transactions
 * @desc Get transactions for AI
 * @access Private
 */
router.get('/transactions', verifyToken, validatePagination, AIController.getTransactions);

/**
 * @route POST /api/ai/transactions
 * @desc Create transaction via AI
 * @access Private
 */
router.post('/transactions', verifyToken, validateTransactionData, aiLogger('create-transaction'), AIController.createTransaction);

/**
 * @route PUT /api/ai/transactions/:id
 * @desc Update transaction via AI
 * @access Private
 */
router.put('/transactions/:id', verifyToken, param('id').isMongoId(), AIController.updateTransaction);

/**
 * @route DELETE /api/ai/transactions/:id
 * @desc Delete transaction via AI
 * @access Private
 */
router.delete('/transactions/:id', verifyToken, param('id').isMongoId(), AIController.deleteTransaction);

/**
 * @route GET /api/ai/transactions/:id
 * @desc Get transaction by ID for AI
 * @access Private
 */
router.get('/transactions/:id', verifyToken, param('id').isMongoId(), AIController.getTransactionById);

// ==========================================
// CATEGORY ROUTES
// ==========================================

/**
 * @route GET /api/ai/categories
 * @desc Get categories for AI
 * @access Private
 */
router.get('/categories', verifyToken, validatePagination, AIController.getCategories);

/**
 * @route POST /api/ai/categories
 * @desc Create category via AI
 * @access Private
 */
router.post('/categories', verifyToken, validateCategoryData, aiLogger('create-category'), AIController.createCategory);

/**
 * @route PUT /api/ai/categories/:id
 * @desc Update category via AI
 * @access Private
 */
router.put('/categories/:id', verifyToken, param('id').isMongoId(), AIController.updateCategory);

/**
 * @route DELETE /api/ai/categories/:id
 * @desc Delete category via AI
 * @access Private
 */
router.delete('/categories/:id', verifyToken, param('id').isMongoId(), AIController.deleteCategory);

/**
 * @route GET /api/ai/categories/:id
 * @desc Get category by ID for AI
 * @access Private
 */
router.get('/categories/:id', verifyToken, param('id').isMongoId(), AIController.getCategoryById);

// ==========================================
// BUDGET ROUTES
// ==========================================

/**
 * @route GET /api/ai/budgets
 * @desc Get budgets for AI
 * @access Private
 */
router.get('/budgets', verifyToken, validatePagination, AIController.getBudgets);

/**
 * @route POST /api/ai/budgets
 * @desc Create budget via AI
 * @access Private
 */
router.post('/budgets', verifyToken, validateBudgetData, aiLogger('create-budget'), AIController.createBudget);

/**
 * @route PUT /api/ai/budgets/:id
 * @desc Update budget via AI
 * @access Private
 */
router.put('/budgets/:id', verifyToken, param('id').isMongoId(), AIController.updateBudget);

/**
 * @route DELETE /api/ai/budgets/:id
 * @desc Delete budget via AI
 * @access Private
 */
router.delete('/budgets/:id', verifyToken, param('id').isMongoId(), AIController.deleteBudget);

/**
 * @route GET /api/ai/budgets/:id
 * @desc Get budget by ID for AI
 * @access Private
 */
router.get('/budgets/:id', verifyToken, param('id').isMongoId(), AIController.getBudgetById);

// ==========================================
// GOAL ROUTES
// ==========================================

/**
 * @route GET /api/ai/goals
 * @desc Get goals for AI
 * @access Private
 */
router.get('/goals', verifyToken, validatePagination, AIController.getGoals);

/**
 * @route POST /api/ai/goals
 * @desc Create goal via AI
 * @access Private
 */
router.post('/goals', verifyToken, validateGoalData, aiLogger('create-goal'), AIController.createGoal);

/**
 * @route PUT /api/ai/goals/:id
 * @desc Update goal via AI
 * @access Private
 */
router.put('/goals/:id', verifyToken, param('id').isMongoId(), AIController.updateGoal);

/**
 * @route DELETE /api/ai/goals/:id
 * @desc Delete goal via AI
 * @access Private
 */
router.delete('/goals/:id', verifyToken, param('id').isMongoId(), AIController.deleteGoal);

/**
 * @route GET /api/ai/goals/:id
 * @desc Get goal by ID for AI
 * @access Private
 */
router.get('/goals/:id', verifyToken, param('id').isMongoId(), AIController.getGoalById);

// ==========================================
// ANALYTICS ROUTES
// ==========================================

/**
 * @route GET /api/ai/analytics/financial-summary
 * @desc Get financial summary for AI
 * @access Private
 */
router.get('/analytics/financial-summary', verifyToken, AIController.getFinancialSummary);

/**
 * @route GET /api/ai/analytics/spending-patterns
 * @desc Get spending patterns for AI
 * @access Private
 */
router.get('/analytics/spending-patterns', verifyToken, AIController.getSpendingPatterns);

/**
 * @route GET /api/ai/analytics/spending-breakdown
 * @desc Get spending breakdown by category for AI
 * @access Private
 */
router.get('/analytics/spending-breakdown', verifyToken, AIController.getSpendingBreakdown);

/**
 * @route GET /api/ai/analytics/transaction-analytics
 * @desc Get transaction analytics for AI
 * @access Private
 */
router.get('/analytics/transaction-analytics', verifyToken, AIController.getTransactionAnalytics);

// ==========================================
// COMPREHENSIVE DATA ACCESS ROUTES
// ==========================================

/**
 * @route GET /api/ai/data/transactions/comprehensive
 * @desc Get comprehensive transaction data for AI analysis
 * @access Private (AI Service Only)
 */
router.get('/data/transactions/comprehensive', verifyToken, aiServiceOnly, aiLogger('transactions/comprehensive'), async (req, res) => {
  try {
    const AIService = require('../services/ai.service');
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

    const aiService = new AIService();
    const data = await aiService.getComprehensiveTransactions(userId, options);

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

/**
 * @route GET /api/ai/data/transactions/recent/:count?
 * @desc Get recent transactions for AI (for spending breakdown)
 * @access Private (AI Service Only)
 */
router.get('/data/transactions/recent/:count?', verifyToken, aiServiceOnly, async (req, res) => {
  try {
    const AIService = require('../services/ai.service');
    const userId = req.user.id;
    const count = Math.min(parseInt(req.params.count) || 50, 200);

    const aiService = new AIService();
    const data = await aiService.getComprehensiveTransactions(userId, {
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

/**
 * @route GET /api/ai/data/budgets/comprehensive
 * @desc Get comprehensive budget data for AI analysis
 * @access Private (AI Service Only)
 */
router.get('/data/budgets/comprehensive', verifyToken, aiServiceOnly, async (req, res) => {
  try {
    const AIService = require('../services/ai.service');
    const userId = req.user.id;
    
    const aiService = new AIService();
    const data = await aiService.getComprehensiveBudgets(userId);

    res.json({
      success: true,
      message: 'Comprehensive budget data retrieved successfully',
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in comprehensive budgets endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve comprehensive budget data',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @route GET /api/ai/data/goals/comprehensive
 * @desc Get comprehensive goals data for AI analysis
 * @access Private (AI Service Only)
 */
router.get('/data/goals/comprehensive', verifyToken, aiServiceOnly, async (req, res) => {
  try {
    const AIService = require('../services/ai.service');
    const userId = req.user.id;
    
    const aiService = new AIService();
    const data = await aiService.getComprehensiveGoals(userId);

    res.json({
      success: true,
      message: 'Comprehensive goals data retrieved successfully',
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in comprehensive goals endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve comprehensive goals data',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @route GET /api/ai/data/context/financial
 * @desc Get complete financial context for AI analysis
 * @access Private (AI Service Only)
 */
router.get('/data/context/financial', verifyToken, aiServiceOnly, async (req, res) => {
  try {
    const AIService = require('../services/ai.service');
    const userId = req.user.id;
    const {
      includeTransactions = 'true',
      includeBudgets = 'true',
      includeGoals = 'true',
      transactionLimit = '50',
      timeframe = 'last-3-months'
    } = req.query;

    const options = {
      includeTransactions: includeTransactions === 'true',
      includeBudgets: includeBudgets === 'true',
      includeGoals: includeGoals === 'true',
      transactionLimit: parseInt(transactionLimit),
      timeframe
    };

    const aiService = new AIService();
    const context = await aiService.getFinancialContext(userId, options);

    res.json({
      success: true,
      message: 'Financial context retrieved successfully',
      data: context,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in financial context endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve financial context',
      code: 'INTERNAL_ERROR'
    });
  }
});

// ==========================================
// UTILITY ROUTES
// ==========================================

/**
 * @route GET /api/ai/schemas
 * @desc Get creation schemas for AI to understand required fields
 * @access Private
 */
router.get('/schemas', verifyToken, (req, res) => {
  const schemas = {
    transaction: {
      required: ['description', 'amount', 'type', 'date'],
      optional: ['category', 'paymentMethod', 'payee', 'notes', 'tags', 'location'],
      types: {
        type: ['income', 'expense', 'transfer'],
        paymentMethod: ['cash', 'card', 'bank_transfer', 'check', 'digital_wallet', 'other']
      },
      example: {
        description: "Grocery shopping",
        amount: 125.50,
        type: "expense",
        date: "2025-01-15",
        category: "groceries",
        paymentMethod: "card",
        payee: "SuperMarket",
        notes: "Weekly grocery shopping",
        tags: ["food", "weekly"]
      }
    },
    
    budget: {
      required: ['name', 'amount', 'period'],
      optional: ['categories', 'description', 'alertThreshold', 'startDate', 'endDate'],
      types: {
        period: ['monthly', 'weekly', 'yearly', 'custom'],
        alertThreshold: 'number (0-1, e.g., 0.8 for 80%)'
      },
      example: {
        name: "Monthly Groceries",
        amount: 600,
        period: "monthly",
        categories: ["groceries", "household"],
        description: "Monthly budget for food and household items",
        alertThreshold: 0.8
      }
    },
    
    goal: {
      required: ['name', 'targetAmount', 'targetDate'],
      optional: ['description', 'category', 'priority', 'currentAmount'],
      types: {
        priority: ['low', 'medium', 'high'],
        targetDate: 'ISO date string (YYYY-MM-DD)'
      },
      example: {
        name: "Emergency Fund",
        targetAmount: 10000,
        targetDate: "2025-12-31",
        description: "Build emergency fund for 6 months expenses",
        category: "savings",
        priority: "high",
        currentAmount: 2500
      }
    },
    
    category: {
      required: ['name', 'type'],
      optional: ['description', 'icon', 'color', 'parent', 'sortOrder'],
      types: {
        type: ['income', 'expense'],
        icon: 'string (icon name)',
        color: 'hex color code (#RRGGBB)'
      },
      example: {
        name: "Dining Out",
        type: "expense",
        description: "Restaurants and takeout",
        icon: "restaurant",
        color: "#FF5722",
        parent: null
      }
    }
  };

  res.json({
    success: true,
    message: 'Creation schemas retrieved successfully',
    data: schemas,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
