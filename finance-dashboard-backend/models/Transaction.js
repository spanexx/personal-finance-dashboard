const mongoose = require('mongoose');
const validator = require('validator');

// File attachment subdocument schema
const attachmentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: [true, 'Attachment filename is required'],
    trim: true,
    maxlength: [255, 'Filename cannot exceed 255 characters']
  },
  
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true,
    maxlength: [255, 'Original filename cannot exceed 255 characters']
  },
  
  path: {
    type: String,
    required: [true, 'File path is required'],
    trim: true
  },
  
  mimeType: {
    type: String,
    required: [true, 'File MIME type is required'],
    validate: {
      validator: function(mimeType) {
        // Allow common receipt/document formats
        const allowedTypes = [
          'image/jpeg',
          'image/jpg', 
          'image/png',
          'image/webp',
          'application/pdf',
          'text/plain'
        ];
        return allowedTypes.includes(mimeType);
      },
      message: 'File type must be JPEG, PNG, WebP, PDF, or TXT'
    }
  },
  
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [1, 'File size must be greater than 0'],
    max: [10485760, 'File size cannot exceed 10MB'] // 10MB limit
  },
  
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true
});

// Recurring transaction configuration schema
const recurringConfigSchema = new mongoose.Schema({
  frequency: {
    type: String,
    required: [true, 'Recurring frequency is required'],
    enum: {
      values: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'],
      message: 'Frequency must be one of: daily, weekly, biweekly, monthly, quarterly, yearly'
    }
  },
  
  interval: {
    type: Number,
    required: [true, 'Recurring interval is required'],
    min: [1, 'Interval must be at least 1'],
    max: [365, 'Interval cannot exceed 365']
  },
  
  endDate: {
    type: Date,
    validate: {
      validator: function(endDate) {
        if (!endDate) return true; // End date is optional
        return endDate > this.parent().date;
      },
      message: 'End date must be after transaction date'
    }
  },
  
  maxOccurrences: {
    type: Number,
    min: [1, 'Max occurrences must be at least 1'],
    max: [999, 'Max occurrences cannot exceed 999']
  },
  
  nextDueDate: {
    type: Date,
    required: [true, 'Next due date is required for recurring transactions']
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  occurrenceCount: {
    type: Number,
    default: 0,
    min: [0, 'Occurrence count cannot be negative']
  }
}, {
  _id: false
});

// Location coordinates schema
const locationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    min: [-90, 'Latitude must be between -90 and 90'],
    max: [90, 'Latitude must be between -90 and 90']
  },
  
  longitude: {
    type: Number,
    min: [-180, 'Longitude must be between -180 and 180'],
    max: [180, 'Longitude must be between -180 and 180']
  },
  
  address: {
    type: String,
    trim: true,
    maxlength: [200, 'Address cannot exceed 200 characters']
  }
}, {
  _id: false
});

// Main Transaction Schema
const transactionSchema = new mongoose.Schema({
  // Core transaction data
  amount: {
    type: Number,
    required: [true, 'Transaction amount is required'],
    min: [0.01, 'Amount must be greater than 0'],
    validate: {
      validator: function(amount) {
        // Validate decimal precision (max 2 decimal places)
        return Number.isFinite(amount) && /^\d+(\.\d{1,2})?$/.test(amount.toString());
      },
      message: 'Amount must have maximum 2 decimal places'
    }
  },
  
  type: {
    type: String,
    required: [true, 'Transaction type is required'],
    enum: {
      values: ['income', 'expense', 'transfer'],
      message: 'Transaction type must be income, expense, or transfer'
    },
    lowercase: true,
    index: true
  },
  
  date: {
    type: Date,
    required: [true, 'Transaction date is required'],
    validate: {
      validator: function(date) {
        // Allow future dates only for scheduled/recurring transactions
        if (this.isRecurring || this.status === 'scheduled') {
          return true;
        }
        // For completed transactions, date should not be in future
        return date <= new Date();
      },
      message: 'Transaction date cannot be in the future for completed transactions'
    },
    index: true
  },
  
  description: {
    type: String,
    required: [true, 'Transaction description is required'],
    trim: true,
    minlength: [2, 'Description must be at least 2 characters'],
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  
  // User and category references
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true
  },
  
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category reference is required'],
    validate: {
      validator: async function(categoryId) {
        if (!categoryId) return false;
        
        const Category = mongoose.model('Category');
        const category = await Category.findById(categoryId);
        
        if (!category) {
          throw new Error('Category does not exist');
        }
        
        if (!category.user.equals(this.user)) {
          throw new Error('Category must belong to the same user');
        }
        
        // Validate category type matches transaction type
        if (this.type !== 'transfer' && category.type !== this.type) {
          throw new Error('Category type must match transaction type');
        }
        
        return true;
      },
      message: 'Invalid category reference'
    },
    index: true
  },
  
  // Optional details
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  
  payee: {
    type: String,
    trim: true,
    maxlength: [100, 'Payee name cannot exceed 100 characters']
  },
  
  location: locationSchema,
  
  // Transfer-specific fields
  toAccount: {
    type: String,
    trim: true,
    maxlength: [100, 'To account cannot exceed 100 characters'],
    validate: {
      validator: function(toAccount) {
        // Required for transfer transactions
        if (this.type === 'transfer') {
          return toAccount && toAccount.length > 0;
        }
        return true;
      },
      message: 'To account is required for transfer transactions'
    }
  },
  
  fromAccount: {
    type: String,
    trim: true,
    maxlength: [100, 'From account cannot exceed 100 characters'],
    validate: {
      validator: function(fromAccount) {
        // Required for transfer transactions
        if (this.type === 'transfer') {
          return fromAccount && fromAccount.length > 0;
        }
        return true;
      },
      message: 'From account is required for transfer transactions'
    }
  },
  
  // Recurring transaction support
  isRecurring: {
    type: Boolean,
    default: false,
    index: true
  },
  
  recurringConfig: {
    type: recurringConfigSchema,
    validate: {
      validator: function(config) {
        // Required if transaction is recurring
        if (this.isRecurring) {
          return config && config.frequency;
        }
        return true;
      },
      message: 'Recurring configuration is required for recurring transactions'
    }
  },
  
  parentTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    validate: {
      validator: function(parentId) {
        // Only recurring instances should have parent transactions
        if (parentId && !this.isRecurringInstance) {
          throw new Error('Only recurring instances can have parent transactions');
        }
        return true;
      },
      message: 'Invalid parent transaction reference'
    }
  },
  
  isRecurringInstance: {
    type: Boolean,
    default: false
  },
  
  // Tagging system
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
  
  // File attachments
  attachments: {
    type: [attachmentSchema],
    validate: {
      validator: function(attachments) {
        return attachments.length <= 5; // Maximum 5 attachments per transaction
      },
      message: 'Cannot have more than 5 attachments per transaction'
    }
  },
  
  // Transaction status
  status: {
    type: String,
    enum: {
      values: ['completed', 'pending', 'scheduled', 'cancelled'],
      message: 'Status must be completed, pending, scheduled, or cancelled'
    },
    default: 'completed',
    index: true
  },
  
  // Reference number (for tracking)
  referenceNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Reference number cannot exceed 50 characters']
  },
    // External transaction ID (for bank imports)
  externalId: {
    type: String,
    trim: true,
    maxlength: [100, 'External ID cannot exceed 100 characters']
  },
  
  // Balance impact tracking
  balanceImpact: {
    type: Number,
    default: function() {
      return this.calculateBalanceImpact();
    }
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

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function() {
  const sign = this.type === 'expense' ? '-' : '+';
  return `${sign}$${this.amount.toFixed(2)}`;
});

// Virtual for age in days
transactionSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.date.getTime()) / (1000 * 60 * 60 * 24));
});

// Compound indexes for performance optimization
transactionSchema.index({ user: 1, date: -1 }); // Timeline views (most recent first)
transactionSchema.index({ user: 1, category: 1, type: 1 }); // Category and type filtering
transactionSchema.index({ user: 1, status: 1, date: -1 }); // Status-based queries
transactionSchema.index({ user: 1, isRecurring: 1, 'recurringConfig.nextDueDate': 1 }); // Recurring transaction processing
transactionSchema.index({ user: 1, isDeleted: 1, date: -1 }); // Active transactions
transactionSchema.index({ tags: 1, user: 1 }); // Tag-based filtering
transactionSchema.index({ externalId: 1 }, { sparse: true }); // External ID lookups
transactionSchema.index({ payee: 1, user: 1 }); // Payee-based queries

// Text index for search functionality
transactionSchema.index({
  description: 'text',
  notes: 'text',
  payee: 'text'
}, {
  weights: {
    description: 10,
    payee: 5,
    notes: 1
  },
  name: 'transaction_text_search'
});

// Pre-save middleware
transactionSchema.pre('save', async function(next) {
  try {
    // Calculate balance impact
    this.balanceImpact = this.calculateBalanceImpact();
    
    // Set deletion timestamp
    if (this.isDeleted && !this.deletedAt) {
      this.deletedAt = new Date();
    }
    
    // Clear deletion timestamp if undeleted
    if (!this.isDeleted && this.deletedAt) {
      this.deletedAt = undefined;
    }
    
    // Validate and update recurring configuration
    if (this.isRecurring && this.recurringConfig) {
      // Set next due date if not provided
      if (!this.recurringConfig.nextDueDate) {
        this.recurringConfig.nextDueDate = this.calculateNextDueDate();
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance Methods

// Calculate balance impact based on transaction type
transactionSchema.methods.calculateBalanceImpact = function() {
  switch (this.type) {
    case 'income':
      return this.amount;
    case 'expense':
      return -this.amount;
    case 'transfer':
      return 0; // Transfers don't affect total balance
    default:
      return 0;
  }
};

// Calculate next due date for recurring transactions
transactionSchema.methods.calculateNextDueDate = function() {
  if (!this.isRecurring || !this.recurringConfig) {
    return null;
  }
  
  const { frequency, interval } = this.recurringConfig;
  const currentDate = this.recurringConfig.nextDueDate || this.date;
  const nextDate = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (interval * 7));
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + (interval * 14));
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + interval);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + (interval * 3));
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + interval);
      break;
  }
  
  return nextDate;
};

// Generate recurring transaction instances
transactionSchema.methods.generateRecurringTransactions = async function(endDate = null) {
  if (!this.isRecurring || !this.recurringConfig) {
    throw new Error('Transaction is not configured for recurring');
  }
  
  const instances = [];
  const config = this.recurringConfig;
  let currentDate = new Date(config.nextDueDate);
  const finalEndDate = endDate || config.endDate || new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 year default
  
  while (currentDate <= finalEndDate) {
    // Check max occurrences limit
    if (config.maxOccurrences && config.occurrenceCount >= config.maxOccurrences) {
      break;
    }
    
    // Create new transaction instance
    const instanceData = {
      ...this.toObject(),
      _id: new mongoose.Types.ObjectId(),
      date: new Date(currentDate),
      isRecurring: false,
      isRecurringInstance: true,
      parentTransaction: this._id,
      recurringConfig: undefined,
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    delete instanceData.__v;
    instances.push(instanceData);
    
    // Calculate next occurrence
    currentDate = this.calculateNextDueDate.call({ 
      recurringConfig: { ...config, nextDueDate: currentDate },
      date: currentDate
    });
    
    config.occurrenceCount++;
  }
  
  // Update the recurring configuration
  this.recurringConfig.nextDueDate = currentDate;
  this.recurringConfig.occurrenceCount = config.occurrenceCount;
  await this.save();
  
  // Save all instances
  if (instances.length > 0) {
    await this.constructor.insertMany(instances);
  }
  
  return instances;
};

// Add attachment to transaction
transactionSchema.methods.addAttachment = function(attachmentData) {
  if (this.attachments.length >= 5) {
    throw new Error('Cannot add more than 5 attachments per transaction');
  }
  
  this.attachments.push(attachmentData);
  return this.save();
};

// Remove attachment from transaction
transactionSchema.methods.removeAttachment = function(attachmentId) {
  this.attachments.id(attachmentId).remove();
  return this.save();
};

// Soft delete transaction
transactionSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Restore soft deleted transaction
transactionSchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = undefined;
  return this.save();
};

// Static Methods

// Search transactions with text search
transactionSchema.statics.searchTransactions = function(userId, searchTerm, options = {}) {
  const {
    limit = 20,
    skip = 0,
    type = null,
    categoryId = null,
    dateFrom = null,
    dateTo = null,
    status = 'completed',
    includeDeleted = false
  } = options;
  
  const filter = {
    user: userId,
    $text: { $search: searchTerm }
  };
  
  if (!includeDeleted) {
    filter.isDeleted = { $ne: true };
  }
  
  if (type) {
    filter.type = type;
  }
  
  if (categoryId) {
    filter.category = categoryId;
  }
  
  if (status) {
    filter.status = status;
  }
  
  if (dateFrom || dateTo) {
    filter.date = {};
    if (dateFrom) filter.date.$gte = new Date(dateFrom);
    if (dateTo) filter.date.$lte = new Date(dateTo);
  }
  
  return this.find(filter, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, date: -1 })
    .populate('category', 'name type color icon')
    .limit(limit)
    .skip(skip);
};

// Get transactions by date range
transactionSchema.statics.getTransactionsByDateRange = function(userId, startDate, endDate, options = {}) {
  const {
    type = null,
    categoryId = null,
    status = 'completed',
    includeDeleted = false,
    sort = { date: -1 },
    limit = null,
    skip = 0
  } = options;
  
  const filter = {
    user: userId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  
  if (!includeDeleted) {
    filter.isDeleted = { $ne: true };
  }
  
  if (type) {
    filter.type = type;
  }
  
  if (categoryId) {
    filter.category = categoryId;
  }
  
  if (status) {
    filter.status = status;
  }
  
  let query = this.find(filter)
    .populate('category', 'name type color icon')
    .sort(sort)
    .skip(skip);
  
  if (limit) {
    query = query.limit(limit);
  }
  
  return query;
};

// Get transactions by category with aggregation
transactionSchema.statics.getTransactionsByCategory = function(userId, options = {}) {
  const {
    dateFrom = null,
    dateTo = null,
    type = null,
    includeDeleted = false
  } = options;
  
  const matchStage = {
    user: mongoose.Types.ObjectId(userId)
  };
  
  if (!includeDeleted) {
    matchStage.isDeleted = { $ne: true };
  }
  
  if (type) {
    matchStage.type = type;
  }
  
  if (dateFrom || dateTo) {
    matchStage.date = {};
    if (dateFrom) matchStage.date.$gte = new Date(dateFrom);
    if (dateTo) matchStage.date.$lte = new Date(dateTo);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$category',
        totalAmount: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
        avgAmount: { $avg: '$amount' },
        minAmount: { $min: '$amount' },
        maxAmount: { $max: '$amount' },
        lastTransaction: { $max: '$date' }
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category'
      }
    },
    {
      $unwind: '$category'
    },
    {
      $sort: { totalAmount: -1 }
    }
  ]);
};

// Get spending trends
transactionSchema.statics.getSpendingTrends = function(userId, period = 'monthly', count = 12) {
  const matchStage = {
    user: mongoose.Types.ObjectId(userId),
    type: 'expense',
    isDeleted: { $ne: true },
    status: 'completed'
  };
  
  let groupBy;
  switch (period) {
    case 'daily':
      groupBy = {
        year: { $year: '$date' },
        month: { $month: '$date' },
        day: { $dayOfMonth: '$date' }
      };
      break;
    case 'weekly':
      groupBy = {
        year: { $year: '$date' },
        week: { $week: '$date' }
      };
      break;
    case 'monthly':
    default:
      groupBy = {
        year: { $year: '$date' },
        month: { $month: '$date' }
      };
      break;
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: groupBy,
        totalSpent: { $sum: '$amount' },
        transactionCount: { $sum: 1 },
        avgTransaction: { $avg: '$amount' }
      }
    },
    {
      $sort: { '_id.year': -1, '_id.month': -1, '_id.week': -1, '_id.day': -1 }
    },
    { $limit: count }
  ]);
};

// Get recurring transactions due for processing
transactionSchema.statics.getRecurringTransactionsDue = function(upToDate = new Date()) {
  return this.find({
    isRecurring: true,
    'recurringConfig.isActive': true,
    'recurringConfig.nextDueDate': { $lte: upToDate },
    isDeleted: { $ne: true },
    $or: [
      { 'recurringConfig.endDate': { $exists: false } },
      { 'recurringConfig.endDate': null },
      { 'recurringConfig.endDate': { $gte: upToDate } }
    ],
    $or: [
      { 'recurringConfig.maxOccurrences': { $exists: false } },
      { 'recurringConfig.maxOccurrences': null },
      { $expr: { $lt: ['$recurringConfig.occurrenceCount', '$recurringConfig.maxOccurrences'] } }
    ]
  }).populate('category user');
};

// Get transactions by tags
transactionSchema.statics.getTransactionsByTags = function(userId, tags, options = {}) {
  const {
    limit = 20,
    skip = 0,
    includeDeleted = false
  } = options;
  
  const filter = {
    user: userId,
    tags: { $in: tags }
  };
  
  if (!includeDeleted) {
    filter.isDeleted = { $ne: true };
  }
  
  return this.find(filter)
    .populate('category', 'name type color icon')
    .sort({ date: -1 })
    .limit(limit)
    .skip(skip);
};

// Cleanup old deleted transactions
transactionSchema.statics.cleanupDeletedTransactions = function(olderThanDays = 90) {
  const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
  
  return this.deleteMany({
    isDeleted: true,
    deletedAt: { $lt: cutoffDate }
  });
};

// Export the model
module.exports = mongoose.model('Transaction', transactionSchema);
