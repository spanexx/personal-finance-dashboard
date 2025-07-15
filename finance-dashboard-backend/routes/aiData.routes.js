const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const aiDataAccessService = require('../services/aiDataAccess.service');
const TransactionService = require('../services/transaction.service');
const BudgetService = require('../services/budget.service');
const GoalService = require('../services/goal.service');
const CategoryService = require('../services/category.service');
const { DatabaseError, ValidationError } = require('../utils/errorHandler');

const router = express.Router();

// Enhanced logging middleware for AI endpoints
const aiLogger = (endpoint) => (req, res, next) => {
  const timestamp = new Date().toISOString();
  const userId = req.user?.userId || 'unknown';
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

// Middleware to ensure only AI service can access these endpoints
const aiServiceOnly = (req, res, next) => {
  // Check if request is from AI service
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

/**
 * @route GET /api/ai-data/transactions/comprehensive
 * @desc Get comprehensive transaction data for AI analysis
 * @access Private (AI Service Only)
 */
router.get('/transactions/comprehensive', verifyToken, aiServiceOnly, aiLogger('transactions/comprehensive'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      limit = 100,
      startDate,
      endDate,
      category,
      type,
      includeRecent = 'true'
    } = req.query;

    const options = {
      limit: parseInt(limit),
      startDate,
      endDate,
      category,
      type,
      includeRecent: includeRecent === 'true'
    };

    const data = await aiDataAccessService.getComprehensiveTransactions(userId, options);

    console.log(`✅ [AI-ENDPOINT] transactions/comprehensive - Success: ${data.recentTransactions?.length || 0} transactions returned`);

    res.json({
      success: true,
      message: 'Comprehensive transaction data retrieved successfully',
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AI-ENDPOINT] transactions/comprehensive - Error:', error.message);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    if (error instanceof DatabaseError) {
      return res.status(500).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve comprehensive transaction data',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @route GET /api/ai-data/budgets/comprehensive
 * @desc Get comprehensive budget data for AI analysis
 * @access Private (AI Service Only)
 */
router.get('/budgets/comprehensive', verifyToken, aiServiceOnly, async (req, res) => {
  try {
    const userId = req.user.userId;
    const data = await aiDataAccessService.getComprehensiveBudgets(userId);

    res.json({
      success: true,
      message: 'Comprehensive budget data retrieved successfully',
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in comprehensive budgets endpoint:', error);
    
    if (error instanceof DatabaseError) {
      return res.status(500).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve comprehensive budget data',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @route GET /api/ai-data/goals/comprehensive
 * @desc Get comprehensive goals data for AI analysis
 * @access Private (AI Service Only)
 */
router.get('/goals/comprehensive', verifyToken, aiServiceOnly, async (req, res) => {
  try {
    const userId = req.user.userId;
    const data = await aiDataAccessService.getComprehensiveGoals(userId);

    res.json({
      success: true,
      message: 'Comprehensive goals data retrieved successfully',
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in comprehensive goals endpoint:', error);
    
    if (error instanceof DatabaseError) {
      return res.status(500).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve comprehensive goals data',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @route GET /api/ai-data/context/financial
 * @desc Get complete financial context for AI analysis
 * @access Private (AI Service Only)
 */
router.get('/context/financial', verifyToken, aiServiceOnly, async (req, res) => {
  try {
    const userId = req.user.userId;
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

    const context = await aiDataAccessService.getFinancialContext(userId, options);

    res.json({
      success: true,
      message: 'Financial context retrieved successfully',
      data: context,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in financial context endpoint:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    if (error instanceof DatabaseError) {
      return res.status(500).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve financial context',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @route GET /api/ai-data/transactions/recent/:count
 * @desc Get recent transactions for AI (bypasses normal pagination)
 * @access Private (AI Service Only)
 */
router.get('/transactions/recent/:count', verifyToken, aiServiceOnly, async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = Math.min(parseInt(req.params.count) || 20, 200); // Max 200 transactions

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

    res.json({
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
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recent transactions',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @route GET /api/ai-data/spending/analysis
 * @desc Get detailed spending analysis for AI
 * @access Private (AI Service Only)
 */
router.get('/spending/analysis', verifyToken, aiServiceOnly, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { timeframe = 'last-month', groupBy = 'category' } = req.query;

    // Get comprehensive transaction data for analysis
    const data = await aiDataAccessService.getComprehensiveTransactions(userId, {
      limit: 500, // Higher limit for thorough analysis
      includeRecent: false
    });

    // Enhanced analysis
    const analysis = {
      summary: data.summary,
      categoryBreakdown: data.categoryBreakdown,
      spendingTrends: [],
      insights: []
    };

    // Add spending pattern insights
    if (data.transactions.length > 0) {
      // Weekly spending pattern
      const weeklySpending = {};
      data.transactions.forEach(transaction => {
        if (transaction.type === 'expense') {
          const week = new Date(transaction.date).toISOString().split('T')[0];
          weeklySpending[week] = (weeklySpending[week] || 0) + transaction.amount;
        }
      });

      analysis.spendingTrends = Object.entries(weeklySpending)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      // Generate insights
      const avgWeeklySpending = Object.values(weeklySpending).reduce((sum, amount) => sum + amount, 0) / Object.keys(weeklySpending).length;
      const recentWeekSpending = Object.values(weeklySpending).slice(-1)[0] || 0;

      if (recentWeekSpending > avgWeeklySpending * 1.2) {
        analysis.insights.push({
          type: 'spending-increase',
          message: 'Recent spending is 20% higher than average',
          severity: 'medium'
        });
      }

      // Top spending day insights
      const dailySpending = {};
      data.transactions.forEach(transaction => {
        if (transaction.type === 'expense') {
          const day = new Date(transaction.date).getDay();
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const dayName = dayNames[day];
          dailySpending[dayName] = (dailySpending[dayName] || 0) + transaction.amount;
        }
      });

      const topSpendingDay = Object.entries(dailySpending)
        .sort(([,a], [,b]) => b - a)[0];

      if (topSpendingDay) {
        analysis.insights.push({
          type: 'spending-pattern',
          message: `Highest spending occurs on ${topSpendingDay[0]} ($${topSpendingDay[1].toFixed(2)})`,
          severity: 'info'
        });
      }
    }

    res.json({
      success: true,
      message: 'Spending analysis completed',
      data: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in spending analysis endpoint:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to perform spending analysis',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @route POST /api/ai-data/transactions/create
 * @desc Create a new transaction via AI
 * @access Private (AI Service Only)
 */
router.post('/transactions/create', verifyToken, aiServiceOnly, aiLogger('transactions/create'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const transactionData = req.body;

    console.log(`🚀 [AI-CREATE] Creating transaction for user ${userId}:`, transactionData);

    // Validate required fields
    const requiredFields = ['description', 'amount', 'type', 'date'];
    for (const field of requiredFields) {
      if (!transactionData[field]) {
        console.log(`❌ [AI-CREATE] Missing required field: ${field}`);
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`,
          code: 'MISSING_FIELD'
        });
      }
    }

    // Create transaction
    const transaction = await TransactionService.createTransaction(userId, transactionData);

    console.log(`✅ [AI-CREATE] Transaction created successfully:`, transaction._id);

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AI-CREATE] Error creating transaction:', error.message);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      code: 'CREATION_ERROR'
    });
  }
});

/**
 * @route POST /api/ai-data/budgets/create
 * @desc Create a new budget via AI
 * @access Private (AI Service Only)
 */
router.post('/budgets/create', verifyToken, aiServiceOnly, async (req, res) => {
  try {
    const userId = req.user.userId;
    const budgetData = req.body;

    // Validate required fields
    const requiredFields = ['name', 'amount', 'period'];
    for (const field of requiredFields) {
      if (!budgetData[field]) {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`,
          code: 'MISSING_FIELD'
        });
      }
    }

    // Create budget
    const budget = await BudgetService.createBudget(budgetData, userId);

    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data: budget,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating budget via AI:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create budget',
      code: 'CREATION_ERROR'
    });
  }
});

/**
 * @route POST /api/ai-data/goals/create
 * @desc Create a new goal via AI
 * @access Private (AI Service Only)
 */
router.post('/goals/create', verifyToken, aiServiceOnly, async (req, res) => {
  try {
    const userId = req.user.userId;
    const goalData = req.body;

    // Validate required fields
    const requiredFields = ['name', 'targetAmount', 'targetDate'];
    for (const field of requiredFields) {
      if (!goalData[field]) {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`,
          code: 'MISSING_FIELD'
        });
      }
    }

    // Create goal
    const goal = await GoalService.createGoal(goalData, userId);

    res.status(201).json({
      success: true,
      message: 'Goal created successfully',
      data: goal,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating goal via AI:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create goal',
      code: 'CREATION_ERROR'
    });
  }
});

/**
 * @route POST /api/ai-data/categories/create
 * @desc Create a new category via AI
 * @access Private (AI Service Only)
 */
router.post('/categories/create', verifyToken, aiServiceOnly, aiLogger('categories/create'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const categoryData = req.body;

    console.log(`🚀 [AI-CREATE] Creating category for user ${userId}:`, categoryData);

    // Validate required fields
    const requiredFields = ['name', 'type'];
    for (const field of requiredFields) {
      if (!categoryData[field]) {
        console.log(`❌ [AI-CREATE] Missing required field: ${field}`);
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`,
          code: 'MISSING_FIELD'
        });
      }
    }

    // Validate type
    if (!['income', 'expense'].includes(categoryData.type)) {
      console.log(`❌ [AI-CREATE] Invalid category type: ${categoryData.type}`);
      return res.status(400).json({
        success: false,
        message: 'Category type must be either "income" or "expense"',
        code: 'INVALID_TYPE'
      });
    }

    // Create category
    const category = await CategoryService.createCategory(userId, categoryData);

    console.log(`✅ [AI-CREATE] Category created successfully:`, category._id, category.name);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AI-CREATE] Error creating category:', error.message);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      code: 'CREATION_ERROR'
    });
  }
});

/**
 * @route POST /api/ai-data/bulk/create
 * @desc Create multiple items in bulk via AI (transactions, budgets, goals, categories)
 * @access Private (AI Service Only)
 */
router.post('/bulk/create', verifyToken, aiServiceOnly, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required and must not be empty',
        code: 'INVALID_BULK_DATA'
      });
    }

    const results = {
      transactions: [],
      budgets: [],
      goals: [],
      categories: [],
      errors: []
    };

    // Process each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      try {
        let result;
        
        switch (item.type) {
          case 'transaction':
            result = await TransactionService.createTransaction(userId, item.data);
            results.transactions.push(result);
            break;
            
          case 'budget':
            result = await BudgetService.createBudget(item.data, userId);
            results.budgets.push(result);
            break;
            
          case 'goal':
            result = await GoalService.createGoal(item.data, userId);
            results.goals.push(result);
            break;
            
          case 'category':
            result = await CategoryService.createCategory(userId, item.data);
            results.categories.push(result);
            break;
            
          default:
            results.errors.push({
              index: i,
              type: item.type,
              error: `Unsupported item type: ${item.type}`
            });
        }
      } catch (error) {
        results.errors.push({
          index: i,
          type: item.type,
          error: error.message
        });
      }
    }

    const totalCreated = results.transactions.length + results.budgets.length + 
                        results.goals.length + results.categories.length;

    res.status(201).json({
      success: true,
      message: `Bulk creation completed: ${totalCreated} items created, ${results.errors.length} errors`,
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in bulk creation via AI:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process bulk creation',
      code: 'BULK_CREATION_ERROR'
    });
  }
});

/**
 * @route GET /api/ai-data/schemas
 * @desc Get creation schemas for AI to understand required fields
 * @access Private (AI Service Only)
 */
router.get('/schemas', verifyToken, aiServiceOnly, async (req, res) => {
  try {
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

  } catch (error) {
    console.error('Error getting schemas:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve schemas',
      code: 'SCHEMA_ERROR'
    });
  }
});

module.exports = router;
