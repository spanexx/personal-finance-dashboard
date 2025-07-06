const mongoose = require('mongoose');
const validator = require('validator');

// Category Schema Definition
const categorySchema = new mongoose.Schema({
  // User reference for ownership and data isolation
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    index: true
  },

  // Category name
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters'],
    minlength: [2, 'Category name must be at least 2 characters']
  },

  // Category type (income or expense)
  type: {
    type: String,
    required: [true, 'Category type is required'],
    enum: {
      values: ['income', 'expense'],
      message: 'Category type must be either income or expense'
    },
    lowercase: true,
    index: true
  },

  // Visual properties
  color: {
    type: String,
    required: [true, 'Category color is required'],
    validate: {
      validator: function(color) {
        // Validate hex color format (#RRGGBB or #RGB)
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
      },
      message: 'Color must be a valid hex color code (e.g., #FF5733 or #F53)'
    },
    uppercase: true
  },

  icon: {
    type: String,
    required: [true, 'Category icon is required'],
    trim: true,
    maxlength: [50, 'Icon identifier cannot exceed 50 characters'],
    validate: {
      validator: function(icon) {
        // Basic validation for icon identifier (alphanumeric, underscore, hyphen)
        return /^[a-zA-Z0-9_-]+$/.test(icon);
      },
      message: 'Icon identifier can only contain letters, numbers, underscores, and hyphens'
    }
  },

  // Hierarchy support
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
    validate: {
      validator: async function(parentId) {
        if (!parentId) return true; // No parent is valid
        
        // Check if parent exists and belongs to the same user
        const parent = await this.constructor.findById(parentId);
        if (!parent) {
          throw new Error('Parent category does not exist');
        }
        
        if (!parent.user.equals(this.user)) {
          throw new Error('Parent category must belong to the same user');
        }
        
        // Check if parent has the same type
        if (parent.type !== this.type) {
          throw new Error('Parent category must have the same type (income/expense)');
        }
        
        return true;
      },
      message: 'Invalid parent category'
    }
  },

  // Hierarchy level (calculated field)
  level: {
    type: Number,
    default: 0,
    min: [0, 'Level cannot be negative'],
    max: [5, 'Maximum category depth is 5 levels']
  },

  // Description (optional)
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  // Active/inactive status for soft deletion
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Budget allocation (optional - for budget planning)
  budgetAllocation: {
    type: Number,
    default: 0,
    min: [0, 'Budget allocation cannot be negative']
  },

  // Usage statistics
  transactionCount: {
    type: Number,
    default: 0,
    min: [0, 'Transaction count cannot be negative']
  },

  totalAmount: {
    type: Number,
    default: 0
  },

  // Sort order for display
  sortOrder: {
    type: Number,
    default: 0
  },

  // System categories (cannot be deleted)
  isSystem: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full path (breadcrumb navigation)
categorySchema.virtual('fullPath').get(function() {
  // This will be populated by the getFullPath method
  return this._fullPath || this.name;
});

// Virtual for subcategory count
categorySchema.virtual('subcategoryCount', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
  count: true
});

// Compound indexes for performance
categorySchema.index({ user: 1, type: 1 }); // Efficient filtering by user and type
categorySchema.index({ parent: 1 }); // Hierarchy queries
categorySchema.index({ user: 1, isActive: 1 }); // Active categories
categorySchema.index({ user: 1, type: 1, isActive: 1 }); // Combined filter
categorySchema.index({ user: 1, name: 1 }, { unique: true }); // Unique category names per user
categorySchema.index({ level: 1, sortOrder: 1 }); // Sorting and hierarchy display

// Pre-save middleware to calculate level and validate hierarchy
categorySchema.pre('save', async function(next) {
  try {
    if (this.parent) {
      // Calculate level based on parent
      const parent = await this.constructor.findById(this.parent);
      if (parent) {
        this.level = parent.level + 1;
        
        // Validate maximum depth
        if (this.level > 5) {
          throw new Error('Maximum category depth of 5 levels exceeded');
        }
      }
    } else {
      this.level = 0;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance Methods

// Get subcategories
categorySchema.methods.getSubcategories = async function(includeInactive = false) {
  const filter = { parent: this._id, user: this.user };
  if (!includeInactive) {
    filter.isActive = true;
  }
  
  return await this.constructor.find(filter).sort({ sortOrder: 1, name: 1 });
};

// Validate hierarchy to prevent circular references
categorySchema.methods.validateHierarchy = async function(newParentId) {
  if (!newParentId) return true;
  
  // Cannot set self as parent
  if (newParentId.equals(this._id)) {
    throw new Error('Category cannot be its own parent');
  }
  
  // Check if newParentId is a descendant of this category
  const descendants = await this.getAllDescendants();
  const isDescendant = descendants.some(desc => desc._id.equals(newParentId));
  
  if (isDescendant) {
    throw new Error('Cannot create circular reference in category hierarchy');
  }
  
  return true;
};

// Get full path for breadcrumb navigation
categorySchema.methods.getFullPath = async function(separator = ' > ') {
  const path = [];
  let current = this;
  
  // Traverse up the hierarchy
  while (current) {
    path.unshift(current.name);
    if (current.parent) {
      current = await this.constructor.findById(current.parent);
    } else {
      current = null;
    }
  }
  
  this._fullPath = path.join(separator);
  return this._fullPath;
};

// Get all descendants (subcategories at all levels)
categorySchema.methods.getAllDescendants = async function() {
  const descendants = [];
  
  const getChildren = async (categoryId) => {
    const children = await this.constructor.find({ parent: categoryId, user: this.user });
    
    for (const child of children) {
      descendants.push(child);
      await getChildren(child._id);
    }
  };
  
  await getChildren(this._id);
  return descendants;
};

// Soft delete category and all subcategories
categorySchema.methods.softDelete = async function() {
  // Mark this category as inactive
  this.isActive = false;
  await this.save();
  
  // Mark all descendants as inactive
  const descendants = await this.getAllDescendants();
  for (const descendant of descendants) {
    descendant.isActive = false;
    await descendant.save();
  }
  
  return true;
};

// Update transaction count and total amount
categorySchema.methods.updateStats = async function() {
  const Transaction = mongoose.model('Transaction');
  
  const stats = await Transaction.aggregate([
    {
      $match: {
        category: this._id,
        user: this.user
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        total: { $sum: '$amount' }
      }
    }
  ]);
  
  if (stats.length > 0) {
    this.transactionCount = stats[0].count;
    this.totalAmount = stats[0].total;
  } else {
    this.transactionCount = 0;
    this.totalAmount = 0;
  }
  
  await this.save();
  return { count: this.transactionCount, total: this.totalAmount };
};

// Static Methods

// Find categories by user and type
categorySchema.statics.findByUserAndType = function(userId, type, includeInactive = false) {
  const filter = { user: userId, type };
  if (!includeInactive) {
    filter.isActive = true;
  }
  
  return this.find(filter).sort({ level: 1, sortOrder: 1, name: 1 });
};

// Get category hierarchy for a user
categorySchema.statics.getHierarchy = async function(userId, type = null) {
  const filter = { user: userId, isActive: true };
  if (type) {
    filter.type = type;
  }
  
  const categories = await this.find(filter).sort({ level: 1, sortOrder: 1, name: 1 });
  
  // Build hierarchy tree
  const categoryMap = new Map();
  const rootCategories = [];
  
  // First pass: create map and identify roots
  categories.forEach(category => {
    categoryMap.set(category._id.toString(), {
      ...category.toObject(),
      children: []
    });
    
    if (!category.parent) {
      rootCategories.push(categoryMap.get(category._id.toString()));
    }
  });
  
  // Second pass: build parent-child relationships
  categories.forEach(category => {
    if (category.parent) {
      const parent = categoryMap.get(category.parent.toString());
      if (parent) {
        parent.children.push(categoryMap.get(category._id.toString()));
      }
    }
  });
  
  return rootCategories;
};

// Create default categories for a new user
categorySchema.statics.createDefaultCategories = async function(userId) {
  const defaultCategories = [
    // Expense categories
    { name: 'Food & Dining', type: 'expense', color: '#FF6B6B', icon: 'restaurant' },
    { name: 'Transportation', type: 'expense', color: '#4ECDC4', icon: 'directions_car' },
    { name: 'Shopping', type: 'expense', color: '#45B7D1', icon: 'shopping_cart' },
    { name: 'Entertainment', type: 'expense', color: '#FFA07A', icon: 'movie' },
    { name: 'Bills & Utilities', type: 'expense', color: '#98D8C8', icon: 'receipt' },
    { name: 'Healthcare', type: 'expense', color: '#F7DC6F', icon: 'local_hospital' },
    { name: 'Education', type: 'expense', color: '#BB8FCE', icon: 'school' },
    { name: 'Travel', type: 'expense', color: '#85C1E9', icon: 'flight' },
    
    // Income categories
    { name: 'Salary', type: 'income', color: '#58D68D', icon: 'work' },
    { name: 'Business', type: 'income', color: '#52C785', icon: 'business' },
    { name: 'Investments', type: 'income', color: '#48C775', icon: 'trending_up' },
    { name: 'Other Income', type: 'income', color: '#3EB770', icon: 'attach_money' }
  ];
  
  const createdCategories = [];
  
  for (const categoryData of defaultCategories) {
    try {
      const category = new this({
        ...categoryData,
        user: userId,
        isSystem: true
      });
      
      const savedCategory = await category.save();
      createdCategories.push(savedCategory);
    } catch (error) {
      console.error(`Error creating default category ${categoryData.name}:`, error);
    }
  }
  
  return createdCategories;
};

// Find categories with transaction count
categorySchema.statics.findWithStats = function(userId, type = null) {
  const match = { user: mongoose.Types.ObjectId(userId), isActive: true };
  if (type) {
    match.type = type;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'transactions',
        let: { categoryId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$category', '$$categoryId'] },
                  { $eq: ['$user', mongoose.Types.ObjectId(userId)] }
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              total: { $sum: '$amount' }
            }
          }
        ],
        as: 'stats'
      }
    },
    {
      $addFields: {
        transactionCount: { $ifNull: [{ $arrayElemAt: ['$stats.count', 0] }, 0] },
        totalAmount: { $ifNull: [{ $arrayElemAt: ['$stats.total', 0] }, 0] }
      }
    },
    { $project: { stats: 0 } },
    { $sort: { level: 1, sortOrder: 1, name: 1 } }
  ]);
};

// Search categories by name
categorySchema.statics.searchByName = function(userId, searchTerm, type = null) {
  const filter = {
    user: userId,
    isActive: true,
    name: { $regex: searchTerm, $options: 'i' }
  };
  
  if (type) {
    filter.type = type;
  }
  
  return this.find(filter).sort({ name: 1 }).limit(20);
};

// Cleanup unused categories
categorySchema.statics.cleanupUnused = async function(userId) {
  const Transaction = mongoose.model('Transaction');
  
  // Find categories with no transactions
  const categoriesWithTransactions = await Transaction.distinct('category', { user: userId });
  
  const unusedCategories = await this.find({
    user: userId,
    _id: { $nin: categoriesWithTransactions },
    isSystem: false, // Don't delete system categories
    isActive: true
  });
  
  // Mark unused categories as inactive
  for (const category of unusedCategories) {
    category.isActive = false;
    await category.save();
  }
  
  return unusedCategories.length;
};

// Export the model
module.exports = mongoose.model('Category', categorySchema);
