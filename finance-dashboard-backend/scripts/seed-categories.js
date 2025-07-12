/**
 * Category Seeder Script
 * Seeds default categories for income and expense types
 * Usage: node scripts/seed-categories.js [userId]
 * If no userId provided, will seed for the first user found
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Category } = require('../models');

// Database connection
const dbUri = process.env.MONGODB_URI;
const dbOptions = { useNewUrlParser: true, useUnifiedTopology: true };

// Default category definitions
const DEFAULT_CATEGORIES = {
  income: [
    {
      name: 'Salary',
      icon: 'work',
      color: '#4CAF50',
      description: 'Regular employment income'
    },
    {
      name: 'Freelance',
      icon: 'laptop',
      color: '#2196F3',
      description: 'Freelance work and consulting'
    },
    {
      name: 'Investment',
      icon: 'trending_up',
      color: '#FF9800',
      description: 'Dividends, capital gains, and investment returns'
    },
    {
      name: 'Business',
      icon: 'business',
      color: '#9C27B0',
      description: 'Business income and profits'
    },
    {
      name: 'Rental',
      icon: 'home',
      color: '#607D8B',
      description: 'Rental property income'
    },
    {
      name: 'Bonus',
      icon: 'star',
      color: '#FFC107',
      description: 'Performance bonuses and incentives'
    },
    {
      name: 'Refund',
      icon: 'replay',
      color: '#795548',
      description: 'Tax refunds and reimbursements'
    },
    {
      name: 'Gift',
      icon: 'card_giftcard',
      color: '#E91E63',
      description: 'Money gifts and winnings'
    },
    {
      name: 'Side Hustle',
      icon: 'weekend',
      color: '#3F51B5',
      description: 'Part-time work and gig economy'
    },
    {
      name: 'Other Income',
      icon: 'attach_money',
      color: '#009688',
      description: 'Miscellaneous income sources'
    }
  ],
  expense: [
    // Essential Categories
    {
      name: 'Rent',
      icon: 'home',
      color: '#F44336',
      description: 'Monthly rent payments'
    },
    {
      name: 'Mortgage',
      icon: 'home_work',
      color: '#D32F2F',
      description: 'Mortgage payments and home loans'
    },
    {
      name: 'Utilities',
      icon: 'electrical_services',
      color: '#FF5722',
      description: 'Electricity, gas, water, internet'
    },
    {
      name: 'Groceries',
      icon: 'shopping_cart',
      color: '#4CAF50',
      description: 'Food and household essentials'
    },
    {
      name: 'Transportation',
      icon: 'directions_car',
      color: '#2196F3',
      description: 'Gas, public transport, car maintenance'
    },
    
    // Healthcare
    {
      name: 'Healthcare',
      icon: 'local_hospital',
      color: '#E91E63',
      description: 'Medical expenses, insurance, prescriptions'
    },
    {
      name: 'Insurance',
      icon: 'security',
      color: '#9C27B0',
      description: 'Health, auto, life insurance premiums'
    },
    
    // Food & Dining
    {
      name: 'Dining',
      icon: 'restaurant',
      color: '#FF9800',
      description: 'Restaurants and takeout'
    },
    {
      name: 'Coffee',
      icon: 'local_cafe',
      color: '#795548',
      description: 'Coffee shops and beverages'
    },
    
    // Entertainment & Lifestyle
    {
      name: 'Entertainment',
      icon: 'movie',
      color: '#673AB7',
      description: 'Movies, concerts, events'
    },
    {
      name: 'Subscriptions',
      icon: 'subscriptions',
      color: '#607D8B',
      description: 'Streaming services, software, memberships'
    },
    {
      name: 'Gaming',
      icon: 'sports_esports',
      color: '#3F51B5',
      description: 'Games, gaming subscriptions'
    },
    
    // Shopping
    {
      name: 'Shopping',
      icon: 'shopping_bag',
      color: '#FF5722',
      description: 'General shopping and retail'
    },
    {
      name: 'Clothing',
      icon: 'checkroom',
      color: '#E91E63',
      description: 'Clothes, shoes, accessories'
    },
    {
      name: 'Electronics',
      icon: 'devices',
      color: '#2196F3',
      description: 'Gadgets, computers, phones'
    },
    
    // Personal Care
    {
      name: 'Personal Care',
      icon: 'spa',
      color: '#9C27B0',
      description: 'Haircuts, beauty, personal hygiene'
    },
    {
      name: 'Fitness',
      icon: 'fitness_center',
      color: '#4CAF50',
      description: 'Gym memberships, sports, fitness'
    },
    
    // Financial
    {
      name: 'Loan Payment',
      icon: 'payment',
      color: '#F44336',
      description: 'Student loans, personal loans'
    },
    {
      name: 'Credit Card',
      icon: 'credit_card',
      color: '#D32F2F',
      description: 'Credit card payments'
    },
    {
      name: 'Savings',
      icon: 'savings',
      color: '#4CAF50',
      description: 'Transfers to savings accounts'
    },
    {
      name: 'Investment',
      icon: 'trending_up',
      color: '#FF9800',
      description: 'Investment contributions'
    },
    
    // Education & Development
    {
      name: 'Education',
      icon: 'school',
      color: '#2196F3',
      description: 'Courses, books, training'
    },
    {
      name: 'Professional',
      icon: 'work_outline',
      color: '#607D8B',
      description: 'Professional development, networking'
    },
    
    // Travel & Transport
    {
      name: 'Travel',
      icon: 'flight',
      color: '#009688',
      description: 'Flights, hotels, vacation expenses'
    },
    {
      name: 'Parking',
      icon: 'local_parking',
      color: '#795548',
      description: 'Parking fees and tolls'
    },
    
    // Family & Pets
    {
      name: 'Childcare',
      icon: 'child_care',
      color: '#FFC107',
      description: 'Daycare, babysitting, child expenses'
    },
    {
      name: 'Pet Care',
      icon: 'pets',
      color: '#8BC34A',
      description: 'Pet food, vet bills, pet supplies'
    },
    
    // Gifts & Charity
    {
      name: 'Gifts',
      icon: 'card_giftcard',
      color: '#E91E63',
      description: 'Gifts for friends and family'
    },
    {
      name: 'Charity',
      icon: 'volunteer_activism',
      color: '#4CAF50',
      description: 'Donations and charitable giving'
    },
    
    // Home & Garden
    {
      name: 'Home Improvement',
      icon: 'home_repair_service',
      color: '#FF5722',
      description: 'Home repairs and improvements'
    },
    {
      name: 'Garden',
      icon: 'local_florist',
      color: '#8BC34A',
      description: 'Gardening supplies and plants'
    },
    
    // Miscellaneous
    {
      name: 'Taxes',
      icon: 'account_balance',
      color: '#37474F',
      description: 'Tax payments and fees'
    },
    {
      name: 'Bank Fees',
      icon: 'account_balance_wallet',
      color: '#D32F2F',
      description: 'Banking fees and charges'
    },
    {
      name: 'Other Expense',
      icon: 'more_horiz',
      color: '#757575',
      description: 'Miscellaneous expenses'
    }
  ]
};

/**
 * Seed categories for a specific user
 * @param {string} userId - User ID to seed categories for
 */
async function seedCategoriesForUser(userId) {
  console.log(`Seeding categories for user: ${userId}`);
  
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  let createdCount = 0;
  let skippedCount = 0;

  // Seed income categories
  for (const categoryData of DEFAULT_CATEGORIES.income) {
    const existingCategory = await Category.findOne({
      user: userId,
      name: categoryData.name,
      type: 'income'
    });

    if (existingCategory) {
      console.log(`  Skipping existing income category: ${categoryData.name}`);
      skippedCount++;
      continue;
    }

    const category = new Category({
      user: userId,
      name: categoryData.name,
      type: 'income',
      icon: categoryData.icon,
      color: categoryData.color,
      description: categoryData.description,
      isActive: true,
      isSystem: true
    });

    await category.save();
    console.log(`  ✓ Created income category: ${categoryData.name}`);
    createdCount++;
  }

  // Seed expense categories
  for (const categoryData of DEFAULT_CATEGORIES.expense) {
    const existingCategory = await Category.findOne({
      user: userId,
      name: categoryData.name,
      type: 'expense'
    });

    if (existingCategory) {
      console.log(`  Skipping existing expense category: ${categoryData.name}`);
      skippedCount++;
      continue;
    }

    const category = new Category({
      user: userId,
      name: categoryData.name,
      type: 'expense',
      icon: categoryData.icon,
      color: categoryData.color,
      description: categoryData.description,
      isActive: true,
      isSystem: true
    });

    await category.save();
    console.log(`  ✓ Created expense category: ${categoryData.name}`);
    createdCount++;
  }

  return { createdCount, skippedCount };
}

/**
 * Main seeder function
 */
async function main() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(dbUri, dbOptions);
    console.log('Connected to database');

    // Get userId from command line arguments or find first user
    const userId = process.argv[2];
    
    if (userId) {
      // Seed for specific user
      const result = await seedCategoriesForUser(userId);
      console.log(`\nSeeding completed for user ${userId}:`);
      console.log(`  Created: ${result.createdCount} categories`);
      console.log(`  Skipped: ${result.skippedCount} categories (already exist)`);
    } else {
      // Seed for all users or first user if no argument provided
      const users = await User.find({});
      
      if (users.length === 0) {
        throw new Error('No users found in database. Please create a user first.');
      }

      console.log(`Found ${users.length} user(s) in database`);
      
      let totalCreated = 0;
      let totalSkipped = 0;

      for (const user of users) {
        const result = await seedCategoriesForUser(user._id);
        totalCreated += result.createdCount;
        totalSkipped += result.skippedCount;
      }

      console.log(`\nSeeding completed for all users:`);
      console.log(`  Total created: ${totalCreated} categories`);
      console.log(`  Total skipped: ${totalSkipped} categories (already exist)`);
    }

  } catch (error) {
    console.error('Error seeding categories:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

// Run the seeder
if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_CATEGORIES,
  seedCategoriesForUser
};
