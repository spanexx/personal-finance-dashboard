// Seed script for 10 transactions across different months
// Usage: node scripts/seed-transactions.js

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Category, Transaction } = require('../models');

// Use env vars for DB connection
const dbUri = process.env.MONGODB_URI;
const dbOptions = { useNewUrlParser: true, useUnifiedTopology: true };

async function main() {
  await mongoose.connect(dbUri, dbOptions);

  // Find a user to assign transactions to (first user)
  const user = await User.findOne();
  if (!user) throw new Error('No user found in database. Please create a user first.');

  // Find or create default income and expense categories if they don't exist
  let incomeCategory = await Category.findOne({ user: user._id, type: 'income' });
  if (!incomeCategory) {
    console.log('User has no income category. Creating a default "Salary" category.');
    incomeCategory = await new Category({
      user: user._id,
      name: 'Salary',
      type: 'income',
      icon: 'attach_money',
      color: '#4CAF50'
    }).save();
  }

  let expenseCategory = await Category.findOne({ user: user._id, type: 'expense' });
  if (!expenseCategory) {
    console.log('User has no expense category. Creating a default "General" category.');
    expenseCategory = await new Category({
      user: user._id,
      name: 'General',
      type: 'expense',
      icon: 'shopping_cart',
      color: '#F44336'
    }).save();
  }

  // Find or create a second expense category for variety
  let groceriesCategory = await Category.findOne({ user: user._id, type: 'expense', name: 'Groceries' });
  if (!groceriesCategory) {
    console.log('Creating a "Groceries" expense category for more variety.');
    groceriesCategory = await new Category({
      user: user._id,
      name: 'Groceries',
      type: 'expense',
      icon: 'local_grocery_store',
      color: '#FF6B6B'
    }).save();
  }

  // Log user and category info for debugging
  console.log('Seeding for user:', user._id, user.email || user.username || '');
  console.log('Income category:', incomeCategory._id, incomeCategory.name, incomeCategory.type);
  console.log('Expense category 1:', expenseCategory._id, expenseCategory.name, expenseCategory.type);
  console.log('Expense category 2:', groceriesCategory._id, groceriesCategory.name, groceriesCategory.type);

  const now = new Date();
  const transactions = [];

  // STEP 1: Generate historical transactions: 4 per month (1 income, 3 expenses) for the last 12 months
  console.log('Generating historical transactions for the last 12 months...');
  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    // Calculate base date for this month
    const year = now.getFullYear();
    const month = now.getMonth() - monthOffset;
    const adjustedDate = new Date(year, month, 1);
    
    // Income: 10th of the month
    let incomeDate = new Date(adjustedDate.getFullYear(), adjustedDate.getMonth(), 10);
    if (incomeDate > now) incomeDate = new Date(now);
    transactions.push({
      amount: 1500 + monthOffset * 100,
      type: 'income',
      date: incomeDate,
      description: `Salary for ${incomeDate.toLocaleString('default', { month: 'long' })} ${incomeDate.getFullYear()}`,
      user: user._id,
      category: incomeCategory._id
    });

    // Expenses: 12th, 18th, 25th of the month
    const expenseDays = [12, 18, 25];
    expenseDays.forEach((day, idx) => {
      let expenseDate = new Date(adjustedDate.getFullYear(), adjustedDate.getMonth(), day);
      if (expenseDate > now) expenseDate = new Date(now);
      
      // Alternate between expense categories
      const category = idx % 2 === 0 ? expenseCategory._id : groceriesCategory._id;
      const description = idx % 2 === 0 ? 
        `General expense ${idx + 1} for ${expenseDate.toLocaleString('default', { month: 'long' })}` :
        `Grocery shopping on ${expenseDate.toLocaleString('default', { day: 'numeric', month: 'long' })}`;
      
      transactions.push({
        amount: 300 + monthOffset * 50 + idx * 25,
        type: 'expense',
        date: expenseDate,
        description,
        user: user._id,
        category
      });
    });
  }

  // STEP 2: Add more transactions for THIS WEEK (for weekly filter testing)
  console.log('Adding transactions for the current week...');
  const currentDay = now.getDate();
  const currentWeekday = now.getDay(); // 0 = Sunday, 6 = Saturday
  const daysInCurrentWeek = [];
  
  // Calculate the dates in the current week (Sunday to today)
  for (let i = 0; i <= currentWeekday; i++) {
    const day = currentDay - currentWeekday + i;
    daysInCurrentWeek.push(day);
  }

  // Add one income and multiple expenses for this week
  transactions.push({
    amount: 500,
    type: 'income',
    date: new Date(now.getFullYear(), now.getMonth(), daysInCurrentWeek[1]), // Monday
    description: `Weekly side gig income`,
    user: user._id,
    category: incomeCategory._id
  });

  // Add expenses for different days this week
  daysInCurrentWeek.forEach((day, idx) => {
    if (idx === 1) return; // Skip Monday as we used it for income
    
    transactions.push({
      amount: 20 + idx * 15,
      type: 'expense',
      date: new Date(now.getFullYear(), now.getMonth(), day),
      description: `Current week expense ${idx}`,
      user: user._id,
      category: idx % 2 === 0 ? expenseCategory._id : groceriesCategory._id
    });
  });

  // STEP 3: Add more transactions for THIS MONTH (beyond this week)
  console.log('Adding more transactions for the current month...');
  const daysThisMonth = [5, 8, 15, 22];
  
  daysThisMonth.forEach(day => {
    // Skip days that are part of current week
    if (daysInCurrentWeek.includes(day)) return;
    
    // Only include days up to today
    if (day > now.getDate()) return;
    
    // Add one income transaction
    if (day === 15) {
      transactions.push({
        amount: 1200,
        type: 'income',
        date: new Date(now.getFullYear(), now.getMonth(), day),
        description: `Mid-month commission`,
        user: user._id,
        category: incomeCategory._id
      });
    } 
    // Add expense transactions
    else {
      transactions.push({
        amount: 50 + day * 2,
        type: 'expense',
        date: new Date(now.getFullYear(), now.getMonth(), day),
        description: `Current month expense on day ${day}`,
        user: user._id,
        category: day % 2 === 0 ? expenseCategory._id : groceriesCategory._id
      });
    }
  });

  // STEP 4: Add more transactions for THIS QUARTER (previous months in quarter)
  console.log('Adding transactions for the current quarter...');
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const quarterStartMonth = currentQuarter * 3;
  
  // Only add transactions for earlier months in the quarter
  for (let m = quarterStartMonth; m < now.getMonth(); m++) {
    // Add one income transaction per month
    transactions.push({
      amount: 2500 + (m - quarterStartMonth) * 200,
      type: 'income',
      date: new Date(now.getFullYear(), m, 10),
      description: `Quarterly bonus payment`,
      user: user._id,
      category: incomeCategory._id
    });
    
    // Add 2-3 expenses per month
    for (let d = 0; d < 3; d++) {
      transactions.push({
        amount: 150 + d * 100,
        type: 'expense',
        date: new Date(now.getFullYear(), m, 10 + d * 5),
        description: `Quarterly expense plan - payment ${d+1}`,
        user: user._id,
        category: d % 2 === 0 ? expenseCategory._id : groceriesCategory._id
      });
    }
  }

  await Transaction.insertMany(transactions);
  console.log(`Seeded ${transactions.length} transactions:`);
  console.log(`- Historical data for last 12 months (4 transactions per month)`);
  console.log(`- Additional transactions for current week`);
  console.log(`- Additional transactions for current month`);
  console.log(`- Additional transactions for current quarter`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Seeding script failed:', err.message);
  if (mongoose.connection.readyState === 1) {
    mongoose.disconnect();
  }
  process.exit(1);
});
