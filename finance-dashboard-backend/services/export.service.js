/**
 * Data Export Service
 * Comprehensive data export system supporting CSV, PDF, and Excel formats
 * Handles transactions, budgets, goals, categories, and reports with streaming support
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const csvWriter = require('csv-writer').createObjectCsvWriter;
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');
const Category = require('../models/Category');
const User = require('../models/User');
const { ValidationError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Data Export Service Class
 * Provides comprehensive export functionality for all financial data types
 */
class ExportService {
  /**
   * Export data in specified format
   * @param {string} userId - User ID
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result with file path or stream
   */
  static async exportData(userId, options) {
    const {
      dataType, // transactions, budgets, goals, categories, reports
      format, // csv, pdf, excel
      dateRange = {},
      filters = {},
      includeCharts = false,
      filename
    } = options;

    // Validate parameters
    if (!dataType) {
      throw new ValidationError('Data type is required');
    }

    if (!format) {
      throw new ValidationError('Export format is required');
    }

    const validDataTypes = ['transactions', 'budgets', 'goals', 'categories', 'reports', 'all'];
    const validFormats = ['csv', 'pdf', 'excel'];

    if (!validDataTypes.includes(dataType)) {
      throw new ValidationError(`Invalid data type. Must be one of: ${validDataTypes.join(', ')}`);
    }

    if (!validFormats.includes(format)) {
      throw new ValidationError(`Invalid format. Must be one of: ${validFormats.join(', ')}`);
    }

    logger.info(`Starting export for user ${userId}, type: ${dataType}, format: ${format}`);

    // Generate filename if not provided
    const exportFilename = filename || this.generateFilename(dataType, format, userId);
    const outputPath = path.join(process.cwd(), 'exports', exportFilename);

    // Ensure exports directory exists
    await this.ensureExportDirectory();

    let result;

    switch (format) {
      case 'csv':
        result = await this.exportToCSV(userId, dataType, outputPath, { dateRange, filters });
        break;
      case 'pdf':
        result = await this.exportToPDF(userId, dataType, outputPath, { dateRange, filters, includeCharts });
        break;
      case 'excel':
        result = await this.exportToExcel(userId, dataType, outputPath, { dateRange, filters });
        break;
    }

    logger.info(`Export completed for user ${userId}: ${exportFilename}`);
    return result;
  }

  /**
   * Export data to CSV format
   * @param {string} userId - User ID
   * @param {string} dataType - Type of data to export
   * @param {string} outputPath - Output file path
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  static async exportToCSV(userId, dataType, outputPath, options) {
    const { dateRange, filters } = options;
    
    switch (dataType) {
      case 'transactions':
        return await this.exportTransactionsToCSV(userId, outputPath, dateRange, filters);
      case 'budgets':
        return await this.exportBudgetsToCSV(userId, outputPath, dateRange);
      case 'goals':
        return await this.exportGoalsToCSV(userId, outputPath);
      case 'categories':
        return await this.exportCategoriesToCSV(userId, outputPath);
      case 'all':
        return await this.exportAllDataToCSV(userId, outputPath, dateRange, filters);
      default:
        throw new ValidationError(`CSV export not supported for data type: ${dataType}`);
    }
  }

  /**
   * Export transactions to CSV
   * @param {string} userId - User ID
   * @param {string} outputPath - Output file path
   * @param {Object} dateRange - Date range filter
   * @param {Object} filters - Additional filters
   * @returns {Promise<Object>} Export result
   */
  static async exportTransactionsToCSV(userId, outputPath, dateRange, filters) {
    const query = { user: userId };

    // Apply date range filter
    if (dateRange.startDate || dateRange.endDate) {
      query.date = {};
      if (dateRange.startDate) query.date.$gte = new Date(dateRange.startDate);
      if (dateRange.endDate) query.date.$lte = new Date(dateRange.endDate);
    }

    // Apply additional filters
    if (filters.category) query.category = filters.category;
    if (filters.type) query.type = filters.type;
    if (filters.minAmount) query.amount = { ...query.amount, $gte: filters.minAmount };
    if (filters.maxAmount) query.amount = { ...query.amount, $lte: filters.maxAmount };

    const transactions = await Transaction.find(query)
      .populate('category', 'name type')
      .sort({ date: -1 })
      .lean();

    const csvWriterInstance = csvWriter({
      path: outputPath,
      header: [
        { id: 'date', title: 'Date' },
        { id: 'description', title: 'Description' },
        { id: 'amount', title: 'Amount' },
        { id: 'type', title: 'Type' },
        { id: 'category', title: 'Category' },
        { id: 'payee', title: 'Payee' },
        { id: 'notes', title: 'Notes' },
        { id: 'status', title: 'Status' },
        { id: 'referenceNumber', title: 'Reference Number' }
      ]
    });

    const csvData = transactions.map(transaction => ({
      date: transaction.date.toISOString().split('T')[0],
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category?.name || 'Uncategorized',
      payee: transaction.payee || '',
      notes: transaction.notes || '',
      status: transaction.status,
      referenceNumber: transaction.referenceNumber || ''
    }));

    await csvWriterInstance.writeRecords(csvData);

    return {
      filePath: outputPath,
      filename: path.basename(outputPath),
      recordCount: csvData.length,
      format: 'csv',
      fileSize: fs.statSync(outputPath).size
    };
  }

  /**
   * Export budgets to CSV
   * @param {string} userId - User ID
   * @param {string} outputPath - Output file path
   * @param {Object} dateRange - Date range filter
   * @returns {Promise<Object>} Export result
   */
  static async exportBudgetsToCSV(userId, outputPath, dateRange) {
    const query = { user: userId };

    if (dateRange.startDate || dateRange.endDate) {
      query.$or = [];
      if (dateRange.startDate) {
        query.$or.push({ startDate: { $gte: new Date(dateRange.startDate) } });
      }
      if (dateRange.endDate) {
        query.$or.push({ endDate: { $lte: new Date(dateRange.endDate) } });
      }
    }

    const budgets = await Budget.find(query)
      .populate('category', 'name')
      .sort({ startDate: -1 })
      .lean();

    const csvWriterInstance = csvWriter({
      path: outputPath,
      header: [
        { id: 'name', title: 'Budget Name' },
        { id: 'category', title: 'Category' },
        { id: 'amount', title: 'Budget Amount' },
        { id: 'spent', title: 'Amount Spent' },
        { id: 'remaining', title: 'Remaining' },
        { id: 'percentage', title: 'Usage Percentage' },
        { id: 'period', title: 'Period' },
        { id: 'startDate', title: 'Start Date' },
        { id: 'endDate', title: 'End Date' },
        { id: 'status', title: 'Status' }
      ]
    });

    const csvData = budgets.map(budget => ({
      name: budget.name,
      category: budget.category?.name || 'All Categories',
      amount: budget.amount,
      spent: budget.spent || 0,
      remaining: budget.amount - (budget.spent || 0),
      percentage: budget.spent ? ((budget.spent / budget.amount) * 100).toFixed(2) + '%' : '0%',
      period: budget.period,
      startDate: budget.startDate.toISOString().split('T')[0],
      endDate: budget.endDate.toISOString().split('T')[0],
      status: budget.isActive ? 'Active' : 'Inactive'
    }));

    await csvWriterInstance.writeRecords(csvData);

    return {
      filePath: outputPath,
      filename: path.basename(outputPath),
      recordCount: csvData.length,
      format: 'csv',
      fileSize: fs.statSync(outputPath).size
    };
  }

  /**
   * Export goals to CSV
   * @param {string} userId - User ID
   * @param {string} outputPath - Output file path
   * @returns {Promise<Object>} Export result
   */
  static async exportGoalsToCSV(userId, outputPath) {
    const goals = await Goal.find({ user: userId })
      .sort({ targetDate: 1 })
      .lean();

    const csvWriterInstance = csvWriter({
      path: outputPath,
      header: [
        { id: 'name', title: 'Goal Name' },
        { id: 'description', title: 'Description' },
        { id: 'targetAmount', title: 'Target Amount' },
        { id: 'currentAmount', title: 'Current Amount' },
        { id: 'remainingAmount', title: 'Remaining Amount' },
        { id: 'progress', title: 'Progress %' },
        { id: 'targetDate', title: 'Target Date' },
        { id: 'status', title: 'Status' },
        { id: 'priority', title: 'Priority' }
      ]
    });

    const csvData = goals.map(goal => ({
      name: goal.name,
      description: goal.description || '',
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount || 0,
      remainingAmount: goal.targetAmount - (goal.currentAmount || 0),
      progress: goal.currentAmount ? ((goal.currentAmount / goal.targetAmount) * 100).toFixed(2) + '%' : '0%',
      targetDate: goal.targetDate.toISOString().split('T')[0],
      status: goal.status,
      priority: goal.priority || 'medium'
    }));

    await csvWriterInstance.writeRecords(csvData);

    return {
      filePath: outputPath,
      filename: path.basename(outputPath),
      recordCount: csvData.length,
      format: 'csv',
      fileSize: fs.statSync(outputPath).size
    };
  }

  /**
   * Export categories to CSV
   * @param {string} userId - User ID
   * @param {string} outputPath - Output file path
   * @returns {Promise<Object>} Export result
   */
  static async exportCategoriesToCSV(userId, outputPath) {
    const categories = await Category.find({ user: userId })
      .sort({ name: 1 })
      .lean();

    const csvWriterInstance = csvWriter({
      path: outputPath,
      header: [
        { id: 'name', title: 'Category Name' },
        { id: 'type', title: 'Type' },
        { id: 'description', title: 'Description' },
        { id: 'color', title: 'Color' },
        { id: 'icon', title: 'Icon' },
        { id: 'isActive', title: 'Active' },
        { id: 'createdAt', title: 'Created Date' }
      ]
    });

    const csvData = categories.map(category => ({
      name: category.name,
      type: category.type,
      description: category.description || '',
      color: category.color || '',
      icon: category.icon || '',
      isActive: category.isActive ? 'Yes' : 'No',
      createdAt: category.createdAt.toISOString().split('T')[0]
    }));

    await csvWriterInstance.writeRecords(csvData);

    return {
      filePath: outputPath,
      filename: path.basename(outputPath),
      recordCount: csvData.length,
      format: 'csv',
      fileSize: fs.statSync(outputPath).size
    };
  }

  /**
   * Export all data to multiple CSV files in a ZIP
   * @param {string} userId - User ID
   * @param {string} outputPath - Output file path (will be modified to .zip)
   * @param {Object} dateRange - Date range filter
   * @param {Object} filters - Additional filters
   * @returns {Promise<Object>} Export result
   */
  static async exportAllDataToCSV(userId, outputPath, dateRange, filters) {
    const archiver = require('archiver');
    const zipPath = outputPath.replace('.csv', '.zip');
    
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    // Export each data type to temporary CSV files
    const tempDir = path.join(process.cwd(), 'temp');
    await this.ensureDirectory(tempDir);

    const exports = [];

    try {
      // Export transactions
      const transactionsPath = path.join(tempDir, `transactions_${userId}_${Date.now()}.csv`);
      const transactionsResult = await this.exportTransactionsToCSV(userId, transactionsPath, dateRange, filters);
      archive.file(transactionsPath, { name: 'transactions.csv' });
      exports.push(transactionsResult);

      // Export budgets
      const budgetsPath = path.join(tempDir, `budgets_${userId}_${Date.now()}.csv`);
      const budgetsResult = await this.exportBudgetsToCSV(userId, budgetsPath, dateRange);
      archive.file(budgetsPath, { name: 'budgets.csv' });
      exports.push(budgetsResult);

      // Export goals
      const goalsPath = path.join(tempDir, `goals_${userId}_${Date.now()}.csv`);
      const goalsResult = await this.exportGoalsToCSV(userId, goalsPath);
      archive.file(goalsPath, { name: 'goals.csv' });
      exports.push(goalsResult);

      // Export categories
      const categoriesPath = path.join(tempDir, `categories_${userId}_${Date.now()}.csv`);
      const categoriesResult = await this.exportCategoriesToCSV(userId, categoriesPath);
      archive.file(categoriesPath, { name: 'categories.csv' });
      exports.push(categoriesResult);

      await archive.finalize();

      // Clean up temporary files
      setTimeout(() => {
        exports.forEach(exp => {
          try {
            fs.unlinkSync(exp.filePath);
          } catch (err) {
            logger.warn(`Failed to clean up temporary file: ${exp.filePath}`);
          }
        });
      }, 1000);

      return {
        filePath: zipPath,
        filename: path.basename(zipPath),
        recordCount: exports.reduce((sum, exp) => sum + exp.recordCount, 0),
        format: 'zip',
        fileSize: fs.statSync(zipPath).size,
        exports: exports.map(exp => ({
          type: exp.filename.split('.')[0],
          recordCount: exp.recordCount
        }))
      };
    } catch (error) {
      // Clean up on error
      exports.forEach(exp => {
        try {
          fs.unlinkSync(exp.filePath);
        } catch (err) {
          // Ignore cleanup errors
        }
      });
      throw error;
    }
  }

  /**
   * Export data to PDF format with charts and professional formatting
   * @param {string} userId - User ID
   * @param {string} dataType - Type of data to export
   * @param {string} outputPath - Output file path
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  static async exportToPDF(userId, dataType, outputPath, options) {
    const { dateRange, filters, includeCharts } = options;

    // Get user information
    const user = await User.findById(userId).lean();
    
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Report`,
        Author: 'Personal Finance Dashboard',
        Subject: 'Financial Data Export',
        Creator: 'Personal Finance Dashboard'
      }
    });

    doc.pipe(fs.createWriteStream(outputPath));

    // Add header
    this.addPDFHeader(doc, user, dataType, dateRange);

    switch (dataType) {
      case 'transactions':
        await this.addTransactionsToPDF(doc, userId, dateRange, filters);
        break;
      case 'budgets':
        await this.addBudgetsToPDF(doc, userId, dateRange);
        break;
      case 'goals':
        await this.addGoalsToPDF(doc, userId);
        break;
      case 'reports':
        await this.addReportsToPDF(doc, userId, dateRange, includeCharts);
        break;
      default:
        throw new ValidationError(`PDF export not supported for data type: ${dataType}`);
    }

    // Add footer
    this.addPDFFooter(doc);

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve({
          filePath: outputPath,
          filename: path.basename(outputPath),
          format: 'pdf',
          fileSize: fs.statSync(outputPath).size
        });
      });

      doc.on('error', reject);
    });
  }

  /**
   * Add PDF header with user info and title
   * @param {PDFDocument} doc - PDF document
   * @param {Object} user - User information
   * @param {string} dataType - Data type being exported
   * @param {Object} dateRange - Date range
   */
  static addPDFHeader(doc, user, dataType, dateRange) {
    // Logo/Title area
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('Personal Finance Dashboard', 50, 50);

    doc.fontSize(16)
       .font('Helvetica')
       .text(`${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Report`, 50, 80);

    // User info
    doc.fontSize(12)
       .text(`Generated for: ${user.firstName} ${user.lastName}`, 50, 110)
       .text(`Email: ${user.email}`, 50, 125)
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 140);

    // Date range if applicable
    if (dateRange.startDate || dateRange.endDate) {
      let dateRangeText = 'Date Range: ';
      if (dateRange.startDate) dateRangeText += `From ${new Date(dateRange.startDate).toLocaleDateString()}`;
      if (dateRange.endDate) dateRangeText += ` To ${new Date(dateRange.endDate).toLocaleDateString()}`;
      doc.text(dateRangeText, 50, 155);
    }

    // Add a line separator
    doc.moveTo(50, 180)
       .lineTo(550, 180)
       .stroke();
  }

  /**
   * Add transactions data to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {string} userId - User ID
   * @param {Object} dateRange - Date range filter
   * @param {Object} filters - Additional filters
   */
  static async addTransactionsToPDF(doc, userId, dateRange, filters) {
    const query = { user: userId };

    // Apply filters (same as CSV export)
    if (dateRange.startDate || dateRange.endDate) {
      query.date = {};
      if (dateRange.startDate) query.date.$gte = new Date(dateRange.startDate);
      if (dateRange.endDate) query.date.$lte = new Date(dateRange.endDate);
    }

    if (filters.category) query.category = filters.category;
    if (filters.type) query.type = filters.type;

    const transactions = await Transaction.find(query)
      .populate('category', 'name')
      .sort({ date: -1 })
      .limit(100) // Limit for PDF readability
      .lean();

    doc.y = 200;
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Transactions Summary', 50);

    doc.fontSize(10)
       .font('Helvetica')
       .text(`Total Transactions: ${transactions.length}`, 50, doc.y + 10);

    // Calculate totals
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    doc.text(`Total Income: $${totalIncome.toFixed(2)}`, 50, doc.y + 5)
       .text(`Total Expenses: $${totalExpenses.toFixed(2)}`, 50, doc.y + 5)
       .text(`Net Amount: $${(totalIncome - totalExpenses).toFixed(2)}`, 50, doc.y + 5);

    // Transaction table headers
    doc.y += 20;
    const tableTop = doc.y;
    const tableLeft = 50;

    doc.font('Helvetica-Bold')
       .text('Date', tableLeft, tableTop)
       .text('Description', tableLeft + 80, tableTop)
       .text('Amount', tableLeft + 250, tableTop)
       .text('Type', tableLeft + 320, tableTop)
       .text('Category', tableLeft + 380, tableTop);

    // Add transactions
    doc.font('Helvetica');
    let currentY = tableTop + 20;

    transactions.slice(0, 30).forEach((transaction, index) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      doc.text(transaction.date.toLocaleDateString(), tableLeft, currentY)
         .text(transaction.description.substring(0, 20), tableLeft + 80, currentY)
         .text(`$${transaction.amount.toFixed(2)}`, tableLeft + 250, currentY)
         .text(transaction.type, tableLeft + 320, currentY)
         .text(transaction.category?.name || 'N/A', tableLeft + 380, currentY);

      currentY += 15;
    });

    if (transactions.length > 30) {
      doc.text(`... and ${transactions.length - 30} more transactions`, tableLeft, currentY + 10);
    }
  }

  /**
   * Add budgets data to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {string} userId - User ID
   * @param {Object} dateRange - Date range filter
   */
  static async addBudgetsToPDF(doc, userId, dateRange) {
    const query = { user: userId };

    const budgets = await Budget.find(query)
      .populate('category', 'name')
      .sort({ startDate: -1 })
      .lean();

    doc.y = 200;
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Budgets Overview', 50);

    doc.fontSize(10)
       .font('Helvetica')
       .text(`Total Budgets: ${budgets.length}`, 50, doc.y + 10);

    // Budget table
    doc.y += 30;
    const tableTop = doc.y;
    const tableLeft = 50;

    doc.font('Helvetica-Bold')
       .text('Budget Name', tableLeft, tableTop)
       .text('Amount', tableLeft + 150, tableTop)
       .text('Spent', tableLeft + 220, tableTop)
       .text('Remaining', tableLeft + 290, tableTop)
       .text('Progress', tableLeft + 370, tableTop)
       .text('Status', tableLeft + 450, tableTop);

    doc.font('Helvetica');
    let currentY = tableTop + 20;

    budgets.forEach((budget) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      const spent = budget.spent || 0;
      const remaining = budget.amount - spent;
      const progress = budget.amount > 0 ? ((spent / budget.amount) * 100).toFixed(1) : '0';

      doc.text(budget.name.substring(0, 15), tableLeft, currentY)
         .text(`$${budget.amount.toFixed(2)}`, tableLeft + 150, currentY)
         .text(`$${spent.toFixed(2)}`, tableLeft + 220, currentY)
         .text(`$${remaining.toFixed(2)}`, tableLeft + 290, currentY)
         .text(`${progress}%`, tableLeft + 370, currentY)
         .text(budget.isActive ? 'Active' : 'Inactive', tableLeft + 450, currentY);

      currentY += 15;
    });
  }

  /**
   * Add goals data to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {string} userId - User ID
   */
  static async addGoalsToPDF(doc, userId) {
    const goals = await Goal.find({ user: userId })
      .sort({ targetDate: 1 })
      .lean();

    doc.y = 200;
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Financial Goals', 50);

    doc.fontSize(10)
       .font('Helvetica')
       .text(`Total Goals: ${goals.length}`, 50, doc.y + 10);

    // Goals details
    doc.y += 30;
    let currentY = doc.y;

    goals.forEach((goal) => {
      if (currentY > 650) {
        doc.addPage();
        currentY = 50;
      }

      const progress = goal.targetAmount > 0 ? ((goal.currentAmount || 0) / goal.targetAmount * 100).toFixed(1) : '0';
      const remaining = goal.targetAmount - (goal.currentAmount || 0);

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text(goal.name, 50, currentY);

      doc.fontSize(10)
         .font('Helvetica')
         .text(`Target: $${goal.targetAmount.toFixed(2)}`, 50, currentY + 15)
         .text(`Current: $${(goal.currentAmount || 0).toFixed(2)}`, 200, currentY + 15)
         .text(`Remaining: $${remaining.toFixed(2)}`, 350, currentY + 15)
         .text(`Progress: ${progress}%`, 50, currentY + 30)
         .text(`Target Date: ${goal.targetDate.toLocaleDateString()}`, 200, currentY + 30)
         .text(`Status: ${goal.status}`, 350, currentY + 30);

      if (goal.description) {
        doc.text(`Description: ${goal.description}`, 50, currentY + 45);
        currentY += 60;
      } else {
        currentY += 50;
      }

      // Add separator line
      doc.moveTo(50, currentY)
         .lineTo(550, currentY)
         .stroke();
      
      currentY += 10;
    });
  }

  /**
   * Add comprehensive reports to PDF with charts
   * @param {PDFDocument} doc - PDF document
   * @param {string} userId - User ID
   * @param {Object} dateRange - Date range filter
   * @param {boolean} includeCharts - Whether to include charts
   */
  static async addReportsToPDF(doc, userId, dateRange, includeCharts) {
    // Import report service for data
    const ReportService = require('./report.service');

    // Generate spending report
    const spendingReport = await ReportService.generateSpendingReport(userId, dateRange);
    const incomeReport = await ReportService.generateIncomeReport(userId, dateRange);
    const cashFlowReport = await ReportService.generateCashFlowReport(userId, dateRange);

    doc.y = 200;
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('Financial Reports Summary', 50);

    // Spending Analysis
    doc.y += 30;
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Spending Analysis', 50);

    doc.fontSize(10)
       .font('Helvetica')
       .text(`Total Spending: $${spendingReport.totalAmount?.toFixed(2) || '0.00'}`, 50, doc.y + 10)
       .text(`Number of Transactions: ${spendingReport.transactionCount || 0}`, 50, doc.y + 5)
       .text(`Average Transaction: $${spendingReport.averageAmount?.toFixed(2) || '0.00'}`, 50, doc.y + 5);

    // Top categories
    if (spendingReport.categoryAnalysis && spendingReport.categoryAnalysis.length > 0) {
      doc.y += 20;
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Top Spending Categories:', 50);

      doc.font('Helvetica');
      spendingReport.categoryAnalysis.slice(0, 5).forEach((category, index) => {
        doc.text(`${index + 1}. ${category.category}: $${category.amount.toFixed(2)} (${category.percentage.toFixed(1)}%)`, 70, doc.y + 5);
      });
    }

    // Income Analysis
    doc.y += 30;
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Income Analysis', 50);

    doc.fontSize(10)
       .font('Helvetica')
       .text(`Total Income: $${incomeReport.totalAmount?.toFixed(2) || '0.00'}`, 50, doc.y + 10)
       .text(`Number of Income Transactions: ${incomeReport.transactionCount || 0}`, 50, doc.y + 5)
       .text(`Average Income: $${incomeReport.averageAmount?.toFixed(2) || '0.00'}`, 50, doc.y + 5);

    // Cash Flow Analysis
    doc.y += 30;
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Cash Flow Summary', 50);

    const netCashFlow = (incomeReport.totalAmount || 0) - (spendingReport.totalAmount || 0);
    const savingsRate = incomeReport.totalAmount > 0 ? 
      ((netCashFlow / incomeReport.totalAmount) * 100).toFixed(1) : '0';

    doc.fontSize(10)
       .font('Helvetica')
       .text(`Net Cash Flow: $${netCashFlow.toFixed(2)}`, 50, doc.y + 10)
       .text(`Savings Rate: ${savingsRate}%`, 50, doc.y + 5);

    // Monthly trends if available
    if (cashFlowReport.monthlyCashFlow && cashFlowReport.monthlyCashFlow.length > 0) {
      doc.y += 30;
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Monthly Cash Flow Trends:', 50);

      doc.font('Helvetica');
      cashFlowReport.monthlyCashFlow.slice(-6).forEach((month) => {
        doc.text(`${month.month}: Income $${month.income.toFixed(2)}, Expenses $${month.expenses.toFixed(2)}, Net $${month.netCashFlow.toFixed(2)}`, 70, doc.y + 5);
      });
    }
  }

  /**
   * Add PDF footer
   * @param {PDFDocument} doc - PDF document
   */
  static addPDFFooter(doc) {
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      // Add page number
      doc.fontSize(8)
         .text(`Page ${i + 1} of ${pages.count}`, 
               doc.page.width - 100, 
               doc.page.height - 30);
      
      // Add generation timestamp
      doc.text(`Generated on ${new Date().toLocaleString()}`, 
               50, 
               doc.page.height - 30);
    }
  }

  /**
   * Export data to Excel format with multiple sheets and formulas
   * @param {string} userId - User ID
   * @param {string} dataType - Type of data to export
   * @param {string} outputPath - Output file path
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  static async exportToExcel(userId, dataType, outputPath, options) {
    const { dateRange, filters } = options;
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Personal Finance Dashboard';
    workbook.lastModifiedBy = 'System';
    workbook.created = new Date();
    workbook.modified = new Date();

    switch (dataType) {
      case 'transactions':
        await this.addTransactionsToExcel(workbook, userId, dateRange, filters);
        break;
      case 'budgets':
        await this.addBudgetsToExcel(workbook, userId, dateRange);
        break;
      case 'goals':
        await this.addGoalsToExcel(workbook, userId);
        break;
      case 'all':
        await this.addAllDataToExcel(workbook, userId, dateRange, filters);
        break;
      default:
        throw new ValidationError(`Excel export not supported for data type: ${dataType}`);
    }

    await workbook.xlsx.writeFile(outputPath);

    return {
      filePath: outputPath,
      filename: path.basename(outputPath),
      format: 'excel',
      fileSize: fs.statSync(outputPath).size
    };
  }

  /**
   * Add transactions to Excel workbook
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {string} userId - User ID
   * @param {Object} dateRange - Date range filter
   * @param {Object} filters - Additional filters
   */
  static async addTransactionsToExcel(workbook, userId, dateRange, filters) {
    const query = { user: userId };

    // Apply filters (same as other exports)
    if (dateRange.startDate || dateRange.endDate) {
      query.date = {};
      if (dateRange.startDate) query.date.$gte = new Date(dateRange.startDate);
      if (dateRange.endDate) query.date.$lte = new Date(dateRange.endDate);
    }

    if (filters.category) query.category = filters.category;
    if (filters.type) query.type = filters.type;

    const transactions = await Transaction.find(query)
      .populate('category', 'name type')
      .sort({ date: -1 })
      .lean();

    const worksheet = workbook.addWorksheet('Transactions');

    // Set column headers and widths
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Payee', key: 'payee', width: 20 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Reference', key: 'reference', width: 15 }
    ];

    // Style the header row
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6FA' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Add transaction data
    transactions.forEach((transaction) => {
      worksheet.addRow({
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category?.name || 'Uncategorized',
        payee: transaction.payee || '',
        notes: transaction.notes || '',
        status: transaction.status,
        reference: transaction.referenceNumber || ''
      });
    });

    // Format amount column as currency
    worksheet.getColumn('amount').numFmt = '$#,##0.00';

    // Format date column
    worksheet.getColumn('date').numFmt = 'mm/dd/yyyy';

    // Add summary formulas
    const lastRow = transactions.length + 1;
    const summaryStartRow = lastRow + 3;

    worksheet.getCell(`A${summaryStartRow}`).value = 'Summary:';
    worksheet.getCell(`A${summaryStartRow}`).font = { bold: true };

    worksheet.getCell(`A${summaryStartRow + 1}`).value = 'Total Income:';
    worksheet.getCell(`B${summaryStartRow + 1}`).value = {
      formula: `SUMIF(D2:D${lastRow},"income",C2:C${lastRow})`,
      result: 0
    };
    worksheet.getCell(`B${summaryStartRow + 1}`).numFmt = '$#,##0.00';

    worksheet.getCell(`A${summaryStartRow + 2}`).value = 'Total Expenses:';
    worksheet.getCell(`B${summaryStartRow + 2}`).value = {
      formula: `SUMIF(D2:D${lastRow},"expense",C2:C${lastRow})`,
      result: 0
    };
    worksheet.getCell(`B${summaryStartRow + 2}`).numFmt = '$#,##0.00';

    worksheet.getCell(`A${summaryStartRow + 3}`).value = 'Net Amount:';
    worksheet.getCell(`B${summaryStartRow + 3}`).value = {
      formula: `B${summaryStartRow + 1}-B${summaryStartRow + 2}`,
      result: 0
    };
    worksheet.getCell(`B${summaryStartRow + 3}`).numFmt = '$#,##0.00';

    // Auto-filter
    worksheet.autoFilter = `A1:I${lastRow}`;

    // Freeze top row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  /**
   * Add budgets to Excel workbook
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {string} userId - User ID
   * @param {Object} dateRange - Date range filter
   */
  static async addBudgetsToExcel(workbook, userId, dateRange) {
    const query = { user: userId };

    const budgets = await Budget.find(query)
      .populate('category', 'name')
      .sort({ startDate: -1 })
      .lean();

    const worksheet = workbook.addWorksheet('Budgets');

    // Set column headers
    worksheet.columns = [
      { header: 'Budget Name', key: 'name', width: 25 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Budget Amount', key: 'amount', width: 15 },
      { header: 'Amount Spent', key: 'spent', width: 15 },
      { header: 'Remaining', key: 'remaining', width: 15 },
      { header: 'Usage %', key: 'percentage', width: 12 },
      { header: 'Period', key: 'period', width: 12 },
      { header: 'Start Date', key: 'startDate', width: 15 },
      { header: 'End Date', key: 'endDate', width: 15 },
      { header: 'Status', key: 'status', width: 12 }
    ];

    // Style header
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6FA' }
      };
    });

    // Add budget data with formulas
    budgets.forEach((budget, index) => {
      const rowIndex = index + 2;
      const spent = budget.spent || 0;

      worksheet.addRow({
        name: budget.name,
        category: budget.category?.name || 'All Categories',
        amount: budget.amount,
        spent: spent,
        remaining: { formula: `C${rowIndex}-D${rowIndex}`, result: budget.amount - spent },
        percentage: { formula: `IF(C${rowIndex}=0,0,D${rowIndex}/C${rowIndex})`, result: budget.amount > 0 ? spent / budget.amount : 0 },
        period: budget.period,
        startDate: budget.startDate,
        endDate: budget.endDate,
        status: budget.isActive ? 'Active' : 'Inactive'
      });
    });

    // Format columns
    ['amount', 'spent', 'remaining'].forEach(col => {
      worksheet.getColumn(col).numFmt = '$#,##0.00';
    });
    worksheet.getColumn('percentage').numFmt = '0.0%';
    ['startDate', 'endDate'].forEach(col => {
      worksheet.getColumn(col).numFmt = 'mm/dd/yyyy';
    });

    // Auto-filter
    worksheet.autoFilter = `A1:J${budgets.length + 1}`;
  }

  /**
   * Add goals to Excel workbook
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {string} userId - User ID
   */
  static async addGoalsToExcel(workbook, userId) {
    const goals = await Goal.find({ user: userId })
      .sort({ targetDate: 1 })
      .lean();

    const worksheet = workbook.addWorksheet('Goals');

    worksheet.columns = [
      { header: 'Goal Name', key: 'name', width: 25 },
      { header: 'Description', key: 'description', width: 35 },
      { header: 'Target Amount', key: 'targetAmount', width: 15 },
      { header: 'Current Amount', key: 'currentAmount', width: 15 },
      { header: 'Remaining', key: 'remaining', width: 15 },
      { header: 'Progress %', key: 'progress', width: 12 },
      { header: 'Target Date', key: 'targetDate', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Priority', key: 'priority', width: 12 }
    ];

    // Style header
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6FA' }
      };
    });

    // Add goals with formulas
    goals.forEach((goal, index) => {
      const rowIndex = index + 2;
      const currentAmount = goal.currentAmount || 0;

      worksheet.addRow({
        name: goal.name,
        description: goal.description || '',
        targetAmount: goal.targetAmount,
        currentAmount: currentAmount,
        remaining: { formula: `C${rowIndex}-D${rowIndex}`, result: goal.targetAmount - currentAmount },
        progress: { formula: `IF(C${rowIndex}=0,0,D${rowIndex}/C${rowIndex})`, result: goal.targetAmount > 0 ? currentAmount / goal.targetAmount : 0 },
        targetDate: goal.targetDate,
        status: goal.status,
        priority: goal.priority || 'medium'
      });
    });

    // Format columns
    ['targetAmount', 'currentAmount', 'remaining'].forEach(col => {
      worksheet.getColumn(col).numFmt = '$#,##0.00';
    });
    worksheet.getColumn('progress').numFmt = '0.0%';
    worksheet.getColumn('targetDate').numFmt = 'mm/dd/yyyy';

    // Add conditional formatting for progress
    worksheet.addConditionalFormatting({
      ref: `F2:F${goals.length + 1}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'greaterThanOrEqual',
          formulae: [1],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF90EE90' } } }
        },
        {
          type: 'cellIs',
          operator: 'between',
          formulae: [0.7, 0.99],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFFF00' } } }
        },
        {
          type: 'cellIs',
          operator: 'lessThan',
          formulae: [0.5],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF6B6B' } } }
        }
      ]
    });
  }

  /**
   * Add all data types to Excel workbook with multiple sheets
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {string} userId - User ID
   * @param {Object} dateRange - Date range filter
   * @param {Object} filters - Additional filters
   */
  static async addAllDataToExcel(workbook, userId, dateRange, filters) {
    // Add all data types as separate worksheets
    await this.addTransactionsToExcel(workbook, userId, dateRange, filters);
    await this.addBudgetsToExcel(workbook, userId, dateRange);
    await this.addGoalsToExcel(workbook, userId);
    
    // Add categories worksheet
    const categories = await Category.find({ user: userId }).sort({ name: 1 }).lean();
    const categoriesSheet = workbook.addWorksheet('Categories');

    categoriesSheet.columns = [
      { header: 'Category Name', key: 'name', width: 25 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Description', key: 'description', width: 35 },
      { header: 'Color', key: 'color', width: 12 },
      { header: 'Icon', key: 'icon', width: 12 },
      { header: 'Active', key: 'isActive', width: 10 },
      { header: 'Created Date', key: 'createdAt', width: 15 }
    ];

    // Style header
    categoriesSheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6FA' }
      };
    });

    categories.forEach((category) => {
      categoriesSheet.addRow({
        name: category.name,
        type: category.type,
        description: category.description || '',
        color: category.color || '',
        icon: category.icon || '',
        isActive: category.isActive ? 'Yes' : 'No',
        createdAt: category.createdAt
      });
    });

    categoriesSheet.getColumn('createdAt').numFmt = 'mm/dd/yyyy';

    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary', { tabColor: { argb: 'FFFF0000' } });
    await this.addSummaryToExcel(summarySheet, userId, dateRange);
  }

  /**
   * Add summary information to Excel worksheet
   * @param {ExcelJS.Worksheet} worksheet - Excel worksheet
   * @param {string} userId - User ID
   * @param {Object} dateRange - Date range filter
   */
  static async addSummaryToExcel(worksheet, userId, dateRange) {
    // Get summary data
    const transactionCount = await Transaction.countDocuments({ user: userId });
    const budgetCount = await Budget.countDocuments({ user: userId });
    const goalCount = await Goal.countDocuments({ user: userId });
    const categoryCount = await Category.countDocuments({ user: userId });

    const user = await User.findById(userId).lean();

    worksheet.getCell('A1').value = 'Personal Finance Dashboard - Export Summary';
    worksheet.getCell('A1').font = { bold: true, size: 16 };

    worksheet.getCell('A3').value = 'Account Information:';
    worksheet.getCell('A3').font = { bold: true };
    worksheet.getCell('A4').value = `Name: ${user.firstName} ${user.lastName}`;
    worksheet.getCell('A5').value = `Email: ${user.email}`;
    worksheet.getCell('A6').value = `Export Date: ${new Date().toLocaleDateString()}`;

    if (dateRange.startDate || dateRange.endDate) {
      let dateRangeText = 'Date Range: ';
      if (dateRange.startDate) dateRangeText += `From ${new Date(dateRange.startDate).toLocaleDateString()}`;
      if (dateRange.endDate) dateRangeText += ` To ${new Date(dateRange.endDate).toLocaleDateString()}`;
      worksheet.getCell('A7').value = dateRangeText;
    }

    worksheet.getCell('A9').value = 'Data Summary:';
    worksheet.getCell('A9').font = { bold: true };
    worksheet.getCell('A10').value = `Total Transactions: ${transactionCount}`;
    worksheet.getCell('A11').value = `Total Budgets: ${budgetCount}`;
    worksheet.getCell('A12').value = `Total Goals: ${goalCount}`;
    worksheet.getCell('A13').value = `Total Categories: ${categoryCount}`;

    // Style the summary
    worksheet.getColumn('A').width = 40;
  }

  /**
   * Generate filename for export
   * @param {string} dataType - Type of data
   * @param {string} format - Export format
   * @param {string} userId - User ID
   * @returns {string} Generated filename
   */
  static generateFilename(dataType, format, userId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const userSuffix = userId.slice(-6);
    return `${dataType}-export-${timestamp}-${userSuffix}.${format}`;
  }

  /**
   * Ensure export directory exists
   * @returns {Promise<void>}
   */
  static async ensureExportDirectory() {
    const exportDir = path.join(process.cwd(), 'exports');
    await this.ensureDirectory(exportDir);
  }

  /**
   * Ensure directory exists
   * @param {string} dirPath - Directory path
   * @returns {Promise<void>}
   */
  static async ensureDirectory(dirPath) {
    try {
      await fs.promises.access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.promises.mkdir(dirPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  /**
   * Clean up old export files (older than 24 hours)
   * @returns {Promise<void>}
   */
  static async cleanupOldExports() {
    const exportDir = path.join(process.cwd(), 'exports');
    const tempDir = path.join(process.cwd(), 'temp');
    
    const cleanupDir = async (dirPath) => {
      try {
        const files = await fs.promises.readdir(dirPath);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = await fs.promises.stat(filePath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            await fs.promises.unlink(filePath);
            logger.info(`Cleaned up old export file: ${filePath}`);
          }
        }
      } catch (error) {
        logger.warn(`Failed to cleanup directory ${dirPath}:`, error.message);
      }
    };

    await cleanupDir(exportDir);
    await cleanupDir(tempDir);
  }

  /**
   * Get export file info
   * @param {string} filePath - File path
   * @returns {Promise<Object>} File information
   */
  static async getExportFileInfo(filePath) {
    try {
      const stats = await fs.promises.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        filename: path.basename(filePath)
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Stream large export for download
   * @param {string} filePath - File path to stream
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  static async streamExportFile(filePath, res) {
    const fileInfo = await this.getExportFileInfo(filePath);
    
    if (!fileInfo.exists) {
      throw new ValidationError('Export file not found');
    }

    const filename = fileInfo.filename;
    const mimeType = this.getMimeType(path.extname(filename));

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileInfo.size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    return new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  }

  /**
   * Get MIME type for file extension
   * @param {string} ext - File extension
   * @returns {string} MIME type
   */
  static getMimeType(ext) {
    const mimeTypes = {
      '.csv': 'text/csv',
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip'
    };
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
  }
}

module.exports = ExportService;
