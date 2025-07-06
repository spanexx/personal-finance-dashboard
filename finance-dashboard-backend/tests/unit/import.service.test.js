/**
 * Unit Tests for Import Service
 * Tests comprehensive data import functionality for CSV, Excel, and JSON formats
 * Covers transactions, budgets, goals, categories, and bank statement imports with validation
 */

const ImportService = require('../../services/import.service');
const Transaction = require('../../models/Transaction');
const Budget = require('../../models/Budget');
const Goal = require('../../models/Goal');
const Category = require('../../models/Category');
const User = require('../../models/User');
const ImportHistory = require('../../models/ImportHistory');
const { ValidationError } = require('../../utils/errorHandler');
const logger = require('../../utils/logger');
const fs = require('fs').promises;
const csv = require('csv-parser');
const ExcelJS = require('exceljs');
const moment = require('moment');

// Mock dependencies
jest.mock('../../models/Transaction');
jest.mock('../../models/Budget');
jest.mock('../../models/Goal');
jest.mock('../../models/Category');
jest.mock('../../models/User');
jest.mock('../../models/ImportHistory');
jest.mock('../../utils/logger');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    unlink: jest.fn()
  },
  createReadStream: jest.fn()
}));
jest.mock('csv-parser');
jest.mock('exceljs');
jest.mock('moment');

describe('ImportService', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockFile = {
    originalname: 'transactions.csv',
    mimetype: 'text/csv',
    path: '/tmp/upload_123.csv',
    size: 1024
  };

  const mockTransaction = {
    _id: '507f1f77bcf86cd799439012',
    user: mockUserId,
    date: new Date('2024-01-15'),
    description: 'Coffee Shop',
    amount: 5.50,
    type: 'expense',
    status: 'completed'
  };

  const mockCategory = {
    _id: '507f1f77bcf86cd799439013',
    name: 'Food & Dining',
    type: 'expense',
    user: mockUserId
  };

  const mockBudget = {
    _id: '507f1f77bcf86cd799439014',
    name: 'Monthly Food Budget',
    amount: 500,
    period: 'monthly',
    user: mockUserId
  };

  const mockGoal = {
    _id: '507f1f77bcf86cd799439015',
    name: 'Emergency Fund',
    targetAmount: 10000,
    currentAmount: 7500,
    user: mockUserId
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock logger
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Mock fs operations
    fs.unlink = jest.fn().mockResolvedValue();
    fs.readFile = jest.fn();

    // Mock moment
    moment.mockImplementation((date) => ({
      toDate: () => new Date(date),
      isValid: () => true,
      isSame: () => false,
      isBefore: () => false,
      isAfter: () => false,
      add: () => ({ toDate: () => new Date() }),
      endOf: () => ({ toDate: () => new Date() })
    }));

    // Mock database models
    Transaction.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });
    Transaction.insertMany = jest.fn().mockResolvedValue([mockTransaction]);

    Budget.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });
    Budget.insertMany = jest.fn().mockResolvedValue([mockBudget]);

    Goal.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });
    Goal.insertMany = jest.fn().mockResolvedValue([mockGoal]);

    Category.findOne = jest.fn().mockResolvedValue(null);
    Category.create = jest.fn().mockResolvedValue(mockCategory);
    Category.find = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });
    Category.insertMany = jest.fn().mockResolvedValue([mockCategory]);

    ImportHistory.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      })
    });
    ImportHistory.countDocuments = jest.fn().mockResolvedValue(0);
    ImportHistory.findOne = jest.fn().mockResolvedValue(null);
  });

  describe('importData', () => {
    it('should successfully import transaction data from CSV', async () => {
      const options = {
        dataType: 'transactions',
        format: 'csv',
        skipDuplicates: true,
        batchSize: 100
      };

      const mockRawData = [
        {
          date: '2024-01-15',
          description: 'Coffee Shop',
          amount: '5.50',
          type: 'expense',
          category: 'Food & Dining'
        }
      ];

      // Mock parseFile
      jest.spyOn(ImportService, 'parseFile').mockResolvedValue(mockRawData);

      const result = await ImportService.importData(mockUserId, mockFile, options);

      expect(result).toEqual({
        importedCount: 1,
        totalRows: 1,
        validationErrors: [],
        duplicates: [],
        importErrors: [],
        summary: {
          processed: 1,
          validated: 1,
          imported: 1,
          skipped: 0,
          errors: 0
        }
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Starting import for user ${mockUserId}`)
      );
      expect(fs.unlink).toHaveBeenCalledWith(mockFile.path);
    });

    it('should throw ValidationError when file is missing', async () => {
      const options = { dataType: 'transactions' };

      await expect(ImportService.importData(mockUserId, null, options))
        .rejects.toThrow(ValidationError);
      await expect(ImportService.importData(mockUserId, null, options))
        .rejects.toThrow('Import file is required');
    });

    it('should throw ValidationError for invalid data type', async () => {
      const options = { dataType: 'invalid' };

      await expect(ImportService.importData(mockUserId, mockFile, options))
        .rejects.toThrow(ValidationError);
      await expect(ImportService.importData(mockUserId, mockFile, options))
        .rejects.toThrow('Invalid data type');
    });

    it('should throw ValidationError for invalid file type', async () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'application/pdf'
      };
      const options = { dataType: 'transactions' };

      await expect(ImportService.importData(mockUserId, invalidFile, options))
        .rejects.toThrow(ValidationError);
      await expect(ImportService.importData(mockUserId, invalidFile, options))
        .rejects.toThrow('Invalid file type');
    });

    it('should detect format from file mimetype when not provided', async () => {
      const options = { dataType: 'transactions' };
      const mockRawData = [{ date: '2024-01-15', description: 'Test', amount: '10' }];

      jest.spyOn(ImportService, 'parseFile').mockResolvedValue(mockRawData);
      jest.spyOn(ImportService, 'detectFileFormat').mockReturnValue('csv');

      await ImportService.importData(mockUserId, mockFile, options);

      expect(ImportService.detectFileFormat).toHaveBeenCalledWith(mockFile);
    });

    it('should clean up file on error', async () => {
      const options = { dataType: 'transactions' };

      jest.spyOn(ImportService, 'parseFile').mockRejectedValue(new Error('Parse failed'));

      await expect(ImportService.importData(mockUserId, mockFile, options))
        .rejects.toThrow('Parse failed');

      expect(fs.unlink).toHaveBeenCalledWith(mockFile.path);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle file cleanup failures gracefully', async () => {
      const options = { dataType: 'transactions' };
      const mockRawData = [{ date: '2024-01-15', description: 'Test', amount: '10' }];

      jest.spyOn(ImportService, 'parseFile').mockResolvedValue(mockRawData);
      fs.unlink.mockRejectedValue(new Error('Cleanup failed'));

      const result = await ImportService.importData(mockUserId, mockFile, options);

      expect(result.importedCount).toBe(1);
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to clean up uploaded file:',
        'Cleanup failed'
      );
    });

    it('should support budget import', async () => {
      const options = { dataType: 'budgets' };
      const mockRawData = [
        {
          name: 'Monthly Food Budget',
          amount: '500',
          period: 'monthly',
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        }
      ];

      jest.spyOn(ImportService, 'parseFile').mockResolvedValue(mockRawData);

      const result = await ImportService.importData(mockUserId, mockFile, options);

      expect(result.importedCount).toBe(1);
      expect(Budget.insertMany).toHaveBeenCalled();
    });

    it('should support goal import', async () => {
      const options = { dataType: 'goals' };
      const mockRawData = [
        {
          name: 'Emergency Fund',
          targetAmount: '10000',
          currentAmount: '7500',
          targetDate: '2024-12-31'
        }
      ];

      jest.spyOn(ImportService, 'parseFile').mockResolvedValue(mockRawData);

      const result = await ImportService.importData(mockUserId, mockFile, options);

      expect(result.importedCount).toBe(1);
      expect(Goal.insertMany).toHaveBeenCalled();
    });

    it('should support category import', async () => {
      const options = { dataType: 'categories' };
      const mockRawData = [
        {
          name: 'Food & Dining',
          type: 'expense',
          description: 'Food expenses',
          color: '#FF5733'
        }
      ];

      jest.spyOn(ImportService, 'parseFile').mockResolvedValue(mockRawData);

      const result = await ImportService.importData(mockUserId, mockFile, options);

      expect(result.importedCount).toBe(1);
      expect(Category.insertMany).toHaveBeenCalled();
    });

    it('should support bank statement import', async () => {
      const options = { dataType: 'bankStatement' };
      const mockRawData = [
        {
          date: '2024-01-15',
          description: 'ATM Withdrawal',
          debit: '100.00',
          credit: '',
          balance: '1500.00'
        }
      ];

      jest.spyOn(ImportService, 'parseFile').mockResolvedValue(mockRawData);

      const result = await ImportService.importData(mockUserId, mockFile, options);

      expect(result.importedCount).toBe(1);
      expect(Transaction.insertMany).toHaveBeenCalled();
    });
  });

  describe('File Parsing', () => {
    describe('parseFile', () => {
      it('should parse CSV file', async () => {
        jest.spyOn(ImportService, 'parseCSVFile').mockResolvedValue([
          { date: '2024-01-15', description: 'Test', amount: '10' }
        ]);

        const result = await ImportService.parseFile(mockFile, 'csv');

        expect(ImportService.parseCSVFile).toHaveBeenCalledWith(mockFile.path, true);
        expect(result).toHaveLength(1);
      });

      it('should parse Excel file', async () => {
        jest.spyOn(ImportService, 'parseExcelFile').mockResolvedValue([
          { date: '2024-01-15', description: 'Test', amount: '10' }
        ]);

        const result = await ImportService.parseFile(mockFile, 'excel', { sheetName: 'Sheet1' });

        expect(ImportService.parseExcelFile).toHaveBeenCalledWith(
          mockFile.path, true, 'Sheet1'
        );
        expect(result).toHaveLength(1);
      });

      it('should parse JSON file', async () => {
        jest.spyOn(ImportService, 'parseJSONFile').mockResolvedValue([
          { date: '2024-01-15', description: 'Test', amount: '10' }
        ]);

        const result = await ImportService.parseFile(mockFile, 'json');

        expect(ImportService.parseJSONFile).toHaveBeenCalledWith(mockFile.path);
        expect(result).toHaveLength(1);
      });

      it('should throw error for unsupported format', async () => {
        await expect(ImportService.parseFile(mockFile, 'xml'))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.parseFile(mockFile, 'xml'))
          .rejects.toThrow('Unsupported file format: xml');
      });
    });

    describe('detectFileFormat', () => {
      it('should detect CSV format', () => {
        const csvFile = { mimetype: 'text/csv' };
        expect(ImportService.detectFileFormat(csvFile)).toBe('csv');
      });

      it('should detect Excel format from xlsx mimetype', () => {
        const excelFile = { 
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        };
        expect(ImportService.detectFileFormat(excelFile)).toBe('excel');
      });

      it('should detect Excel format from xls mimetype', () => {
        const excelFile = { mimetype: 'application/vnd.ms-excel' };
        expect(ImportService.detectFileFormat(excelFile)).toBe('excel');
      });

      it('should detect JSON format', () => {
        const jsonFile = { mimetype: 'application/json' };
        expect(ImportService.detectFileFormat(jsonFile)).toBe('json');
      });

      it('should default to CSV for unknown mimetypes', () => {
        const unknownFile = { mimetype: 'application/unknown' };
        expect(ImportService.detectFileFormat(unknownFile)).toBe('csv');
      });
    });

    describe('parseCSVFile', () => {
      it('should parse CSV file with headers', async () => {
        const mockStream = {
          pipe: jest.fn().mockReturnThis(),
          on: jest.fn()
        };

        require('fs').createReadStream.mockReturnValue(mockStream);
        csv.mockImplementation(() => mockStream);

        // Simulate CSV parsing
        const parsePromise = ImportService.parseCSVFile('/path/to/file.csv', true);

        // Simulate data events
        const onDataCallback = mockStream.on.mock.calls.find(call => call[0] === 'data')[1];
        const onEndCallback = mockStream.on.mock.calls.find(call => call[0] === 'end')[1];

        // First row (header) should be skipped
        onDataCallback({ date: '2024-01-15', description: 'Test', amount: '10' });
        onEndCallback();

        const result = await parsePromise;
        expect(result).toHaveLength(0); // First row skipped
      });

      it('should handle CSV parsing errors', async () => {
        const mockStream = {
          pipe: jest.fn().mockReturnThis(),
          on: jest.fn()
        };

        require('fs').createReadStream.mockReturnValue(mockStream);
        csv.mockImplementation(() => mockStream);

        const parsePromise = ImportService.parseCSVFile('/path/to/file.csv', true);

        // Simulate error
        const onErrorCallback = mockStream.on.mock.calls.find(call => call[0] === 'error')[1];
        onErrorCallback(new Error('CSV parse error'));

        await expect(parsePromise).rejects.toThrow('CSV parse error');
      });
    });

    describe('parseExcelFile', () => {
      it('should parse Excel file with multiple worksheets', async () => {
        const mockWorksheet = {
          eachRow: jest.fn()
        };

        const mockWorkbook = {
          xlsx: {
            readFile: jest.fn().mockResolvedValue()
          },
          getWorksheet: jest.fn().mockReturnValue(mockWorksheet)
        };

        ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

        // Mock worksheet data
        mockWorksheet.eachRow.mockImplementation((callback) => {
          // Header row
          const headerRow = {
            eachCell: jest.fn((cellCallback) => {
              cellCallback({ value: 'Date' }, 1);
              cellCallback({ value: 'Description' }, 2);
              cellCallback({ value: 'Amount' }, 3);
            }),
            getCell: jest.fn((index) => ({ value: ['Date', 'Description', 'Amount'][index - 1] }))
          };
          callback(headerRow, 1);

          // Data row
          const dataRow = {
            getCell: jest.fn((index) => ({ 
              value: ['2024-01-15', 'Test Transaction', '10.50'][index - 1] || '',
              type: index === 1 ? ExcelJS.ValueType.Date : 'string'
            }))
          };
          callback(dataRow, 2);
        });

        const result = await ImportService.parseExcelFile('/path/to/file.xlsx', true);

        expect(mockWorkbook.xlsx.readFile).toHaveBeenCalledWith('/path/to/file.xlsx');
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          Date: '2024-01-15',
          Description: 'Test Transaction',
          Amount: '10.50'
        });
      });

      it('should handle specific sheet name', async () => {
        const mockWorksheet = {
          eachRow: jest.fn()
        };

        const mockWorkbook = {
          xlsx: {
            readFile: jest.fn().mockResolvedValue()
          },
          getWorksheet: jest.fn().mockReturnValue(mockWorksheet)
        };

        ExcelJS.Workbook.mockImplementation(() => mockWorkbook);
        mockWorksheet.eachRow.mockImplementation(() => {});

        await ImportService.parseExcelFile('/path/to/file.xlsx', true, 'Transactions');

        expect(mockWorkbook.getWorksheet).toHaveBeenCalledWith('Transactions');
      });

      it('should throw error for non-existent sheet', async () => {
        const mockWorkbook = {
          xlsx: {
            readFile: jest.fn().mockResolvedValue()
          },
          getWorksheet: jest.fn().mockReturnValue(null)
        };

        ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

        await expect(ImportService.parseExcelFile('/path/to/file.xlsx', true, 'NonExistent'))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.parseExcelFile('/path/to/file.xlsx', true, 'NonExistent'))
          .rejects.toThrow("Sheet 'NonExistent' not found");
      });

      it('should handle Excel date cells', async () => {
        const mockWorksheet = {
          eachRow: jest.fn()
        };

        const mockWorkbook = {
          xlsx: {
            readFile: jest.fn().mockResolvedValue()
          },
          getWorksheet: jest.fn().mockReturnValue(mockWorksheet)
        };

        ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

        mockWorksheet.eachRow.mockImplementation((callback) => {
          // Header row
          const headerRow = {
            eachCell: jest.fn((cellCallback) => {
              cellCallback({ value: 'Date' }, 1);
            }),
            getCell: jest.fn(() => ({ value: 'Date' }))
          };
          callback(headerRow, 1);

          // Data row with date
          const dataRow = {
            getCell: jest.fn(() => ({ 
              value: new Date('2024-01-15'),
              type: ExcelJS.ValueType.Date
            }))
          };
          callback(dataRow, 2);
        });

        const result = await ImportService.parseExcelFile('/path/to/file.xlsx', true);

        expect(result[0].Date).toBe('2024-01-15');
      });
    });

    describe('parseJSONFile', () => {
      it('should parse valid JSON array', async () => {
        const jsonData = [
          { date: '2024-01-15', description: 'Test', amount: '10' }
        ];

        fs.readFile.mockResolvedValue(JSON.stringify(jsonData));

        const result = await ImportService.parseJSONFile('/path/to/file.json');

        expect(result).toEqual(jsonData);
      });

      it('should parse JSON object with data array', async () => {
        const jsonData = {
          data: [
            { date: '2024-01-15', description: 'Test', amount: '10' }
          ],
          metadata: { version: '1.0' }
        };

        fs.readFile.mockResolvedValue(JSON.stringify(jsonData));

        const result = await ImportService.parseJSONFile('/path/to/file.json');

        expect(result).toEqual(jsonData.data);
      });

      it('should throw error for invalid JSON structure', async () => {
        const jsonData = { invalid: 'structure' };

        fs.readFile.mockResolvedValue(JSON.stringify(jsonData));

        await expect(ImportService.parseJSONFile('/path/to/file.json'))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.parseJSONFile('/path/to/file.json'))
          .rejects.toThrow('JSON file must contain an array');
      });

      it('should handle JSON parsing errors', async () => {
        fs.readFile.mockResolvedValue('invalid json');

        await expect(ImportService.parseJSONFile('/path/to/file.json'))
          .rejects.toThrow();
      });
    });
  });

  describe('Data Validation and Mapping', () => {
    describe('mapFields', () => {
      it('should map fields using field mapping configuration', () => {
        const row = {
          'Transaction Date': '2024-01-15',
          'Memo': 'Coffee Shop',
          'Value': '5.50',
          'Type': 'expense'
        };

        const fieldMapping = {
          date: ['date', 'Transaction Date'],
          description: ['description', 'Memo'],
          amount: ['amount', 'Value'],
          type: ['type', 'Type']
        };

        const result = ImportService.mapFields(row, fieldMapping);

        expect(result).toEqual({
          date: '2024-01-15',
          description: 'Coffee Shop',
          amount: '5.50',
          type: 'expense'
        });
      });

      it('should handle missing fields gracefully', () => {
        const row = {
          'Date': '2024-01-15',
          'Description': 'Coffee Shop'
        };

        const fieldMapping = {
          date: ['Date'],
          description: ['Description'],
          amount: ['Amount'],
          type: ['Type']
        };

        const result = ImportService.mapFields(row, fieldMapping);

        expect(result).toEqual({
          date: '2024-01-15',
          description: 'Coffee Shop'
        });
      });

      it('should prefer first available field in mapping', () => {
        const row = {
          'date': '2024-01-15',
          'transaction_date': '2024-01-16',
          'Date': '2024-01-17'
        };

        const fieldMapping = {
          date: ['date', 'transaction_date', 'Date']
        };

        const result = ImportService.mapFields(row, fieldMapping);

        expect(result.date).toBe('2024-01-15');
      });
    });

    describe('validateTransaction', () => {
      beforeEach(() => {
        moment.mockImplementation((date) => ({
          toDate: () => new Date(date),
          isValid: () => true
        }));
      });

      it('should validate valid transaction data', async () => {
        const data = {
          date: '2024-01-15',
          description: 'Coffee Shop',
          amount: '5.50',
          type: 'expense',
          category: 'Food & Dining'
        };

        Category.findOne.mockResolvedValue(mockCategory);

        const result = await ImportService.validateTransaction(data, mockUserId);

        expect(result).toEqual({
          amount: 5.50,
          type: 'expense',
          date: new Date('2024-01-15'),
          description: 'Coffee Shop',
          user: mockUserId,
          category: mockCategory._id,
          status: 'completed',
          payee: undefined,
          notes: undefined,
          referenceNumber: undefined
        });
      });

      it('should throw error for missing required fields', async () => {
        const data = {
          description: 'Coffee Shop',
          amount: '5.50'
          // missing date
        };

        await expect(ImportService.validateTransaction(data, mockUserId))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.validateTransaction(data, mockUserId))
          .rejects.toThrow('date is required');
      });

      it('should handle invalid date formats', async () => {
        const data = {
          date: 'invalid-date',
          description: 'Coffee Shop',
          amount: '5.50'
        };

        moment.mockImplementation(() => ({
          toDate: () => new Date('invalid'),
          isValid: () => false
        }));

        await expect(ImportService.validateTransaction(data, mockUserId))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.validateTransaction(data, mockUserId))
          .rejects.toThrow('Invalid date format');
      });

      it('should handle invalid amount formats', async () => {
        const data = {
          date: '2024-01-15',
          description: 'Coffee Shop',
          amount: 'invalid-amount'
        };

        await expect(ImportService.validateTransaction(data, mockUserId))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.validateTransaction(data, mockUserId))
          .rejects.toThrow('Invalid amount');
      });

      it('should create new category if not found', async () => {
        const data = {
          date: '2024-01-15',
          description: 'Coffee Shop',
          amount: '5.50',
          category: 'New Category'
        };

        Category.findOne.mockResolvedValue(null);
        Category.create.mockResolvedValue({ _id: 'new-category-id' });

        const result = await ImportService.validateTransaction(data, mockUserId);

        expect(Category.create).toHaveBeenCalledWith({
          name: 'New Category',
          type: 'expense',
          user: mockUserId,
          isActive: true
        });
        expect(result.category).toBe('new-category-id');
      });

      it('should auto-detect income type from description', async () => {
        const data = {
          date: '2024-01-15',
          description: 'Salary Deposit',
          amount: '5000'
        };

        const result = await ImportService.validateTransaction(data, mockUserId);

        expect(result.type).toBe('income');
      });

      it('should apply custom validation rules', async () => {
        const data = {
          date: '2024-01-15',
          description: 'Large expense',
          amount: '10000'
        };

        const validationRules = {
          maxAmount: 5000
        };

        await expect(ImportService.validateTransaction(data, mockUserId, validationRules))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.validateTransaction(data, mockUserId, validationRules))
          .rejects.toThrow('Amount exceeds maximum');
      });

      it('should parse amount with currency symbols', async () => {
        const data = {
          date: '2024-01-15',
          description: 'Coffee Shop',
          amount: '$5.50'
        };

        const result = await ImportService.validateTransaction(data, mockUserId);

        expect(result.amount).toBe(5.50);
      });
    });

    describe('isDuplicateTransaction', () => {
      it('should detect duplicate transactions', () => {
        const transaction = {
          date: new Date('2024-01-15'),
          description: 'Coffee Shop',
          amount: 5.50
        };

        const existingTransactions = [
          {
            date: new Date('2024-01-15'),
            description: 'coffee shop',
            amount: 5.50
          }
        ];

        moment.mockImplementation(() => ({
          isSame: () => true
        }));

        const result = ImportService.isDuplicateTransaction(transaction, existingTransactions);

        expect(result).toBe(true);
      });

      it('should not detect false positives', () => {
        const transaction = {
          date: new Date('2024-01-15'),
          description: 'Coffee Shop',
          amount: 5.50
        };

        const existingTransactions = [
          {
            date: new Date('2024-01-16'), // Different date
            description: 'Coffee Shop',
            amount: 5.50
          }
        ];

        moment.mockImplementation(() => ({
          isSame: () => false
        }));

        const result = ImportService.isDuplicateTransaction(transaction, existingTransactions);

        expect(result).toBe(false);
      });
    });
  });

  describe('Budget Import', () => {
    describe('validateBudget', () => {
      it('should validate valid budget data', async () => {
        const data = {
          name: 'Monthly Food Budget',
          amount: '500',
          period: 'monthly',
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        };

        moment.mockImplementation((date) => ({
          toDate: () => new Date(date),
          isValid: () => true,
          endOf: () => ({ toDate: () => new Date('2024-01-31') })
        }));

        const result = await ImportService.validateBudget(data, mockUserId);

        expect(result).toEqual({
          name: 'Monthly Food Budget',
          amount: 500,
          period: 'monthly',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
          category: null,
          description: undefined,
          user: mockUserId,
          isActive: true,
          spent: 0
        });
      });

      it('should throw error for missing required fields', async () => {
        const data = {
          amount: '500'
          // missing name
        };

        await expect(ImportService.validateBudget(data, mockUserId))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.validateBudget(data, mockUserId))
          .rejects.toThrow('name is required');
      });

      it('should handle invalid budget amount', async () => {
        const data = {
          name: 'Test Budget',
          amount: 'invalid'
        };

        await expect(ImportService.validateBudget(data, mockUserId))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.validateBudget(data, mockUserId))
          .rejects.toThrow('Invalid budget amount');
      });

      it('should validate end date is after start date', async () => {
        const data = {
          name: 'Test Budget',
          amount: '500',
          startDate: '2024-01-31',
          endDate: '2024-01-01'
        };

        moment.mockImplementation((date) => ({
          toDate: () => new Date(date),
          isValid: () => true
        }));

        await expect(ImportService.validateBudget(data, mockUserId))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.validateBudget(data, mockUserId))
          .rejects.toThrow('End date must be after start date');
      });
    });

    describe('isDuplicateBudget', () => {
      it('should detect duplicate budgets', () => {
        const budget = {
          name: 'Monthly Food Budget',
          period: 'monthly',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        };

        const existingBudgets = [
          {
            name: 'monthly food budget',
            period: 'monthly',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31')
          }
        ];

        moment.mockImplementation(() => ({
          isBefore: () => false,
          isAfter: () => false
        }));

        const result = ImportService.isDuplicateBudget(budget, existingBudgets);

        expect(result).toBe(true);
      });
    });
  });

  describe('Goal Import', () => {
    describe('validateGoal', () => {
      it('should validate valid goal data', async () => {
        const data = {
          name: 'Emergency Fund',
          targetAmount: '10000',
          currentAmount: '7500',
          targetDate: '2024-12-31',
          priority: 'high',
          status: 'active'
        };

        moment.mockImplementation((date) => ({
          toDate: () => new Date(date),
          isValid: () => true,
          add: () => ({ toDate: () => new Date('2025-01-15') })
        }));

        const result = await ImportService.validateGoal(data, mockUserId);

        expect(result).toEqual({
          name: 'Emergency Fund',
          description: undefined,
          targetAmount: 10000,
          currentAmount: 7500,
          targetDate: new Date('2024-12-31'),
          priority: 'high',
          status: 'active',
          user: mockUserId,
          isActive: true,
          reminderFrequency: 'monthly'
        });
      });

      it('should throw error for invalid priority', async () => {
        const data = {
          name: 'Emergency Fund',
          targetAmount: '10000',
          priority: 'invalid'
        };

        moment.mockImplementation(() => ({
          add: () => ({ toDate: () => new Date() })
        }));

        await expect(ImportService.validateGoal(data, mockUserId))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.validateGoal(data, mockUserId))
          .rejects.toThrow('Invalid priority');
      });

      it('should default target date to one year from now', async () => {
        const data = {
          name: 'Emergency Fund',
          targetAmount: '10000'
        };

        const oneYearFromNow = new Date('2025-01-15');
        moment.mockImplementation(() => ({
          add: () => ({ toDate: () => oneYearFromNow })
        }));

        const result = await ImportService.validateGoal(data, mockUserId);

        expect(result.targetDate).toEqual(oneYearFromNow);
      });
    });
  });

  describe('Category Import', () => {
    describe('validateCategory', () => {
      it('should validate valid category data', async () => {
        const data = {
          name: 'Food & Dining',
          type: 'expense',
          description: 'Food expenses',
          color: '#FF5733',
          icon: 'fa-utensils'
        };

        const result = await ImportService.validateCategory(data, mockUserId);

        expect(result).toEqual({
          name: 'Food & Dining',
          type: 'expense',
          description: 'Food expenses',
          color: '#FF5733',
          icon: 'fa-utensils',
          budget: null,
          user: mockUserId,
          isActive: true
        });
      });

      it('should use default values for optional fields', async () => {
        const data = {
          name: 'Food & Dining'
        };

        const result = await ImportService.validateCategory(data, mockUserId);

        expect(result.type).toBe('expense');
        expect(result.color).toBe('#dc3545');
        expect(result.icon).toBe('fa-minus');
      });

      it('should throw error for invalid category type', async () => {
        const data = {
          name: 'Food & Dining',
          type: 'invalid'
        };

        await expect(ImportService.validateCategory(data, mockUserId))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.validateCategory(data, mockUserId))
          .rejects.toThrow('Invalid category type');
      });
    });
  });

  describe('Bank Statement Import', () => {
    it('should process bank statement with debit/credit format', async () => {
      const options = { dataType: 'bankStatement' };
      const mockRawData = [
        {
          date: '2024-01-15',
          description: 'ATM Withdrawal',
          debit: '100.00',
          credit: '',
          balance: '1500.00'
        },
        {
          date: '2024-01-16',
          description: 'Salary Deposit',
          debit: '',
          credit: '3000.00',
          balance: '4500.00'
        }
      ];

      jest.spyOn(ImportService, 'parseFile').mockResolvedValue(mockRawData);
      jest.spyOn(ImportService, 'importTransactions').mockResolvedValue({
        importedCount: 2,
        totalRows: 2,
        validationErrors: [],
        duplicates: [],
        importErrors: [],
        summary: { processed: 2, validated: 2, imported: 2, skipped: 0, errors: 0 }
      });

      const result = await ImportService.importData(mockUserId, mockFile, options);

      expect(ImportService.importTransactions).toHaveBeenCalledWith(
        mockUserId,
        expect.arrayContaining([
          expect.objectContaining({
            amount: -100, // Debit as negative
            type: 'expense'
          }),
          expect.objectContaining({
            amount: 3000, // Credit as positive
            type: 'income'
          })
        ]),
        expect.any(Object)
      );

      expect(result.importedCount).toBe(2);
    });
  });

  describe('Utility Methods', () => {
    describe('getImportOptions', () => {
      it('should return comprehensive import options', () => {
        const options = ImportService.getImportOptions();

        expect(options).toEqual({
          supportedFormats: ['csv', 'excel', 'json'],
          supportedTypes: ['transactions', 'budgets', 'goals', 'categories', 'bankStatement'],
          fieldMappings: expect.objectContaining({
            transactions: expect.any(Object),
            budgets: expect.any(Object),
            goals: expect.any(Object),
            categories: expect.any(Object)
          }),
          validationRules: expect.objectContaining({
            transactions: expect.any(Object),
            budgets: expect.any(Object),
            goals: expect.any(Object),
            categories: expect.any(Object)
          }),
          maxFileSize: '10MB',
          maxRecords: 10000
        });
      });
    });

    describe('validateImportFile', () => {
      it('should validate file structure and return analysis', async () => {
        const mockData = [
          { date: '2024-01-15', description: 'Test', amount: '10' },
          { date: '2024-01-16', description: 'Test 2', amount: '20' }
        ];

        jest.spyOn(ImportService, 'parseFile').mockResolvedValue(mockData);

        const result = await ImportService.validateImportFile('/path/to/file.csv', 'transactions');

        expect(result).toEqual({
          isValid: true,
          recordCount: 2,
          availableFields: ['date', 'description', 'amount'],
          requiredFields: ['date', 'description', 'amount'],
          missingFields: [],
          suggestions: expect.any(Object)
        });
      });

      it('should handle empty files', async () => {
        jest.spyOn(ImportService, 'parseFile').mockResolvedValue([]);

        const result = await ImportService.validateImportFile('/path/to/file.csv', 'transactions');

        expect(result).toEqual({
          isValid: false,
          error: 'File appears to be empty or invalid format',
          recordCount: 0,
          availableFields: [],
          requiredFields: [],
          missingFields: [],
          suggestions: {}
        });
      });

      it('should handle parse errors', async () => {
        jest.spyOn(ImportService, 'parseFile').mockRejectedValue(new Error('Parse failed'));

        const result = await ImportService.validateImportFile('/path/to/file.csv', 'transactions');

        expect(result).toEqual({
          isValid: false,
          error: 'Parse failed',
          recordCount: 0,
          availableFields: [],
          requiredFields: [],
          missingFields: [],
          suggestions: {}
        });
      });
    });

    describe('generateFieldMappingSuggestions', () => {
      it('should generate accurate field mapping suggestions', () => {
        const availableFields = ['Transaction Date', 'Memo', 'Amount USD', 'Category Name'];
        
        const suggestions = ImportService.generateFieldMappingSuggestions(availableFields, 'transactions');

        expect(suggestions).toEqual({
          date: 'Transaction Date',
          description: 'Memo',
          amount: 'Amount USD',
          category: 'Category Name'
        });
      });

      it('should handle partial matches', () => {
        const availableFields = ['date_field', 'desc', 'amt'];
        
        const suggestions = ImportService.generateFieldMappingSuggestions(availableFields, 'transactions');

        expect(suggestions.date).toBe('date_field');
        expect(suggestions.description).toBe('desc');
        expect(suggestions.amount).toBe('amt');
      });
    });

    describe('getImportHistory', () => {
      it('should return paginated import history', async () => {
        const mockImports = [
          { _id: '1', userId: mockUserId, type: 'transactions', status: 'completed' }
        ];

        ImportHistory.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockImports)
              })
            })
          })
        });
        ImportHistory.countDocuments.mockResolvedValue(1);

        const result = await ImportService.getImportHistory(mockUserId, { page: 1, limit: 10 });

        expect(result).toEqual({
          imports: mockImports,
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            pages: 1
          }
        });
      });
    });

    describe('cancelImport', () => {
      it('should cancel pending import', async () => {
        const mockImport = {
          _id: 'import-id',
          userId: mockUserId,
          status: 'pending',
          markAsCancelled: jest.fn().mockResolvedValue()
        };

        ImportHistory.findOne.mockResolvedValue(mockImport);

        const result = await ImportService.cancelImport(mockUserId, 'import-id');

        expect(result).toEqual({
          success: true,
          message: 'Import cancelled successfully'
        });
        expect(mockImport.markAsCancelled).toHaveBeenCalled();
      });

      it('should throw error for non-existent import', async () => {
        ImportHistory.findOne.mockResolvedValue(null);

        await expect(ImportService.cancelImport(mockUserId, 'invalid-id'))
          .rejects.toThrow(ValidationError);
        await expect(ImportService.cancelImport(mockUserId, 'invalid-id'))
          .rejects.toThrow('Import not found or cannot be cancelled');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle batch import errors gracefully', async () => {
      const options = { dataType: 'transactions', batchSize: 2 };
      const mockRawData = [
        { date: '2024-01-15', description: 'Valid', amount: '10' },
        { date: '2024-01-16', description: 'Valid 2', amount: '20' },
        { date: '2024-01-17', description: 'Valid 3', amount: '30' }
      ];

      jest.spyOn(ImportService, 'parseFile').mockResolvedValue(mockRawData);

      // Mock batch insert with partial failure
      Transaction.insertMany
        .mockResolvedValueOnce([mockTransaction]) // First batch succeeds
        .mockRejectedValueOnce({ // Second batch fails
          writeErrors: [
            { index: 0, errmsg: 'Duplicate key error' }
          ]
        });

      const result = await ImportService.importData(mockUserId, mockFile, options);

      expect(result.importedCount).toBe(1);
      expect(result.importErrors).toHaveLength(1);
      expect(result.importErrors[0]).toEqual({
        row: 3,
        error: 'Duplicate key error',
        data: expect.any(Object)
      });
    });

    it('should handle progress callbacks', async () => {
      const progressCallback = jest.fn();
      const options = { 
        dataType: 'transactions', 
        progressCallback 
      };
      const mockRawData = [
        { date: '2024-01-15', description: 'Test', amount: '10' }
      ];

      jest.spyOn(ImportService, 'parseFile').mockResolvedValue(mockRawData);

      await ImportService.importData(mockUserId, mockFile, options);

      expect(progressCallback).toHaveBeenCalledWith({
        current: 1,
        total: 1,
        phase: 'validation'
      });
      expect(progressCallback).toHaveBeenCalledWith({
        current: 1,
        total: 1,
        phase: 'import'
      });
    });

    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        date: '2024-01-15',
        description: `Transaction ${i}`,
        amount: (Math.random() * 100).toFixed(2)
      }));

      const options = { 
        dataType: 'transactions',
        batchSize: 1000
      };

      jest.spyOn(ImportService, 'parseFile').mockResolvedValue(largeDataset);

      const result = await ImportService.importData(mockUserId, mockFile, options);

      expect(result.totalRows).toBe(5000);
      expect(Transaction.insertMany).toHaveBeenCalledTimes(5); // 5 batches of 1000
    });

    it('should handle duplicate detection with large existing datasets', async () => {
      const existingTransactions = Array.from({ length: 10000 }, (_, i) => ({
        date: new Date('2024-01-01'),
        description: `Existing ${i}`,
        amount: i
      }));

      Transaction.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(existingTransactions)
        })
      });

      const mockRawData = [
        { date: '2024-01-01', description: 'Existing 0', amount: '0' } // Duplicate
      ];

      jest.spyOn(ImportService, 'parseFile').mockResolvedValue(mockRawData);
      moment.mockImplementation(() => ({
        isSame: () => true
      }));

      const options = { dataType: 'transactions', skipDuplicates: true };
      const result = await ImportService.importData(mockUserId, mockFile, options);

      expect(result.duplicates).toHaveLength(1);
      expect(result.importedCount).toBe(0);
    });
  });
});
