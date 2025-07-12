const aiService = require('../services/ai.service');

async function getInsights(req, res) {
  const insights = await aiService.getInsights(req.user.id);
  res.json({ insights });
}

module.exports = {
  getInsights,
};
