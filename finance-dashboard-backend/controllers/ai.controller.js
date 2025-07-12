const AIService = require('../services/ai.service');
const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');
const { 
  ErrorHandler, 
  ValidationError, 
  AuthenticationError, 
  ConflictError, 
  NotFoundError,
  RateLimitError 
} = require('../utils/errorHandler');

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
}

module.exports = AIController;
