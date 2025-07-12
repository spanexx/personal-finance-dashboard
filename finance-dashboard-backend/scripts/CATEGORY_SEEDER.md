# Category Seeder Documentation

## Overview
The category seeder script creates default income and expense categories for users in the personal finance dashboard.

## Features
- **42 Pre-defined Categories**: 10 income categories and 32 expense categories
- **User-specific**: Categories are created for specific users or all users
- **Duplicate Prevention**: Skips categories that already exist
- **Material Design Icons**: Uses Material Design icon names
- **Color-coded**: Each category has a distinct hex color
- **Comprehensive Coverage**: Covers all major financial categories

## Category Types

### Income Categories (10)
- Salary, Freelance, Investment, Business, Rental
- Bonus, Refund, Gift, Side Hustle, Other Income

### Expense Categories (32)
- **Essential**: Rent, Mortgage, Utilities, Groceries, Transportation
- **Healthcare**: Healthcare, Insurance
- **Food**: Dining, Coffee
- **Entertainment**: Entertainment, Subscriptions, Gaming
- **Shopping**: Shopping, Clothing, Electronics
- **Personal**: Personal Care, Fitness
- **Financial**: Loan Payment, Credit Card, Savings, Investment
- **Education**: Education, Professional
- **Travel**: Travel, Parking
- **Family**: Childcare, Pet Care
- **Social**: Gifts, Charity
- **Home**: Home Improvement, Garden
- **Misc**: Taxes, Bank Fees, Other Expense

## Usage

### Run for all users
```bash
npm run seed:categories
```

### Run for specific user
```bash
npm run seed:categories <userId>
# or
node scripts/seed-categories.js <userId>
```

### Direct execution
```bash
node scripts/seed-categories.js
```

## Output Example
```
Connecting to database...
Connected to database
Found 1 user(s) in database
Seeding categories for user: 60f7b3a8e1234567890abcde
  ✓ Created income category: Salary
  ✓ Created income category: Freelance
  ✓ Created expense category: Rent
  ✓ Created expense category: Groceries
  Skipping existing expense category: Utilities
  ...

Seeding completed for all users:
  Total created: 40 categories
  Total skipped: 2 categories (already exist)
Database connection closed
```

## Category Properties
Each category includes:
- **name**: Human-readable category name
- **type**: 'income' or 'expense'
- **icon**: Material Design icon identifier
- **color**: Hex color code for UI display
- **description**: Brief description of the category
- **isActive**: true (categories are active by default)
- **isSystem**: true (marks as system-created categories)
- **user**: Reference to the user who owns the category

## Integration
After running the seeder, users will have a comprehensive set of categories available for:
- Creating new transactions
- Importing transaction data
- Budget planning
- Financial reporting

## Notes
- Categories marked as `isSystem: true` should not be deleted by users
- Each category has a unique color for visual distinction
- Icons use Material Design naming convention
- All descriptions are provided for user clarity
- The seeder is idempotent - safe to run multiple times
