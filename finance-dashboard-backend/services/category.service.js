/**
 * Category Service
 * Business logic layer for category operations
 */

const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError 
} = require('../utils/errorHandler');

class CategoryService {
  /**
   * Get categories with filtering and pagination
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Categories and pagination info
   */
  static async getCategories(userId, options = {}) {
    const {
      type,
      includeInactive = false,
      includeStats = false,
      parentId,
      search,
      page = 1,
      limit = 50,
      sortBy = 'name',
      sortOrder = 'asc'
    } = options;

    // Build filter
    const filter = { user: userId };

    if (type && ['income', 'expense'].includes(type)) {
      filter.type = type;
    }

    if (!includeInactive || includeInactive === 'false') {
      filter.isActive = true;
    }

    if (parentId) {
      if (parentId === 'null' || parentId === 'root') {
        filter.parent = null;
      } else if (mongoose.isValidObjectId(parentId)) {
        filter.parent = parentId;
      }
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sortObject = {};
    const validSortFields = ['name', 'type', 'level', 'sortOrder', 'createdAt', 'updatedAt'];
    if (validSortFields.includes(sortBy)) {
      sortObject[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortObject.name = 1; // Default sort
    }

    // Add secondary sort for consistent ordering
    if (sortBy !== 'name') {
      sortObject.name = 1;
    }

    // Handle stats inclusion
    if (includeStats === 'true') {
      const categories = await Category.findWithStats(userId, type);
      return {
        categories,
        total: categories.length,
        includeStats: true
      };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100); // Max 100 items
    const skip = (pageNum - 1) * limitNum;

    const [categories, total] = await Promise.all([
      Category.find(filter)
        .sort(sortObject)
        .skip(skip)
        .limit(limitNum)
        .populate('parent', 'name type'),
      Category.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    return {
      categories,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage,
        hasPrevPage
      }
    };
  }

  /**
   * Get category hierarchy
   * @param {string} userId - User ID
   * @param {string} type - Category type filter
   * @returns {Promise<Object>} Category hierarchy
   */
  static async getCategoryHierarchy(userId, type) {
    const hierarchy = await Category.getHierarchy(userId, type);
    return {
      hierarchy,
      type: type || 'all'
    };
  }

  /**
   * Get category by ID with additional data
   * @param {string} categoryId - Category ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Category with additional data
   */
  static async getCategoryById(categoryId, userId) {
    if (!mongoose.isValidObjectId(categoryId)) {
      throw new ValidationError('Invalid category ID');
    }

    const category = await Category.findOne({
      _id: categoryId,
      user: userId
    }).populate('parent', 'name type level');

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Get subcategories
    const subcategories = await category.getSubcategories();

    // Get usage statistics
    await category.updateStats();

    // Get full path for breadcrumb
    const fullPath = await category.getFullPath();

    return {
      category: {
        ...category.toObject(),
        fullPath,
        subcategories,
        stats: {
          transactionCount: category.transactionCount,
          totalAmount: category.totalAmount
        }
      }
    };
  }

  /**
   * Create a new category with validation
   * @param {string} userId - User ID
   * @param {Object} categoryData - Category data
   * @returns {Promise<Object>} Created category
   */
  static async createCategory(userId, categoryData) {
    const {
      name,
      type,
      description,
      color,
      icon,
      parent,
      sortOrder,
      budgetAllocation
    } = categoryData;

    // Check for duplicate category name for this user
    const existingCategory = await Category.findOne({
      user: userId,
      name: name.trim(),
      isActive: true
    });

    if (existingCategory) {
      throw new ConflictError('Category with this name already exists');
    }

    // Validate parent category if provided
    if (parent) {
      if (!mongoose.isValidObjectId(parent)) {
        throw new ValidationError('Invalid parent category ID');
      }

      const parentCategory = await Category.findOne({
        _id: parent,
        user: userId,
        type: type,
        isActive: true
      });

      if (!parentCategory) {
        throw new NotFoundError('Parent category not found');
      }

      // Check depth limit
      if (parentCategory.level >= 4) { // Max 5 levels (0-4)
        throw new ValidationError('Maximum category depth exceeded');
      }
    }

    // Create new category
    const category = new Category({
      user: userId,
      name: name.trim(),
      type: type.toLowerCase(),
      description: description?.trim(),
      color,
      icon,
      parent: parent || null,
      sortOrder: sortOrder || 0,
      budgetAllocation: budgetAllocation || 0
    });

    await category.save();

    // Populate parent information
    await category.populate('parent', 'name type level');

    return { category };
  }

  /**
   * Update category with validation
   * @param {string} categoryId - Category ID
   * @param {string} userId - User ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated category
   */
  static async updateCategory(categoryId, userId, updates) {
    if (!mongoose.isValidObjectId(categoryId)) {
      throw new ValidationError('Invalid category ID');
    }

    const category = await Category.findOne({
      _id: categoryId,
      user: userId
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Prevent updating system categories
    if (category.isSystem) {
      throw new ValidationError('System categories cannot be modified');
    }

    // Check for name conflicts if name is being updated
    if (updates.name && updates.name !== category.name) {
      const existingCategory = await Category.findOne({
        user: userId,
        name: updates.name.trim(),
        _id: { $ne: categoryId },
        isActive: true
      });

      if (existingCategory) {
        throw new ConflictError('Category with this name already exists');
      }
    }

    // Validate parent category if being updated
    if (updates.parent !== undefined) {
      if (updates.parent) {
        if (!mongoose.isValidObjectId(updates.parent)) {
          throw new ValidationError('Invalid parent category ID');
        }

        // Check for circular reference
        await category.validateHierarchy(updates.parent);

        const parentCategory = await Category.findOne({
          _id: updates.parent,
          user: userId,
          type: updates.type || category.type,
          isActive: true
        });

        if (!parentCategory) {
          throw new NotFoundError('Parent category not found');
        }
      } else {
        updates.parent = null;
      }
    }

    // Validate allowed fields
    const allowedUpdates = [
      'name', 'description', 'color', 'icon', 'parent', 
      'sortOrder', 'budgetAllocation', 'isActive'
    ];
    const updateFields = {};

    for (const field of allowedUpdates) {
      if (updates[field] !== undefined) {
        updateFields[field] = updates[field];
      }
    }

    // Trim string fields
    if (updateFields.name) {
      updateFields.name = updateFields.name.trim();
    }
    if (updateFields.description) {
      updateFields.description = updateFields.description.trim();
    }

    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate('parent', 'name type level');

    return { category: updatedCategory };
  }

  /**
   * Delete category with validation and cleanup
   * @param {string} categoryId - Category ID
   * @param {string} userId - User ID
   * @param {boolean} force - Force deletion even if in use
   * @returns {Promise<Object>} Deletion result
   */
  static async deleteCategory(categoryId, userId, force = false) {
    if (!mongoose.isValidObjectId(categoryId)) {
      throw new ValidationError('Invalid category ID');
    }

    const category = await Category.findOne({
      _id: categoryId,
      user: userId
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Prevent deleting system categories
    if (category.isSystem) {
      throw new ValidationError('System categories cannot be deleted');
    }

    // Check if category is in use
    const transactionCount = await Transaction.countDocuments({
      category: categoryId,
      user: userId,
      isDeleted: { $ne: true }
    });

    if (transactionCount > 0 && !force) {
      return {
        canDelete: false,
        transactionCount,
        canForceDelete: true,
        warning: 'Force deletion will unassign this category from all transactions'
      };
    }

    // If force delete, unassign category from transactions
    if (force && transactionCount > 0) {
      await Transaction.updateMany(
        {
          category: categoryId,
          user: userId
        },
        {
          $unset: { category: 1 }
        }
      );
    }

    // Soft delete the category and all subcategories
    await category.softDelete();

    return {
      canDelete: true,
      deletedCategory: categoryId,
      affectedTransactions: force ? transactionCount : 0
    };
  }

  /**
   * Get category statistics
   * @param {string} categoryId - Category ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Category statistics
   */
  static async getCategoryStatistics(categoryId, userId, options = {}) {
    const {
      startDate,
      endDate,
      includeSubcategories = false
    } = options;

    if (!mongoose.isValidObjectId(categoryId)) {
      throw new ValidationError('Invalid category ID');
    }

    const category = await Category.findOne({
      _id: categoryId,
      user: userId
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // Build category filter
    let categoryFilter = { category: categoryId };
    
    if (includeSubcategories === 'true') {
      const descendants = await category.getAllDescendants();
      const categoryIds = [categoryId, ...descendants.map(desc => desc._id)];
      categoryFilter = { category: { $in: categoryIds } };
    }

    // Build aggregation pipeline
    const matchStage = {
      user: mongoose.Types.ObjectId(userId),
      ...categoryFilter,
      isDeleted: { $ne: true }
    };

    if (Object.keys(dateFilter).length > 0) {
      matchStage.date = dateFilter;
    }

    const stats = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          averageAmount: { $avg: '$amount' },
          minAmount: { $min: '$amount' },
          maxAmount: { $max: '$amount' },
          firstTransaction: { $min: '$date' },
          lastTransaction: { $max: '$date' }
        }
      }
    ]);

    // Monthly breakdown
    const monthlyStats = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          transactions: { $sum: 1 },
          amount: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const basicStats = stats[0] || {
      totalTransactions: 0,
      totalAmount: 0,
      averageAmount: 0,
      minAmount: 0,
      maxAmount: 0,
      firstTransaction: null,
      lastTransaction: null
    };

    return {
      category: {
        id: category._id,
        name: category.name,
        type: category.type
      },
      dateRange: {
        startDate: startDate || basicStats.firstTransaction,
        endDate: endDate || basicStats.lastTransaction
      },
      includeSubcategories: includeSubcategories === 'true',
      summary: basicStats,
      monthlyBreakdown: monthlyStats,
      trends: {
        isIncreasing: monthlyStats.length > 1 ? 
          monthlyStats[monthlyStats.length - 1].amount > monthlyStats[0].amount : null,
        averageMonthlyAmount: monthlyStats.length > 0 ? 
          monthlyStats.reduce((sum, month) => sum + month.amount, 0) / monthlyStats.length : 0
      }
    };
  }

  /**
   * Search categories by name
   * @param {string} userId - User ID
   * @param {string} searchTerm - Search term
   * @param {string} type - Category type filter
   * @param {number} limit - Result limit
   * @returns {Promise<Object>} Search results
   */
  static async searchCategories(userId, searchTerm, type, limit = 20) {
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new ValidationError('Search term must be at least 2 characters long');
    }

    const categories = await Category.searchByName(
      userId, 
      searchTerm.trim(), 
      type
    ).limit(Math.min(parseInt(limit), 50));

    return {
      categories,
      searchTerm: searchTerm.trim(),
      type: type || 'all'
    };
  }

  /**
   * Get category usage summary
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Usage summary
   */
  static async getCategoryUsageSummary(userId, options = {}) {
    const { type, startDate, endDate } = options;

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // Build aggregation pipeline
    const matchStage = {
      user: mongoose.Types.ObjectId(userId),
      isDeleted: { $ne: true }
    };

    if (Object.keys(dateFilter).length > 0) {
      matchStage.date = dateFilter;
    }

    const usageSummary = await Transaction.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      ...(type ? [{ $match: { 'categoryInfo.type': type } }] : []),
      {
        $group: {
          _id: '$category',
          categoryName: { $first: '$categoryInfo.name' },
          categoryType: { $first: '$categoryInfo.type' },
          categoryColor: { $first: '$categoryInfo.color' },
          transactionCount: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          averageAmount: { $avg: '$amount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    return {
      summary: usageSummary,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null
      },
      type: type || 'all'
    };
  }
}

module.exports = CategoryService;
