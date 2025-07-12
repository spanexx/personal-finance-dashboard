/**
 * AI Service
 * Provides business logic and helper functions for AI operations
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const TransactionService = require('./transaction.service');
const BudgetService = require('./budget.service');
const GoalService = require('./goal.service');
const CategoryService = require('./category.service');
const ChatHistory = require('../models/ChatHistory');
const AIPreferences = require('../models/AIPreferences');
const { v4: uuidv4 } = require('uuid');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  DatabaseError 
} = require('../utils/errorHandler');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class AIService {
  /**
   * Get financial context for AI analysis
   * @param {string} userId - User ID
   * @param {Object} preferences - User preferences (optional)
   * @returns {Promise<Object>} Financial context data
   */
  static async getFinancialContext(userId, preferences = null) {
    try {
      // Get user preferences if not provided
      if (!preferences) {
        preferences = await AIPreferences.getOrCreateForUser(userId);
      }

      const dataRangeMonths = preferences.contextSettings?.dataRangeMonths || 6;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - dataRangeMonths);

      // Fetch data based on preferences
      const [transactionData, budgetData, goalData, categoriesData] = await Promise.all([
        TransactionService.getTransactions(userId, { startDate }),
        preferences.contextSettings?.includeBudgets ? BudgetService.getBudgets(userId, {}) : { budgets: [] },
        preferences.contextSettings?.includeGoals ? GoalService.getGoals(userId) : { goals: [] },
        CategoryService.getCategories(userId)
      ]);

      return {
        transactions: transactionData.transactions.map(t => ({
          date: t.date,
          description: t.description,
          amount: t.amount,
          type: t.type,
          category: t.category?.name || 'Uncategorized',
        })),
        budgets: budgetData.budgets.map(b => ({
          category: b.category?.name || 'Unknown',
          amount: b.amount,
          spent: b.spent || 0,
          remaining: b.remaining || b.amount,
        })),
        goals: goalData.goals.map(g => ({
          name: g.name,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount || 0,
          deadline: g.deadline,
          progress: ((g.currentAmount || 0) / g.targetAmount * 100).toFixed(1)
        })),
        categories: categoriesData.categories.map(c => c.name),
        preferences: {
          responseStyle: preferences.responseStyle,
          language: preferences.language
        }
      };
    } catch (error) {
      console.error('Error getting financial context:', error);
      throw new DatabaseError('Failed to fetch financial context');
    }
  }

  /**
   * Generate AI insights for user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of insights
   */
  static async getInsights(userId) {
    try {
      const preferences = await AIPreferences.getOrCreateForUser(userId);
      const financialContext = await this.getFinancialContext(userId, preferences);

      const stylePrompts = {
        concise: "Provide brief, bullet-point insights.",
        detailed: "Provide comprehensive analysis with detailed explanations.",
        conversational: "Use a friendly, conversational tone.",
        professional: "Use formal, professional language."
      };

      const prompt = `
        You are a sophisticated financial AI assistant. Analyze the user's financial data and provide personalized insights.
        
        Response Style: ${stylePrompts[preferences.responseStyle] || stylePrompts.conversational}
        
        User's financial data:
        - Transactions (last ${preferences.contextSettings?.dataRangeMonths || 6} months): ${JSON.stringify(financialContext.transactions)}
        - Budgets: ${JSON.stringify(financialContext.budgets)}
        - Goals: ${JSON.stringify(financialContext.goals)}

        Based on this data, provide:
        1. A summary of the user's financial health
        2. Personalized insights into their spending habits
        3. Actionable suggestions for improving their financial situation
        4. Progress updates on their goals and budgets
      `;

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const startTime = Date.now();
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const processingTime = Date.now() - startTime;

      return text.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
      console.error('Error generating insights:', error);
      throw new DatabaseError('Failed to generate insights');
    }
  }

  /**
   * Get AI response for user input
   * @param {string} userId - User ID
   * @param {string} userInput - User's question/request
   * @param {string} sessionId - Chat session ID (optional)
   * @returns {Promise<Object>} AI response
   */
  static async getAIResponse(userId, userInput, sessionId = null) {
    try {
      const preferences = await AIPreferences.getOrCreateForUser(userId);
      const financialContext = await this.getFinancialContext(userId, preferences);
      
      // Create session ID if not provided
      if (!sessionId) {
        sessionId = uuidv4();
      }

      // Get recent chat history for context
      const recentChats = await ChatHistory.getRecentChats(userId, 1, 5);
      const conversationContext = recentChats.map(chat => 
        `User: ${chat.userMessage}\nAI: ${typeof chat.aiResponse === 'string' ? chat.aiResponse : JSON.stringify(chat.aiResponse)}`
      ).join('\n\n');

      const stylePrompts = {
        concise: "Keep responses brief and to the point.",
        detailed: "Provide comprehensive explanations.",
        conversational: "Use a friendly, conversational tone.",
        professional: "Use formal, professional language."
      };

      const prompt = `
        You are a sophisticated financial AI assistant. The user is asking for help with their finances.
        
        Response Style: ${stylePrompts[preferences.responseStyle] || stylePrompts.conversational}
        
        Recent conversation context:
        ${conversationContext}
        
        Current financial context:
        - Transactions: ${JSON.stringify(financialContext.transactions.slice(-10))} (showing last 10)
        - Budgets: ${JSON.stringify(financialContext.budgets)}
        - Goals: ${JSON.stringify(financialContext.goals)}
        - Categories: ${JSON.stringify(financialContext.categories)}

        User's current request: "${userInput}"

        Based on their financial context and request, provide a helpful and context-aware response.
        
        If the user wants to create, modify, or delete a transaction, budget, goal, or category, respond with ONLY a JSON object in this format:
        {
          "action": "create|update|delete",
          "type": "transaction|budget|goal|category",
          "data": { /* relevant data */ },
          "message": "Confirmation message for the user"
        }
        
        For regular conversation, respond naturally without JSON formatting.
      `;

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const startTime = Date.now();
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const processingTime = Date.now() - startTime;

      // Try to determine response type
      let responseType = 'text';
      let parsedResponse = text;
      
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
          responseType = 'action';
        }
      } catch (e) {
        // Keep as text response
      }

      // Save to chat history
      await ChatHistory.create({
        userId,
        userMessage: userInput,
        aiResponse: parsedResponse,
        responseType,
        sessionId,
        metadata: {
          processingTime,
          model: 'gemini-1.5-flash'
        }
      });

      return parsedResponse;
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Check if it's a quota exceeded error
      if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('429')) {
        console.log('🚫 API quota exceeded, providing fallback response');
        
        // Provide intelligent fallback responses based on user input
        const fallbackResponses = {
          greeting: "Hello! I'm your AI financial assistant. I'd love to help you with your finances, but I'm currently experiencing high demand. How can I assist you today?",
          spending: "I can help you analyze your spending patterns and suggest budget optimizations once my full capabilities are restored.",
          budget: "I can assist with budget planning and tracking. Let me know what specific budget goals you'd like to work on.",
          investment: "I can provide investment insights and portfolio analysis. What investment topics interest you?",
          default: "I'm your AI financial assistant, ready to help with budgeting, spending analysis, goal tracking, and investment insights. What would you like to explore?"
        };
        
        const userInput = (arguments[0] || '').toLowerCase();
        let response = fallbackResponses.default;
        
        if (userInput.includes('hello') || userInput.includes('hi') || userInput.includes('hey')) {
          response = fallbackResponses.greeting;
        } else if (userInput.includes('spend') || userInput.includes('expense')) {
          response = fallbackResponses.spending;
        } else if (userInput.includes('budget')) {
          response = fallbackResponses.budget;
        } else if (userInput.includes('invest') || userInput.includes('stock') || userInput.includes('portfolio')) {
          response = fallbackResponses.investment;
        }
        
        return response;
      }
      
      throw new DatabaseError('Failed to get AI response');
    }
  }

  /**
   * Get chat history for user
   * @param {string} userId - User ID
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<Array>} Chat history
   */
  static async getChatHistory(userId, page = 1, limit = 20) {
    try {
      return await ChatHistory.getRecentChats(userId, page, limit);
    } catch (error) {
      console.error('Error getting chat history:', error);
      throw new DatabaseError('Failed to get chat history');
    }
  }

  /**
   * Execute AI-suggested action
   * @param {string} userId - User ID
   * @param {Object} action - Action to execute
   * @returns {Promise<Object>} Execution result
   */
  static async executeAction(userId, action) {
    try {
      const { type, action: actionType, data } = action;
      let result = null;

      switch (type) {
        case 'transaction':
          if (actionType === 'create') {
            result = await TransactionService.createTransaction(userId, data);
          } else if (actionType === 'update') {
            result = await TransactionService.updateTransaction(data.id, userId, data);
          } else if (actionType === 'delete') {
            result = await TransactionService.deleteTransaction(data.id, userId);
          }
          break;

        case 'budget':
          if (actionType === 'create') {
            result = await BudgetService.createBudget(data, userId);
          } else if (actionType === 'update') {
            result = await BudgetService.updateBudget(data.id, data, userId);
          } else if (actionType === 'delete') {
            result = await BudgetService.deleteBudget(data.id, userId);
          }
          break;

        case 'goal':
          if (actionType === 'create') {
            result = await GoalService.createGoal(data, userId);
          } else if (actionType === 'update') {
            result = await GoalService.updateGoal(data.id, data, userId);
          } else if (actionType === 'delete') {
            result = await GoalService.deleteGoal(data.id, userId);
          }
          break;

        default:
          throw new ValidationError(`Unsupported action type: ${type}`);
      }

      return result;
    } catch (error) {
      console.error('Error executing action:', error);
      throw new DatabaseError(`Failed to execute ${action.type} ${action.action}`);
    }
  }

  /**
   * Get user AI preferences
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User preferences
   */
  static async getUserPreferences(userId) {
    try {
      return await AIPreferences.getOrCreateForUser(userId);
    } catch (error) {
      console.error('Error getting user preferences:', error);
      throw new DatabaseError('Failed to get user preferences');
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
      const preferences = await AIPreferences.getOrCreateForUser(userId);
      Object.assign(preferences, updates);
      return await preferences.save();
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw new DatabaseError('Failed to update user preferences');
    }
  }
}

module.exports = AIService;
