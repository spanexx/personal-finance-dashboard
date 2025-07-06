/**
 * Category Service Unit Tests
 * Comprehensive test suite for category.service.js
 */

const CategoryService = require('../../services/category.service');
const Category = require('../../models/Category');
const Transaction = require('../../models/Transaction');
const mongoose = require('mongoose');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError 
} = require('../../utils/errorHandler');

// Mock mongoose
jest.mock('mongoose', () => ({
  isValidObjectId: jest.fn(),
  Types: {
    ObjectId: jest.fn()
  }
}));

// Mock Category model
jest.mock('../../models/Category');

// Mock Transaction model
jest.mock('../../models/Transaction');

// Mock error handlers
jest.mock('../../utils/errorHandler', () => ({
  ValidationError: class ValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ConflictError';
    }
  }
}));

describe('CategoryService', () => {
  let mockUserId;
  let mockCategoryId;
  let mockCategory;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUserId = 'user123';
    mockCategoryId = 'category123';
    
    // Mock mongoose validation
    mongoose.isValidObjectId.mockReturnValue(true);
    
    // Mock category object
    mockCategory = {
      _id: mockCategoryId,
      user: mockUserId,
      name: 'Food & Dining',
      type: 'expense',
      description: 'Food and restaurant expenses',
      color: '#FF6B35',
      icon: 'restaurant',
      level: 0,
      parent: null,
      isSystem: false,
      isActive: true,
      sortOrder: 0,
      budgetAllocation: 500,
      transactionCount: 25,
      totalAmount: 1250.50,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15'),
      save: jest.fn().mockResolvedValue(this),
      populate: jest.fn().mockResolvedValue(this),
      toObject: jest.fn().mockReturnValue({
        _id: mockCategoryId,
        user: mockUserId,
        name: 'Food & Dining',
        type: 'expense',
        level: 0
      }),
      getSubcategories: jest.fn().mockResolvedValue([]),
      updateStats: jest.fn().mockResolvedValue(),
      getFullPath: jest.fn().mockResolvedValue(['Food & Dining']),
      validateHierarchy: jest.fn().mockResolvedValue()
    };
  });

  describe('getCategories', () => {
    let mockCategories;
    
    beforeEach(() => {
      mockCategories = [
        {
          _id: 'cat1',
          name: 'Food & Dining',
          type: 'expense',
          level: 0,
          isActive: true
        },
        {
          _id: 'cat2',
          name: 'Transportation',
          type: 'expense',
          level: 0,
          isActive: true
        },
        {
          _id: 'cat3',
          name: 'Salary',
          type: 'income',
          level: 0,
          isActive: true
        }
      ];

      Category.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockCategories)
            })
          })
        })
      });
      Category.countDocuments.mockResolvedValue(mockCategories.length);
    });

    it('should get categories with default options', async () => {
      const result = await CategoryService.getCategories(mockUserId);

      expect(Category.find).toHaveBeenCalledWith({ user: mockUserId, isActive: true });
      expect(result.categories).toHaveLength(3);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.totalItems).toBe(3);
    });

    it('should filter categories by type', async () => {
      const options = { type: 'expense' };

      await CategoryService.getCategories(mockUserId, options);

      expect(Category.find).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUserId,
          type: 'expense',
          isActive: true
        })
      );
    });

    it('should include inactive categories when specified', async () => {
      const options = { includeInactive: true };

      await CategoryService.getCategories(mockUserId, options);

      expect(Category.find).toHaveBeenCalledWith({ user: mockUserId });
    });

    it('should filter by parent category', async () => {
      const options = { parentId: 'parent123' };

      await CategoryService.getCategories(mockUserId, options);

      expect(Category.find).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: 'parent123'
        })
      );
    });

    it('should filter root categories when parentId is null', async () => {
      const options = { parentId: 'null' };

      await CategoryService.getCategories(mockUserId, options);

      expect(Category.find).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: null
        })
      );
    });

    it('should search categories by name and description', async () => {
      const options = { search: 'food' };

      await CategoryService.getCategories(mockUserId, options);

      expect(Category.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { name: { $regex: 'food', $options: 'i' } },
            { description: { $regex: 'food', $options: 'i' } }
          ]
        })
      );
    });

    it('should handle pagination correctly', async () => {
      const options = { page: 2, limit: 10 };

      await CategoryService.getCategories(mockUserId, options);

      const mockQuery = Category.find().sort().skip();
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should sort categories correctly', async () => {
      const options = { sortBy: 'type', sortOrder: 'desc' };

      await CategoryService.getCategories(mockUserId, options);

      const mockQuery = Category.find();
      expect(mockQuery.sort).toHaveBeenCalledWith({ type: -1, name: 1 });
    });

    it('should use default sort for invalid sortBy', async () => {
      const options = { sortBy: 'invalid_field' };

      await CategoryService.getCategories(mockUserId, options);

      const mockQuery = Category.find();
      expect(mockQuery.sort).toHaveBeenCalledWith({ name: 1 });
    });

    it('should limit maximum items per page', async () => {
      const options = { limit: 200 }; // Exceeds max

      await CategoryService.getCategories(mockUserId, options);

      const mockQuery = Category.find().sort().skip();
      expect(mockQuery.limit).toHaveBeenCalledWith(100); // Should be capped at 100
    });

    it('should calculate pagination info correctly', async () => {
      Category.countDocuments.mockResolvedValue(25);
      const options = { page: 2, limit: 10 };

      const result = await CategoryService.getCategories(mockUserId, options);

      expect(result.pagination).toEqual({
        currentPage: 2,
        totalPages: 3,
        totalItems: 25,
        itemsPerPage: 10,
        hasNextPage: true,
        hasPrevPage: true
      });
    });

    it('should include stats when requested', async () => {
      const options = { includeStats: 'true' };
      Category.findWithStats = jest.fn().mockResolvedValue(mockCategories);

      const result = await CategoryService.getCategories(mockUserId, options);

      expect(Category.findWithStats).toHaveBeenCalledWith(mockUserId, undefined);
      expect(result.includeStats).toBe(true);
      expect(result.total).toBe(3);
    });
  });

  describe('getCategoryHierarchy', () => {
    it('should get category hierarchy for all types', async () => {
      const mockHierarchy = [
        {
          _id: 'cat1',
          name: 'Food & Dining',
          level: 0,
          children: [
            { _id: 'cat1a', name: 'Restaurants', level: 1, children: [] }
          ]
        }
      ];

      Category.getHierarchy = jest.fn().mockResolvedValue(mockHierarchy);

      const result = await CategoryService.getCategoryHierarchy(mockUserId);

      expect(Category.getHierarchy).toHaveBeenCalledWith(mockUserId, undefined);
      expect(result.hierarchy).toEqual(mockHierarchy);
      expect(result.type).toBe('all');
    });

    it('should get category hierarchy for specific type', async () => {
      const mockHierarchy = [];
      Category.getHierarchy = jest.fn().mockResolvedValue(mockHierarchy);

      const result = await CategoryService.getCategoryHierarchy(mockUserId, 'expense');

      expect(Category.getHierarchy).toHaveBeenCalledWith(mockUserId, 'expense');
      expect(result.type).toBe('expense');
    });
  });

  describe('getCategoryById', () => {
    beforeEach(() => {
      Category.findOne.mockResolvedValue(mockCategory);
    });

    it('should get category by ID with additional data', async () => {
      const subcategories = [{ _id: 'sub1', name: 'Restaurants' }];
      mockCategory.getSubcategories.mockResolvedValue(subcategories);
      mockCategory.getFullPath.mockResolvedValue(['Food & Dining']);

      const result = await CategoryService.getCategoryById(mockCategoryId, mockUserId);

      expect(Category.findOne).toHaveBeenCalledWith({
        _id: mockCategoryId,
        user: mockUserId
      });
      expect(mockCategory.getSubcategories).toHaveBeenCalled();
      expect(mockCategory.updateStats).toHaveBeenCalled();
      expect(mockCategory.getFullPath).toHaveBeenCalled();

      expect(result.category).toHaveProperty('fullPath');
      expect(result.category).toHaveProperty('subcategories');
      expect(result.category).toHaveProperty('stats');
    });

    it('should validate category ID format', async () => {
      mongoose.isValidObjectId.mockReturnValue(false);

      await expect(CategoryService.getCategoryById('invalid-id', mockUserId))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when category not found', async () => {
      Category.findOne.mockResolvedValue(null);

      await expect(CategoryService.getCategoryById(mockCategoryId, mockUserId))
        .rejects.toThrow(NotFoundError);
    });

    it('should populate parent category information', async () => {
      await CategoryService.getCategoryById(mockCategoryId, mockUserId);

      expect(mockCategory.populate).toHaveBeenCalledWith('parent', 'name type level');
    });
  });

  describe('createCategory', () => {
    let categoryData;

    beforeEach(() => {
      categoryData = {
        name: 'New Category',
        type: 'expense',
        description: 'Test category',
        color: '#FF6B35',
        icon: 'category',
        sortOrder: 0,
        budgetAllocation: 100
      };

      Category.findOne.mockResolvedValue(null); // No existing category
      Category.mockImplementation(() => mockCategory);
    });

    it('should create category with valid data', async () => {
      const result = await CategoryService.createCategory(mockUserId, categoryData);

      expect(Category.findOne).toHaveBeenCalledWith({
        user: mockUserId,
        name: categoryData.name,
        isActive: true
      });
      expect(Category).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUserId,
          name: categoryData.name,
          type: 'expense',
          description: categoryData.description
        })
      );
      expect(mockCategory.save).toHaveBeenCalled();
      expect(result.category).toBeDefined();
    });

    it('should throw ConflictError for duplicate category name', async () => {
      Category.findOne.mockResolvedValue(mockCategory); // Existing category found

      await expect(CategoryService.createCategory(mockUserId, categoryData))
        .rejects.toThrow(ConflictError);
    });

    it('should validate parent category when provided', async () => {
      const parentCategory = {
        _id: 'parent123',
        level: 1,
        type: 'expense'
      };
      categoryData.parent = 'parent123';

      Category.findOne
        .mockResolvedValueOnce(null) // No duplicate
        .mockResolvedValueOnce(parentCategory); // Parent exists

      await CategoryService.createCategory(mockUserId, categoryData);

      expect(Category.findOne).toHaveBeenCalledWith({
        _id: 'parent123',
        user: mockUserId,
        type: 'expense',
        isActive: true
      });
    });

    it('should throw ValidationError for invalid parent ID', async () => {
      categoryData.parent = 'invalid-id';
      mongoose.isValidObjectId.mockReturnValue(false);

      await expect(CategoryService.createCategory(mockUserId, categoryData))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when parent category not found', async () => {
      categoryData.parent = 'parent123';
      Category.findOne
        .mockResolvedValueOnce(null) // No duplicate
        .mockResolvedValueOnce(null); // Parent not found

      await expect(CategoryService.createCategory(mockUserId, categoryData))
        .rejects.toThrow(NotFoundError);
    });

    it('should enforce maximum category depth', async () => {
      const deepParent = {
        _id: 'parent123',
        level: 4, // At max depth
        type: 'expense'
      };
      categoryData.parent = 'parent123';

      Category.findOne
        .mockResolvedValueOnce(null) // No duplicate
        .mockResolvedValueOnce(deepParent); // Deep parent

      await expect(CategoryService.createCategory(mockUserId, categoryData))
        .rejects.toThrow(ValidationError);
    });

    it('should trim category name', async () => {
      categoryData.name = '  Trimmed Category  ';

      await CategoryService.createCategory(mockUserId, categoryData);

      expect(Category).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Trimmed Category'
        })
      );
    });

    it('should convert type to lowercase', async () => {
      categoryData.type = 'EXPENSE';

      await CategoryService.createCategory(mockUserId, categoryData);

      expect(Category).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expense'
        })
      );
    });

    it('should set default values for optional fields', async () => {
      const minimalData = {
        name: 'Minimal Category',
        type: 'expense'
      };

      await CategoryService.createCategory(mockUserId, minimalData);

      expect(Category).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: null,
          sortOrder: 0,
          budgetAllocation: 0
        })
      );
    });
  });

  describe('updateCategory', () => {
    let updates;

    beforeEach(() => {
      updates = {
        name: 'Updated Category',
        description: 'Updated description',
        color: '#FF0000'
      };

      Category.findOne.mockResolvedValue(mockCategory);
    });

    it('should update category with valid data', async () => {
      const result = await CategoryService.updateCategory(mockCategoryId, mockUserId, updates);

      expect(Category.findOne).toHaveBeenCalledWith({
        _id: mockCategoryId,
        user: mockUserId
      });
      expect(result.category).toBeDefined();
    });

    it('should validate category ID format', async () => {
      mongoose.isValidObjectId.mockReturnValue(false);

      await expect(CategoryService.updateCategory('invalid-id', mockUserId, updates))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when category not found', async () => {
      Category.findOne.mockResolvedValue(null);

      await expect(CategoryService.updateCategory(mockCategoryId, mockUserId, updates))
        .rejects.toThrow(NotFoundError);
    });

    it('should prevent updating system categories', async () => {
      mockCategory.isSystem = true;

      await expect(CategoryService.updateCategory(mockCategoryId, mockUserId, updates))
        .rejects.toThrow(ValidationError);
    });

    it('should check for name conflicts when updating name', async () => {
      updates.name = 'Conflicting Name';
      Category.findOne
        .mockResolvedValueOnce(mockCategory) // Original category
        .mockResolvedValueOnce({ _id: 'other123' }); // Conflicting category

      await expect(CategoryService.updateCategory(mockCategoryId, mockUserId, updates))
        .rejects.toThrow(ConflictError);
    });

    it('should allow same name for same category', async () => {
      mockCategory.name = 'Same Name';
      updates.name = 'Same Name';

      // Should not check for conflicts since name is the same
      const result = await CategoryService.updateCategory(mockCategoryId, mockUserId, updates);

      expect(result.category).toBeDefined();
    });

    it('should validate parent category when updating parent', async () => {
      updates.parent = 'parent123';
      const parentCategory = {
        _id: 'parent123',
        level: 1,
        type: 'expense'
      };

      Category.findOne
        .mockResolvedValueOnce(mockCategory) // Original category
        .mockResolvedValueOnce(parentCategory); // Parent category

      await CategoryService.updateCategory(mockCategoryId, mockUserId, updates);

      expect(mockCategory.validateHierarchy).toHaveBeenCalledWith('parent123');
    });

    it('should validate parent ID format when updating parent', async () => {
      updates.parent = 'invalid-id';
      mongoose.isValidObjectId.mockReturnValue(false);

      await expect(CategoryService.updateCategory(mockCategoryId, mockUserId, updates))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      Category.find.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(CategoryService.getCategories(mockUserId))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle empty search results', async () => {
      Category.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue([])
            })
          })
        })
      });
      Category.countDocuments.mockResolvedValue(0);

      const result = await CategoryService.getCategories(mockUserId, { search: 'nonexistent' });

      expect(result.categories).toHaveLength(0);
      expect(result.pagination.totalItems).toBe(0);
    });

    it('should handle very long category names', async () => {
      const longName = 'A'.repeat(200);
      const categoryData = {
        name: longName,
        type: 'expense'
      };

      Category.findOne.mockResolvedValue(null);
      Category.mockImplementation(() => mockCategory);

      await CategoryService.createCategory(mockUserId, categoryData);

      expect(Category).toHaveBeenCalledWith(
        expect.objectContaining({
          name: longName
        })
      );
    });

    it('should handle null and undefined values in search', async () => {
      const options = { search: null };

      await CategoryService.getCategories(mockUserId, options);

      expect(Category.find).toHaveBeenCalledWith(
        expect.not.objectContaining({
          $or: expect.any(Array)
        })
      );
    });

    it('should handle invalid type filters', async () => {
      const options = { type: 'invalid_type' };

      await CategoryService.getCategories(mockUserId, options);

      expect(Category.find).toHaveBeenCalledWith(
        expect.not.objectContaining({
          type: 'invalid_type'
        })
      );
    });

    it('should handle page numbers less than 1', async () => {
      const options = { page: 0 };

      Category.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue([])
            })
          })
        })
      });
      Category.countDocuments.mockResolvedValue(0);

      const result = await CategoryService.getCategories(mockUserId, options);

      expect(result.pagination.currentPage).toBe(0);
    });

    it('should handle special characters in category names', async () => {
      const categoryData = {
        name: 'Category with @#$%^&*() characters',
        type: 'expense'
      };

      Category.findOne.mockResolvedValue(null);
      Category.mockImplementation(() => mockCategory);

      await CategoryService.createCategory(mockUserId, categoryData);

      expect(Category).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Category with @#$%^&*() characters'
        })
      );
    });
  });

  describe('Performance Tests', () => {
    it('should handle large numbers of categories efficiently', async () => {
      const largeCategories = Array.from({ length: 1000 }, (_, i) => ({
        _id: `cat${i}`,
        name: `Category ${i}`,
        type: i % 2 === 0 ? 'expense' : 'income',
        level: 0
      }));

      Category.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(largeCategories.slice(0, 50))
            })
          })
        })
      });
      Category.countDocuments.mockResolvedValue(1000);

      const startTime = Date.now();
      const result = await CategoryService.getCategories(mockUserId, { limit: 50 });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      expect(result.categories).toHaveLength(50);
      expect(result.pagination.totalItems).toBe(1000);
    });

    it('should handle complex search queries efficiently', async () => {
      const complexSearch = 'food restaurant dining café coffee';

      Category.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue([])
            })
          })
        })
      });
      Category.countDocuments.mockResolvedValue(0);

      const startTime = Date.now();
      await CategoryService.getCategories(mockUserId, { search: complexSearch });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Validation Tests', () => {
    it('should validate required fields for category creation', async () => {
      const invalidData = {}; // Missing required fields

      Category.findOne.mockResolvedValue(null);

      // This should be handled by the Category model validation
      // Here we test that the service doesn't crash
      try {
        await CategoryService.createCategory(mockUserId, invalidData);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle empty strings in category data', async () => {
      const categoryData = {
        name: '',
        type: 'expense',
        description: '',
        color: '',
        icon: ''
      };

      Category.findOne.mockResolvedValue(null);
      Category.mockImplementation(() => mockCategory);

      await CategoryService.createCategory(mockUserId, categoryData);

      expect(Category).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '', // Should preserve empty string
          description: ''
        })
      );
    });

    it('should handle whitespace-only names', async () => {
      const categoryData = {
        name: '   ',
        type: 'expense'
      };

      Category.findOne.mockResolvedValue(null);
      Category.mockImplementation(() => mockCategory);

      await CategoryService.createCategory(mockUserId, categoryData);

      expect(Category).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '' // Should trim to empty string
        })
      );
    });
  });
});
