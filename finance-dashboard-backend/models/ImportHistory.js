/**
 * Import History Model
 * Tracks user data import operations
 */

const mongoose = require('mongoose');

const importHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  originalFileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number
  },
  mimeType: {
    type: String
  },
  type: {
    type: String,
    enum: ['transactions', 'budgets', 'goals', 'categories'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'validating', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  recordsProcessed: {
    type: Number,
    default: 0
  },
  recordsImported: {
    type: Number,
    default: 0
  },
  recordsSkipped: {
    type: Number,
    default: 0
  },
  recordsWithErrors: {
    type: Number,
    default: 0
  },
  validation: {
    isValid: {
      type: Boolean,
      default: false
    },
    errors: [{
      row: Number,
      column: String,
      value: String,
      message: String,
      code: String
    }],
    warnings: [{
      row: Number,
      column: String,
      value: String,
      message: String,
      code: String
    }],
    summary: {
      totalRows: Number,
      validRows: Number,
      invalidRows: Number,
      duplicateRows: Number,
      emptyRows: Number
    }
  },
  options: {
    type: mongoose.Schema.Types.Mixed
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  error: {
    message: String,
    stack: String,
    code: String
  },
  processingStartedAt: {
    type: Date
  },
  processingCompletedAt: {
    type: Date
  },
  importResults: {
    transactions: {
      imported: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      errors: { type: Number, default: 0 }
    },
    budgets: {
      imported: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      errors: { type: Number, default: 0 }
    },
    goals: {
      imported: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      errors: { type: Number, default: 0 }
    },
    categories: {
      imported: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      errors: { type: Number, default: 0 }
    }
  },
  metadata: {
    sourceApplication: String,
    sourceVersion: String,
    importSettings: mongoose.Schema.Types.Mixed,
    columnMappings: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
importHistorySchema.index({ userId: 1, createdAt: -1 });
importHistorySchema.index({ status: 1 });
importHistorySchema.index({ type: 1 });

// Virtual for success rate
importHistorySchema.virtual('successRate').get(function() {
  if (this.recordsProcessed === 0) return 0;
  return (this.recordsImported / this.recordsProcessed) * 100;
});

// Virtual for processing duration
importHistorySchema.virtual('processingDuration').get(function() {
  if (this.processingStartedAt && this.processingCompletedAt) {
    return this.processingCompletedAt.getTime() - this.processingStartedAt.getTime();
  }
  return null;
});

// Virtual for summary
importHistorySchema.virtual('summary').get(function() {
  return {
    fileName: this.originalFileName,
    type: this.type,
    status: this.status,
    processed: this.recordsProcessed,
    imported: this.recordsImported,
    skipped: this.recordsSkipped,
    errors: this.recordsWithErrors,
    successRate: this.successRate,
    duration: this.processingDuration
  };
});

// Instance method to mark as started
importHistorySchema.methods.markAsStarted = function() {
  this.status = 'processing';
  this.processingStartedAt = new Date();
  this.progress = 0;
  return this.save();
};

// Instance method to mark as validating
importHistorySchema.methods.markAsValidating = function() {
  this.status = 'validating';
  this.progress = 10;
  return this.save();
};

// Instance method to update validation results
importHistorySchema.methods.updateValidation = function(validationResult) {
  this.validation = validationResult;
  this.progress = 20;
  return this.save();
};

// Instance method to update progress
importHistorySchema.methods.updateProgress = function(progress, recordsProcessed = null) {
  this.progress = Math.min(100, Math.max(0, progress));
  if (recordsProcessed !== null) {
    this.recordsProcessed = recordsProcessed;
  }
  return this.save();
};

// Instance method to update import results
importHistorySchema.methods.updateImportResults = function(type, results) {
  if (this.importResults[type]) {
    this.importResults[type] = {
      ...this.importResults[type],
      ...results
    };
  }
  
  // Update overall counters
  this.recordsImported = Object.values(this.importResults)
    .reduce((sum, result) => sum + (result.imported || 0), 0);
  
  this.recordsSkipped = Object.values(this.importResults)
    .reduce((sum, result) => sum + (result.skipped || 0), 0);
    
  this.recordsWithErrors = Object.values(this.importResults)
    .reduce((sum, result) => sum + (result.errors || 0), 0);
  
  return this.save();
};

// Instance method to mark as completed
importHistorySchema.methods.markAsCompleted = function(finalResults = null) {
  this.status = 'completed';
  this.processingCompletedAt = new Date();
  this.progress = 100;
  
  if (finalResults) {
    this.recordsProcessed = finalResults.recordsProcessed || this.recordsProcessed;
    this.recordsImported = finalResults.recordsImported || this.recordsImported;
    this.recordsSkipped = finalResults.recordsSkipped || this.recordsSkipped;
    this.recordsWithErrors = finalResults.recordsWithErrors || this.recordsWithErrors;
  }
  
  return this.save();
};

// Instance method to mark as failed
importHistorySchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.processingCompletedAt = new Date();
  
  if (error) {
    this.error = {
      message: error.message,
      stack: error.stack,
      code: error.code
    };
  }
  
  return this.save();
};

// Instance method to mark as cancelled
importHistorySchema.methods.markAsCancelled = function() {
  this.status = 'cancelled';
  this.processingCompletedAt = new Date();
  return this.save();
};

// Static method to get user import stats
importHistorySchema.statics.getUserStats = async function(userId, timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);
  
  const stats = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalImports: { $sum: 1 },
        completedImports: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failedImports: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        totalRecordsProcessed: { $sum: '$recordsProcessed' },
        totalRecordsImported: { $sum: '$recordsImported' },
        totalRecordsSkipped: { $sum: '$recordsSkipped' },
        totalRecordsWithErrors: { $sum: '$recordsWithErrors' }
      }
    }
  ]);
  
  const result = stats[0] || {
    totalImports: 0,
    completedImports: 0,
    failedImports: 0,
    totalRecordsProcessed: 0,
    totalRecordsImported: 0,
    totalRecordsSkipped: 0,
    totalRecordsWithErrors: 0
  };
  
  // Calculate overall success rate
  result.overallSuccessRate = result.totalRecordsProcessed > 0 
    ? (result.totalRecordsImported / result.totalRecordsProcessed) * 100 
    : 0;
  
  return result;
};

// Static method to get import stats by type
importHistorySchema.statics.getStatsByType = async function(userId, timeRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);
  
  return await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$type',
        totalImports: { $sum: 1 },
        completedImports: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        totalRecordsProcessed: { $sum: '$recordsProcessed' },
        totalRecordsImported: { $sum: '$recordsImported' },
        avgSuccessRate: { $avg: '$successRate' }
      }
    },
    {
      $sort: { totalImports: -1 }
    }
  ]);
};

module.exports = mongoose.model('ImportHistory', importHistorySchema);
