const { GoogleGenerativeAI } = require('@google/generative-ai');
const transactionService = require('./transaction.service');
const budgetService = require('./budget.service');
const goalService = require('./goal.service');
const categoryService = require('./category.service');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getFinancialContext(userId) {
  const transactions = await transactionService.getTransactions(userId);
  const budgets = await budgetService.getBudgets(userId);
  const goals = await goalService.getGoals(userId);
  const categories = await categoryService.getCategories(userId);

  return {
    transactions: transactions.map(t => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category.name,
    })),
    budgets: budgets.map(b => ({
      category: b.category.name,
      amount: b.amount,
      spent: b.spent,
      remaining: b.remaining,
    })),
    goals: goals.map(g => ({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      deadline: g.deadline,
    })),
    categories: categories.map(c => c.name),
  };
}

async function getInsights(userId) {
  const financialContext = await getFinancialContext(userId);

  const prompt = `
    As a sophisticated financial AI assistant, analyze the following user data and provide detailed, personalized insights.
    The user's financial data is as follows:
    - Transactions: ${JSON.stringify(financialContext.transactions)}
    - Budgets: ${JSON.stringify(financialContext.budgets)}
    - Goals: ${JSON.stringify(financialContext.goals)}

    Based on this data, provide:
    1.  A summary of the user's financial health.
    2.  Personalized insights into their spending habits.
    3.  Actionable suggestions for improving their financial situation.
  `;

  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  return text.split('\n').filter(line => line.trim() !== '');
}

async function getAIResponse(userId, userInput) {
  const financialContext = await getFinancialContext(userId);

  const prompt = `
    You are a sophisticated financial AI assistant. The user is asking for help with their finances.
    Their current financial context is:
    - Transactions: ${JSON.stringify(financialContext.transactions)}
    - Budgets: ${JSON.stringify(financialContext.budgets)}
    - Goals: ${JSON.stringify(financialContext.goals)}
    - Categories: ${JSON.stringify(financialContext.categories)}

    The user's request is: "${userInput}"

    Based on their financial context and request, provide a helpful and context-aware response.
    If the user wants to create, modify, or delete a transaction, budget, goal, or category, provide the response in a structured format that can be parsed by the system.
    For example:
    - To create a transaction: { "action": "create", "type": "transaction", "data": { "description": "Groceries", "amount": 100, "date": "2024-07-28", "category": "Food" } }
    - To create a budget: { "action": "create", "type": "budget", "data": { "category": "Entertainment", "amount": 200 } }
  `;

  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

module.exports = {
  getInsights,
  getAIResponse,
};
