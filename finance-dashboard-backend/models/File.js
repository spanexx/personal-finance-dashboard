const mongoose = require('mongoose');
const validator = require('validator');

// File Schema Definition
const fileSchema = new mongoose.Schema({
  // File identification
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true,
    maxlength: [255, 'Filename cannot exceed 255 characters']
  },

  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true,
    maxlength: [255, 'Original filename cannot exceed 255 characters']
  },

  // File location and storage
  path: {
    type: String,
    required: [true, 'File path is required'],
    trim: true
  },

  url: {
    type: String,
    trim: true,
    validate: {
      validator: function(url) {
        return !url || validator.isURL(url);
      },
      message: 'Invalid URL format'
    }
  },

  // File metadata
  mimeType: {
    type: String,
    required: [true, 'MIME type is required'],
    validate: {
      validator: function(mimeType) {
        // Allow common file types
        const allowedTypes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
          'image/gif',
          'application/pdf',
          'text/plain',
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        return allowedTypes.includes(mimeType);
      },
      message: 'Unsupported file type'
    }
  },

  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size cannot be negative'],
    max: [50 * 1024 * 1024, 'File size cannot exceed 50MB'] // 50MB limit
  },

  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true
  },

  // File usage context
  entityType: {
    type: String,
    enum: ['transaction', 'user_avatar', 'budget', 'goal', 'report', 'other'],
    required: [true, 'Entity type is required'],
    index: true
  },

  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    validate: {
      validator: function(entityId) {
        // entityId is required for all types except user_avatar and other
        if (['user_avatar', 'other'].includes(this.entityType)) {
          return true;
        }
        return !!entityId;
      },
      message: 'Entity ID is required for this file type'
    },
    index: true
  },

  // Storage information
  storageType: {
    type: String,
    enum: ['local', 's3', 'cloudinary'],
    required: [true, 'Storage type is required'],
    default: 'local'
  },

  bucket: {
    type: String,
    trim: true
  },

  key: {
    type: String,
    trim: true
  },

  // File processing status
  processedStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },

  // Image-specific metadata
  imageMetadata: {
    width: {
      type: Number,
      min: [1, 'Width must be positive']
    },
    height: {
      type: Number,
      min: [1, 'Height must be positive']
    },
    format: {
      type: String,
      enum: ['jpeg', 'jpg', 'png', 'webp', 'gif']
    },
    hasTransparency: {
      type: Boolean,
      default: false
    }
  },

  // Thumbnails and variants
  thumbnails: [{
    size: {
      type: String,
      enum: ['small', 'medium', 'large'],
      required: true
    },
    width: {
      type: Number,
      required: true
    },
    height: {
      type: Number,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    url: String,
    size: {
      type: Number,
      required: true
    }
  }],

  // Security and validation
  checksum: {
    type: String,
    trim: true
  },

  virusScanned: {
    type: Boolean,
    default: false
  },

  virusScanResult: {
    status: {
      type: String,
      enum: ['clean', 'infected', 'suspicious', 'scan_failed'],
      default: 'clean'
    },
    scannedAt: Date,
    scanEngine: String,
    details: String
  },

  quarantined: {
    type: Boolean,
    default: false
  },

  quarantineReason: {
    type: String,
    trim: true
  },

  // Access control
  isPublic: {
    type: Boolean,
    default: false
  },

  permissions: {
    canDownload: {
      type: Boolean,
      default: true
    },
    canDelete: {
      type: Boolean,
      default: true
    },
    canShare: {
      type: Boolean,
      default: false
    }
  },

  // Lifecycle management
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
  expiresAt: {
    type: Date
  },

  // Usage tracking
  downloadCount: {
    type: Number,
    default: 0,
    min: [0, 'Download count cannot be negative']
  },

  lastAccessed: {
    type: Date,
    default: Date.now
  },

  // Tags for organization
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, 'Tag cannot exceed 50 characters'],
    validate: {
      validator: function(tag) {
        return /^[a-z0-9_-]+$/.test(tag);
      },
      message: 'Tags can only contain lowercase letters, numbers, underscores, and hyphens'
    }
  }],

  // Additional metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals

// File size in human readable format
fileSchema.virtual('formattedSize').get(function() {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (this.size === 0) return '0 Bytes';
  const i = Math.floor(Math.log(this.size) / Math.log(1024));
  return Math.round(this.size / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Check if file is an image
fileSchema.virtual('isImage').get(function() {
  return this.mimeType && this.mimeType.startsWith('image/');
});

// Check if file is a document
fileSchema.virtual('isDocument').get(function() {
  const documentTypes = ['application/pdf', 'text/', 'application/vnd.ms-excel', 'application/vnd.openxmlformats'];
  return this.mimeType && documentTypes.some(type => this.mimeType.includes(type));
});

// File extension
fileSchema.virtual('extension').get(function() {
  const ext = this.originalName.split('.').pop();
  return ext ? ext.toLowerCase() : '';
});

// Indexes for performance
fileSchema.index({ user: 1, entityType: 1 }); // User's files by type
fileSchema.index({ user: 1, isActive: 1, createdAt: -1 }); // Active files by user
fileSchema.index({ user: 1, isDeleted: 1 }); // Non-deleted files
fileSchema.index({ entityType: 1, entityId: 1 }); // Files for specific entities
fileSchema.index({ storageType: 1, path: 1 }); // Storage lookup
fileSchema.index({ checksum: 1 }, { sparse: true }); // Duplicate detection
fileSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true }); // TTL for temporary files
fileSchema.index({ tags: 1, user: 1 }); // Tag-based filtering
fileSchema.index({ virusScanned: 1, quarantined: 1 }); // Security status
fileSchema.index({ 'virusScanResult.status': 1 }); // Virus scan results

// Text index for search
fileSchema.index({
  originalName: 'text',
  filename: 'text',
  tags: 'text'
}, {
  weights: {
    originalName: 10,
    filename: 5,
    tags: 1
  },
  name: 'file_text_search'
});

// Pre-save middleware
fileSchema.pre('save', async function(next) {
  try {
    // Set deleted timestamp
    if (this.isDeleted && !this.deletedAt) {
      this.deletedAt = new Date();
    }

    // Clear deleted timestamp if restored
    if (!this.isDeleted && this.deletedAt) {
      this.deletedAt = undefined;
    }

    // Update last accessed if new
    if (this.isNew) {
      this.lastAccessed = new Date();
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Instance Methods

// Soft delete file
fileSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.isActive = false;
  this.deletedAt = new Date();
  return this.save();
};

// Restore soft deleted file
fileSchema.methods.restore = function() {
  this.isDeleted = false;
  this.isActive = true;
  this.deletedAt = undefined;
  return this.save();
};

// Increment download count
fileSchema.methods.incrementDownload = function() {
  this.downloadCount += 1;
  this.lastAccessed = new Date();
  return this.save();
};

// Check if file has expired
fileSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

// Get file URL (handles different storage types)
fileSchema.methods.getUrl = function() {
  if (this.url) {
    return this.url;
  }

  // For local storage, generate URL based on path
  if (this.storageType === 'local') {
    return `/uploads/${this.path}`;
  }

  // For S3, construct URL from bucket and key
  if (this.storageType === 's3' && this.bucket && this.key) {
    return `https://${this.bucket}.s3.amazonaws.com/${this.key}`;
  }

  return null;
};

// Add thumbnail
fileSchema.methods.addThumbnail = function(thumbnailData) {
  this.thumbnails.push(thumbnailData);
  return this.save();
};

// Get thumbnail by size
fileSchema.methods.getThumbnail = function(size = 'medium') {
  return this.thumbnails.find(thumb => thumb.size === size);
};

// Mark as quarantined
fileSchema.methods.quarantine = function(reason) {
  this.quarantined = true;
  this.quarantineReason = reason;
  this.isActive = false;
  return this.save();
};

// Release from quarantine
fileSchema.methods.releaseFromQuarantine = function() {
  this.quarantined = false;
  this.quarantineReason = undefined;
  this.isActive = true;
  return this.save();
};

// Static Methods

// Find files by user
fileSchema.statics.findByUser = function(userId, options = {}) {
  const {
    entityType = null,
    isActive = true,
    limit = 20,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;

  const filter = {
    user: userId,
    isDeleted: { $ne: true }
  };

  if (entityType) filter.entityType = entityType;
  if (isActive !== null) filter.isActive = isActive;

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder;

  return this.find(filter)
    .sort(sortOptions)
    .limit(limit)
    .skip(skip)
    .populate('user', 'firstName lastName email');
};

// Find files by entity
fileSchema.statics.findByEntity = function(entityType, entityId) {
  return this.find({
    entityType,
    entityId,
    isDeleted: { $ne: true },
    isActive: true
  }).sort({ createdAt: -1 });
};

// Find expired files
fileSchema.statics.findExpired = function() {
  return this.find({
    expiresAt: { $lt: new Date() },
    isDeleted: { $ne: true }
  });
};

// Find orphaned files (files without valid entity references)
fileSchema.statics.findOrphaned = async function() {
  const Transaction = mongoose.model('Transaction');
  const User = mongoose.model('User');
  const Budget = mongoose.model('Budget');
  const Goal = mongoose.model('Goal');

  const orphanedFiles = [];

  // Check transaction files
  const transactionFiles = await this.find({ entityType: 'transaction' });
  for (const file of transactionFiles) {
    const transaction = await Transaction.findById(file.entityId);
    if (!transaction) {
      orphanedFiles.push(file);
    }
  }

  // Check user avatar files
  const avatarFiles = await this.find({ entityType: 'user_avatar' });
  for (const file of avatarFiles) {
    const user = await User.findById(file.user);
    if (!user || !user.profileImage || user.profileImage.filename !== file.filename) {
      orphanedFiles.push(file);
    }
  }

  // Check budget files
  const budgetFiles = await this.find({ entityType: 'budget' });
  for (const file of budgetFiles) {
    const budget = await Budget.findById(file.entityId);
    if (!budget) {
      orphanedFiles.push(file);
    }
  }

  // Check goal files
  const goalFiles = await this.find({ entityType: 'goal' });
  for (const file of goalFiles) {
    const goal = await Goal.findById(file.entityId);
    if (!goal) {
      orphanedFiles.push(file);
    }
  }

  return orphanedFiles;
};

// Find files requiring virus scan
fileSchema.statics.findRequiringVirusScan = function() {
  return this.find({
    virusScanned: false,
    quarantined: false,
    isDeleted: { $ne: true }
  });
};

// Get storage statistics
fileSchema.statics.getStorageStats = async function(userId = null) {
  const matchStage = { isDeleted: { $ne: true } };
  if (userId) {
    matchStage.user = mongoose.Types.ObjectId(userId);
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$size' },
        avgSize: { $avg: '$size' },
        maxSize: { $max: '$size' },
        minSize: { $min: '$size' }
      }
    },
    {
      $project: {
        _id: 0,
        totalFiles: 1,
        totalSize: 1,
        avgSize: { $round: ['$avgSize', 2] },
        maxSize: 1,
        minSize: 1,
        totalSizeMB: { $round: [{ $divide: ['$totalSize', 1024 * 1024] }, 2] }
      }
    }
  ]);

  return stats[0] || {
    totalFiles: 0,
    totalSize: 0,
    avgSize: 0,
    maxSize: 0,
    minSize: 0,
    totalSizeMB: 0
  };
};

// Get storage stats by type
fileSchema.statics.getStorageStatsByType = async function(userId = null) {
  const matchStage = { isDeleted: { $ne: true } };
  if (userId) {
    matchStage.user = mongoose.Types.ObjectId(userId);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$entityType',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' },
        avgSize: { $avg: '$size' }
      }
    },
    {
      $project: {
        entityType: '$_id',
        count: 1,
        totalSize: 1,
        avgSize: { $round: ['$avgSize', 2] },
        totalSizeMB: { $round: [{ $divide: ['$totalSize', 1024 * 1024] }, 2] },
        _id: 0
      }
    },
    { $sort: { totalSize: -1 } }
  ]);
};

// Search files
fileSchema.statics.searchFiles = function(userId, searchTerm, options = {}) {
  const {
    entityType = null,
    limit = 20,
    skip = 0
  } = options;

  const filter = {
    user: userId,
    isDeleted: { $ne: true },
    $text: { $search: searchTerm }
  };

  if (entityType) filter.entityType = entityType;

  return this.find(filter, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .skip(skip);
};

// Cleanup old deleted files
fileSchema.statics.cleanupDeletedFiles = function(olderThanDays = 30) {
  const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
  
  return this.deleteMany({
    isDeleted: true,
    deletedAt: { $lt: cutoffDate }
  });
};

// Find large files
fileSchema.statics.findLargeFiles = function(sizeThresholdMB = 10) {
  const sizeThreshold = sizeThresholdMB * 1024 * 1024; // Convert to bytes
  
  return this.find({
    size: { $gt: sizeThreshold },
    isDeleted: { $ne: true }
  }).sort({ size: -1 });
};

// Get duplicate files by checksum
fileSchema.statics.findDuplicateFiles = function() {
  return this.aggregate([
    {
      $match: {
        checksum: { $exists: true, $ne: null },
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$checksum',
        files: { $push: '$$ROOT' },
        count: { $sum: 1 }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    }
  ]);
};

// Export the model
module.exports = mongoose.model('File', fileSchema);
