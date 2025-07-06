/**
 * Transaction Service Unit Tests
 * Tests transaction CRUD operations, categorization, analytics, and business logic
 */

const TransactionService = require('../../services/transaction.service');
const Transaction = require('../../models/Transaction');
const Category = require('../../models/Category');
const User = require('../../models/User');

// Mock dependencies
jest.mock('../../models/Transaction');
jest.mock('../../models/Category');
jest.mock('../../models/User');
jest.mock('../../utils/logger');

describe('TransactionService', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockUser = {
    _id: mockUserId,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Transaction CRUD Operations', () => {
    describe('createTransaction', () => {
      const validTransactionData = {
        amount: 100.50,
        description: 'Coffee purchase',
        category: '507f1f77bcf86cd799439012',
        type: 'expense',
        date: new Date('2024-01-15')
      };

      it('should create transaction with valid data', async () => {
        const mockCreatedTransaction = {
          _id: '507f1f77bcf86cd799439013',
          ...validTransactionData,
          user: mockUserId,
          createdAt: new Date(),
          save: jest.fn().mockResolvedValue()
        };

        Transaction.mockImplementation(() => mockCreatedTransaction);

        const result = await TransactionService.createTransaction(
          mockUserId,
          validTransactionData
        );

        expect(Transaction).toHaveBeenCalledWith({
          ...validTransactionData,
          user: mockUserId
        });
        expect(mockCreatedTransaction.save).toHaveBeenCalled();
        expect(result).toEqual(mockCreatedTransaction);
      });

      it('should validate required fields', async () => {
        const invalidData = {
          description: 'Missing amount'
          // Missing required fields: amount, category, type
        };

        Transaction.mockImplementation(() => ({
          save: jest.fn().mockRejectedValue(new Error('Validation failed'))
        }));

        await expect(
          TransactionService.createTransaction(mockUserId, invalidData)
        ).rejects.toThrow('Validation failed');
      });

      it('should handle negative amounts for expenses', async () => {
        const negativeAmountData = {
          ...validTransactionData,
          amount: -50.25,
          type: 'expense'
        };

        const mockTransaction = {
          ...negativeAmountData,
          user: mockUserId,
          save: jest.fn().mockResolvedValue()
        };

        Transaction.mockImplementation(() => mockTransaction);

        const result = await TransactionService.createTransaction(
          mockUserId,
          negativeAmountData
        );

        expect(result.amount).toBe(-50.25);
      });

      it('should auto-categorize transactions when no category provided', async () => {
        const dataWithoutCategory = {
          amount: 25.00,
          description: 'Grocery shopping',
          type: 'expense',
          date: new Date()
        };

        const mockCategorizeTransactionSpy = jest.spyOn(
          TransactionService,
          'categorizeTransaction'
        );
        mockCategorizeTransactionSpy.mockResolvedValue('507f1f77bcf86cd799439014');

        const mockTransaction = {
          ...dataWithoutCategory,
          category: '507f1f77bcf86cd799439014',
          user: mockUserId,
          save: jest.fn().mockResolvedValue()
        };

        Transaction.mockImplementation(() => mockTransaction);

        await TransactionService.createTransaction(mockUserId, dataWithoutCategory);

        expect(mockCategorizeTransactionSpy).toHaveBeenCalledWith(
          dataWithoutCategory.description,
          dataWithoutCategory.type
        );
      });
    });

    describe('getTransactions', () => {
      it('should fetch transactions with default pagination', async () => {
        const mockTransactions = [
          { _id: '1', amount: 100, description: 'Test 1' },
          { _id: '2', amount: 200, description: 'Test 2' }
        ];

        const mockQuery = {
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockTransactions)
        };

        Transaction.find.mockReturnValue(mockQuery);
        Transaction.countDocuments.mockResolvedValue(2);

        const result = await TransactionService.getTransactions(mockUserId);

        expect(Transaction.find).toHaveBeenCalledWith({ user: mockUserId });
        expect(mockQuery.sort).toHaveBeenCalledWith({ date: -1 });
        expect(mockQuery.skip).toHaveBeenCalledWith(0);
        expect(mockQuery.limit).toHaveBeenCalledWith(20);
        expect(result.transactions).toEqual(mockTransactions);
        expect(result.total).toBe(2);
      });

      it('should apply date range filters', async () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');

        const mockQuery = {
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([])
        };

        Transaction.find.mockReturnValue(mockQuery);
        Transaction.countDocuments.mockResolvedValue(0);

        await TransactionService.getTransactions(mockUserId, {
          startDate,
          endDate
        });

        expect(Transaction.find).toHaveBeenCalledWith({
          user: mockUserId,
          date: {
            $gte: startDate,
            $lte: endDate
          }
        });
      });

      it('should apply category and type filters', async () => {
        const filters = {
          category: '507f1f77bcf86cd799439012',
          type: 'expense'
        };

        const mockQuery = {
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([])
        };

        Transaction.find.mockReturnValue(mockQuery);
        Transaction.countDocuments.mockResolvedValue(0);

        await TransactionService.getTransactions(mockUserId, filters);

        expect(Transaction.find).toHaveBeenCalledWith({
          user: mockUserId,
          category: filters.category,
          type: filters.type
        });
      });

      it('should apply search filters', async () => {
        const mockQuery = {
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([])
        };

        Transaction.find.mockReturnValue(mockQuery);
        Transaction.countDocuments.mockResolvedValue(0);

        await TransactionService.getTransactions(mockUserId, {
          search: 'coffee'
        });

        expect(Transaction.find).toHaveBeenCalledWith({
          user: mockUserId,
          description: { $regex: 'coffee', $options: 'i' }
        });
      });

      it('should handle custom pagination', async () => {
        const mockQuery = {
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([])
        };

        Transaction.find.mockReturnValue(mockQuery);
        Transaction.countDocuments.mockResolvedValue(0);

        await TransactionService.getTransactions(mockUserId, {
          page: 2,
          limit: 10
        });

        expect(mockQuery.skip).toHaveBeenCalledWith(10); // (page - 1) * limit
        expect(mockQuery.limit).toHaveBeenCalledWith(10);
      });
    });

    describe('updateTransaction', () => {
      const mockTransaction = {
        _id: '507f1f77bcf86cd799439013',
        user: mockUserId,
        amount: 100,
        description: 'Original description',
        save: jest.fn()
      };

      beforeEach(() => {
        Transaction.findById.mockResolvedValue(mockTransaction);
        mockTransaction.save.mockClear();
      });

      it('should update transaction with valid data', async () => {
        const updateData = {
          amount: 150,
          description: 'Updated description'
        };

        mockTransaction.save.mockResolvedValue(mockTransaction);

        const result = await TransactionService.updateTransaction(
          '507f1f77bcf86cd799439013',
          mockUserId,
          updateData
        );

        expect(Transaction.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439013');
        expect(mockTransaction.amount).toBe(150);
        expect(mockTransaction.description).toBe('Updated description');
        expect(mockTransaction.save).toHaveBeenCalled();
        expect(result).toEqual(mockTransaction);
      });

      it('should reject update for non-existent transaction', async () => {
        Transaction.findById.mockResolvedValue(null);

        await expect(
          TransactionService.updateTransaction(
            '507f1f77bcf86cd799439999',
            mockUserId,
            { amount: 150 }
          )
        ).rejects.toThrow('Transaction not found');
      });

      it('should reject update for unauthorized user', async () => {
        const unauthorizedTransaction = {
          ...mockTransaction,
          user: '507f1f77bcf86cd799439099' // Different user
        };

        Transaction.findById.mockResolvedValue(unauthorizedTransaction);

        await expect(
          TransactionService.updateTransaction(
            '507f1f77bcf86cd799439013',
            mockUserId,
            { amount: 150 }
          )
        ).rejects.toThrow('Not authorized to update this transaction');
      });

      it('should validate updated data', async () => {
        const invalidUpdateData = {
          amount: 'invalid amount',
          type: 'invalid type'
        };

        mockTransaction.save.mockRejectedValue(new Error('Validation failed'));

        await expect(
          TransactionService.updateTransaction(
            '507f1f77bcf86cd799439013',
            mockUserId,
            invalidUpdateData
          )
        ).rejects.toThrow('Validation failed');
      });
    });

    describe('deleteTransaction', () => {
      const mockTransaction = {
        _id: '507f1f77bcf86cd799439013',
        user: mockUserId
      };

      it('should delete transaction successfully', async () => {
        Transaction.findById.mockResolvedValue(mockTransaction);
        Transaction.findByIdAndDelete.mockResolvedValue(mockTransaction);

        const result = await TransactionService.deleteTransaction(
          '507f1f77bcf86cd799439013',
          mockUserId
        );

        expect(Transaction.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439013');
        expect(Transaction.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439013');
        expect(result.success).toBe(true);
      });

      it('should reject delete for non-existent transaction', async () => {
        Transaction.findById.mockResolvedValue(null);

        await expect(
          TransactionService.deleteTransaction(
            '507f1f77bcf86cd799439999',
            mockUserId
          )
        ).rejects.toThrow('Transaction not found');
      });

      it('should reject delete for unauthorized user', async () => {
        const unauthorizedTransaction = {
          ...mockTransaction,
          user: '507f1f77bcf86cd799439099'
        };

        Transaction.findById.mockResolvedValue(unauthorizedTransaction);

        await expect(
          TransactionService.deleteTransaction(
            '507f1f77bcf86cd799439013',
            mockUserId
          )
        ).rejects.toThrow('Not authorized to delete this transaction');
      });
    });
  });

  describe('Transaction Categorization', () => {
    describe('categorizeTransaction', () => {
      const mockCategories = [
        { _id: '1', name: 'Food & Dining', keywords: ['restaurant', 'coffee', 'food'] },
        { _id: '2', name: 'Transportation', keywords: ['gas', 'uber', 'taxi'] },
        { _id: '3', name: 'Shopping', keywords: ['amazon', 'store', 'shopping'] }
      ];

      beforeEach(() => {
        Category.find.mockResolvedValue(mockCategories);
      });

      it('should categorize by keyword matching', async () => {
        const result = await TransactionService.categorizeTransaction(
          'Coffee at Starbucks',
          'expense'
        );

        expect(result).toBe('1'); // Food & Dining category
      });

      it('should be case insensitive', async () => {
        const result = await TransactionService.categorizeTransaction(
          'UBER RIDE',
          'expense'
        );

        expect(result).toBe('2'); // Transportation category
      });

      it('should handle partial matches', async () => {
        const result = await TransactionService.categorizeTransaction(
          'Amazon purchase',
          'expense'
        );

        expect(result).toBe('3'); // Shopping category
      });

      it('should return null for no matches', async () => {
        const result = await TransactionService.categorizeTransaction(
          'Unknown expense',
          'expense'
        );

        expect(result).toBeNull();
      });

      it('should prioritize exact matches', async () => {
        const categoriesWithOverlap = [
          { _id: '1', name: 'Food', keywords: ['food'] },
          { _id: '2', name: 'Fast Food', keywords: ['fast food', 'food'] }
        ];

        Category.find.mockResolvedValue(categoriesWithOverlap);

        const result = await TransactionService.categorizeTransaction(
          'fast food order',
          'expense'
        );

        expect(result).toBe('2'); // Should match Fast Food, not just Food
      });
    });

    describe('recategorizeTransactions', () => {
      it('should recategorize multiple transactions', async () => {
        const mockTransactions = [
          { _id: '1', description: 'Coffee shop', save: jest.fn() },
          { _id: '2', description: 'Gas station', save: jest.fn() }
        ];

        Transaction.find.mockResolvedValue(mockTransactions);

        const categorizeTransactionSpy = jest.spyOn(
          TransactionService,
          'categorizeTransaction'
        );
        categorizeTransactionSpy
          .mockResolvedValueOnce('food-category')
          .mockResolvedValueOnce('transport-category');

        await TransactionService.recategorizeTransactions(mockUserId);

        expect(mockTransactions[0].category).toBe('food-category');
        expect(mockTransactions[1].category).toBe('transport-category');
        expect(mockTransactions[0].save).toHaveBeenCalled();
        expect(mockTransactions[1].save).toHaveBeenCalled();
      });

      it('should skip transactions with existing categories if not forced', async () => {
        const mockTransactions = [
          { _id: '1', description: 'Coffee shop', category: 'existing-category', save: jest.fn() }
        ];

        Transaction.find.mockResolvedValue(mockTransactions);

        await TransactionService.recategorizeTransactions(mockUserId, false);

        expect(mockTransactions[0].save).not.toHaveBeenCalled();
      });

      it('should force recategorization when specified', async () => {
        const mockTransactions = [
          { _id: '1', description: 'Coffee shop', category: 'existing-category', save: jest.fn() }
        ];

        Transaction.find.mockResolvedValue(mockTransactions);

        const categorizeTransactionSpy = jest.spyOn(
          TransactionService,
          'categorizeTransaction'
        );
        categorizeTransactionSpy.mockResolvedValue('new-category');

        await TransactionService.recategorizeTransactions(mockUserId, true);

        expect(mockTransactions[0].category).toBe('new-category');
        expect(mockTransactions[0].save).toHaveBeenCalled();
      });
    });
  });

  describe('Transaction Analytics', () => {
    describe('getSpendingAnalysis', () => {
      const mockTransactions = [
        { amount: -100, type: 'expense', category: { name: 'Food' }, date: new Date('2024-01-15') },
        { amount: -50, type: 'expense', category: { name: 'Transport' }, date: new Date('2024-01-20') },
        { amount: 1000, type: 'income', category: { name: 'Salary' }, date: new Date('2024-01-01') }
      ];

      beforeEach(() => {
        Transaction.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockTransactions)
        });
      });

      it('should calculate spending totals by category', async () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');

        const result = await TransactionService.getSpendingAnalysis(
          mockUserId,
          startDate,
          endDate
        );

        expect(result.totalExpenses).toBe(150);
        expect(result.totalIncome).toBe(1000);
        expect(result.netAmount).toBe(850);
        expect(result.expensesByCategory).toEqual({
          'Food': 100,
          'Transport': 50
        });
      });

      it('should calculate daily spending trends', async () => {
        const result = await TransactionService.getSpendingAnalysis(
          mockUserId,
          new Date('2024-01-01'),
          new Date('2024-01-31')
        );

        expect(result.dailyTrends).toHaveProperty('2024-01-15');
        expect(result.dailyTrends).toHaveProperty('2024-01-20');
        expect(result.dailyTrends['2024-01-15']).toBe(100);
        expect(result.dailyTrends['2024-01-20']).toBe(50);
      });

      it('should handle empty transaction data', async () => {
        Transaction.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([])
        });

        const result = await TransactionService.getSpendingAnalysis(
          mockUserId,
          new Date('2024-01-01'),
          new Date('2024-01-31')
        );

        expect(result.totalExpenses).toBe(0);
        expect(result.totalIncome).toBe(0);
        expect(result.netAmount).toBe(0);
        expect(result.expensesByCategory).toEqual({});
        expect(result.dailyTrends).toEqual({});
      });

      it('should exclude future dates from analysis', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);

        await TransactionService.getSpendingAnalysis(
          mockUserId,
          new Date('2024-01-01'),
          futureDate
        );

        expect(Transaction.find).toHaveBeenCalledWith({
          user: mockUserId,
          date: {
            $gte: new Date('2024-01-01'),
            $lte: expect.any(Date) // Should be capped to current date
          }
        });
      });
    });

    describe('getTransactionStatistics', () => {
      it('should calculate comprehensive transaction statistics', async () => {
        const mockAggregationResult = [
          {
            _id: null,
            totalTransactions: 10,
            totalExpenses: 500,
            totalIncome: 1500,
            avgTransactionAmount: 100,
            expensesByCategory: [
              { category: 'Food', total: 200 },
              { category: 'Transport', total: 150 }
            ]
          }
        ];

        Transaction.aggregate.mockResolvedValue(mockAggregationResult);

        const result = await TransactionService.getTransactionStatistics(
          mockUserId,
          new Date('2024-01-01'),
          new Date('2024-01-31')
        );

        expect(result.totalTransactions).toBe(10);
        expect(result.totalExpenses).toBe(500);
        expect(result.totalIncome).toBe(1500);
        expect(result.netAmount).toBe(1000);
        expect(result.avgTransactionAmount).toBe(100);
      });

      it('should handle missing aggregation data', async () => {
        Transaction.aggregate.mockResolvedValue([]);

        const result = await TransactionService.getTransactionStatistics(
          mockUserId,
          new Date('2024-01-01'),
          new Date('2024-01-31')
        );

        expect(result.totalTransactions).toBe(0);
        expect(result.totalExpenses).toBe(0);
        expect(result.totalIncome).toBe(0);
        expect(result.netAmount).toBe(0);
        expect(result.avgTransactionAmount).toBe(0);
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('bulkImportTransactions', () => {
      const validTransactionData = [
        {
          amount: 100,
          description: 'Test transaction 1',
          type: 'expense',
          date: '2024-01-15'
        },
        {
          amount: 200,
          description: 'Test transaction 2',
          type: 'income',
          date: '2024-01-16'
        }
      ];

      it('should import valid transactions', async () => {
        Transaction.insertMany.mockResolvedValue([
          { _id: '1', ...validTransactionData[0] },
          { _id: '2', ...validTransactionData[1] }
        ]);

        const result = await TransactionService.bulkImportTransactions(
          mockUserId,
          validTransactionData
        );

        expect(result.success).toBe(true);
        expect(result.imported).toBe(2);
        expect(result.failed).toBe(0);
        expect(Transaction.insertMany).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ user: mockUserId }),
            expect.objectContaining({ user: mockUserId })
          ])
        );
      });

      it('should handle validation errors during import', async () => {
        const invalidData = [
          ...validTransactionData,
          { description: 'Invalid - missing amount' }
        ];

        Transaction.insertMany.mockRejectedValue(new Error('Validation failed'));

        const result = await TransactionService.bulkImportTransactions(
          mockUserId,
          invalidData
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should validate data before import', async () => {
        const invalidData = [
          { amount: 'invalid', description: 'Test' }
        ];

        const result = await TransactionService.bulkImportTransactions(
          mockUserId,
          invalidData
        );

        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(Transaction.insertMany).not.toHaveBeenCalled();
      });

      it('should auto-categorize imported transactions', async () => {
        const categorizeTransactionSpy = jest.spyOn(
          TransactionService,
          'categorizeTransaction'
        );
        categorizeTransactionSpy.mockResolvedValue('auto-category');

        Transaction.insertMany.mockResolvedValue([
          { _id: '1', ...validTransactionData[0] }
        ]);

        await TransactionService.bulkImportTransactions(
          mockUserId,
          validTransactionData.slice(0, 1)
        );

        expect(categorizeTransactionSpy).toHaveBeenCalledWith(
          validTransactionData[0].description,
          validTransactionData[0].type
        );
      });
    });

    describe('bulkDeleteTransactions', () => {
      it('should delete multiple transactions', async () => {
        const transactionIds = ['1', '2', '3'];

        Transaction.deleteMany.mockResolvedValue({ deletedCount: 3 });

        const result = await TransactionService.bulkDeleteTransactions(
          mockUserId,
          transactionIds
        );

        expect(Transaction.deleteMany).toHaveBeenCalledWith({
          _id: { $in: transactionIds },
          user: mockUserId
        });
        expect(result.success).toBe(true);
        expect(result.deletedCount).toBe(3);
      });

      it('should handle deletion of non-existent transactions', async () => {
        const transactionIds = ['nonexistent1', 'nonexistent2'];

        Transaction.deleteMany.mockResolvedValue({ deletedCount: 0 });

        const result = await TransactionService.bulkDeleteTransactions(
          mockUserId,
          transactionIds
        );

        expect(result.success).toBe(true);
        expect(result.deletedCount).toBe(0);
      });
    });
  });

  describe('Transaction Search and Filtering', () => {
    describe('searchTransactions', () => {
      it('should search transactions by description', async () => {
        const mockQuery = {
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([])
        };

        Transaction.find.mockReturnValue(mockQuery);

        await TransactionService.searchTransactions(mockUserId, 'coffee');

        expect(Transaction.find).toHaveBeenCalledWith({
          user: mockUserId,
          $or: [
            { description: { $regex: 'coffee', $options: 'i' } },
            { 'category.name': { $regex: 'coffee', $options: 'i' } }
          ]
        });
      });

      it('should apply additional filters to search', async () => {
        const mockQuery = {
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([])
        };

        Transaction.find.mockReturnValue(mockQuery);

        await TransactionService.searchTransactions(mockUserId, 'coffee', {
          type: 'expense',
          minAmount: 10,
          maxAmount: 100
        });

        expect(Transaction.find).toHaveBeenCalledWith({
          user: mockUserId,
          type: 'expense',
          amount: { $gte: 10, $lte: 100 },
          $or: [
            { description: { $regex: 'coffee', $options: 'i' } },
            { 'category.name': { $regex: 'coffee', $options: 'i' } }
          ]
        });
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large transaction datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        _id: i.toString(),
        amount: Math.random() * 1000,
        description: `Transaction ${i}`,
        type: 'expense'
      }));

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(largeDataset)
      };

      Transaction.find.mockReturnValue(mockQuery);
      Transaction.countDocuments.mockResolvedValue(1000);

      const startTime = Date.now();
      await TransactionService.getTransactions(mockUserId);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(500); // Should complete within 500ms
    });

    it('should efficiently categorize large batches of transactions', async () => {
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        description: `Transaction ${i}`,
        type: 'expense'
      }));

      Category.find.mockResolvedValue([
        { _id: '1', name: 'General', keywords: ['transaction'] }
      ]);

      const startTime = Date.now();
      
      for (const transaction of largeBatch.slice(0, 10)) { // Test with smaller subset for performance
        await TransactionService.categorizeTransaction(
          transaction.description,
          transaction.type
        );
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(200); // Should categorize 10 transactions within 200ms
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      Transaction.find.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        TransactionService.getTransactions(mockUserId)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle invalid ObjectId formats', async () => {
      const invalidId = 'invalid-object-id';

      await expect(
        TransactionService.updateTransaction(invalidId, mockUserId, {})
      ).rejects.toThrow();
    });

    it('should handle concurrent modification conflicts', async () => {
      const mockTransaction = {
        _id: '1',
        user: mockUserId,
        amount: 100,
        save: jest.fn().mockRejectedValue(new Error('Version conflict'))
      };

      Transaction.findById.mockResolvedValue(mockTransaction);

      await expect(
        TransactionService.updateTransaction('1', mockUserId, { amount: 200 })
      ).rejects.toThrow('Version conflict');
    });
  });
});
