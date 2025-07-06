/**
 * Unit Tests for Export Service
 * Tests comprehensive data export functionality for CSV, PDF, and Excel formats
 * Covers transactions, budgets, goals, categories, and reports export
 */

const ExportService = require('../../services/export.service');
const Transaction = require('../../models/Transaction');
const Budget = require('../../models/Budget');
const Goal = require('../../models/Goal');
const Category = require('../../models/Category');
const User = require('../../models/User');
const { ValidationError } = require('../../utils/errorHandler');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Mock dependencies
jest.mock('../../models/Transaction');
jest.mock('../../models/Budget');
jest.mock('../../models/Goal');
jest.mock('../../models/Category');
jest.mock('../../models/User');
jest.mock('../../utils/logger');
jest.mock('fs');
jest.mock('pdfkit');
jest.mock('exceljs');
jest.mock('csv-writer');
jest.mock('archiver');

// Mock csv-writer
const mockCsvWriter = {
  writeRecords: jest.fn().mockResolvedValue()
};
const csvWriter = {
  createObjectCsvWriter: jest.fn().mockReturnValue(mockCsvWriter)
};
require('csv-writer').createObjectCsvWriter = csvWriter.createObjectCsvWriter;

describe('ExportService', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockUser = {
    _id: mockUserId,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com'
  };

  const mockTransaction = {
    _id: '507f1f77bcf86cd799439012',
    user: mockUserId,
    description: 'Coffee Shop',
    amount: 5.50,
    type: 'expense',
    category: { _id: '507f1f77bcf86cd799439013', name: 'Food & Dining' },
    date: new Date('2024-01-15'),
    payee: 'Starbucks',
    notes: 'Morning coffee',
    status: 'completed',
    referenceNumber: 'TXN001'
  };

  const mockBudget = {
    _id: '507f1f77bcf86cd799439014',
    user: mockUserId,
    name: 'Monthly Food Budget',
    category: { _id: '507f1f77bcf86cd799439013', name: 'Food & Dining' },
    amount: 500,
    spent: 350,
    period: 'monthly',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    isActive: true
  };

  const mockGoal = {
    _id: '507f1f77bcf86cd799439015',
    user: mockUserId,
    name: 'Emergency Fund',
    description: 'Save for emergencies',
    targetAmount: 10000,
    currentAmount: 7500,
    targetDate: new Date('2024-12-31'),
    status: 'active',
    priority: 'high'
  };

  const mockCategory = {
    _id: '507f1f77bcf86cd799439013',
    user: mockUserId,
    name: 'Food & Dining',
    type: 'expense',
    description: 'Food and restaurant expenses',
    color: '#FF5733',
    icon: 'restaurant',
    isActive: true,
    createdAt: new Date('2024-01-01')
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock file system operations
    fs.promises = {
      access: jest.fn(),
      mkdir: jest.fn(),
      readdir: jest.fn(),
      stat: jest.fn(),
      unlink: jest.fn()
    };
    fs.statSync = jest.fn().mockReturnValue({ size: 1024 });
    fs.createReadStream = jest.fn();
    fs.createWriteStream = jest.fn();

    // Mock User model
    User.findById = jest.fn().mockResolvedValue(mockUser);

    // Mock Transaction model
    Transaction.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockTransaction]),
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([mockTransaction])
          })
        })
      })
    });
    Transaction.countDocuments = jest.fn().mockResolvedValue(25);

    // Mock Budget model
    Budget.find = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockBudget])
        })
      })
    });
    Budget.countDocuments = jest.fn().mockResolvedValue(5);

    // Mock Goal model
    Goal.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([mockGoal])
      })
    });
    Goal.countDocuments = jest.fn().mockResolvedValue(3);

    // Mock Category model
    Category.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([mockCategory])
      })
    });
    Category.countDocuments = jest.fn().mockResolvedValue(8);

    // Mock path operations
    path.join = jest.fn((...args) => args.join('/'));
    path.basename = jest.fn((filePath) => filePath.split('/').pop());
    path.extname = jest.fn((filePath) => {
      const parts = filePath.split('.');
      return parts.length > 1 ? '.' + parts.pop() : '';
    });

    // Mock process.cwd
    process.cwd = jest.fn().mockReturnValue('/app');

    // Mock logger
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
  });

  describe('exportData', () => {
    it('should successfully export transactions to CSV', async () => {
      const options = {
        dataType: 'transactions',
        format: 'csv',
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        filters: { category: 'Food & Dining' }
      };

      // Mock directory access
      fs.promises.access.mockResolvedValue();

      const result = await ExportService.exportData(mockUserId, options);

      expect(result).toBeDefined();
      expect(result.format).toBe('csv');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Starting export for user ${mockUserId}`)
      );
    });

    it('should throw ValidationError for missing dataType', async () => {
      const options = {
        format: 'csv'
      };

      await expect(ExportService.exportData(mockUserId, options))
        .rejects.toThrow(ValidationError);
      await expect(ExportService.exportData(mockUserId, options))
        .rejects.toThrow('Data type is required');
    });

    it('should throw ValidationError for missing format', async () => {
      const options = {
        dataType: 'transactions'
      };

      await expect(ExportService.exportData(mockUserId, options))
        .rejects.toThrow(ValidationError);
      await expect(ExportService.exportData(mockUserId, options))
        .rejects.toThrow('Export format is required');
    });

    it('should throw ValidationError for invalid dataType', async () => {
      const options = {
        dataType: 'invalid',
        format: 'csv'
      };

      await expect(ExportService.exportData(mockUserId, options))
        .rejects.toThrow(ValidationError);
      await expect(ExportService.exportData(mockUserId, options))
        .rejects.toThrow('Invalid data type');
    });

    it('should throw ValidationError for invalid format', async () => {
      const options = {
        dataType: 'transactions',
        format: 'invalid'
      };

      await expect(ExportService.exportData(mockUserId, options))
        .rejects.toThrow(ValidationError);
      await expect(ExportService.exportData(mockUserId, options))
        .rejects.toThrow('Invalid format');
    });

    it('should generate custom filename when provided', async () => {
      const options = {
        dataType: 'transactions',
        format: 'csv',
        filename: 'custom-export.csv'
      };

      fs.promises.access.mockResolvedValue();

      await ExportService.exportData(mockUserId, options);

      expect(path.join).toHaveBeenCalledWith(
        expect.any(String),
        'exports',
        'custom-export.csv'
      );
    });

    it('should create export directory if it does not exist', async () => {
      const options = { dataType: 'transactions', format: 'csv' };
      
      fs.promises.access.mockRejectedValue({ code: 'ENOENT' });
      fs.promises.mkdir.mockResolvedValue();

      await ExportService.exportData(mockUserId, options);

      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('exports'),
        { recursive: true }
      );
    });
  });

  describe('exportToCSV', () => {
    beforeEach(() => {
      fs.promises.access.mockResolvedValue();
    });

    it('should export transactions to CSV with proper headers', async () => {
      const outputPath = '/app/exports/transactions.csv';
      const dateRange = { startDate: '2024-01-01' };
      const filters = { type: 'expense' };

      const result = await ExportService.exportTransactionsToCSV(
        mockUserId, outputPath, dateRange, filters
      );

      expect(csvWriter.createObjectCsvWriter).toHaveBeenCalledWith({
        path: outputPath,
        header: expect.arrayContaining([
          { id: 'date', title: 'Date' },
          { id: 'description', title: 'Description' },
          { id: 'amount', title: 'Amount' },
          { id: 'type', title: 'Type' },
          { id: 'category', title: 'Category' }
        ])
      });

      expect(mockCsvWriter.writeRecords).toHaveBeenCalled();
      expect(result).toEqual({
        filePath: outputPath,
        filename: 'transactions.csv',
        recordCount: 1,
        format: 'csv',
        fileSize: 1024
      });
    });

    it('should export budgets to CSV with calculated fields', async () => {
      const outputPath = '/app/exports/budgets.csv';
      const dateRange = {};

      const result = await ExportService.exportBudgetsToCSV(
        mockUserId, outputPath, dateRange
      );

      expect(mockCsvWriter.writeRecords).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'Monthly Food Budget',
          amount: 500,
          spent: 350,
          remaining: 150,
          percentage: '70.0%'
        })
      ]);

      expect(result.recordCount).toBe(1);
    });

    it('should export goals to CSV with progress calculation', async () => {
      const outputPath = '/app/exports/goals.csv';

      const result = await ExportService.exportGoalsToCSV(mockUserId, outputPath);

      expect(mockCsvWriter.writeRecords).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'Emergency Fund',
          targetAmount: 10000,
          currentAmount: 7500,
          remainingAmount: 2500,
          progress: '75.0%'
        })
      ]);

      expect(result.recordCount).toBe(1);
    });

    it('should export categories to CSV', async () => {
      const outputPath = '/app/exports/categories.csv';

      const result = await ExportService.exportCategoriesToCSV(mockUserId, outputPath);

      expect(mockCsvWriter.writeRecords).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'Food & Dining',
          type: 'expense',
          isActive: 'Yes'
        })
      ]);

      expect(result.recordCount).toBe(1);
    });

    it('should handle all data export to ZIP', async () => {
      const mockArchiver = {
        pipe: jest.fn(),
        file: jest.fn(),
        finalize: jest.fn().mockResolvedValue()
      };

      require('archiver').mockReturnValue(mockArchiver);
      fs.createWriteStream.mockReturnValue({});

      const outputPath = '/app/exports/all-data.csv';
      const dateRange = {};
      const filters = {};

      // Mock temporary directory creation
      fs.promises.access.mockResolvedValue();

      const result = await ExportService.exportAllDataToCSV(
        mockUserId, outputPath, dateRange, filters
      );

      expect(mockArchiver.file).toHaveBeenCalledTimes(4); // transactions, budgets, goals, categories
      expect(result.format).toBe('zip');
      expect(result.exports).toHaveLength(4);
    });

    it('should apply date range filters correctly', async () => {
      const outputPath = '/app/exports/transactions.csv';
      const dateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      await ExportService.exportTransactionsToCSV(
        mockUserId, outputPath, dateRange, {}
      );

      expect(Transaction.find).toHaveBeenCalledWith({
        user: mockUserId,
        date: {
          $gte: new Date('2024-01-01'),
          $lte: new Date('2024-01-31')
        }
      });
    });

    it('should apply category and type filters', async () => {
      const outputPath = '/app/exports/transactions.csv';
      const filters = {
        category: 'Food & Dining',
        type: 'expense',
        minAmount: 10,
        maxAmount: 100
      };

      await ExportService.exportTransactionsToCSV(
        mockUserId, outputPath, {}, filters
      );

      expect(Transaction.find).toHaveBeenCalledWith({
        user: mockUserId,
        category: 'Food & Dining',
        type: 'expense',
        amount: {
          $gte: 10,
          $lte: 100
        }
      });
    });
  });

  describe('exportToPDF', () => {
    let mockDoc;

    beforeEach(() => {
      mockDoc = {
        pipe: jest.fn(),
        fontSize: jest.fn().mockReturnThis(),
        font: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        addPage: jest.fn().mockReturnThis(),
        end: jest.fn(),
        on: jest.fn(),
        y: 100,
        page: { width: 612, height: 792 },
        bufferedPageRange: jest.fn().mockReturnValue({ count: 1 }),
        switchToPage: jest.fn()
      };

      PDFDocument.mockImplementation(() => mockDoc);
      fs.createWriteStream.mockReturnValue({});
      fs.promises.access.mockResolvedValue();
    });

    it('should create PDF with transactions data', async () => {
      const options = {
        dataType: 'transactions',
        format: 'pdf',
        dateRange: { startDate: '2024-01-01' },
        filters: {}
      };

      const outputPath = '/app/exports/transactions.pdf';

      // Mock PDF completion
      setTimeout(() => {
        const endCallback = mockDoc.on.mock.calls.find(call => call[0] === 'end')[1];
        endCallback();
      }, 0);

      const result = await ExportService.exportToPDF(
        mockUserId, 'transactions', outputPath, options
      );

      expect(PDFDocument).toHaveBeenCalledWith({
        size: 'A4',
        margin: 50,
        info: expect.objectContaining({
          Title: 'Transactions Report',
          Author: 'Personal Finance Dashboard'
        })
      });

      expect(result).toEqual({
        filePath: outputPath,
        filename: 'transactions.pdf',
        format: 'pdf',
        fileSize: 1024
      });
    });

    it('should create PDF with budgets data', async () => {
      const options = { dateRange: {} };
      const outputPath = '/app/exports/budgets.pdf';

      setTimeout(() => {
        const endCallback = mockDoc.on.mock.calls.find(call => call[0] === 'end')[1];
        endCallback();
      }, 0);

      const result = await ExportService.exportToPDF(
        mockUserId, 'budgets', outputPath, options
      );

      expect(mockDoc.text).toHaveBeenCalledWith('Budgets Overview', 50);
      expect(result.format).toBe('pdf');
    });

    it('should create PDF with goals data', async () => {
      const options = {};
      const outputPath = '/app/exports/goals.pdf';

      setTimeout(() => {
        const endCallback = mockDoc.on.mock.calls.find(call => call[0] === 'end')[1];
        endCallback();
      }, 0);

      const result = await ExportService.exportToPDF(
        mockUserId, 'goals', outputPath, options
      );

      expect(mockDoc.text).toHaveBeenCalledWith('Financial Goals', 50);
      expect(result.format).toBe('pdf');
    });

    it('should include reports with charts when requested', async () => {
      // Mock ReportService
      const mockReportService = {
        generateSpendingReport: jest.fn().mockResolvedValue({
          totalAmount: 1000,
          transactionCount: 50,
          averageAmount: 20,
          categoryAnalysis: [
            { category: 'Food', amount: 500, percentage: 50 }
          ]
        }),
        generateIncomeReport: jest.fn().mockResolvedValue({
          totalAmount: 3000,
          transactionCount: 10,
          averageAmount: 300
        }),
        generateCashFlowReport: jest.fn().mockResolvedValue({
          monthlyCashFlow: [
            { month: 'Jan 2024', income: 3000, expenses: 1000, netCashFlow: 2000 }
          ]
        })
      };

      jest.doMock('../../services/report.service', () => mockReportService);

      const options = {
        dateRange: { startDate: '2024-01-01' },
        includeCharts: true
      };
      const outputPath = '/app/exports/reports.pdf';

      setTimeout(() => {
        const endCallback = mockDoc.on.mock.calls.find(call => call[0] === 'end')[1];
        endCallback();
      }, 0);

      const result = await ExportService.exportToPDF(
        mockUserId, 'reports', outputPath, options
      );

      expect(result.format).toBe('pdf');
    });

    it('should handle PDF generation errors', async () => {
      const options = { dateRange: {} };
      const outputPath = '/app/exports/test.pdf';

      setTimeout(() => {
        const errorCallback = mockDoc.on.mock.calls.find(call => call[0] === 'error')[1];
        errorCallback(new Error('PDF generation failed'));
      }, 0);

      await expect(ExportService.exportToPDF(
        mockUserId, 'transactions', outputPath, options
      )).rejects.toThrow('PDF generation failed');
    });

    it('should throw error for unsupported PDF data type', async () => {
      const options = {};
      const outputPath = '/app/exports/invalid.pdf';

      await expect(ExportService.exportToPDF(
        mockUserId, 'invalid', outputPath, options
      )).rejects.toThrow(ValidationError);
    });
  });

  describe('exportToExcel', () => {
    let mockWorkbook;
    let mockWorksheet;

    beforeEach(() => {
      mockWorksheet = {
        columns: [],
        addRow: jest.fn(),
        getRow: jest.fn().mockReturnValue({
          eachCell: jest.fn()
        }),
        getColumn: jest.fn().mockReturnValue({
          numFmt: ''
        }),
        getCell: jest.fn().mockReturnValue({
          value: '',
          font: {},
          fill: {},
          border: {}
        }),
        autoFilter: '',
        views: [],
        addConditionalFormatting: jest.fn()
      };

      mockWorkbook = {
        creator: '',
        lastModifiedBy: '',
        created: null,
        modified: null,
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
        xlsx: {
          writeFile: jest.fn().mockResolvedValue()
        }
      };

      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);
      fs.promises.access.mockResolvedValue();
    });

    it('should create Excel workbook with transactions', async () => {
      const options = {
        dateRange: { startDate: '2024-01-01' },
        filters: { type: 'expense' }
      };
      const outputPath = '/app/exports/transactions.xlsx';

      const result = await ExportService.exportToExcel(
        mockUserId, 'transactions', outputPath, options
      );

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Transactions');
      expect(mockWorksheet.columns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ header: 'Date', key: 'date' }),
          expect.objectContaining({ header: 'Description', key: 'description' }),
          expect.objectContaining({ header: 'Amount', key: 'amount' })
        ])
      );

      expect(mockWorksheet.addRow).toHaveBeenCalledWith(
        expect.objectContaining({
          date: expect.any(Date),
          description: 'Coffee Shop',
          amount: 5.50,
          type: 'expense'
        })
      );

      expect(result).toEqual({
        filePath: outputPath,
        filename: 'transactions.xlsx',
        format: 'excel',
        fileSize: 1024
      });
    });

    it('should create Excel workbook with budgets and formulas', async () => {
      const options = { dateRange: {} };
      const outputPath = '/app/exports/budgets.xlsx';

      const result = await ExportService.exportToExcel(
        mockUserId, 'budgets', outputPath, options
      );

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Budgets');
      expect(mockWorksheet.addRow).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Monthly Food Budget',
          amount: 500,
          spent: 350,
          remaining: expect.objectContaining({
            formula: 'C2-D2',
            result: 150
          })
        })
      );
    });

    it('should create Excel workbook with goals and conditional formatting', async () => {
      const outputPath = '/app/exports/goals.xlsx';

      const result = await ExportService.exportToExcel(
        mockUserId, 'goals', outputPath, {}
      );

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Goals');
      expect(mockWorksheet.addConditionalFormatting).toHaveBeenCalledWith({
        ref: 'F2:F2',
        rules: expect.arrayContaining([
          expect.objectContaining({
            type: 'cellIs',
            operator: 'greaterThanOrEqual',
            formulae: [1]
          })
        ])
      });
    });

    it('should create Excel workbook with all data types', async () => {
      const options = {
        dateRange: { startDate: '2024-01-01' },
        filters: {}
      };
      const outputPath = '/app/exports/all-data.xlsx';

      const result = await ExportService.exportToExcel(
        mockUserId, 'all', outputPath, options
      );

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Transactions');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Budgets');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Goals');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Categories');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Summary');
    });

    it('should throw error for unsupported Excel data type', async () => {
      const outputPath = '/app/exports/invalid.xlsx';

      await expect(ExportService.exportToExcel(
        mockUserId, 'invalid', outputPath, {}
      )).rejects.toThrow(ValidationError);
    });

    it('should format currency columns correctly', async () => {
      const options = { dateRange: {} };
      const outputPath = '/app/exports/transactions.xlsx';

      await ExportService.exportToExcel(
        mockUserId, 'transactions', outputPath, options
      );

      expect(mockWorksheet.getColumn).toHaveBeenCalledWith('amount');
    });

    it('should add summary formulas to transactions sheet', async () => {
      const options = { dateRange: {} };
      const outputPath = '/app/exports/transactions.xlsx';

      await ExportService.exportToExcel(
        mockUserId, 'transactions', outputPath, options
      );

      // Verify that cells with formulas were set
      expect(mockWorksheet.getCell).toHaveBeenCalled();
    });
  });

  describe('Utility Methods', () => {
    it('should generate proper filename', () => {
      const filename = ExportService.generateFilename('transactions', 'csv', mockUserId);
      
      expect(filename).toMatch(/transactions-export-\d{4}-\d{2}-\d{2}-\w{6}\.csv/);
      expect(filename).toContain(mockUserId.slice(-6));
    });

    it('should ensure export directory exists', async () => {
      fs.promises.access.mockResolvedValue();

      await ExportService.ensureExportDirectory();

      expect(fs.promises.access).toHaveBeenCalledWith(
        expect.stringContaining('exports')
      );
    });

    it('should create directory if it does not exist', async () => {
      fs.promises.access.mockRejectedValue({ code: 'ENOENT' });
      fs.promises.mkdir.mockResolvedValue();

      await ExportService.ensureDirectory('/app/test');

      expect(fs.promises.mkdir).toHaveBeenCalledWith('/app/test', { recursive: true });
    });

    it('should clean up old export files', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

      fs.promises.readdir.mockResolvedValue(['old-file.csv', 'recent-file.csv']);
      fs.promises.stat
        .mockResolvedValueOnce({ mtime: oldDate })
        .mockResolvedValueOnce({ mtime: recentDate });
      fs.promises.unlink.mockResolvedValue();

      await ExportService.cleanupOldExports();

      expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
      expect(fs.promises.unlink).toHaveBeenCalledWith(
        expect.stringContaining('old-file.csv')
      );
    });

    it('should get export file info', async () => {
      const filePath = '/app/exports/test.csv';
      const mockStats = {
        size: 2048,
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-02')
      };

      fs.promises.stat.mockResolvedValue(mockStats);

      const result = await ExportService.getExportFileInfo(filePath);

      expect(result).toEqual({
        exists: true,
        size: 2048,
        created: mockStats.birthtime,
        modified: mockStats.mtime,
        filename: 'test.csv'
      });
    });

    it('should handle file not found in getExportFileInfo', async () => {
      const filePath = '/app/exports/nonexistent.csv';

      fs.promises.stat.mockRejectedValue(new Error('File not found'));

      const result = await ExportService.getExportFileInfo(filePath);

      expect(result).toEqual({
        exists: false,
        error: 'File not found'
      });
    });

    it('should stream export file for download', async () => {
      const filePath = '/app/exports/test.csv';
      const mockRes = {
        setHeader: jest.fn(),
        pipe: jest.fn()
      };
      const mockStream = {
        pipe: jest.fn(),
        on: jest.fn()
      };

      fs.promises.stat.mockResolvedValue({ size: 1024 });
      fs.createReadStream.mockReturnValue(mockStream);

      // Mock successful stream
      setTimeout(() => {
        const endCallback = mockStream.on.mock.calls.find(call => call[0] === 'end')[1];
        endCallback();
      }, 0);

      await ExportService.streamExportFile(filePath, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="test.csv"'
      );
      expect(mockStream.pipe).toHaveBeenCalledWith(mockRes);
    });

    it('should throw error when streaming non-existent file', async () => {
      const filePath = '/app/exports/nonexistent.csv';
      const mockRes = {};

      fs.promises.stat.mockRejectedValue(new Error('File not found'));

      await expect(ExportService.streamExportFile(filePath, mockRes))
        .rejects.toThrow(ValidationError);
    });

    it('should get correct MIME types', () => {
      expect(ExportService.getMimeType('.csv')).toBe('text/csv');
      expect(ExportService.getMimeType('.pdf')).toBe('application/pdf');
      expect(ExportService.getMimeType('.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(ExportService.getMimeType('.zip')).toBe('application/zip');
      expect(ExportService.getMimeType('.unknown')).toBe('application/octet-stream');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during export', async () => {
      Transaction.find.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const options = { dataType: 'transactions', format: 'csv' };

      await expect(ExportService.exportData(mockUserId, options))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle file system errors during CSV export', async () => {
      fs.promises.access.mockResolvedValue();
      mockCsvWriter.writeRecords.mockRejectedValue(new Error('Disk full'));

      const outputPath = '/app/exports/transactions.csv';

      await expect(ExportService.exportTransactionsToCSV(
        mockUserId, outputPath, {}, {}
      )).rejects.toThrow('Disk full');
    });

    it('should handle errors during ZIP creation', async () => {
      const mockArchiver = {
        pipe: jest.fn(),
        file: jest.fn(),
        finalize: jest.fn().mockRejectedValue(new Error('Archive creation failed'))
      };

      require('archiver').mockReturnValue(mockArchiver);
      fs.createWriteStream.mockReturnValue({});
      fs.promises.access.mockResolvedValue();

      const outputPath = '/app/exports/all-data.csv';

      await expect(ExportService.exportAllDataToCSV(
        mockUserId, outputPath, {}, {}
      )).rejects.toThrow('Archive creation failed');
    });

    it('should handle Excel workbook creation errors', async () => {
      const mockWorkbook = {
        addWorksheet: jest.fn().mockImplementation(() => {
          throw new Error('Worksheet creation failed');
        })
      };

      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      const options = { dateRange: {} };
      const outputPath = '/app/exports/transactions.xlsx';

      await expect(ExportService.exportToExcel(
        mockUserId, 'transactions', outputPath, options
      )).rejects.toThrow('Worksheet creation failed');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large transaction datasets efficiently', async () => {
      const largeTransactionSet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockTransaction,
        _id: `507f1f77bcf86cd79943${i.toString().padStart(4, '0')}`,
        description: `Transaction ${i}`,
        amount: Math.random() * 100
      }));

      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(largeTransactionSet)
          })
        })
      });

      fs.promises.access.mockResolvedValue();

      const startTime = Date.now();
      const result = await ExportService.exportTransactionsToCSV(
        mockUserId, '/app/exports/large-transactions.csv', {}, {}
      );
      const endTime = Date.now();

      expect(result.recordCount).toBe(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(mockCsvWriter.writeRecords).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ description: 'Transaction 0' }),
          expect.objectContaining({ description: 'Transaction 999' })
        ])
      );
    });

    it('should handle memory efficiently during all data export', async () => {
      const options = { dataType: 'all', format: 'csv' };
      
      // Mock large datasets
      Transaction.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(Array(500).fill(mockTransaction))
          })
        })
      });

      Budget.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(Array(100).fill(mockBudget))
          })
        })
      });

      const mockArchiver = {
        pipe: jest.fn(),
        file: jest.fn(),
        finalize: jest.fn().mockResolvedValue()
      };

      require('archiver').mockReturnValue(mockArchiver);
      fs.createWriteStream.mockReturnValue({});
      fs.promises.access.mockResolvedValue();

      const result = await ExportService.exportAllDataToCSV(
        mockUserId, '/app/exports/all-data.csv', {}, {}
      );

      expect(result.exports).toHaveLength(4);
      expect(result.recordCount).toBeGreaterThan(600);
    });
  });

  describe('Integration Scenarios', () => {
    it('should export data with complex filtering and date ranges', async () => {
      const options = {
        dataType: 'transactions',
        format: 'csv',
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        },
        filters: {
          category: 'Food & Dining',
          type: 'expense',
          minAmount: 5,
          maxAmount: 100
        }
      };

      fs.promises.access.mockResolvedValue();

      const result = await ExportService.exportData(mockUserId, options);

      expect(Transaction.find).toHaveBeenCalledWith({
        user: mockUserId,
        date: {
          $gte: new Date('2024-01-01'),
          $lte: new Date('2024-12-31')
        },
        category: 'Food & Dining',
        type: 'expense',
        amount: {
          $gte: 5,
          $lte: 100
        }
      });

      expect(result.format).toBe('csv');
    });

    it('should handle complete user data export workflow', async () => {
      const options = {
        dataType: 'all',
        format: 'excel',
        filename: 'complete-export.xlsx'
      };

      const mockWorkbook = {
        creator: '',
        addWorksheet: jest.fn().mockReturnValue({
          columns: [],
          addRow: jest.fn(),
          getRow: jest.fn().mockReturnValue({ eachCell: jest.fn() }),
          getColumn: jest.fn().mockReturnValue({ numFmt: '' }),
          getCell: jest.fn().mockReturnValue({ value: '', font: {} }),
          addConditionalFormatting: jest.fn()
        }),
        xlsx: {
          writeFile: jest.fn().mockResolvedValue()
        }
      };

      ExcelJS.Workbook.mockImplementation(() => mockWorkbook);
      fs.promises.access.mockResolvedValue();

      const result = await ExportService.exportData(mockUserId, options);

      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Transactions');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Budgets');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Goals');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Categories');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Summary');

      expect(result.filename).toBe('complete-export.xlsx');
      expect(result.format).toBe('excel');
    });
  });
});
