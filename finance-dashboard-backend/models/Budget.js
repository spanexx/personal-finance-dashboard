const mongoose = require('mongoose');
const { budgetAlertService } = require('../services');

const validator = require('validator');

// Category allocation subdocument schema
const categoryAllocationSchema = new mongoose.Schema({
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category reference is required']
  },
  
  allocatedAmount: {
    type: Number,
    required: [true, 'Allocated amount is required'],
    min: [0, 'Allocated amount cannot be negative'],
    validate: {
      validator: function(amount) {
        // Validate decimal precision (max 2 decimal places)
        return Number.isFinite(amount) && /^\d+(\.\d{1,2})?$/.test(amount.toString());
      },
      message: 'Allocated amount must have maximum 2 decimal places'
    }
  },
  
  spentAmount: {
    type: Number,
    default: 0,
    min: [0, 'Spent amount cannot be negative']
  },
  
  percentage: {
    type: Number,
    min: [0, 'Percentage cannot be negative'],
    max: [100, 'Percentage cannot exceed 100%']
  },
  
  rolloverAmount: {
    type: Number,
    default: 0
  },
  
  adjustedAmount: {
    type: Number,
    default: function() {
      return this.allocatedAmount + this.rolloverAmount;
    }
  },
  
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  _id: true,
  timestamps: true
});

// Virtual for remaining amount in category allocation
categoryAllocationSchema.virtual('remainingAmount').get(function() {
  return Math.max(0, this.adjustedAmount - this.spentAmount);
});

// Virtual for overspent amount in category allocation
categoryAllocationSchema.virtual('overspentAmount').get(function() {
  return Math.max(0, this.spentAmount - this.adjustedAmount);
});

// Virtual for utilization percentage
categoryAllocationSchema.virtual('utilizationPercentage').get(function() {
  if (this.adjustedAmount === 0) return 0;
  return Math.min(100, (this.spentAmount / this.adjustedAmount) * 100);
});

// Main Budget Schema
const budgetSchema = new mongoose.Schema({
  // Budget identification
  name: {
    type: String,
    required: [true, 'Budget name is required'],
    trim: true,
    minlength: [2, 'Budget name must be at least 2 characters'],
    maxlength: [100, 'Budget name cannot exceed 100 characters']
  },
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true
  },
  
  // Budget configuration
  totalAmount: {
    type: Number,
    required: [true, 'Total budget amount is required'],
    min: [0.01, 'Total amount must be greater than 0'],
    validate: {
      validator: function(amount) {
        // Validate decimal precision (max 2 decimal places)
        return Number.isFinite(amount) && /^\d+(\.\d{1,2})?$/.test(amount.toString());
      },
      message: 'Total amount must have maximum 2 decimal places'
    }
  },
  
  period: {
    type: String,
    required: [true, 'Budget period is required'],
    enum: {
      values: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      message: 'Period must be one of: daily, weekly, monthly, quarterly, yearly'
    },
    lowercase: true,
    index: true
  },
  
  // Date range
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    validate: {
      validator: function(startDate) {
        // Start date should not be more than 1 year in the past for new budgets
        if (this.isNew) {
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          return startDate >= oneYearAgo;
        }
        return true;
      },
      message: 'Start date cannot be more than 1 year in the past'
    },
    index: true
  },
  
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(endDate) {
        return endDate > this.startDate;
      },
      message: 'End date must be after start date'
    },
    index: true
  },
  
  // Category allocations
  categoryAllocations: {
    type: [categoryAllocationSchema],
    validate: {
      validator: function(allocations) {
        if (allocations.length === 0) {
          throw new Error('At least one category allocation is required');
        }
        
        // Check for duplicate categories
        const categoryIds = allocations.map(alloc => alloc.category.toString());
        const uniqueCategories = new Set(categoryIds);
        if (categoryIds.length !== uniqueCategories.size) {
          throw new Error('Duplicate categories are not allowed in budget allocations');
        }
        
        // Validate total allocation doesn't exceed budget (with tolerance for rounding)
        const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
        if (totalAllocated > this.totalAmount + 0.01) { // 1 cent tolerance
          throw new Error('Total category allocations cannot exceed budget amount');
        }
        
        return true;
      },
      message: 'Invalid category allocations'
    }
  },
  
  // Budget settings
  rolloverEnabled: {
    type: Boolean,
    default: false
  },
  
  autoAdjustAllocations: {
    type: Boolean,
    default: false
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Alert settings
  alertThreshold: {
    type: Number,
    default: 80,
    min: [50, 'Alert threshold must be at least 50%'],
    max: [100, 'Alert threshold cannot exceed 100%']
  },
  
  enableAlerts: {
    type: Boolean,
    default: true
  },
  
  // Calculated fields
  totalSpent: {
    type: Number,
    default: 0,
    min: [0, 'Total spent cannot be negative']
  },
  
  totalRemaining: {
    type: Number,
    default: function() {
      return this.totalAmount - this.totalSpent;
    }
  },
  
  utilizationPercentage: {
    type: Number,
    default: 0,
    min: [0, 'Utilization percentage cannot be negative'],
    max: [200, 'Utilization percentage cap at 200%'] // Allow overspending tracking
  },
  
  // Tracking and metadata
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, 'Tag cannot exceed 50 characters'],
    validate: {
      validator: function(tag) {
        // Tag format validation (alphanumeric, underscore, hyphen)
        return /^[a-z0-9_-]+$/.test(tag);
      },
      message: 'Tags can only contain lowercase letters, numbers, underscores, and hyphens'
    }
  }],
  
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
    minlength: [3, 'Currency code must be 3 characters'],
    maxlength: [3, 'Currency code must be 3 characters']
  },
  
  // Revision tracking
  version: {
    type: Number,
    default: 1
  },
  
  lastCalculated: {
    type: Date,
    default: Date.now
  },
  
  // Soft deletion
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for days remaining in budget period
budgetSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  if (now > this.endDate) return 0;
  if (now < this.startDate) return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
  return Math.ceil((this.endDate - now) / (1000 * 60 * 60 * 24));
});

// Virtual for days elapsed in budget period
budgetSchema.virtual('daysElapsed').get(function() {
  const now = new Date();
  if (now < this.startDate) return 0;
  const elapsed = Math.floor((Math.min(now, this.endDate) - this.startDate) / (1000 * 60 * 60 * 24));
  return Math.max(0, elapsed);
});

// Virtual for total budget duration
budgetSchema.virtual('totalDays').get(function() {
  return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for budget period progress percentage
budgetSchema.virtual('periodProgress').get(function() {
  const totalDays = this.totalDays;
  if (totalDays === 0) return 100;
  return Math.min(100, (this.daysElapsed / totalDays) * 100);
});

// Virtual for daily budget amount
budgetSchema.virtual('dailyBudget').get(function() {
  const totalDays = this.totalDays;
  return totalDays > 0 ? this.totalAmount / totalDays : 0;
});

// Compound indexes for performance optimization
budgetSchema.index({ user: 1, period: 1 }); // Budget retrieval by user and period
budgetSchema.index({ user: 1, startDate: 1, endDate: 1 }); // Date range queries
budgetSchema.index({ user: 1, isActive: 1, startDate: -1 }); // Active budgets
budgetSchema.index({ user: 1, isDeleted: 1, endDate: -1 }); // Non-deleted budgets
budgetSchema.index({ tags: 1, user: 1 }); // Tag-based filtering
budgetSchema.index({ 'categoryAllocations.category': 1 }); // Category allocation queries

// Unique index to prevent overlapping budgets for same period
budgetSchema.index(
  { user: 1, period: 1, startDate: 1, endDate: 1 },
  { 
    unique: true,
    partialFilterExpression: { isDeleted: { $ne: true } }
  }
);

// Pre-save middleware
budgetSchema.pre('save', async function(next) {
  try {
    // Calculate percentages for category allocations
    this.categoryAllocations.forEach(allocation => {
      if (this.totalAmount > 0) {
        allocation.percentage = (allocation.allocatedAmount / this.totalAmount) * 100;
      }
      allocation.adjustedAmount = allocation.allocatedAmount + (allocation.rolloverAmount || 0);
    });
    
    // Set deletion timestamp
    if (this.isDeleted && !this.deletedAt) {
      this.deletedAt = new Date();
    }
    
    // Clear deletion timestamp if undeleted
    if (!this.isDeleted && this.deletedAt) {
      this.deletedAt = undefined;
    }
    
    // Update utilization percentage
    if (this.totalAmount > 0) {
      this.utilizationPercentage = (this.totalSpent / this.totalAmount) * 100;
    }
    
    // Update remaining amount
    this.totalRemaining = this.totalAmount - this.totalSpent;
    
    // Update last calculated timestamp
    this.lastCalculated = new Date();
    
    // Increment version on significant changes
    if (this.isModified('totalAmount') || this.isModified('categoryAllocations')) {
      this.version += 1;
    }

    // Add a flag to indicate that the document has been updated
    if (!this.isNew) {
      this._updated = true;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance Methods

// Calculate spent amount using transaction aggregation
budgetSchema.methods.calculateSpentAmount = async function(categoryId = null) {
  const Transaction = mongoose.model('Transaction');
  
  const matchStage = {
    user: this.user,
    type: 'expense',
    date: {
      $gte: this.startDate,
      $lte: this.endDate
    },
    status: 'completed',
    isDeleted: { $ne: true }
  };
  
  // If categoryId provided, calculate for specific category
  if (categoryId) {
    matchStage.category = categoryId;
  } else {
    // Calculate for all categories in this budget
    const categoryIds = this.categoryAllocations.map(alloc => alloc.category);
    if (categoryIds.length > 0) {
      matchStage.category = { $in: categoryIds };
    }
  }
  
  const result = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: categoryId ? null : '$category',
        totalSpent: { $sum: '$amount' }
      }
    }
  ]);
  
  if (categoryId) {
    // Return single category spending
    return result.length > 0 ? result[0].totalSpent : 0;
  } else {
    // Update all category allocations and total spent
    const spendingByCategory = new Map();
    result.forEach(item => {
      spendingByCategory.set(item._id.toString(), item.totalSpent);
    });
    
    let totalSpent = 0;
    this.categoryAllocations.forEach(allocation => {
      const spent = spendingByCategory.get(allocation.category.toString()) || 0;
      allocation.spentAmount = spent;
      totalSpent += spent;
    });
      this.totalSpent = totalSpent;
    
    return totalSpent;
  }
};

// Get budget performance with variance analysis
budgetSchema.methods.getBudgetPerformance = async function() {
  await this.calculateSpentAmount();
  
  const performance = {
    budget: {
      total: this.totalAmount,
      spent: this.totalSpent,
      remaining: this.totalRemaining,
      utilizationPercentage: this.utilizationPercentage
    },
    period: {
      totalDays: this.totalDays,
      daysElapsed: this.daysElapsed,
      daysRemaining: this.daysRemaining,
      periodProgress: this.periodProgress
    },
    daily: {
      budgetPerDay: this.dailyBudget,
      averageSpentPerDay: this.daysElapsed > 0 ? this.totalSpent / this.daysElapsed : 0,
      projectedSpending: this.daysElapsed > 0 ? (this.totalSpent / this.daysElapsed) * this.totalDays : 0
    },
    categories: [],
    variance: {
      amount: this.totalSpent - this.totalAmount,
      percentage: this.totalAmount > 0 ? ((this.totalSpent - this.totalAmount) / this.totalAmount) * 100 : 0,
      status: 'on-track' // Will be updated below
    },
    alerts: []
  };
  
  // Calculate expected spending based on time elapsed
  const expectedSpending = (this.periodProgress / 100) * this.totalAmount;
  performance.variance.timeVariance = this.totalSpent - expectedSpending;
  performance.variance.timeVariancePercentage = expectedSpending > 0 ? ((this.totalSpent - expectedSpending) / expectedSpending) * 100 : 0;
  
  // Determine status
  if (this.totalSpent > this.totalAmount) {
    performance.variance.status = 'over-budget';
  } else if (this.utilizationPercentage >= this.alertThreshold) {
    performance.variance.status = 'warning';
  } else {
    performance.variance.status = 'on-track';
  }
  
  // Category performance analysis
  this.categoryAllocations.forEach(allocation => {
    const categoryPerformance = {
      category: allocation.category,
      allocated: allocation.adjustedAmount,
      spent: allocation.spentAmount,
      remaining: allocation.remainingAmount,
      overspent: allocation.overspentAmount,
      utilizationPercentage: allocation.utilizationPercentage,
      status: allocation.utilizationPercentage > 100 ? 'over-budget' : 
              allocation.utilizationPercentage >= this.alertThreshold ? 'warning' : 'on-track'
    };
    
    performance.categories.push(categoryPerformance);
    
    // Generate alerts
    if (categoryPerformance.status === 'over-budget') {
      performance.alerts.push({
        type: 'overspent',
        category: allocation.category,
        amount: allocation.overspentAmount,
        message: `Over budget by $${allocation.overspentAmount.toFixed(2)}`
      });
    } else if (categoryPerformance.status === 'warning') {
      performance.alerts.push({
        type: 'warning',
        category: allocation.category,
        utilizationPercentage: allocation.utilizationPercentage,
        message: `${allocation.utilizationPercentage.toFixed(1)}% of budget used`
      });
    }
  });
  
  return performance;
};

// Check budget violations for overspending alerts
budgetSchema.methods.checkBudgetViolations = async function() {
  await this.calculateSpentAmount();
  
  const violations = [];
  
  // Check overall budget violation
  if (this.totalSpent > this.totalAmount) {
    violations.push({
      type: 'budget_exceeded',
      level: 'critical',
      amount: this.totalSpent - this.totalAmount,
      percentage: ((this.totalSpent - this.totalAmount) / this.totalAmount) * 100,
      message: `Budget exceeded by $${(this.totalSpent - this.totalAmount).toFixed(2)}`
    });
  } else if (this.utilizationPercentage >= this.alertThreshold) {
    violations.push({
      type: 'budget_warning',
      level: 'warning',
      percentage: this.utilizationPercentage,
      message: `${this.utilizationPercentage.toFixed(1)}% of budget used`
    });
  }
  
  // Check category violations
  this.categoryAllocations.forEach(allocation => {
    if (allocation.spentAmount > allocation.adjustedAmount) {
      violations.push({
        type: 'category_exceeded',
        level: 'critical',
        category: allocation.category,
        amount: allocation.spentAmount - allocation.adjustedAmount,
        percentage: ((allocation.spentAmount - allocation.adjustedAmount) / allocation.adjustedAmount) * 100,
        message: `Category exceeded by $${(allocation.spentAmount - allocation.adjustedAmount).toFixed(2)}`
      });
    } else if (allocation.utilizationPercentage >= this.alertThreshold) {
      violations.push({
        type: 'category_warning',
        level: 'warning',
        category: allocation.category,
        percentage: allocation.utilizationPercentage,
        message: `${allocation.utilizationPercentage.toFixed(1)}% of category budget used`
      });
    }
  });
  
  return violations;
};

// Get remaining budget amounts
budgetSchema.methods.getRemainingBudget = async function() {
  await this.calculateSpentAmount();
  
  const remaining = {
    total: this.totalRemaining,
    daily: this.daysRemaining > 0 ? this.totalRemaining / this.daysRemaining : 0,
    categories: {}
  };
  
  this.categoryAllocations.forEach(allocation => {
    remaining.categories[allocation.category.toString()] = {
      allocated: allocation.adjustedAmount,
      spent: allocation.spentAmount,
      remaining: allocation.remainingAmount,
      dailyRemaining: this.daysRemaining > 0 ? allocation.remainingAmount / this.daysRemaining : 0
    };
  });
  
  return remaining;
};

// Add or update category allocation
budgetSchema.methods.addCategoryAllocation = function(categoryId, amount, notes = '') {
  const existingIndex = this.categoryAllocations.findIndex(
    alloc => alloc.category.toString() === categoryId.toString()
  );
  
  if (existingIndex >= 0) {
    // Update existing allocation
    this.categoryAllocations[existingIndex].allocatedAmount = amount;
    if (notes) this.categoryAllocations[existingIndex].notes = notes;
  } else {
    // Add new allocation
    this.categoryAllocations.push({
      category: categoryId,
      allocatedAmount: amount,
      notes: notes
    });
  }
  
  return this.save();
};

// Remove category allocation
budgetSchema.methods.removeCategoryAllocation = function(categoryId) {
  this.categoryAllocations = this.categoryAllocations.filter(
    alloc => alloc.category.toString() !== categoryId.toString()
  );
  
  return this.save();
};

// Apply rollover from previous budget
budgetSchema.methods.applyRollover = async function(previousBudgetId) {
  if (!this.rolloverEnabled) {
    throw new Error('Rollover is not enabled for this budget');
  }
  
  const previousBudget = await this.constructor.findById(previousBudgetId);
  if (!previousBudget || !previousBudget.user.equals(this.user)) {
    throw new Error('Previous budget not found or access denied');
  }
  
  await previousBudget.calculateSpentAmount();
  
  // Apply rollover for each category
  this.categoryAllocations.forEach(allocation => {
    const previousAllocation = previousBudget.categoryAllocations.find(
      prevAlloc => prevAlloc.category.toString() === allocation.category.toString()
    );
    
    if (previousAllocation && previousAllocation.remainingAmount > 0) {
      allocation.rolloverAmount = previousAllocation.remainingAmount;
      allocation.adjustedAmount = allocation.allocatedAmount + allocation.rolloverAmount;
    }
  });
  
  return this.save();
};

// Soft delete budget
budgetSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Restore soft deleted budget
budgetSchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = undefined;
  return this.save();
};

// Static Methods

// Find active budgets for a user
budgetSchema.statics.findActiveBudgets = function(userId, options = {}) {
  const {
    period = null,
    includeExpired = false,
    limit = 20,
    skip = 0
  } = options;
  
  const filter = {
    user: userId,
    isActive: true,
    isDeleted: { $ne: true }
  };
  
  if (period) {
    filter.period = period;
  }
  
  if (!includeExpired) {
    filter.endDate = { $gte: new Date() };
  }
  
  return this.find(filter)
    .populate('categoryAllocations.category', 'name type color icon')
    .sort({ startDate: -1 })
    .limit(limit)
    .skip(skip);
};

// Find budgets by date range
budgetSchema.statics.findBudgetsByDateRange = function(userId, startDate, endDate, options = {}) {
  const {
    includeInactive = false,
    includeDeleted = false
  } = options;
  
  const filter = {
    user: userId,
    $or: [
      {
        startDate: { $lte: endDate },
        endDate: { $gte: startDate }
      }
    ]
  };
  
  if (!includeInactive) {
    filter.isActive = true;
  }
  
  if (!includeDeleted) {
    filter.isDeleted = { $ne: true };
  }
  
  return this.find(filter)
    .populate('categoryAllocations.category', 'name type color icon')
    .sort({ startDate: -1 });
};

// Get current budget for a user
budgetSchema.statics.getCurrentBudget = function(userId, period = 'monthly') {
  const now = new Date();
  
  return this.findOne({
    user: userId,
    period: period,
    startDate: { $lte: now },
    endDate: { $gte: now },
    isActive: true,
    isDeleted: { $ne: true }
  }).populate('categoryAllocations.category', 'name type color icon');
};

// Create budget from template
budgetSchema.statics.createFromTemplate = async function(templateBudgetId, newBudgetData) {
  const template = await this.findById(templateBudgetId);
  if (!template) {
    throw new Error('Template budget not found');
  }
  
  const newBudget = new this({
    ...template.toObject(),
    _id: new mongoose.Types.ObjectId(),
    ...newBudgetData,
    totalSpent: 0,
    utilizationPercentage: 0,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // Reset spent amounts in category allocations
  newBudget.categoryAllocations.forEach(allocation => {
    allocation._id = new mongoose.Types.ObjectId();
    allocation.spentAmount = 0;
    allocation.rolloverAmount = 0;
    allocation.adjustedAmount = allocation.allocatedAmount;
  });
  
  return newBudget.save();
};

// Get budget analytics for a user
budgetSchema.statics.getBudgetAnalytics = async function(userId, options = {}) {
  const {
    period = 'monthly',
    months = 12
  } = options;
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  const analytics = await this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        period: period,
        startDate: { $gte: startDate },
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$startDate' },
          month: { $month: '$startDate' }
        },
        totalBudget: { $sum: '$totalAmount' },
        totalSpent: { $sum: '$totalSpent' },
        avgUtilization: { $avg: '$utilizationPercentage' },
        budgetCount: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': -1, '_id.month': -1 }
    },
    { $limit: months }
  ]);
  
  return analytics;
};

// Cleanup old deleted budgets
budgetSchema.statics.cleanupDeletedBudgets = function(olderThanDays = 90) {
  const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
  
  return this.deleteMany({
    isDeleted: true,
    deletedAt: { $lt: cutoffDate }
  });
};

// Export the model
module.exports = mongoose.model('Budget', budgetSchema);
