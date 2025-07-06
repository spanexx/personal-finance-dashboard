/**
 * Transaction Import Service Unit Tests
 * Tests file parsing, data validation, and transaction import functionality
 */

// Mock dependencies first
jest.mock('../../models/Category');
jest.mock('../../models/Transaction');
jest.mock('fs');
jest.mock('csv-parser');
jest.mock('exceljs');
jest.mock('../../utils/logger');

const TransactionImportService = require('../../services/transactionImport.service');
const Category = require('../../models/Category');
const Transaction = require('../../models/Transaction');

describe('TransactionImportService', () => {
  let mockTransaction;
  let mockCategory;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock transaction
    mockTransaction = {
      _id: 'trans123',
      userId: 'user123',
      amount: 100.50,
      description: 'Test Transaction',
      category: 'cat123',
      type: 'expense',
      date: new Date('2024-01-15'),
      save: jest.fn().mockResolvedValue(),
      validate: jest.fn().mockResolvedValue()
    };

    // Mock category
    mockCategory = {
      _id: 'cat123',
      name: 'Groceries',
      type: 'expense',
      userId: 'user123',
      save: jest.fn().mockResolvedValue()
    };

    // Setup default mocks
    Transaction.mockImplementation(() => mockTransaction);
    Category.findOne.mockResolvedValue(mockCategory);
    Category.mockImplementation(() => mockCategory);
  });

  describe('File Validation', () => {
    describe('validateFile', () => {
      it('should validate CSV file successfully', async () => {
        const file = {
          originalname: 'transactions.csv',
          mimetype: 'text/csv',
          size: 1024
        };

        const result = await TransactionImportService.validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.format).toBe('csv');
        expect(result.errors).toHaveLength(0);
      });

      it('should validate Excel file successfully', async () => {
        const file = {
          originalname: 'transactions.xlsx',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 2048
        };

        const result = await TransactionImportService.validateFile(file);

        expect(result.isValid).toBe(true);
        expect(result.format).toBe('excel');
        expect(result.errors).toHaveLength(0);
      });

      it('should reject unsupported file formats', async () => {
        const file = {
          originalname: 'transactions.pdf',
          mimetype: 'application/pdf',
          size: 1024
        };

        const result = await TransactionImportService.validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Unsupported file format. Please use CSV or Excel files.');
      });

      it('should reject files that are too large', async () => {
        const file = {
          originalname: 'transactions.csv',
          mimetype: 'text/csv',
          size: 10 * 1024 * 1024 + 1 // > 10MB
        };

        const result = await TransactionImportService.validateFile(file);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('File size exceeds 10MB limit.');
      });
    });
  });

  describe('Data Validation', () => {
    describe('validateTransactionData', () => {
      it('should validate correct transaction data', async () => {
        const transactionData = {
          date: '2024-01-15',
          amount: '100.50',
          description: 'Groceries',
          category: 'Food',
          type: 'expense'
        };

        const result = await TransactionImportService.validateTransactionData(transactionData);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.data.amount).toBe(100.50);
        expect(result.data.date).toBeInstanceOf(Date);
      });

      it('should reject invalid date format', async () => {
        const transactionData = {
          date: 'invalid-date',
          amount: '100.50',
          description: 'Groceries',
          category: 'Food',
          type: 'expense'
        };

        const result = await TransactionImportService.validateTransactionData(transactionData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid date format');
      });

      it('should reject invalid amount', async () => {
        const transactionData = {
          date: '2024-01-15',
          amount: 'not-a-number',
          description: 'Groceries',
          category: 'Food',
          type: 'expense'
        };

        const result = await TransactionImportService.validateTransactionData(transactionData);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid amount format');
      });
    });
  });

  describe('Category Management', () => {
    describe('findOrCreateCategory', () => {
      it('should find existing category', async () => {
        const userId = 'user123';
        const categoryName = 'Groceries';
        const type = 'expense';

        Category.findOne.mockResolvedValue(mockCategory);

        const result = await TransactionImportService.findOrCreateCategory(userId, categoryName, type);

        expect(Category.findOne).toHaveBeenCalledWith({
          userId,
          name: categoryName,
          type
        });
        expect(result).toBe(mockCategory);
      });

      it('should create new category if not found', async () => {
        const userId = 'user123';
        const categoryName = 'New Category';
        const type = 'expense';

        Category.findOne.mockResolvedValue(null);
        Category.mockImplementation(() => mockCategory);

        const result = await TransactionImportService.findOrCreateCategory(userId, categoryName, type);

        expect(Category.findOne).toHaveBeenCalledWith({
          userId,
          name: categoryName,
          type
        });
        expect(Category).toHaveBeenCalledWith({
          userId,
          name: categoryName,
          type,
          color: expect.any(String),
          icon: expect.any(String)
        });
        expect(mockCategory.save).toHaveBeenCalled();
        expect(result).toBe(mockCategory);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during transaction save', async () => {
      const userId = 'user123';
      const transactionData = {
        date: '2024-01-15',
        amount: '100.50',
        description: 'Groceries',
        category: 'Food',
        type: 'expense'
      };

      // Mock transaction save to fail
      mockTransaction.save.mockRejectedValue(new Error('Database error'));

      const result = await TransactionImportService.processTransaction(userId, transactionData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });
});
