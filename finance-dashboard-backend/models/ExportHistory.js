/**
 * Export History Model
 * Tracks user data export operations
 */

const mongoose = require('mongoose');

const exportHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fileName: {
    type: String,
    required: true
  },
  format: {
    type: String,
    enum: ['csv', 'json', 'excel', 'pdf'],
    required: true
  },
  type: {
    type: String,
    enum: ['transactions', 'budgets', 'goals', 'categories', 'all'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  filePath: {
    type: String
  },
  fileSize: {
    type: Number
  },
  mimeType: {
    type: String
  },
  downloadUrl: {
    type: String
  },
  recordCount: {
    type: Number,
    default: 0
  },
  dateRange: {
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    }
  },
  includeAttachments: {
    type: Boolean,
    default: false
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
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloadAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Files expire after 30 days
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
exportHistorySchema.index({ userId: 1, createdAt: -1 });
exportHistorySchema.index({ status: 1 });
exportHistorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for download availability
exportHistorySchema.virtual('isDownloadable').get(function() {
  return this.status === 'completed' && 
         this.filePath && 
         new Date() < this.expiresAt;
});

// Virtual for processing duration
exportHistorySchema.virtual('processingDuration').get(function() {
  if (this.processingStartedAt && this.processingCompletedAt) {
    return this.processingCompletedAt.getTime() - this.processingStartedAt.getTime();
  }
  return null;
});

// Instance method to mark as started
exportHistorySchema.methods.markAsStarted = function() {
  this.status = 'processing';
  this.processingStartedAt = new Date();
  this.progress = 0;
  return this.save();
};

// Instance method to update progress
exportHistorySchema.methods.updateProgress = function(progress) {
  this.progress = Math.min(100, Math.max(0, progress));
  return this.save();
};

// Instance method to mark as completed
exportHistorySchema.methods.markAsCompleted = function(result) {
  this.status = 'completed';
  this.processingCompletedAt = new Date();
  this.progress = 100;
  
  if (result) {
    this.fileName = result.fileName || this.fileName;
    this.filePath = result.filePath || this.filePath;
    this.fileSize = result.fileSize || this.fileSize;
    this.mimeType = result.mimeType || this.mimeType;
    this.downloadUrl = result.downloadUrl || this.downloadUrl;
    this.recordCount = result.recordCount || this.recordCount;
  }
  
  return this.save();
};

// Instance method to mark as failed
exportHistorySchema.methods.markAsFailed = function(error) {
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
exportHistorySchema.methods.markAsCancelled = function() {
  this.status = 'cancelled';
  this.processingCompletedAt = new Date();
  return this.save();
};

// Instance method to record download
exportHistorySchema.methods.recordDownload = function() {
  this.downloadCount += 1;
  this.lastDownloadAt = new Date();
  return this.save();
};

// Static method to cleanup expired files
exportHistorySchema.statics.cleanupExpiredFiles = async function() {
  const fs = require('fs').promises;
  const path = require('path');
  
  const expiredExports = await this.find({
    status: 'completed',
    expiresAt: { $lt: new Date() },
    filePath: { $exists: true }
  });
  
  const cleanupResults = {
    filesDeleted: 0,
    errors: []
  };
  
  for (const exportRecord of expiredExports) {
    try {
      const fullPath = path.resolve(exportRecord.filePath);
      await fs.unlink(fullPath);
      exportRecord.filePath = null;
      exportRecord.downloadUrl = null;
      await exportRecord.save();
      cleanupResults.filesDeleted++;
    } catch (error) {
      cleanupResults.errors.push({
        exportId: exportRecord._id,
        error: error.message
      });
    }
  }
  
  return cleanupResults;
};

// Static method to get user export stats
exportHistorySchema.statics.getUserStats = async function(userId, timeRange = 30) {
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
        totalExports: { $sum: 1 },
        completedExports: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failedExports: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        totalFileSize: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$fileSize', 0] }
        },
        totalRecords: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$recordCount', 0] }
        },
        totalDownloads: { $sum: '$downloadCount' }
      }
    }
  ]);
  
  return stats[0] || {
    totalExports: 0,
    completedExports: 0,
    failedExports: 0,
    totalFileSize: 0,
    totalRecords: 0,
    totalDownloads: 0
  };
};

module.exports = mongoose.model('ExportHistory', exportHistorySchema);
