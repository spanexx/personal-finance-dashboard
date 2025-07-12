// Cashflow Service: Business logic for cashflow chart data
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

/**
 * Get cashflow data for the last 12 months for a user
 * @param {string} userId
 * @returns {Promise<Array<{ year: number, month: number, income: number, expenses: number }>>}
 */
async function getCashflowChartData(userId) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1); // last 12 months
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Aggregate income
  const income = await Transaction.aggregate([
    { $match: { user: userObjectId, type: 'income', date: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, amount: { $sum: '$amount' } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Aggregate expenses
  const expenses = await Transaction.aggregate([
    { $match: { user: userObjectId, type: 'expense', date: { $gte: startDate, $lte: endDate } } },
    { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, amount: { $sum: '$amount' } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Merge income and expenses by year/month
  const dataMap = new Map();
  income.forEach(item => {
    const key = `${item._id.year}-${item._id.month}`;
    dataMap.set(key, { year: item._id.year, month: item._id.month, income: item.amount, expenses: 0 });
  });
  expenses.forEach(item => {
    const key = `${item._id.year}-${item._id.month}`;
    if (!dataMap.has(key)) {
      dataMap.set(key, { year: item._id.year, month: item._id.month, income: 0, expenses: item.amount });
    } else {
      dataMap.get(key).expenses = item.amount;
    }
  });
  // DEBUG: Log first 5 transactions for this user in the last 12 months
  const debugTx = await Transaction.find({
    user: userObjectId,
    date: { $gte: startDate, $lte: endDate }
  }).limit(5);
  console.log('DEBUG: First 5 transactions for user', userId, debugTx);

  // Return with period field for frontend compatibility
  return Array.from(dataMap.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  }).map(item => ({
    period: `${item.year}-${item.month.toString().padStart(2, '0')}`,
    income: item.income,
    expenses: item.expenses
  }));
}

module.exports = { getCashflowChartData };
