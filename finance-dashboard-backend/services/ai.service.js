const transactionService = require('./transaction.service');

/**
 * Analyzes a user's financial data and returns insights.
 * @param {string} userId - The ID of the user to analyze.
 * @returns {Promise<Array<string>>} - A list of insights.
 */
async function getInsights(userId) {
  const transactions = await transactionService.getTransactions(userId);

  if (transactions.length === 0) {
    return ['No transactions found.'];
  }

  const insights = [];

  // Insight 1: Largest expense category
  const categories = {};
  for (const transaction of transactions) {
    if (transaction.type === 'expense') {
      if (categories[transaction.category]) {
        categories[transaction.category] += transaction.amount;
      } else {
        categories[transaction.category] = transaction.amount;
      }
    }
  }

  let largestCategory = null;
  let largestAmount = 0;
  for (const category in categories) {
    if (categories[category] > largestAmount) {
      largestCategory = category;
      largestAmount = categories[category];
    }
  }

  if (largestCategory) {
    insights.push(`Your largest expense category is ${largestCategory}.`);
  }

  return insights;
}

module.exports = {
  getInsights,
};
