const mongoose = require('mongoose');
const validator = require('validator');

// Contribution subdocument schema
const contributionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Contribution amount is required'],
    min: [0.01, 'Contribution amount must be greater than 0'],
    validate: {
      validator: function(amount) {
        // Validate decimal precision (max 2 decimal places)
        return Number.isFinite(amount) && /^\d+(\.\d{1,2})?$/.test(amount.toString());
      },
      message: 'Contribution amount must have maximum 2 decimal places'
    }
  },
  
  date: {
    type: Date,
    required: [true, 'Contribution date is required'],
    default: Date.now,
    validate: {
      validator: function(date) {
        // Contribution date cannot be in the future
        return date <= new Date();
      },
      message: 'Contribution date cannot be in the future'
    }
  },
  
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Contribution notes cannot exceed 500 characters']
  },
  
  method: {
    type: String,
    enum: {
      values: ['manual', 'automatic', 'transfer', 'external'],
      message: 'Contribution method must be one of: manual, automatic, transfer, external'
    },
    default: 'manual'
  },
  
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    validate: {
      validator: async function(transactionId) {
        if (!transactionId) return true; // Optional field
        
        const Transaction = mongoose.model('Transaction');
        const transaction = await Transaction.findById(transactionId);
        
        if (!transaction) {
          throw new Error('Referenced transaction does not exist');
        }
        
        if (!transaction.user.equals(this.parent().user)) {
          throw new Error('Transaction must belong to the same user as the goal');
        }
        
        return true;
      },
      message: 'Invalid transaction reference'
    }
  },
  
  source: {
    type: String,
    trim: true,
    maxlength: [100, 'Contribution source cannot exceed 100 characters']
  }
}, {
  _id: true,
  timestamps: true
});

// Main Goal Schema
const goalSchema = new mongoose.Schema({
  // Goal definition
  name: {
    type: String,
    required: [true, 'Goal name is required'],
    trim: true,
    minlength: [2, 'Goal name must be at least 2 characters'],
    maxlength: [100, 'Goal name cannot exceed 100 characters']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Goal description cannot exceed 1000 characters']
  },
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true
  },
  
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    validate: {
      validator: async function(categoryId) {
        if (!categoryId) return true; // Optional field
        
        const Category = mongoose.model('Category');
        const category = await Category.findById(categoryId);
        
        if (!category) {
          throw new Error('Category does not exist');
        }
        
        if (!category.user.equals(this.user)) {
          throw new Error('Category must belong to the same user as the goal');
        }
        
        return true;
      },
      message: 'Invalid category reference'
    }
  },
  
  // Financial details
  targetAmount: {
    type: Number,
    required: [true, 'Target amount is required'],
    min: [0.01, 'Target amount must be greater than 0'],
    validate: {
      validator: function(amount) {
        // Validate decimal precision (max 2 decimal places)
        return Number.isFinite(amount) && /^\d+(\.\d{1,2})?$/.test(amount.toString());
      },
      message: 'Target amount must have maximum 2 decimal places'
    }
  },
  
  currentAmount: {
    type: Number,
    default: 0,
    min: [0, 'Current amount cannot be negative'],
    validate: {
      validator: function(amount) {
        // Validate decimal precision (max 2 decimal places)
        return Number.isFinite(amount) && /^\d+(\.\d{1,2})?$/.test(amount.toString());
      },
      message: 'Current amount must have maximum 2 decimal places'
    }
  },
  
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
    minlength: [3, 'Currency code must be 3 characters'],
    maxlength: [3, 'Currency code must be 3 characters']
  },
  
  // Timeline tracking
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    default: Date.now,
    validate: {
      validator: function(startDate) {
        // Start date should not be more than 1 year in the past for new goals
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
  
  targetDate: {
    type: Date,
    required: [true, 'Target date is required'],
    validate: {
      validator: function(targetDate) {
        return targetDate > this.startDate;
      },
      message: 'Target date must be after start date'
    },
    index: true
  },
  
  // Goal management
  status: {
    type: String,
    required: [true, 'Goal status is required'],
    enum: {
      values: ['active', 'completed', 'paused', 'cancelled'],
      message: 'Status must be one of: active, completed, paused, cancelled'
    },
    default: 'active',
    lowercase: true,
    index: true
  },
  
  priority: {
    type: String,
    required: [true, 'Goal priority is required'],
    enum: {
      values: ['low', 'medium', 'high'],
      message: 'Priority must be one of: low, medium, high'
    },
    default: 'medium',
    lowercase: true,
    index: true
  },
  
  progressPercentage: {
    type: Number,
    default: 0,
    min: [0, 'Progress percentage cannot be negative'],
    max: [200, 'Progress percentage cap at 200%'] // Allow overachievement tracking
  },
  
  // Contribution history
  contributions: {
    type: [contributionSchema],
    default: []
  },
  
  // Notification settings
  reminderFrequency: {
    type: String,
    enum: {
      values: ['none', 'daily', 'weekly', 'monthly'],
      message: 'Reminder frequency must be one of: none, daily, weekly, monthly'
    },
    default: 'monthly',
    lowercase: true
  },
  
  milestoneAlerts: {
    type: Boolean,
    default: true
  },
  
  milestonePercentages: [{
    type: Number,
    min: [1, 'Milestone percentage must be at least 1%'],
    max: [100, 'Milestone percentage cannot exceed 100%']
  }],
  
  lastReminderSent: {
    type: Date
  },
  
  nextReminderDate: {
    type: Date
  },
  
  // Visual customization
  icon: {
    type: String,
    trim: true,
    maxlength: [50, 'Icon identifier cannot exceed 50 characters'],
    validate: {
      validator: function(icon) {
        if (!icon) return true; // Optional field
        // Icon format validation (alphanumeric, underscore, hyphen)
        return /^[a-z0-9_-]+$/i.test(icon);
      },
      message: 'Icon identifier can only contain letters, numbers, underscores, and hyphens'
    }
  },
  
  colorTheme: {
    type: String,
    trim: true,
    validate: {
      validator: function(color) {
        if (!color) return true; // Optional field
        // Hex color validation (#RRGGBB or #RGB)
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
      },
      message: 'Color theme must be a valid hex color code'
    }
  },
  
  // Goal type and settings
  goalType: {
    type: String,
    enum: {
      values: ['savings', 'debt_payoff', 'investment', 'purchase', 'emergency_fund', 'other'],
      message: 'Goal type must be one of: savings, debt_payoff, investment, purchase, emergency_fund, other'
    },
    default: 'savings',
    lowercase: true
  },
  
  isRecurring: {
    type: Boolean,
    default: false
  },
  
  autoContribution: {
    enabled: {
      type: Boolean,
      default: false
    },
    amount: {
      type: Number,
      min: [0, 'Auto contribution amount cannot be negative'],
      validate: {
        validator: function(amount) {
          if (amount === undefined || amount === null) return true;
          return Number.isFinite(amount) && /^\d+(\.\d{1,2})?$/.test(amount.toString());
        },
        message: 'Auto contribution amount must have maximum 2 decimal places'
      }
    },
    frequency: {
      type: String,
      enum: {
        values: ['weekly', 'biweekly', 'monthly'],
        message: 'Auto contribution frequency must be one of: weekly, biweekly, monthly'
      },
      default: 'monthly'
    },
    nextContributionDate: {
      type: Date
    }
  },
  
  // Tracking and metadata
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
  
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },
  
  // Achievement tracking
  achievementDate: {
    type: Date
  },
  
  overachievementAmount: {
    type: Number,
    default: 0,
    min: [0, 'Overachievement amount cannot be negative']
  },
  
  // Analytics data
  averageMonthlyContribution: {
    type: Number,
    default: 0
  },
  
  estimatedCompletionDate: {
    type: Date
  },
  
  achievementProbability: {
    type: Number,
    min: [0, 'Achievement probability cannot be negative'],
    max: [100, 'Achievement probability cannot exceed 100%']
  },
  
  // Audit trail
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  
  deletedAt: {
    type: Date
  },
  
  lastCalculated: {
    type: Date,
    default: Date.now
  },
  
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for remaining amount
goalSchema.virtual('remainingAmount').get(function() {
  return Math.max(0, this.targetAmount - this.currentAmount);
});

// Virtual for time remaining
goalSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  if (now >= this.targetDate) return 0;
  return Math.ceil((this.targetDate - now) / (1000 * 60 * 60 * 24)); // Days
});

// Virtual for time elapsed
goalSchema.virtual('timeElapsed').get(function() {
  const now = new Date();
  if (now <= this.startDate) return 0;
  return Math.floor((Math.min(now, this.targetDate) - this.startDate) / (1000 * 60 * 60 * 24)); // Days
});

// Virtual for total timeline duration
goalSchema.virtual('totalTimeframe').get(function() {
  return Math.ceil((this.targetDate - this.startDate) / (1000 * 60 * 60 * 24)); // Days
});

// Virtual for timeline progress percentage
goalSchema.virtual('timelineProgress').get(function() {
  const totalDays = this.totalTimeframe;
  if (totalDays === 0) return 100;
  return Math.min(100, (this.timeElapsed / totalDays) * 100);
});

// Virtual for daily required contribution
goalSchema.virtual('dailyRequiredContribution').get(function() {
  const daysRemaining = this.timeRemaining;
  const amountRemaining = this.remainingAmount;
  return daysRemaining > 0 ? amountRemaining / daysRemaining : 0;
});

// Compound indexes for performance optimization
goalSchema.index({ user: 1, status: 1 }); // Goal filtering by user and status
goalSchema.index({ user: 1, priority: 1, targetDate: 1 }); // Priority-based goal lists
goalSchema.index({ user: 1, goalType: 1, isActive: 1 }); // Goal type filtering
goalSchema.index({ user: 1, targetDate: 1, status: 1 }); // Deadline tracking
goalSchema.index({ tags: 1, user: 1 }); // Tag-based filtering
goalSchema.index({ user: 1, isDeleted: 1, updatedAt: -1 }); // Non-deleted goals

// Text index for search functionality
goalSchema.index({
  name: 'text',
  description: 'text',
  notes: 'text'
});

// Pre-save middleware
goalSchema.pre('save', async function(next) {
  try {
    // Calculate progress percentage
    if (this.targetAmount > 0) {
      this.progressPercentage = Math.min(200, (this.currentAmount / this.targetAmount) * 100);
    }
    
    // Set achievement date when goal is completed
    if (this.status === 'completed' && !this.achievementDate) {
      this.achievementDate = new Date();
    }
    
    // Calculate overachievement amount
    if (this.currentAmount > this.targetAmount) {
      this.overachievementAmount = this.currentAmount - this.targetAmount;
    } else {
      this.overachievementAmount = 0;
    }
    
    // Set deletion timestamp
    if (this.isDeleted && !this.deletedAt) {
      this.deletedAt = new Date();
    }
    
    // Clear deletion timestamp if undeleted
    if (!this.isDeleted && this.deletedAt) {
      this.deletedAt = undefined;
    }
    
    // Update last calculated timestamp
    this.lastCalculated = new Date();
    
    // Increment version on significant changes
    if (this.isModified('targetAmount') || this.isModified('contributions') || this.isModified('currentAmount')) {
      this.version += 1;
    }
    
    // Set default milestone percentages if not set
    if (this.milestoneAlerts && this.milestonePercentages.length === 0) {
      this.milestonePercentages = [25, 50, 75, 90, 100];
    }
    
    // Calculate next reminder date
    if (this.reminderFrequency !== 'none' && this.status === 'active') {
      this.calculateNextReminderDate();
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance Methods

// Calculate progress percentage
goalSchema.methods.calculateProgress = function() {
  if (this.targetAmount <= 0) return 0;
  return Math.min(200, (this.currentAmount / this.targetAmount) * 100);
};

// Estimate completion date based on contribution rate
goalSchema.methods.estimateCompletionDate = function() {
  if (this.currentAmount >= this.targetAmount) {
    return this.achievementDate || new Date();
  }
  
  const remainingAmount = this.remainingAmount;
  if (remainingAmount <= 0) return new Date();
  
  // Calculate average monthly contribution from contribution history
  const monthlyContributions = this.getMonthlyContributionAverage();
  
  if (monthlyContributions <= 0) {
    // Fallback to time-based calculation
    const monthsRemaining = Math.ceil(this.timeRemaining / 30);
    const estimatedDate = new Date();
    estimatedDate.setMonth(estimatedDate.getMonth() + monthsRemaining);
    return estimatedDate;
  }
  
  const monthsToCompletion = Math.ceil(remainingAmount / monthlyContributions);
  const estimatedDate = new Date();
  estimatedDate.setMonth(estimatedDate.getMonth() + monthsToCompletion);
  
  this.estimatedCompletionDate = estimatedDate;
  return estimatedDate;
};

// Get required monthly contribution for timeline goals
goalSchema.methods.getRequiredMonthlyContribution = function() {
  const remainingAmount = this.remainingAmount;
  const monthsRemaining = Math.max(1, Math.ceil(this.timeRemaining / 30));
  
  return remainingAmount / monthsRemaining;
};

// Add contribution with progress updates
goalSchema.methods.addContribution = async function(contributionData) {
  const { amount, notes, method = 'manual', source, transactionId } = contributionData;
  
  // Validate contribution amount
  if (!amount || amount <= 0) {
    throw new Error('Contribution amount must be greater than 0');
  }
  
  // Create contribution object
  const contribution = {
    amount: amount,
    date: new Date(),
    notes: notes,
    method: method,
    source: source,
    transactionId: transactionId
  };
  
  // Add to contributions array
  this.contributions.push(contribution);
  
  // Update current amount
  this.currentAmount += amount;
  
  // Update progress percentage
  this.progressPercentage = this.calculateProgress();
  
  // Check if goal is completed
  if (this.currentAmount >= this.targetAmount && this.status === 'active') {
    this.status = 'completed';
    this.achievementDate = new Date();
  }
  
  // Recalculate analytics
  this.averageMonthlyContribution = this.getMonthlyContributionAverage();
  this.estimatedCompletionDate = this.estimateCompletionDate();
  this.achievementProbability = this.getAchievementProbability();
  
  return this.save();
};

// Get achievement probability using trend analysis
goalSchema.methods.getAchievementProbability = function() {
  if (this.currentAmount >= this.targetAmount) return 100;
  if (this.timeRemaining <= 0) return 0;
  
  const monthlyAverage = this.getMonthlyContributionAverage();
  const requiredMonthly = this.getRequiredMonthlyContribution();
  
  if (monthlyAverage <= 0) return 50; // Default probability
  
  // Calculate probability based on contribution rate vs required rate
  const ratio = monthlyAverage / requiredMonthly;
  
  let probability;
  if (ratio >= 1.2) {
    probability = 95; // Very likely
  } else if (ratio >= 1.0) {
    probability = 85; // Likely
  } else if (ratio >= 0.8) {
    probability = 65; // Moderately likely
  } else if (ratio >= 0.6) {
    probability = 45; // Somewhat likely
  } else if (ratio >= 0.4) {
    probability = 25; // Unlikely
  } else {
    probability = 10; // Very unlikely
  }
  
  // Adjust for time factor
  const timeProgress = this.timelineProgress;
  const goalProgress = this.progressPercentage;
  
  if (goalProgress > timeProgress) {
    probability += 10; // Ahead of schedule
  } else if (goalProgress < timeProgress * 0.7) {
    probability -= 15; // Behind schedule
  }
  
  this.achievementProbability = Math.max(0, Math.min(100, probability));
  return this.achievementProbability;
};

// Get monthly contribution average
goalSchema.methods.getMonthlyContributionAverage = function() {
  if (this.contributions.length === 0) return 0;
  
  const now = new Date();
  const monthsElapsed = Math.max(1, (now - this.startDate) / (1000 * 60 * 60 * 24 * 30));
  
  const totalContributions = this.contributions.reduce((sum, contrib) => sum + contrib.amount, 0);
  
  this.averageMonthlyContribution = totalContributions / monthsElapsed;
  return this.averageMonthlyContribution;
};

// Calculate next reminder date
goalSchema.methods.calculateNextReminderDate = function() {
  if (this.reminderFrequency === 'none' || this.status !== 'active') {
    this.nextReminderDate = undefined;
    return;
  }
  
  const now = new Date();
  const nextDate = new Date(this.lastReminderSent || now);
  
  switch (this.reminderFrequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }
  
  this.nextReminderDate = nextDate;
};

// Get contribution statistics
goalSchema.methods.getContributionStats = function() {
  if (this.contributions.length === 0) {
    return {
      totalContributions: 0,
      averageContribution: 0,
      largestContribution: 0,
      lastContribution: null,
      contributionFrequency: 0
    };
  }
  
  const contributions = this.contributions.sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalAmount = contributions.reduce((sum, contrib) => sum + contrib.amount, 0);
  
  return {
    totalContributions: contributions.length,
    averageContribution: totalAmount / contributions.length,
    largestContribution: Math.max(...contributions.map(c => c.amount)),
    lastContribution: contributions[0],
    contributionFrequency: this.getMonthlyContributionAverage()
  };
};

// Soft delete goal
goalSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.isActive = false;
  this.deletedAt = new Date();
  return this.save();
};

// Restore soft deleted goal
goalSchema.methods.restore = function() {
  this.isDeleted = false;
  this.isActive = true;
  this.deletedAt = undefined;
  return this.save();
};

// Static Methods

// Find active goals for a user
goalSchema.statics.findActiveGoals = function(userId, options = {}) {
  const {
    status = null,
    priority = null,
    goalType = null,
    limit = 20,
    skip = 0,
    sortBy = 'priority',
    sortOrder = -1
  } = options;
  
  const filter = {
    user: userId,
    isActive: true,
    isDeleted: { $ne: true }
  };
  
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (goalType) filter.goalType = goalType;
  
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder;
  
  return this.find(filter)
    .populate('category', 'name type color icon')
    .sort(sortOptions)
    .limit(limit)
    .skip(skip);
};

// Find goals by deadline (upcoming)
goalSchema.statics.findGoalsByDeadline = function(userId, days = 30) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    user: userId,
    targetDate: {
      $gte: now,
      $lte: futureDate
    },
    status: 'active',
    isActive: true,
    isDeleted: { $ne: true }
  })
  .populate('category', 'name type color icon')
  .sort({ targetDate: 1 });
};

// Get goal analytics for a user
goalSchema.statics.getGoalAnalytics = async function(userId, options = {}) {
  const {
    period = 'all' // 'all', 'year', 'month'
  } = options;
  
  let dateFilter = {};
  if (period === 'year') {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    dateFilter = { createdAt: { $gte: yearAgo } };
  } else if (period === 'month') {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    dateFilter = { createdAt: { $gte: monthAgo } };
  }
  
  const analytics = await this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        isDeleted: { $ne: true },
        ...dateFilter
      }
    },
    {
      $group: {
        _id: {
          status: '$status',
          goalType: '$goalType',
          priority: '$priority'
        },
        count: { $sum: 1 },
        totalTargetAmount: { $sum: '$targetAmount' },
        totalCurrentAmount: { $sum: '$currentAmount' },
        avgProgress: { $avg: '$progressPercentage' },
        avgAchievementProbability: { $avg: '$achievementProbability' }
      }
    },
    {
      $group: {
        _id: null,
        byStatus: {
          $push: {
            status: '$_id.status',
            count: '$count',
            totalTargetAmount: '$totalTargetAmount',
            totalCurrentAmount: '$totalCurrentAmount',
            avgProgress: '$avgProgress'
          }
        },
        byType: {
          $push: {
            goalType: '$_id.goalType',
            count: '$count',
            totalTargetAmount: '$totalTargetAmount',
            totalCurrentAmount: '$totalCurrentAmount'
          }
        },
        byPriority: {
          $push: {
            priority: '$_id.priority',
            count: '$count',
            avgAchievementProbability: '$avgAchievementProbability'
          }
        },
        totalGoals: { $sum: '$count' },
        overallTargetAmount: { $sum: '$totalTargetAmount' },
        overallCurrentAmount: { $sum: '$totalCurrentAmount' }
      }
    }
  ]);
  
  return analytics.length > 0 ? analytics[0] : null;
};

// Find goals needing reminders
goalSchema.statics.findGoalsNeedingReminders = function(frequency = null) {
  const now = new Date();
  
  const query = {
    status: 'active',
    isActive: true,
    isDeleted: { $ne: true },
    reminderFrequency: { $ne: 'none' },
    nextReminderDate: { $lte: now }
  };

  // If frequency is specified, filter by that frequency
  if (frequency) {
    query.reminderFrequency = frequency;
  }
  
  return this.find(query)
    .populate('user', 'email firstName lastName notificationPreferences')
    .populate('category', 'name type color icon');
};

// Create goal from template
goalSchema.statics.createFromTemplate = async function(templateGoalId, newGoalData) {
  const template = await this.findById(templateGoalId);
  if (!template) {
    throw new Error('Template goal not found');
  }
  
  const newGoal = new this({
    ...template.toObject(),
    _id: new mongoose.Types.ObjectId(),
    ...newGoalData,
    currentAmount: 0,
    contributions: [],
    progressPercentage: 0,
    achievementDate: undefined,
    overachievementAmount: 0,
    lastReminderSent: undefined,
    nextReminderDate: undefined,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  return newGoal.save();
};

// Get completion trends
goalSchema.statics.getCompletionTrends = async function(userId, months = 12) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  return this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        status: 'completed',
        achievementDate: {
          $gte: startDate,
          $lte: endDate
        },
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$achievementDate' },
          month: { $month: '$achievementDate' }
        },
        completedGoals: { $sum: 1 },
        totalAmountAchieved: { $sum: '$targetAmount' },
        avgTimeToCompletion: {
          $avg: {
            $divide: [
              { $subtract: ['$achievementDate', '$startDate'] },
              1000 * 60 * 60 * 24 // Convert to days
            ]
          }
        }
      }
    },
    {
      $sort: { '_id.year': -1, '_id.month': -1 }
    },
    { $limit: months }
  ]);
};

// Cleanup old deleted goals
goalSchema.statics.cleanupDeletedGoals = function(olderThanDays = 90) {
  const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
  
  return this.deleteMany({
    isDeleted: true,
    deletedAt: { $lt: cutoffDate }
  });
};

// Export the model
module.exports = mongoose.model('Goal', goalSchema);
