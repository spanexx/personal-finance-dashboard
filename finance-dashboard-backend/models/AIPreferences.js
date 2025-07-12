const mongoose = require('mongoose');

const aiPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  responseStyle: {
    type: String,
    enum: ['concise', 'detailed', 'conversational', 'professional'],
    default: 'conversational'
  },
  insightFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'manual'],
    default: 'weekly'
  },
  enabledFeatures: {
    autoInsights: {
      type: Boolean,
      default: true
    },
    spendingAlerts: {
      type: Boolean,
      default: true
    },
    budgetSuggestions: {
      type: Boolean,
      default: true
    },
    goalTracking: {
      type: Boolean,
      default: true
    },
    categoryAnalysis: {
      type: Boolean,
      default: true
    }
  },
  notificationSettings: {
    emailNotifications: {
      type: Boolean,
      default: false
    },
    pushNotifications: {
      type: Boolean,
      default: true
    },
    inAppNotifications: {
      type: Boolean,
      default: true
    }
  },
  contextSettings: {
    includeHistoricalData: {
      type: Boolean,
      default: true
    },
    dataRangeMonths: {
      type: Number,
      default: 6,
      min: 1,
      max: 24
    },
    includeGoals: {
      type: Boolean,
      default: true
    },
    includeBudgets: {
      type: Boolean,
      default: true
    }
  },
  language: {
    type: String,
    default: 'en'
  },
  timezone: {
    type: String,
    default: 'UTC'
  }
}, {
  timestamps: true
});

// Static method to get or create preferences for a user
aiPreferencesSchema.statics.getOrCreateForUser = async function(userId) {
  let preferences = await this.findOne({ userId });
  
  if (!preferences) {
    preferences = await this.create({ userId });
  }
  
  return preferences;
};

// Method to update specific preference section
aiPreferencesSchema.methods.updateSection = function(section, updates) {
  if (this[section]) {
    Object.assign(this[section], updates);
  } else {
    this[section] = updates;
  }
  return this.save();
};

module.exports = mongoose.model('AIPreferences', aiPreferencesSchema);
