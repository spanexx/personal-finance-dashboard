process.env.GEMINI_API_KEY = "your-gemini-api-key-here";
process.env.MONGODB_URI = "mongodb://localhost:27017/finance_dashboard_dev";

const aiService = require('./services/ai.service');

async function testAI() {
  try {
    console.log('--- Testing getInsights ---');
    const insights = await aiService.getInsights('user123');
    console.log('Insights:', insights);

    console.log('\n--- Testing getAIResponse ---');
    const response = await aiService.getAIResponse('user123', 'What is my biggest expense?');
    console.log('AI Response:', response);
  } catch (error) {
    console.error('Error testing AI service:', error);
  }
}

testAI();
