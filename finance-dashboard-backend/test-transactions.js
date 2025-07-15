// Quick test to check if transactions are accessible
const mongoose = require('mongoose');
const Transaction = require('./models/Transaction');
const Category = require('./models/Category'); // Add Category model

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/finance_dashboard_dev');

async function testTransactions() {
  try {
    console.log('🔍 Testing transaction data...');
    
    // Get total transaction count
    const totalCount = await Transaction.countDocuments();
    console.log(`📊 Total transactions in database: ${totalCount}`);
    
    // Get recent transactions
    const recentTransactions = await Transaction.find()
      .populate('category', 'name')
      .sort({ date: -1 })
      .limit(10)
      .lean();
    
    console.log('\n📝 Recent transactions:');
    recentTransactions.forEach(tx => {
      console.log(`  ${tx.date.toISOString().split('T')[0]} | ${tx.description} | ${tx.type} | $${tx.amount} | ${tx.category?.name || 'No category'}`);
    });
    
    // Test category breakdown
    const categoryBreakdown = await Transaction.aggregate([
      { $match: { type: 'expense' } },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $group: {
          _id: '$category',
          categoryName: { $first: { $arrayElemAt: ['$categoryInfo.name', 0] } },
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);
    
    console.log('\n📈 Category breakdown:');
    categoryBreakdown.forEach(cat => {
      console.log(`  ${cat.categoryName || 'Uncategorized'}: $${cat.totalAmount} (${cat.transactionCount} transactions)`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing transactions:', error);
    process.exit(1);
  }
}

testTransactions();
