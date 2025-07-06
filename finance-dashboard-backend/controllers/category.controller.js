const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');
const { categoryService } = require('../services');
const { 
  ErrorHandler, 
  ValidationError, 
  AuthenticationError, 
  ConflictError, 
  NotFoundError,
  RateLimitError 
} = require('../utils/errorHandler');

/**
 * Category Controller
 * Handles comprehensive category management operations
 */
class CategoryController {  /**
   * Get all categories for the authenticated user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getCategories = ErrorHandler.asyncHandler(async (req, res) => {
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
    } = req.query;

    const options = {
      type,
      includeInactive,
      includeStats,
      parentId,
      search,
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      sortBy,
      sortOrder
    };

    const result = await categoryService.getCategories(req.user.id, options);

    return ApiResponse.success(res, result, 'Categories retrieved successfully');
  });
  /**
   * Get category hierarchy for the authenticated user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getCategoryHierarchy = ErrorHandler.asyncHandler(async (req, res) => {
    const { type } = req.query;

    const result = await categoryService.getCategoryHierarchy(req.user.id, type);

    return ApiResponse.success(res, result, 'Category hierarchy retrieved successfully');
  });
  /**
   * Get a specific category by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getCategoryById = ErrorHandler.asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await categoryService.getCategoryById(id, req.user.id);

    return ApiResponse.success(res, result, 'Category retrieved successfully');
  });
  /**
   * Create a new category
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static createCategory = ErrorHandler.asyncHandler(async (req, res) => {
    const {
      name,
      type,
      description,
      color,
      icon,
      parent,
      sortOrder,
      budgetAllocation
    } = req.body;

    const categoryData = {
      name,
      type,
      description,
      color,
      icon,
      parent,
      sortOrder,
      budgetAllocation
    };

    const result = await categoryService.createCategory(req.user.id, categoryData);

    return ApiResponse.success(res, result, 'Category created successfully', 201);
  });
  /**
   * Update an existing category
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static updateCategory = ErrorHandler.asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const result = await categoryService.updateCategory(id, req.user.id, updates);

    return ApiResponse.success(res, result, 'Category updated successfully');
  });
  /**
   * Soft delete a category
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static deleteCategory = ErrorHandler.asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { force = false } = req.query;

    const result = await categoryService.deleteCategory(id, req.user.id, force);

    return ApiResponse.success(res, result, 'Category deleted successfully');
  });
  /**
   * Get category statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getCategoryStatistics = ErrorHandler.asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      includeSubcategories = false
    } = req.query;

    const options = {
      startDate,
      endDate,
      includeSubcategories
    };

    const result = await categoryService.getCategoryStatistics(id, req.user.id, options);

    return ApiResponse.success(res, result, 'Category statistics retrieved successfully');
  });
  /**
   * Search categories by name
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static searchCategories = ErrorHandler.asyncHandler(async (req, res) => {
    const { q: searchTerm, type, limit = 20 } = req.query;

    const options = {
      searchTerm,
      type,
      limit: Math.min(parseInt(limit), 50)
    };

    const result = await categoryService.searchCategories(req.user.id, options);

    return ApiResponse.success(res, result, 'Category search completed');
  });
  /**
   * Get category usage summary
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getCategoryUsageSummary = ErrorHandler.asyncHandler(async (req, res) => {
    const { type, startDate, endDate } = req.query;

    const options = {
      type,
      startDate,
      endDate
    };

    const result = await categoryService.getCategoryUsageSummary(req.user.id, options);

    return ApiResponse.success(res, result, 'Category usage summary retrieved successfully');
  });
}

module.exports = CategoryController;
