/**
 * Consolidated AI Service
 * Provides all AI-related functionality including chat, data access, websocket operations, and financial analysis
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Models
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');
const Category = require('../models/Category');
const User = require('../models/User');
const ChatHistory = require('../models/ChatHistory');
const AIPreferences = require('../models/AIPreferences');

// Services
const TransactionService = require('./transaction.service');
const CategoryService = require('./category.service');
const BudgetService = require('./budget.service');
const GoalService = require('./goal.service');

// Utils
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  DatabaseError 
} = require('../utils/errorHandler');

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

class AIService {
  constructor(io = null) {
    // WebSocket setup if io is provided
    if (io) {
      this.io = io.of('/ai');
      this.executedActions = new Map();
      this.setupWebSocketHandlers();
    }
  }

  // ==========================================
  // DATA ENHANCEMENT UTILITIES
  // ==========================================

  /**
   * Add default color and icon to category data if not provided
   * @param {Object} categoryData - Category data
   * @returns {Object} Enhanced category data with defaults
   */
  static enhanceCategoryData(categoryData) {
    const defaultExpenseCategories = {
      'groceries': { color: '#4CAF50', icon: 'shopping_cart' },
      'dining out': { color: '#FF9800', icon: 'restaurant' },
      'transportation': { color: '#2196F3', icon: 'directions_car' },
      'housing': { color: '#9C27B0', icon: 'home' },
      'utilities': { color: '#FF5722', icon: 'bolt' },
      'entertainment': { color: '#E91E63', icon: 'movie' },
      'shopping': { color: '#673AB7', icon: 'shopping_bag' },
      'healthcare': { color: '#009688', icon: 'local_hospital' },
      'education': { color: '#3F51B5', icon: 'school' },
      'personal care': { color: '#795548', icon: 'face' },
      'gifts': { color: '#FFC107', icon: 'card_giftcard' },
      'travel': { color: '#00BCD4', icon: 'flight' },
      'insurance': { color: '#607D8B', icon: 'security' },
      'taxes': { color: '#F44336', icon: 'account_balance' },
      'debt': { color: '#9E9E9E', icon: 'credit_card' }
    };

    const defaultIncomeCategories = {
      'salary': { color: '#8BC34A', icon: 'work' },
      'freelance': { color: '#CDDC39', icon: 'laptop' },
      'investment': { color: '#4CAF50', icon: 'trending_up' },
      'rental': { color: '#2196F3', icon: 'home' },
      'business': { color: '#FF9800', icon: 'business' },
      'gift': { color: '#E91E63', icon: 'card_giftcard' },
      'bonus': { color: '#9C27B0', icon: 'star' },
      'refund': { color: '#00BCD4', icon: 'replay' }
    };

    const categoryName = (categoryData.name || '').toLowerCase();
    const categoryType = categoryData.type || 'expense';
    
    let defaults = {};
    if (categoryType === 'expense') {
      defaults = defaultExpenseCategories[categoryName] || { color: '#607D8B', icon: 'category' };
    } else {
      defaults = defaultIncomeCategories[categoryName] || { color: '#4CAF50', icon: 'attach_money' };
    }

    return {
      ...categoryData,
      color: categoryData.color || defaults.color,
      icon: categoryData.icon || defaults.icon
    };
  }

  /**
   * Enhance budget data with intelligent defaults
   * @param {Object} budgetData - Budget data
   * @param {string} userId - User ID
   * @returns {Object} Enhanced budget data
   */
  static async enhanceBudgetData(budgetData, userId) {
    try {
      // If no category allocations provided, create intelligent defaults
      if (!budgetData.categoryAllocations || budgetData.categoryAllocations.length === 0) {
        const categories = await CategoryService.getCategories(userId, { type: 'expense' });
        
        if (categories && categories.length > 0) {
          const totalAmount = budgetData.totalAmount || 1000;
          const allocationPerCategory = Math.floor(totalAmount / categories.length);
          
          budgetData.categoryAllocations = categories.map(category => ({
            category: category._id,
            allocatedAmount: allocationPerCategory,
            spentAmount: 0
          }));
        }
      }

      // Add default budget name if not provided
      if (!budgetData.name) {
        const now = new Date();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        budgetData.name = `${monthNames[now.getMonth()]} ${now.getFullYear()} Budget`;
      }

      // Set default period if not provided
      if (!budgetData.period) {
        budgetData.period = 'monthly';
      }

      // Set default start date if not provided
      if (!budgetData.startDate) {
        const now = new Date();
        budgetData.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Set default end date if not provided
      if (!budgetData.endDate) {
        const startDate = new Date(budgetData.startDate);
        budgetData.endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      }

      return budgetData;
    } catch (error) {
      console.error('Error enhancing budget data:', error);
      return budgetData;
    }
  }

  // ==========================================
  // COMPREHENSIVE DATA ACCESS
  // ==========================================

  /**
   * Get comprehensive transaction data for AI analysis
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Complete transaction data
   */
  async getComprehensiveTransactions(userId, options = {}) {
    try {
      const {
        limit = 100,
        startDate,
        endDate,
        category,
        type,
        includeRecent = true,
        timeframe = 'last-3-months'
      } = options;

      // Build query
      const query = { userId };
      
      // Handle timeframe if no specific dates provided
      if (!startDate && !endDate && timeframe) {
        const now = new Date();
        let calculatedStartDate;
        
        switch (timeframe) {
          case 'last-week':
            calculatedStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'last-month':
            calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            break;
          case 'last-3-months':
            calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
            break;
          case 'last-6-months':
            calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
            break;
          case 'this-year':
            calculatedStartDate = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        }
        
        query.date = { $gte: calculatedStartDate, $lte: now };
      } else if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }
      
      if (category) query.category = category;
      if (type) query.type = type;

      // Get comprehensive transaction data
      const transactions = await Transaction.find(query)
        .populate('category', 'name color type')
        .sort({ date: -1 })
        .limit(limit)
        .lean();

      // Get summary statistics
      const totalTransactions = await Transaction.countDocuments(query);
      
      // Calculate aggregations
      const aggregation = await Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalIncome: {
              $sum: {
                $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0]
              }
            },
            totalExpenses: {
              $sum: {
                $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0]
              }
            },
            avgTransaction: { $avg: '$amount' },
            transactionCount: { $sum: 1 }
          }
        }
      ]);

      const summary = aggregation[0] || {
        totalIncome: 0,
        totalExpenses: 0,
        avgTransaction: 0,
        transactionCount: 0
      };

      // Get category breakdown
      const categoryBreakdown = await Transaction.aggregate([
        { $match: { ...query, type: 'expense' } },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $group: {
            _id: '$category',
            categoryName: { $first: { $arrayElemAt: ['$categoryInfo.name', 0] } },
            totalAmount: { $sum: '$amount' },
            transactionCount: { $sum: 1 }
          }
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 10 }
      ]);

      // Get recent transactions if requested
      let recentTransactions = [];
      if (includeRecent) {
        recentTransactions = await Transaction.find({ userId })
          .populate('category', 'name color type')
          .sort({ date: -1 })
          .limit(20)
          .lean();
      }

      return {
        transactions,
        recentTransactions,
        summary: {
          ...summary,
          netBalance: summary.totalIncome - summary.totalExpenses,
          totalTransactions
        },
        categoryBreakdown,
        metadata: {
          queryLimit: limit,
          actualCount: transactions.length,
          hasMore: totalTransactions > limit,
          query: options
        }
      };

    } catch (error) {
      console.error('Error in getComprehensiveTransactions:', error);
      throw new DatabaseError('Failed to fetch comprehensive transaction data');
    }
  }

  /**
   * Get comprehensive budget data for AI analysis
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Complete budget data
   */
  async getComprehensiveBudgets(userId) {
    try {
      const budgets = await Budget.find({ userId })
        .populate('categoryAllocations.category', 'name color type')
        .sort({ createdAt: -1 })
        .lean();

      // Calculate budget performance
      const budgetPerformance = budgets.map(budget => {
        const totalAllocated = budget.categoryAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
        const totalSpent = budget.categoryAllocations.reduce((sum, alloc) => sum + (alloc.spentAmount || 0), 0);
        const utilizationRate = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

        return {
          ...budget,
          totalAllocated,
          totalSpent,
          utilizationRate,
          status: utilizationRate > 100 ? 'over' : utilizationRate > 80 ? 'warning' : 'good'
        };
      });

      // Get overall budget statistics
      const overallStats = {
        totalBudgets: budgets.length,
        activeBudgets: budgets.filter(b => b.isActive).length,
        totalAllocated: budgetPerformance.reduce((sum, b) => sum + b.totalAllocated, 0),
        totalSpent: budgetPerformance.reduce((sum, b) => sum + b.totalSpent, 0)
      };

      return {
        budgets: budgetPerformance,
        overallStats,
        metadata: {
          fetchedAt: new Date(),
          userId
        }
      };

    } catch (error) {
      console.error('Error in getComprehensiveBudgets:', error);
      throw new DatabaseError('Failed to fetch comprehensive budget data');
    }
  }

  /**
   * Get comprehensive goals data for AI analysis
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Complete goals data
   */
  async getComprehensiveGoals(userId) {
    try {
      const goals = await Goal.find({ userId })
        .sort({ createdAt: -1 })
        .lean();

      // Calculate goal progress and insights
      const goalsWithProgress = goals.map(goal => {
        const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
        const remaining = goal.targetAmount - goal.currentAmount;
        const daysToTarget = goal.targetDate ? Math.ceil((new Date(goal.targetDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
        
        let monthlyRequired = 0;
        if (daysToTarget && daysToTarget > 0 && remaining > 0) {
          monthlyRequired = (remaining / daysToTarget) * 30;
        }

        return {
          ...goal,
          progress,
          remaining,
          daysToTarget,
          monthlyRequired,
          status: progress >= 100 ? 'completed' : daysToTarget < 0 ? 'overdue' : progress > 75 ? 'on-track' : 'needs-attention'
        };
      });

      // Get overall goals statistics
      const overallStats = {
        totalGoals: goals.length,
        completedGoals: goalsWithProgress.filter(g => g.status === 'completed').length,
        activeGoals: goalsWithProgress.filter(g => g.status !== 'completed').length,
        totalTargetAmount: goals.reduce((sum, g) => sum + g.targetAmount, 0),
        totalCurrentAmount: goals.reduce((sum, g) => sum + g.currentAmount, 0)
      };

      return {
        goals: goalsWithProgress,
        overallStats,
        metadata: {
          fetchedAt: new Date(),
          userId
        }
      };

    } catch (error) {
      console.error('Error in getComprehensiveGoals:', error);
      throw new DatabaseError('Failed to fetch comprehensive goals data');
    }
  }

  /**
   * Get user's complete financial context for AI
   * @param {string} userId - User ID
   * @param {Object} options - Context options
   * @returns {Promise<Object>} Complete financial context
   */
  async getFinancialContext(userId, options = {}) {
    try {
      const {
        includeTransactions = true,
        includeBudgets = true,
        includeGoals = true,
        transactionLimit = 50,
        timeframe = 'last-3-months'
      } = options;

      const context = {
        userId,
        timeframe,
        timestamp: new Date()
      };

      // Fetch all requested data in parallel
      const promises = [];

      if (includeTransactions) {
        promises.push(
          this.getComprehensiveTransactions(userId, {
            limit: transactionLimit,
            timeframe,
            includeRecent: true
          }).then(data => ({ transactions: data }))
        );
      }

      if (includeBudgets) {
        promises.push(
          this.getComprehensiveBudgets(userId).then(data => ({ budgets: data }))
        );
      }

      if (includeGoals) {
        promises.push(
          this.getComprehensiveGoals(userId).then(data => ({ goals: data }))
        );
      }

      // Get user profile
      promises.push(
        User.findById(userId).select('firstName lastName email preferences').lean().then(user => ({ user }))
      );

      // Execute all promises
      const results = await Promise.all(promises);
      
      // Merge results
      results.forEach(result => {
        Object.assign(context, result);
      });

      // Generate summary insights
      context.insights = this.generateContextInsights(context);

      return context;

    } catch (error) {
      console.error('Error in getFinancialContext:', error);
      throw new DatabaseError('Failed to fetch financial context');
    }
  }

  /**
   * Generate insights from financial context
   * @param {Object} context - Financial context data
   * @returns {Object} Generated insights
   */
  generateContextInsights(context) {
    const insights = {
      summary: {},
      alerts: [],
      opportunities: []
    };

    // Transaction insights
    if (context.transactions) {
      const { summary, categoryBreakdown } = context.transactions;
      insights.summary.spending = {
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        netBalance: summary.netBalance,
        savingsRate: summary.totalIncome > 0 ? ((summary.netBalance / summary.totalIncome) * 100) : 0
      };

      // Top spending categories
      insights.summary.topCategories = categoryBreakdown.slice(0, 5);
    }

    // Budget insights
    if (context.budgets) {
      const { overallStats, budgets } = context.budgets;
      insights.summary.budgets = overallStats;

      // Budget alerts
      budgets.forEach(budget => {
        if (budget.utilizationRate > 100) {
          insights.alerts.push({
            type: 'budget-exceeded',
            message: `Budget "${budget.name}" is ${(budget.utilizationRate - 100).toFixed(1)}% over limit`,
            severity: 'high'
          });
        } else if (budget.utilizationRate > 80) {
          insights.alerts.push({
            type: 'budget-warning',
            message: `Budget "${budget.name}" is ${budget.utilizationRate.toFixed(1)}% utilized`,
            severity: 'medium'
          });
        }
      });
    }

    // Goal insights
    if (context.goals) {
      const { overallStats, goals } = context.goals;
      insights.summary.goals = overallStats;

      // Goal alerts and opportunities
      goals.forEach(goal => {
        if (goal.status === 'overdue') {
          insights.alerts.push({
            type: 'goal-overdue',
            message: `Goal "${goal.name}" target date has passed`,
            severity: 'high'
          });
        } else if (goal.status === 'needs-attention') {
          insights.opportunities.push({
            type: 'goal-acceleration',
            message: `Consider increasing contributions to "${goal.name}" - needs $${goal.monthlyRequired.toFixed(2)}/month`,
            priority: 'medium'
          });
        }
      });
    }

    return insights;
  }

  // ==========================================
  // AI CHAT AND RESPONSE SYSTEM
  // ==========================================

  /**
   * Get AI response for user input
   * @param {string} userId - User ID
   * @param {string} userInput - User's message
   * @param {string} sessionId - Chat session ID
   * @returns {Promise<Object>} AI response with actions
   */
  static async getAIResponse(userId, userInput, sessionId = null) {
    try {
      console.log(`🤖 [AI-SERVICE] Processing request for user ${userId}`);

      // Check if Gemini API is available
      if (!genAI || !process.env.GEMINI_API_KEY) {
        console.warn('⚠️ [AI-SERVICE] Gemini API key not configured, returning fallback response');
        
        // Return a fallback response when AI service is not available
        const fallbackResponse = `Hello! I'm your AI financial assistant. However, the AI service is currently not configured. 

I can still help you with your personal finance management through the dashboard features:
- Track your transactions and spending
- Create and manage budgets
- Set and monitor financial goals
- View detailed reports and analytics

Please contact your administrator to configure the AI service for enhanced features like personalized insights and smart recommendations.`;

        return {
          response: fallbackResponse,
          actions: [],
          sessionId: sessionId || uuidv4(),
          timestamp: new Date()
        };
      }

      // Get user preferences for personalization
      const preferences = await AIService.getUserPreferences(userId);
      
      // Get financial context
      const context = await new AIService().getFinancialContext(userId, preferences);
      
      // Generate session ID if not provided
      if (!sessionId) {
        sessionId = uuidv4();
      }

      // Get recent chat history for context
      const recentHistory = await ChatHistory.find({ userId, sessionId })
        .sort({ timestamp: -1 })
        .limit(5)
        .lean();

      // Prepare context for AI
      const systemPrompt = AIService.buildSystemPrompt(context, preferences);
      const conversationHistory = recentHistory.reverse().map(chat => ({
        user: chat.userMessage,
        ai: chat.aiResponse
      }));

      // Get AI response
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const fullPrompt = `${systemPrompt}\n\nConversation History:\n${conversationHistory.map(h => `User: ${h.user}\nAI: ${h.ai}`).join('\n')}\n\nUser: ${userInput}\n\nAI:`;
      
      const result = await model.generateContent(fullPrompt);
      const aiResponse = result.response.text();

      // Parse potential actions from AI response
      const actions = AIService.parseActionsFromResponse(aiResponse);

      // Save to chat history
      await new ChatHistory({
        userId,
        sessionId,
        userMessage: userInput,
        aiResponse,
        actions,
        timestamp: new Date()
      }).save();

      return {
        response: aiResponse,
        actions,
        sessionId,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ [AI-SERVICE] Error getting AI response:', error);
      throw new DatabaseError('Failed to generate AI response');
    }
  }

  /**
   * Build system prompt for AI
   * @param {Object} context - Financial context
   * @param {Object} preferences - User preferences
   * @returns {string} System prompt
   */
  static buildSystemPrompt(context, preferences) {
    const prompt = `You are an AI financial assistant helping users manage their personal finances. 

FINANCIAL CONTEXT:
- User: ${context.user?.firstName || 'User'}
- Current Balance: $${context.transactions?.summary?.netBalance || 0}
- Monthly Income: $${context.transactions?.summary?.totalIncome || 0}
- Monthly Expenses: $${context.transactions?.summary?.totalExpenses || 0}
- Savings Rate: ${context.insights?.summary?.spending?.savingsRate || 0}%

BUDGETS: ${context.budgets?.overallStats?.totalBudgets || 0} active budgets
GOALS: ${context.goals?.overallStats?.activeGoals || 0} active goals

CAPABILITIES:
You can help users:
1. Create, update, and delete transactions
2. Manage budgets and track spending
3. Set and monitor financial goals
4. Analyze spending patterns
5. Provide financial advice and insights

When suggesting actions, format them as JSON in your response like:
[ACTION:CREATE_TRANSACTION:{"amount": 50, "description": "Groceries", "category": "groceries", "type": "expense"}]

Available actions: CREATE_TRANSACTION, UPDATE_TRANSACTION, DELETE_TRANSACTION, CREATE_BUDGET, CREATE_GOAL, CREATE_CATEGORY

Be helpful, concise, and provide actionable financial advice.`;

    return prompt;
  }

  /**
   * Parse actions from AI response
   * @param {string} response - AI response text
   * @returns {Array} Parsed actions
   */
  static parseActionsFromResponse(response) {
    const actions = [];
    const actionRegex = /\[ACTION:(\w+):(.*?)\]/g;
    let match;

    while ((match = actionRegex.exec(response)) !== null) {
      try {
        const actionType = match[1];
        const actionData = JSON.parse(match[2]);
        actions.push({
          action: actionType,
          data: actionData
        });
      } catch (error) {
        console.warn('Failed to parse action:', match[0]);
      }
    }

    return actions;
  }

  /**
   * Execute AI-suggested action
   * @param {string} userId - User ID
   * @param {Object} action - Action to execute
   * @returns {Promise<Object>} Execution result
   */
  static async executeAction(userId, action) {
    try {
      console.log(`🤖 [AI-SERVICE] Executing action for user ${userId}:`, action);

      const { action: actionType, data } = action;

      switch (actionType) {
        case 'CREATE_TRANSACTION':
          const transaction = await TransactionService.createTransaction({
            ...data,
            userId
          });
          return { success: true, type: 'transaction', data: transaction };

        case 'UPDATE_TRANSACTION':
          if (!data.id) throw new ValidationError('Transaction ID required for update');
          const updatedTransaction = await TransactionService.updateTransaction(
            data.id,
            { ...data, userId }
          );
          return { success: true, type: 'transaction', data: updatedTransaction };

        case 'DELETE_TRANSACTION':
          if (!data.id) throw new ValidationError('Transaction ID required for deletion');
          await TransactionService.deleteTransaction(data.id, userId);
          return { success: true, type: 'transaction', message: 'Transaction deleted' };

        case 'CREATE_CATEGORY':
          const categoryData = AIService.enhanceCategoryData(data);
          const category = await CategoryService.createCategory({
            ...categoryData,
            userId
          });
          return { success: true, type: 'category', data: category };

        case 'CREATE_BUDGET':
          const budgetData = await AIService.enhanceBudgetData(data, userId);
          const budget = await BudgetService.createBudget({
            ...budgetData,
            userId
          });
          return { success: true, type: 'budget', data: budget };

        case 'CREATE_GOAL':
          const goal = await GoalService.createGoal({
            ...data,
            userId
          });
          return { success: true, type: 'goal', data: goal };

        default:
          throw new ValidationError(`Unknown action type: ${actionType}`);
      }

    } catch (error) {
      console.error('❌ [AI-SERVICE] Error executing action:', error);
      return { 
        success: false, 
        error: error.message,
        type: 'error'
      };
    }
  }

  // ==========================================
  // CRUD OPERATIONS VIA AI
  // ==========================================

  /**
   * Get transactions for AI
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Transactions data
   */
  static async getTransactions(userId, options = {}) {
    try {
      const result = await TransactionService.getTransactions(userId, options);
      return result;
    } catch (error) {
      console.error('❌ [AI-SERVICE] Error getting transactions:', error);
      throw error;
    }
  }

  /**
   * Create transaction via AI
   * @param {string} userId - User ID
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  static async createTransaction(userId, transactionData) {
    try {
      const transaction = await TransactionService.createTransaction({
        ...transactionData,
        userId
      });
      return transaction;
    } catch (error) {
      console.error('❌ [AI-SERVICE] Error creating transaction:', error);
      throw error;
    }
  }

  /**
   * Get categories for AI
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Categories
   */
  static async getCategories(userId, options = {}) {
    try {
      const categories = await CategoryService.getCategories(userId, options);
      return categories;
    } catch (error) {
      console.error('❌ [AI-SERVICE] Error getting categories:', error);
      throw error;
    }
  }

  /**
   * Get budgets for AI
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Budgets
   */
  static async getBudgets(userId, options = {}) {
    try {
      const budgets = await BudgetService.getBudgets(userId, options);
      return budgets;
    } catch (error) {
      console.error('❌ [AI-SERVICE] Error getting budgets:', error);
      throw error;
    }
  }

  /**
   * Get goals for AI
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Goals
   */
  static async getGoals(userId, options = {}) {
    try {
      const goals = await GoalService.getGoals(userId, options);
      return goals;
    } catch (error) {
      console.error('❌ [AI-SERVICE] Error getting goals:', error);
      throw error;
    }
  }

  // ==========================================
  // CHAT HISTORY AND PREFERENCES
  // ==========================================

  /**
   * Get chat history for user
   * @param {string} userId - User ID
   * @param {number} page - Page number
   * @param {number} limit - Results per page
   * @returns {Promise<Object>} Chat history
   */
  static async getChatHistory(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      const history = await ChatHistory.find({ userId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await ChatHistory.countDocuments({ userId });

      return {
        history,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('❌ [AI-SERVICE] Error getting chat history:', error);
      throw new DatabaseError('Failed to fetch chat history');
    }
  }

  /**
   * Get user AI preferences
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User preferences
   */
  static async getUserPreferences(userId) {
    try {
      let preferences = await AIPreferences.findOne({ userId }).lean();
      
      if (!preferences) {
        // Create default preferences
        preferences = await new AIPreferences({
          userId,
          responseStyle: 'balanced',
          includeInsights: true,
          autoExecuteActions: false,
          preferredCurrency: 'USD',
          timezone: 'UTC'
        }).save();
      }

      return preferences;
    } catch (error) {
      console.error('❌ [AI-SERVICE] Error getting user preferences:', error);
      throw new DatabaseError('Failed to fetch user preferences');
    }
  }

  /**
   * Update user AI preferences
   * @param {string} userId - User ID
   * @param {Object} updates - Preference updates
   * @returns {Promise<Object>} Updated preferences
   */
  static async updateUserPreferences(userId, updates) {
    try {
      const preferences = await AIPreferences.findOneAndUpdate(
        { userId },
        { $set: updates },
        { new: true, upsert: true }
      );

      return preferences;
    } catch (error) {
      console.error('❌ [AI-SERVICE] Error updating user preferences:', error);
      throw new DatabaseError('Failed to update user preferences');
    }
  }

  // ==========================================
  // WEBSOCKET FUNCTIONALITY
  // ==========================================

  /**
   * Setup WebSocket middleware and event handlers
   */
  setupWebSocketHandlers() {
    if (!this.io) return;

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('_id firstName lastName email');
        
        if (!user) {
          return next(new Error('Invalid token'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      console.log(`🔌 [AI-WEBSOCKET] User ${socket.userId} connected`);
      
      socket.join(`user:${socket.userId}`);

      // Chat handler
      socket.on('ai:chat', async (data) => {
        try {
          const { message, sessionId } = data;
          
          if (!message || typeof message !== 'string') {
            socket.emit('ai:error', { message: 'Valid message required' });
            return;
          }

          const response = await AIService.getAIResponse(socket.userId, message, sessionId);
          socket.emit('ai:response', response);

        } catch (error) {
          console.error('❌ [AI-WEBSOCKET] Chat error:', error);
          socket.emit('ai:error', { message: 'Failed to process message' });
        }
      });

      // Action execution handler
      socket.on('ai:execute_action', async (data) => {
        try {
          const { action } = data;
          
          if (!action) {
            socket.emit('ai:error', { message: 'Action required' });
            return;
          }

          // Check for duplicate actions
          if (this.isActionRecentlyExecuted(socket.userId, action)) {
            socket.emit('ai:error', { message: 'Action already executed recently' });
            return;
          }

          const result = await AIService.executeAction(socket.userId, action);
          
          if (result.success) {
            this.markActionExecuted(socket.userId, action);
            socket.emit('ai:action_result', result);
            this.emitFinancialUpdate(socket.userId);
          } else {
            socket.emit('ai:error', { message: result.error });
          }

        } catch (error) {
          console.error('❌ [AI-WEBSOCKET] Action execution error:', error);
          socket.emit('ai:error', { message: 'Failed to execute action' });
        }
      });

      // Insights handler
      socket.on('ai:get_insights', async () => {
        try {
          const context = await new AIService().getFinancialContext(socket.userId);
          socket.emit('ai:insights', context.insights);
        } catch (error) {
          console.error('❌ [AI-WEBSOCKET] Insights error:', error);
          socket.emit('ai:error', { message: 'Failed to get insights' });
        }
      });

      // Disconnect handler
      socket.on('disconnect', () => {
        console.log(`🔌 [AI-WEBSOCKET] User ${socket.userId} disconnected`);
      });
    });
  }

  /**
   * Check if action was recently executed (deduplication)
   */
  isActionRecentlyExecuted(userId, action) {
    const actionKey = `${userId}-${action.action}-${JSON.stringify(action.data).substring(0, 100)}`;
    const lastExecuted = this.executedActions.get(actionKey);
    
    if (lastExecuted) {
      const timeDiff = Date.now() - lastExecuted;
      return timeDiff < 5000; // 5 seconds
    }
    
    return false;
  }

  /**
   * Mark action as executed
   */
  markActionExecuted(userId, action) {
    const actionKey = `${userId}-${action.action}-${JSON.stringify(action.data).substring(0, 100)}`;
    this.executedActions.set(actionKey, Date.now());
    
    // Clean up old entries
    const cutoff = Date.now() - 60000; // 1 minute
    for (const [key, timestamp] of this.executedActions.entries()) {
      if (timestamp < cutoff) {
        this.executedActions.delete(key);
      }
    }
  }

  /**
   * Emit financial update to user
   */
  async emitFinancialUpdate(userId) {
    try {
      const context = await this.getFinancialContext(userId, {
        transactionLimit: 10,
        timeframe: 'last-month'
      });
      
      this.io.to(`user:${userId}`).emit('ai:financial_update', {
        summary: context.insights.summary,
        alerts: context.insights.alerts,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('❌ [AI-WEBSOCKET] Error emitting financial update:', error);
    }
  }

  /**
   * Generate AI-powered financial insights for a user
   * @param {string} userId - User ID
   * @returns {Object} Comprehensive financial insights
   */
  static async getInsights(userId) {
    try {
      // Get comprehensive financial context
      const aiService = new AIService();
      const context = await aiService.getFinancialContext(userId, {
        includeTransactions: true,
        includeBudgets: true,
        includeGoals: true,
        includeRecent: true
      });

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3); // Last 3 months for insights

      // Extract data arrays from context with fallbacks
      const transactions = context.transactions?.transactions || [];
      const budgets = context.budgets?.budgets || [];
      const goals = context.goals?.goals || [];

      // Check if we have any data to analyze
      if (transactions.length === 0 && budgets.length === 0 && goals.length === 0) {
        return {
          insights: {
            financial_health: [{
              type: 'info',
              priority: 'medium',
              title: 'Getting Started',
              message: 'Start adding transactions, budgets, and goals to get personalized financial insights.',
              actionable_advice: 'Begin by adding your recent transactions or setting up your first budget.',
              ai_confidence: 1.0
            }],
            spending_patterns: [],
            income_trends: [],
            budget_performance: [],
            goal_progress: [],
            recommendations: []
          },
          summary: {
            total_insights: 1,
            high_priority: 0,
            positive_insights: 0,
            warning_insights: 0,
            average_confidence: 1.0,
            generated_at: new Date().toISOString(),
            period_analyzed: {
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
              days_analyzed: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
            }
          },
          context: {
            total_transactions_analyzed: 0,
            total_spent: 0,
            total_income: 0,
            savings_rate: 0,
            top_spending_categories: [],
            data_sources: {
              transactions_available: 0,
              budgets_available: 0,
              goals_available: 0
            }
          }
        };
      }

      // Extract transactions array from context
      const transactionsData = transactions || [];
      
      // Calculate key metrics
      const recentTransactions = transactionsData.filter(t => 
        new Date(t.date) >= startDate && new Date(t.date) <= endDate
      );

      const totalSpent = recentTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalIncome = recentTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const savingsRate = totalIncome > 0 ? ((totalIncome - totalSpent) / totalIncome) * 100 : 0;

      // Categorize spending
      const spendingByCategory = recentTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          const category = t.category?.name || 'Uncategorized';
          acc[category] = (acc[category] || 0) + t.amount;
          return acc;
        }, {});

      const topSpendingCategories = Object.entries(spendingByCategory)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      // Generate insights
      const insights = {
        financial_health: [],
        spending_patterns: [],
        income_trends: [],
        budget_performance: [],
        goal_progress: [],
        recommendations: []
      };

      // Financial Health Insights
      if (savingsRate < 10) {
        insights.financial_health.push({
          type: 'warning',
          priority: 'high',
          title: 'Low Savings Rate',
          message: `Your savings rate is ${savingsRate.toFixed(1)}%. Financial experts recommend saving at least 20% of income.`,
          actionable_advice: 'Consider reducing discretionary spending or increasing income streams.',
          ai_confidence: 0.9
        });
      } else if (savingsRate >= 20) {
        insights.financial_health.push({
          type: 'positive',
          priority: 'medium',
          title: 'Excellent Savings Discipline',
          message: `Outstanding! You're saving ${savingsRate.toFixed(1)}% of your income.`,
          actionable_advice: 'Consider investing your savings for long-term wealth building.',
          ai_confidence: 0.95
        });
      }

      // Spending Pattern Insights
      if (topSpendingCategories.length > 0) {
        const [topCategory, topAmount] = topSpendingCategories[0];
        const categoryPercentage = (topAmount / totalSpent) * 100;

        if (categoryPercentage > 40) {
          insights.spending_patterns.push({
            type: 'warning',
            priority: 'medium',
            title: 'High Category Concentration',
            message: `${categoryPercentage.toFixed(1)}% of your spending is in ${topCategory}.`,
            actionable_advice: `Review your ${topCategory} expenses for potential optimization opportunities.`,
            ai_confidence: 0.85
          });
        }

        // Identify unusual spending patterns
        const avgMonthlySpending = totalSpent / 3;
        const currentMonthTransactions = recentTransactions.filter(t => {
          const transactionDate = new Date(t.date);
          const currentMonth = new Date();
          return transactionDate.getMonth() === currentMonth.getMonth() && 
                 transactionDate.getFullYear() === currentMonth.getFullYear() &&
                 t.type === 'expense';
        });
        
        const currentMonthSpending = currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
        
        if (currentMonthSpending > avgMonthlySpending * 1.3) {
          insights.spending_patterns.push({
            type: 'info',
            priority: 'medium',
            title: 'Increased Monthly Spending',
            message: `This month's spending is ${((currentMonthSpending / avgMonthlySpending - 1) * 100).toFixed(1)}% higher than your 3-month average.`,
            actionable_advice: 'Monitor upcoming expenses to stay within your typical spending range.',
            ai_confidence: 0.8
          });
        }
      }

      // Budget Performance Insights
      if (budgets.length > 0) {
        const activeBudgets = budgets.filter(b => b.isActive);
        let budgetsOverLimit = 0;
        let totalBudgetVariance = 0;

        activeBudgets.forEach(budget => {
          if (budget.spent > budget.amount) {
            budgetsOverLimit++;
          }
          totalBudgetVariance += budget.spent - budget.amount;
        });

        if (budgetsOverLimit > 0) {
          insights.budget_performance.push({
            type: 'warning',
            priority: 'high',
            title: 'Budget Overruns Detected',
            message: `${budgetsOverLimit} of your budgets are currently over limit.`,
            actionable_advice: 'Review and adjust spending in over-budget categories, or revise budget allocations.',
            ai_confidence: 0.9
          });
        } else if (activeBudgets.length > 0) {
          insights.budget_performance.push({
            type: 'positive',
            priority: 'low',
            title: 'Budget Adherence Success',
            message: 'All your budgets are currently within limits. Great financial discipline!',
            actionable_advice: 'Continue monitoring spending to maintain this excellent performance.',
            ai_confidence: 0.95
          });
        }
      }

      // Goal Progress Insights
      if (goals.length > 0) {
        const activeGoals = goals.filter(g => g.status === 'active');
        
        activeGoals.forEach(goal => {
          const progress = (goal.currentAmount / goal.targetAmount) * 100;
          const timeRemaining = goal.targetDate ? Math.ceil((new Date(goal.targetDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
          
          if (timeRemaining && timeRemaining < 90 && progress < 75) {
            insights.goal_progress.push({
              type: 'warning',
              priority: 'high',
              title: `Goal "${goal.name}" At Risk`,
              message: `Only ${progress.toFixed(1)}% complete with ${timeRemaining} days remaining.`,
              actionable_advice: `Consider increasing contributions or adjusting the target date for "${goal.name}".`,
              ai_confidence: 0.85
            });
          } else if (progress >= 90) {
            insights.goal_progress.push({
              type: 'positive',
              priority: 'medium',
              title: `Goal "${goal.name}" Almost Complete`,
              message: `Excellent progress! ${progress.toFixed(1)}% complete.`,
              actionable_advice: 'You\'re almost there! Maintain current contribution pace.',
              ai_confidence: 0.9
            });
          }
        });
      }

      // AI-Generated Recommendations
      insights.recommendations.push({
        type: 'info',
        priority: 'medium',
        title: 'Personalized Financial Tip',
        message: 'Based on your spending patterns, consider setting up automatic transfers to savings.',
        actionable_advice: 'Automate your savings to build wealth consistently without thinking about it.',
        ai_confidence: 0.8
      });

      // Calculate summary statistics
      const allInsights = Object.values(insights).flat();
      const summary = {
        total_insights: allInsights.length,
        high_priority: allInsights.filter(i => i.priority === 'high').length,
        positive_insights: allInsights.filter(i => i.type === 'positive').length,
        warning_insights: allInsights.filter(i => i.type === 'warning').length,
        average_confidence: allInsights.reduce((sum, i) => sum + i.ai_confidence, 0) / allInsights.length,
        generated_at: new Date().toISOString(),
        period_analyzed: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          days_analyzed: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
        }
      };

      return {
        insights,
        summary,
        context: {
          total_transactions_analyzed: recentTransactions.length,
          total_spent: totalSpent,
          total_income: totalIncome,
          savings_rate: savingsRate,
          top_spending_categories: topSpendingCategories,
          data_sources: {
            transactions_available: transactionsData.length,
            budgets_available: budgets.length,
            goals_available: goals.length
          }
        }
      };

    } catch (error) {
      console.error('Error generating AI insights:', error);
      throw new DatabaseError('Failed to generate AI insights', { originalError: error.message });
    }
  }
}

module.exports = AIService;
