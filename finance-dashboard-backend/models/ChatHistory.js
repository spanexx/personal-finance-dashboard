const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userMessage: {
    type: String,
    required: true,
    trim: true
  },
  aiResponse: {
    type: mongoose.Schema.Types.Mixed, // Can be string or structured object
    required: true
  },
  responseType: {
    type: String,
    enum: ['text', 'action', 'mixed'],
    default: 'text'
  },
  actionExecuted: {
    type: Boolean,
    default: false
  },
  actionResult: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  sessionId: {
    type: String,
    index: true
  },
  metadata: {
    processingTime: Number,
    tokenCount: Number,
    model: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
chatHistorySchema.index({ userId: 1, createdAt: -1 });
chatHistorySchema.index({ sessionId: 1, createdAt: -1 });

// Virtual for formatted timestamp
chatHistorySchema.virtual('formattedTimestamp').get(function() {
  return this.createdAt.toISOString();
});

// Method to mark action as executed
chatHistorySchema.methods.markActionExecuted = function(result) {
  this.actionExecuted = true;
  this.actionResult = result;
  return this.save();
};

// Static method to get recent chats for user
chatHistorySchema.statics.getRecentChats = function(userId, page = 1, limit = 20) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();
};

// Static method to get chat by session
chatHistorySchema.statics.getSessionChats = function(sessionId) {
  return this.find({ sessionId })
    .sort({ createdAt: 1 })
    .lean();
};

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
