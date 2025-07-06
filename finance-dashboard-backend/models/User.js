const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const validator = require('validator');

// User Schema Definition
const userSchema = new mongoose.Schema({
  // Basic User Information
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    validate: {
      validator: function(username) {
        // Allow letters, numbers, underscores, and hyphens
        return /^[a-zA-Z0-9_-]+$/.test(username);
      },
      message: 'Username can only contain letters, numbers, underscores, and hyphens'
    }
  },

  // Additional Profile Information
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(phone) {
        if (!phone) return true; // Optional field
        return validator.isMobilePhone(phone);
      },
      message: 'Please provide a valid phone number'
    }
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(date) {
        if (!date) return true; // Optional field
        return date < new Date();
      },
      message: 'Date of birth must be in the past'
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  profileImage: {
    type: String, // Filename of uploaded image
    default: null
  },

  // Password Management
  passwordHistory: [{
    password: {
      type: String,
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  }],
  passwordChangedAt: {
    type: Date
  },

  // Change Tracking
  changeHistory: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    changedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Account Management
  deactivatedAt: {
    type: Date
  },
  deactivationReason: {
    type: String
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },

  // Profile Settings
  profileSettings: {
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'NGN'],
      uppercase: true
    },
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
      lowercase: true
    },
    theme: {
      type: String,
      default: 'light',
      enum: ['light', 'dark', 'system']
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY',
      enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']
    },
    timezone: {
      type: String,
      default: 'UTC'
    }  },

  // Notification Preferences
  notificationPreferences: {
    email: {
      enabled: {
        type: Boolean,
        default: true
      },
      frequency: {
        type: String,
        default: 'weekly',
        enum: ['daily', 'weekly', 'monthly', 'never']
      },
      types: {
        security: {
          type: Boolean,
          default: true        },
        marketing: {
          type: Boolean,
          default: true
        },
        transactional: {
          type: Boolean,
          default: true
        },
        reminders: {
          type: Boolean,
          default: true
        },
        reports: {
          type: Boolean,
          default: true
        }
      }
    },
    push: {
      enabled: {
        type: Boolean,
        default: true
      },
      deviceTokens: [{
        token: String,
        platform: {
          type: String,
          enum: ['ios', 'android', 'web']
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }]
    },
    budgetAlerts: {
      enabled: {
        type: Boolean,
        default: true
      },
      threshold: {
        type: Number,
        default: 80,
        min: 50,
        max: 100
      },
      monthlyEnabled: {
        type: Boolean,
        default: true
      }
    },
    goalReminders: {
      enabled: {
        type: Boolean,
        default: true
      },
      frequency: {
        type: String,
        default: 'weekly',
        enum: ['daily', 'weekly', 'monthly']
      }
    }
  },

  // Email Preferences for Budget Alerts
  emailPreferences: {
    budgetExceededAlerts: {
      type: Boolean,
      default: true
    },
    budgetWarningAlerts: {
      type: Boolean,
      default: true
    },
    categoryOverspendAlerts: {
      type: Boolean,
      default: true
    },
    monthlyBudgetSummary: {
      type: Boolean,
      default: true
    },
    warningThreshold: {
      type: Number,
      default: 80,
      min: 50,
      max: 100,
      validate: {
        validator: function(value) {
          return value >= 50 && value <= 100;
        },
        message: 'Warning threshold must be between 50% and 100%'
      }
    },
    alertFrequency: {
      type: String,
      default: 'immediate',
      enum: ['immediate', 'daily', 'weekly'],
      lowercase: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }  },
  
  // Account Verification
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  emailVerificationAttempts: {
    type: Number,
    default: 0,
    max: 5
  },
  lastEmailVerificationSent: {
    type: Date
  },
  // Account Status
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String
  },
  verificationTokenExpires: {
    type: Date
  },

  // Password Reset
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },

  // JWT Refresh Token
  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 604800 // 7 days in seconds
    },
    userAgent: String,
    ipAddress: String
  }],

  // Password History (for preventing reuse)
  passwordHistory: [{
    password: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },

  // Profile Image
  profileImage: {
    filename: String,
    path: String,
    size: Number,
    mimetype: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Indexes for performance (email index is created by unique: true in schema)
userSchema.index({ verificationToken: 1 });
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ 'refreshTokens.token': 1 });
userSchema.index({ isActive: 1, isVerified: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware for password hashing
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Store current password in history before hashing new one
    if (this.isModified('password') && !this.isNew) {
      // Get the current hashed password from database
      const currentUser = await this.constructor.findById(this._id).select('+password');
      if (currentUser && currentUser.password) {
        this.passwordHistory.unshift({
          password: currentUser.password,
          createdAt: new Date()
        });
        
        // Keep only last 5 passwords
        if (this.passwordHistory.length > 5) {
          this.passwordHistory = this.passwordHistory.slice(0, 5);
        }
      }
    }

    // Only hash if password is not already hashed (to prevent double hashing)
    if (!this.password.startsWith('$2a$') && !this.password.startsWith('$2b$')) {
      // Hash the password with cost of 12
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance Methods

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Check if password was recently used
userSchema.methods.isPasswordRecentlyUsed = async function(newPassword) {
  try {
    for (const historyEntry of this.passwordHistory) {
      const isMatch = await bcrypt.compare(newPassword, historyEntry.password);
      if (isMatch) {
        return true;
      }
    }
    return false;
  } catch (error) {
    throw new Error('Password history check failed');
  }
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  
  return resetToken;
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const crypto = require('crypto');
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.verificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Check if we need to lock the account
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Clean up expired refresh tokens
userSchema.methods.cleanupExpiredRefreshTokens = function() {
  this.refreshTokens = this.refreshTokens.filter(
    token => token.createdAt.getTime() + (7 * 24 * 60 * 60 * 1000) > Date.now()
  );
  return this.save();
};

// User serialization method (exclude sensitive data)
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  
  // Remove sensitive fields
  delete userObject.password;
  delete userObject.refreshTokens;
  delete userObject.verificationToken;
  delete userObject.resetPasswordToken;
  delete userObject.passwordHistory;
  delete userObject.__v;
  
  return userObject;
};

// Generate verification token
userSchema.methods.generateVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.verificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  return resetToken;
};

// Add refresh token
userSchema.methods.addRefreshToken = function(token, userAgent, ipAddress) {
  this.refreshTokens.push({
    token,
    userAgent,
    ipAddress,
    createdAt: new Date()
  });
  
  // Keep only last 5 refresh tokens per user
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
};

// Remove refresh token
userSchema.methods.removeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
};

// Update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.loginAttempts = 0;
  this.lockUntil = undefined;
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = function() {
  // If we have a lock and it's expired, reset attempts
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Static Methods

// Find by email with password
userSchema.statics.findByEmailWithPassword = function(email) {
  return this.findOne({ email }).select('+password');
};

// Find by verification token
userSchema.statics.findByVerificationToken = function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  return this.findOne({
    verificationToken: hashedToken,
    verificationTokenExpires: { $gt: Date.now() }
  });
};

// Find by reset token
userSchema.statics.findByResetToken = function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  return this.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }
  });
};

// Find by refresh token
userSchema.statics.findByRefreshToken = function(token) {
  return this.findOne({
    'refreshTokens.token': token,
    'refreshTokens.createdAt': { $gt: new Date(Date.now() - (process.env.JWT_REFRESH_EXPIRES_IN_MS || 7 * 24 * 60 * 60 * 1000)) }
  });
};

// Get active users count
userSchema.statics.getActiveUsersCount = function() {
  return this.countDocuments({ isActive: true, isVerified: true });
};

// Cleanup expired tokens
userSchema.statics.cleanupExpiredTokens = function() {
  const now = new Date();
  return this.updateMany(
    {
      $or: [
        { verificationTokenExpires: { $lt: now } },
        { resetPasswordExpires: { $lt: now } },
        { emailVerificationExpires: { $lt: now } }
      ]
    },
    {
      $unset: {
        verificationToken: 1,
        verificationTokenExpires: 1,
        resetPasswordToken: 1,
        resetPasswordExpires: 1,
        emailVerificationToken: 1,
        emailVerificationExpires: 1
      }
    }
  );
};

// Email verification methods
userSchema.methods.generateEmailVerificationToken = function() {
  // Generate random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Hash and set token
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  // Set expiry (24 hours)
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  
  // Update last sent timestamp
  this.lastEmailVerificationSent = new Date();
  
  return token;
};

userSchema.methods.verifyEmail = function() {
  this.isEmailVerified = true;
  this.emailVerificationToken = undefined;
  this.emailVerificationExpires = undefined;
  this.emailVerificationAttempts = 0;
  
  // If email is verified, mark account as verified too
  if (!this.isVerified) {
    this.isVerified = true;
  }
  
  return this.save();
};

userSchema.statics.findByEmailVerificationToken = function(token) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  return this.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() }
  });
};

// Check if email verification can be resent
userSchema.methods.canResendEmailVerification = function() {
  if (!this.lastEmailVerificationSent) {
    return true;
  }
  
  // Allow resend after 5 minutes
  const timeSinceLastSent = Date.now() - this.lastEmailVerificationSent.getTime();
  const fiveMinutes = 5 * 60 * 1000;
  
  return timeSinceLastSent > fiveMinutes;
};

// Increment email verification attempts
userSchema.methods.incrementEmailVerificationAttempts = function() {
  this.emailVerificationAttempts = (this.emailVerificationAttempts || 0) + 1;
  return this.save();
};

// Export the model
module.exports = mongoose.model('User', userSchema);
