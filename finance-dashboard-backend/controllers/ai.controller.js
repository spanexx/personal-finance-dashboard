const aiService = require('../services/ai.service');

async function getInsights(req, res) {
  const insights = await aiService.getInsights(req.user.id);
  res.json({ insights });
}

async function getAIResponse(req, res) {
  const { userInput } = req.body;
  const response = await aiService.getAIResponse(req.user.id, userInput);
  res.json({ response });
}

module.exports = {
  getInsights,
  getAIResponse,
};
