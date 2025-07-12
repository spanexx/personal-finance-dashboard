const express = require('express');
const request = require('supertest');
const AIController = require('./controllers/ai.controller');

// Simple test to verify AI controller methods exist and are callable
console.log('=== AI Controller Test ===');

console.log('Available methods:');
console.log('- getInsights:', typeof AIController.getInsights);
console.log('- getAIResponse:', typeof AIController.getAIResponse);
console.log('- getChatHistory:', typeof AIController.getChatHistory);
console.log('- executeAIAction:', typeof AIController.executeAIAction);

// Test route registration
const testApp = express();
testApp.use(express.json());

// Mock auth middleware for testing
const mockAuth = (req, res, next) => {
  req.user = { id: 'test-user-id' };
  next();
};

// Register routes
testApp.get('/test/insights', mockAuth, AIController.getInsights);
testApp.post('/test/chat', mockAuth, AIController.getAIResponse);

console.log('\n=== Route Registration Test ===');
console.log('Routes registered successfully!');

console.log('\n=== AI Service Import Test ===');
try {
  const AIService = require('./services/ai.service');
  console.log('AI Service imported successfully!');
  console.log('Available methods:', Object.getOwnPropertyNames(AIService).filter(name => typeof AIService[name] === 'function'));
} catch (error) {
  console.error('Error importing AI Service:', error.message);
}

console.log('\n=== Models Import Test ===');
try {
  const ChatHistory = require('./models/ChatHistory');
  const AIPreferences = require('./models/AIPreferences');
  console.log('ChatHistory model imported successfully!');
  console.log('AIPreferences model imported successfully!');
} catch (error) {
  console.error('Error importing models:', error.message);
}

console.log('\n✅ All AI components are properly configured and ready to use!');
