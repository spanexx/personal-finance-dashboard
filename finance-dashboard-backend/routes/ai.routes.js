const express = require('express');
const router = express.Router();
const AIController = require('../controllers/ai.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { body, query } = require('express-validator');

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

// AI Insights
router.get('/insights', verifyToken, AIController.getInsights);

// AI Chat
router.post('/chat', verifyToken, validateChatInput, AIController.getAIResponse);
router.get('/chat/history', verifyToken, AIController.getChatHistory);

// AI Actions
router.post('/execute-action', verifyToken, validateActionExecution, AIController.executeAIAction);

// AI Preferences
router.get('/preferences', verifyToken, AIController.getUserPreferences);
router.put('/preferences', verifyToken, validatePreferences, AIController.updateUserPreferences);

module.exports = router;
const validateAction = [
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

// Validation middleware for pagination
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Get AI insights
router.get('/insights', verifyToken, AIController.getInsights);

// Chat with AI
router.post('/chat', verifyToken, validateChatInput, AIController.getAIResponse);

// Get chat history
router.get('/history', verifyToken, validatePagination, AIController.getChatHistory);

// Execute AI suggested action
router.post('/execute-action', verifyToken, validateAction, AIController.executeAIAction);

// Get AI preferences
router.get('/preferences', verifyToken, async (req, res) => {
  try {
    const aiService = require('../services/ai.service');
    const preferences = await aiService.getUserPreferences(req.user.id);
    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get preferences',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update AI preferences
router.put('/preferences', verifyToken, async (req, res) => {
  try {
    const aiService = require('../services/ai.service');
    const preferences = await aiService.updateUserPreferences(req.user.id, req.body);
    res.json({
      success: true,
      preferences,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
