/**
 * Data Import Service
 * Comprehensive data import system supporting CSV, Excel, and JSON formats
 * Handles bank statements, transactions, budgets, goals, and bulk data imports with validation
 */

const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');
const Category = require('../models/Category');
const User = require('../models/User');
const { ValidationError } = require('../utils/errorHandler');
const logger = require('../utils/logger');
const moment = require('moment');

/**
 * Data Import Service Class
 * Provides comprehensive import functionality with validation, mapping, and error handling
 */
class ImportService {
  /**
   * Import data from file
   * @param {string} userId - User ID
   * @param {Object} file - Uploaded file object
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  static async importData(userId, file, options) {
    const {
      dataType = 'transactions', // transactions, budgets, goals, categories, bankStatement
      format, // csv, excel, json
      mappingConfig = {},
      validationRules = {},
      skipDuplicates = true,
      batchSize = 1000,
      progressCallback
    } = options;

    // Validate parameters
    if (!file) {
      throw new ValidationError('Import file is required');
    }

    const validDataTypes = ['transactions', 'budgets', 'goals', 'categories', 'bankStatement'];
    if (!validDataTypes.includes(dataType)) {
      throw new ValidationError(`Invalid data type. Must be one of: ${validDataTypes.join(', ')}`);
    }

    logger.info(`Starting import for user ${userId}, type: ${dataType}, file: ${file.originalname}`);

    // Detect format from file if not provided
    const detectedFormat = format || this.detectFileFormat(file);
    
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new ValidationError('Invalid file type. Only CSV, Excel, and JSON files are allowed.');
    }

    let importResult;

    try {
      // Parse file based on format - handle both file paths and buffers
      let rawData;
      if (file.path) {
        // File path provided
        rawData = await this.parseFile(file, detectedFormat, options);
      } else if (file.buffer) {
        // File buffer provided
        rawData = await this.parseFileFromBuffer(file.buffer, file.mimetype, file.originalname);
      } else {
        throw new ValidationError('Invalid file object provided');
      }
      
      // Process data based on type
      switch (dataType) {
        case 'transactions':
          importResult = await this.importTransactions(userId, rawData, {
            mappingConfig,
            validationRules,
            skipDuplicates,
            batchSize,
            progressCallback
          });
          break;
        case 'budgets':
          importResult = await this.importBudgets(userId, rawData, {
            mappingConfig,
            validationRules,
            skipDuplicates,
            progressCallback
          });
          break;
        case 'goals':
          importResult = await this.importGoals(userId, rawData, {
            mappingConfig,
            validationRules,
            skipDuplicates,
            progressCallback
          });
          break;
        case 'categories':
          importResult = await this.importCategories(userId, rawData, {
            mappingConfig,
            validationRules,
            skipDuplicates,
            progressCallback
          });
          break;
        case 'bankStatement':
          importResult = await this.importBankStatement(userId, rawData, {
            mappingConfig,
            validationRules,
            skipDuplicates,
            batchSize,
            progressCallback
          });
          break;
        default:
          throw new ValidationError(`Import not supported for data type: ${dataType}`);
      }

      // Clean up uploaded file
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        logger.warn('Failed to clean up uploaded file:', unlinkError.message);
      }

      logger.info(`Import completed for user ${userId}: ${importResult.recordsImported} records imported`);
      return importResult;

    } catch (error) {
      // Clean up file on error
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        logger.warn('Failed to clean up uploaded file:', unlinkError.message);
      }
      
      logger.error(`Import failed for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Parse file based on format
   * @param {Object} file - File object
   * @param {string} format - File format
   * @param {Object} options - Parse options
   * @returns {Promise<Array>} Parsed data
   */
  static async parseFile(file, format, options = {}) {
    const { skipFirstRow = true, sheetName = null } = options;

    switch (format) {
      case 'csv':
        return await this.parseCSVFile(file.path, skipFirstRow);
      case 'excel':
        return await this.parseExcelFile(file.path, skipFirstRow, sheetName);
      case 'json':
        return await this.parseJSONFile(file.path);
      default:
        throw new ValidationError(`Unsupported file format: ${format}`);
    }
  }

  /**
   * Detect file format from file object
   * @param {Object} file - File object
   * @returns {string} Detected format
   */
  static detectFileFormat(file) {
    const mimeTypeToFormat = {
      'text/csv': 'csv',
      'application/vnd.ms-excel': 'excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
      'application/json': 'json'
    };

    return mimeTypeToFormat[file.mimetype] || 'csv';
  }

  /**
   * Parse CSV file
   * @param {string} filePath - File path
   * @param {boolean} skipFirstRow - Skip header row
   * @returns {Promise<Array>} Parsed data
   */
  static async parseCSVFile(filePath, skipFirstRow) {
    return new Promise((resolve, reject) => {
      const results = [];
      let isFirstRow = true;
      
      require('fs').createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          if (skipFirstRow && isFirstRow) {
            isFirstRow = false;
            return;
          }
          results.push(row);
          isFirstRow = false;
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  /**
   * Parse Excel file
   * @param {string} filePath - File path
   * @param {boolean} skipFirstRow - Skip header row
   * @param {string} sheetName - Specific sheet name
   * @returns {Promise<Array>} Parsed data
   */
  static async parseExcelFile(filePath, skipFirstRow, sheetName) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    let worksheet;
    if (sheetName) {
      worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        throw new ValidationError(`Sheet '${sheetName}' not found in Excel file`);
      }
    } else {
      worksheet = workbook.getWorksheet(1); // Get first worksheet
    }

    const results = [];
    let headers = [];
    
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Extract headers from first row
        headers = [];
        row.eachCell((cell, colNumber) => {
          headers[colNumber - 1] = cell.value ? cell.value.toString().trim() : `column_${colNumber}`;
        });
        
        if (!skipFirstRow) {
          const rowData = {};
          headers.forEach((header, index) => {
            rowData[header] = row.getCell(index + 1).value || '';
          });
          results.push(rowData);
        }
        return;
      }
      
      // Convert row to object using headers
      const rowData = {};
      headers.forEach((header, index) => {
        const cell = row.getCell(index + 1);
        let value = cell.value || '';
        
        // Handle Excel date cells
        if (cell.type === ExcelJS.ValueType.Date && value instanceof Date) {
          value = value.toISOString().split('T')[0];
        } else if (typeof value === 'object' && value.text) {
          value = value.text;
        }
        
        rowData[header] = value.toString().trim();
      });
      
      results.push(rowData);
    });

    return results;
  }

  /**
   * Parse JSON file
   * @param {string} filePath - File path
   * @returns {Promise<Array>} Parsed data
   */
  static async parseJSONFile(filePath) {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);
    
    // Ensure data is an array
    if (!Array.isArray(jsonData)) {
      if (typeof jsonData === 'object' && jsonData.data && Array.isArray(jsonData.data)) {
        return jsonData.data;
      }
      throw new ValidationError('JSON file must contain an array of objects or an object with a "data" array property');
    }
    
    return jsonData;
  }

  /**
   * Parse file from buffer
   * @param {Buffer} buffer - File buffer
   * @param {string} mimetype - File mimetype
   * @param {string} originalname - Original filename
   * @returns {Promise<Array>} Parsed data
   */
  static async parseFileFromBuffer(buffer, mimetype, originalname) {
    const format = this.detectFileFormat({ mimetype });
    
    switch (format) {
      case 'csv':
        return await this.parseCSVFromBuffer(buffer);
      case 'excel':
        return await this.parseExcelFromBuffer(buffer);
      case 'json':
        return await this.parseJSONFromBuffer(buffer);
      default:
        throw new ValidationError(`Unsupported file format: ${format}`);
    }
  }

  /**
   * Parse CSV from buffer
   * @param {Buffer} buffer - File buffer
   * @returns {Promise<Array>} Parsed data
   */
  static async parseCSVFromBuffer(buffer) {
    return new Promise((resolve, reject) => {
      const results = [];
      const { Readable } = require('stream');
      
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      
      readable
        .pipe(csv())
        .on('data', (row) => {
          results.push(row);
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Parse Excel from buffer
   * @param {Buffer} buffer - File buffer
   * @returns {Promise<Array>} Parsed data
   */
  static async parseExcelFromBuffer(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.getWorksheet(1); // Get first worksheet
    const results = [];
    
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = worksheet.getRow(1).getCell(colNumber).value;
        rowData[header] = cell.value;
      });
      results.push(rowData);
    });
    
    return results;
  }

  /**
   * Parse JSON from buffer
   * @param {Buffer} buffer - File buffer
   * @returns {Promise<Array>} Parsed data
   */
  static async parseJSONFromBuffer(buffer) {
    try {
      const jsonString = buffer.toString('utf8');
      const data = JSON.parse(jsonString);
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      throw new ValidationError('Invalid JSON format');
    }
  }

  /**
   * Import transactions with validation and duplicate detection
   * @param {string} userId - User ID
   * @param {Array} rawData - Raw transaction data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  static async importTransactions(userId, rawData, options) {
    const {
      mappingConfig = {},
      validationRules = {},
      skipDuplicates = true,
      batchSize = 1000,
      progressCallback
    } = options;

    const validatedTransactions = [];
    const validationErrors = [];
    const duplicates = [];

    // Default field mapping
    const defaultMapping = {
      date: ['date', 'transaction_date', 'Date', 'Transaction Date'],
      description: ['description', 'memo', 'Description', 'Memo', 'Details'],
      amount: ['amount', 'Amount', 'value', 'Value'],
      type: ['type', 'Type', 'transaction_type', 'Transaction Type'],
      category: ['category', 'Category', 'category_name'],
      payee: ['payee', 'Payee', 'merchant', 'Merchant'],
      paymentMethod: ['paymentMethod', 'payment_method', 'Payment Method', 'method'],
      notes: ['notes', 'Notes', 'memo', 'comment'],
      reference: ['reference', 'Reference', 'ref', 'transaction_id']
    };

    const fieldMapping = { ...defaultMapping, ...mappingConfig };

    // Get existing transactions for duplicate detection
    let existingTransactions = [];
    if (skipDuplicates) {
      existingTransactions = await Transaction.find({ user: userId })
        .select('date description amount')
        .lean();
    }

    // Process each row
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 1;

      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: rawData.length,
          phase: 'validation'
        });
      }

      try {
        // Map fields
        const mappedData = this.mapFields(row, fieldMapping);
        
        // Validate transaction
        const validatedTransaction = await this.validateTransaction(mappedData, userId, validationRules);
        
        // Check for duplicates
        if (skipDuplicates && this.isDuplicateTransaction(validatedTransaction, existingTransactions)) {
          duplicates.push({
            row: rowNumber,
            data: mappedData,
            reason: 'Duplicate transaction found'
          });
          continue;
        }

        validatedTransactions.push(validatedTransaction);

      } catch (error) {
        validationErrors.push({
          row: rowNumber,
          data: row,
          error: error.message
        });
      }
    }

    // Import valid transactions in batches
    const importedTransactions = [];
    const importErrors = [];

    for (let i = 0; i < validatedTransactions.length; i += batchSize) {
      const batch = validatedTransactions.slice(i, i + batchSize);
      
      if (progressCallback) {
        progressCallback({
          current: i + batch.length,
          total: validatedTransactions.length,
          phase: 'import'
        });
      }

      try {
        const savedTransactions = await Transaction.insertMany(batch, { ordered: false });
        importedTransactions.push(...savedTransactions);
      } catch (error) {
        // Handle individual insert errors
        if (error.writeErrors) {
          error.writeErrors.forEach((writeError) => {
            importErrors.push({
              row: i + writeError.index + 1,
              error: writeError.errmsg,
              data: batch[writeError.index]
            });
          });
        } else {
          throw error;
        }
      }
    }

    return {
      recordsProcessed: rawData.length,
      recordsImported: importedTransactions.length,
      recordsSkipped: duplicates.length,
      errors: validationErrors.concat(importErrors),
      warnings: [],
      summary: {
        processed: rawData.length,
        validated: validatedTransactions.length,
        imported: importedTransactions.length,
        skipped: duplicates.length,
        errors: validationErrors.length + importErrors.length
      }
    };
  }

  /**
   * Map fields from raw data to expected format
   * @param {Object} row - Raw data row
   * @param {Object} fieldMapping - Field mapping configuration
   * @returns {Object} Mapped data
   */
  static mapFields(row, fieldMapping) {
    const mapped = {};

    Object.keys(fieldMapping).forEach(targetField => {
      const possibleFields = fieldMapping[targetField];
      
      for (const field of possibleFields) {
        if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
          mapped[targetField] = row[field];
          break;
        }
      }
    });

    return mapped;
  }

  /**
   * Validate transaction data
   * @param {Object} data - Transaction data
   * @param {string} userId - User ID
   * @param {Object} validationRules - Custom validation rules
   * @returns {Promise<Object>} Validated transaction
   */
  static async validateTransaction(data, userId, validationRules = {}) {
    const errors = [];

    // Required fields
    const requiredFields = ['date', 'description', 'amount'];
    requiredFields.forEach(field => {
      if (!data[field]) {
        errors.push(`${field} is required`);
      }
    });

    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }

    // Parse and validate date
    let date;
    try {
      date = moment(data.date, ['YYYY-MM-DD', 'MM/DD/YYYY', 'MM-DD-YYYY', 'DD/MM/YYYY']).toDate();
      if (!moment(date).isValid()) {
        throw new Error('Invalid date');
      }
    } catch (dateError) {
      throw new ValidationError(`Invalid date format: ${data.date}`);
    }

    // Parse and validate amount
    let amount;
    try {
      amount = parseFloat(data.amount.toString().replace(/[,$]/g, ''));
      if (isNaN(amount)) {
        throw new Error('Invalid amount');
      }
      // Apply custom validation rules
      if (validationRules.minAmount && amount < validationRules.minAmount) {
        throw new ValidationError(`Amount below minimum: ${validationRules.minAmount}`);
      }
      if (validationRules.maxAmount && amount > validationRules.maxAmount) {
        throw new ValidationError(`Amount exceeds maximum: ${validationRules.maxAmount}`);
      }
    } catch (amountError) {
      throw new ValidationError(`Invalid amount: ${data.amount}`);
    }

    // Determine transaction type
    let type = 'expense'; // default
    if (data.type) {
      const typeStr = data.type.toString().toLowerCase();
      if (['income', 'expense', 'transfer'].includes(typeStr)) {
        type = typeStr;
      }
    } else {
      // Auto-detect based on amount or description
      if (amount > 0 && (data.description.toLowerCase().includes('deposit') || 
                         data.description.toLowerCase().includes('salary') ||
                         data.description.toLowerCase().includes('income'))) {
        type = 'income';
      }
    }

    // Find or create category
    let categoryId = null;
    if (data.category) {
      const categoryName = data.category.toString().trim();
      let category = await Category.findOne({
        user: userId,
        name: { $regex: new RegExp(`^${categoryName}$`, 'i') }
      });

      if (!category) {
        // Create new category if it doesn't exist
        category = await Category.create({
          name: categoryName,
          type: type === 'income' ? 'income' : 'expense',
          user: userId,
          isActive: true
        });
      }
      categoryId = category._id;
    }

    // Prepare transaction data
    const transaction = {
      amount: Math.abs(amount),
      type,
      date,
      description: data.description.toString().trim(),
      user: userId,
      category: categoryId,
      payee: data.payee ? data.payee.toString().trim() : undefined,
      paymentMethod: data.paymentMethod ? data.paymentMethod.toString().trim() : 'cash',
      notes: data.notes ? data.notes.toString().trim() : undefined,
      status: 'completed',
      referenceNumber: data.reference ? data.reference.toString().trim() : undefined
    };

    return transaction;
  }

  /**
   * Check if transaction is duplicate
   * @param {Object} transaction - Transaction to check
   * @param {Array} existingTransactions - Existing transactions
   * @returns {boolean} True if duplicate found
   */
  static isDuplicateTransaction(transaction, existingTransactions) {
    return existingTransactions.some(existing => {
      const sameDate = moment(existing.date).isSame(moment(transaction.date), 'day');
      const sameAmount = Math.abs(existing.amount - transaction.amount) < 0.01;
      const sameDescription = existing.description.toLowerCase() === transaction.description.toLowerCase();
      
      return sameDate && sameAmount && sameDescription;
    });
  }

  /**
   * Import budgets
   * @param {string} userId - User ID
   * @param {Array} rawData - Raw budget data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  static async importBudgets(userId, rawData, options) {
    const {
      mappingConfig = {},
      validationRules = {},
      skipDuplicates = true,
      progressCallback
    } = options;

    const defaultMapping = {
      name: ['name', 'budget_name', 'Name', 'Budget Name'],
      amount: ['amount', 'budget_amount', 'Amount', 'Budget Amount'],
      period: ['period', 'Period', 'frequency', 'Frequency'],
      startDate: ['start_date', 'startDate', 'Start Date'],
      endDate: ['end_date', 'endDate', 'End Date'],
      category: ['category', 'Category', 'category_name'],
      description: ['description', 'Description', 'notes']
    };

    const fieldMapping = { ...defaultMapping, ...mappingConfig };
    const validatedBudgets = [];
    const validationErrors = [];
    const duplicates = [];

    // Get existing budgets for duplicate detection
    let existingBudgets = [];
    if (skipDuplicates) {
      existingBudgets = await Budget.find({ user: userId })
        .select('name period startDate endDate')
        .lean();
    }

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 1;

      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: rawData.length,
          phase: 'validation'
        });
      }

      try {
        const mappedData = this.mapFields(row, fieldMapping);
        const validatedBudget = await this.validateBudget(mappedData, userId, validationRules);

        // Check for duplicates
        if (skipDuplicates && this.isDuplicateBudget(validatedBudget, existingBudgets)) {
          duplicates.push({
            row: rowNumber,
            data: mappedData,
            reason: 'Duplicate budget found'
          });
          continue;
        }

        validatedBudgets.push(validatedBudget);

      } catch (error) {
        validationErrors.push({
          row: rowNumber,
          data: row,
          error: error.message
        });
      }
    }

    // Import valid budgets
    const importedBudgets = [];
    try {
      const savedBudgets = await Budget.insertMany(validatedBudgets);
      importedBudgets.push(...savedBudgets);
    } catch (error) {
      throw new ValidationError(`Failed to import budgets: ${error.message}`);
    }

    return {
      recordsProcessed: rawData.length,
      recordsImported: importedBudgets.length,
      recordsSkipped: duplicates.length,
      errors: validationErrors,
      warnings: [],
      summary: {
        processed: rawData.length,
        validated: validatedBudgets.length,
        imported: importedBudgets.length,
        skipped: duplicates.length,
        errors: validationErrors.length
      }
    };
  }

  /**
   * Validate budget data
   * @param {Object} data - Budget data
   * @param {string} userId - User ID
   * @param {Object} validationRules - Custom validation rules
   * @returns {Promise<Object>} Validated budget
   */
  static async validateBudget(data, userId, validationRules = {}) {
    const errors = [];

    // Required fields
    const requiredFields = ['name', 'amount'];
    requiredFields.forEach(field => {
      if (!data[field]) {
        errors.push(`${field} is required`);
      }
    });

    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }

    // Parse amount
    let amount;
    try {
      amount = parseFloat(data.amount.toString().replace(/[,$]/g, ''));
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
      }
    } catch (amountError) {
      throw new ValidationError(`Invalid budget amount: ${data.amount}`);
    }

    // Parse dates
    let startDate, endDate;
    if (data.startDate) {
      startDate = moment(data.startDate).toDate();
      if (!moment(startDate).isValid()) {
        throw new ValidationError(`Invalid start date: ${data.startDate}`);
      }
    } else {
      startDate = new Date();
    }

    if (data.endDate) {
      endDate = moment(data.endDate).toDate();
      if (!moment(endDate).isValid()) {
        throw new ValidationError(`Invalid end date: ${data.endDate}`);
      }
    } else {
      // Default to end of current month
      endDate = moment(startDate).endOf('month').toDate();
    }

    if (endDate <= startDate) {
      throw new ValidationError('End date must be after start date');
    }

    // Find category if specified
    let categoryId = null;
    if (data.category) {
      const category = await Category.findOne({
        user: userId,
        name: { $regex: new RegExp(`^${data.category}$`, 'i') }
      });

      if (category) {
        categoryId = category._id;
      }
    }

    // Determine period
    const period = data.period || 'monthly';
    const validPeriods = ['weekly', 'monthly', 'quarterly', 'yearly'];
    if (!validPeriods.includes(period)) {
      throw new ValidationError(`Invalid period. Must be one of: ${validPeriods.join(', ')}`);
    }

    return {
      name: data.name.toString().trim(),
      amount,
      period,
      startDate,
      endDate,
      category: categoryId,
      description: data.description ? data.description.toString().trim() : undefined,
      user: userId,
      isActive: true,
      spent: 0
    };
  }

  /**
   * Check if budget is duplicate
   * @param {Object} budget - Budget to check
   * @param {Array} existingBudgets - Existing budgets
   * @returns {boolean} True if duplicate found
   */
  static isDuplicateBudget(budget, existingBudgets) {
    return existingBudgets.some(existing => {
      const sameName = existing.name.toLowerCase() === budget.name.toLowerCase();
      const samePeriod = existing.period === budget.period;
      const overlappingDates = moment(existing.startDate).isBefore(budget.endDate) && 
                               moment(existing.endDate).isAfter(budget.startDate);
      
      return sameName && samePeriod && overlappingDates;
    });
  }

  /**
   * Import goals
   * @param {string} userId - User ID
   * @param {Array} rawData - Raw goal data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  static async importGoals(userId, rawData, options) {
    const {
      mappingConfig = {},
      validationRules = {},
      skipDuplicates = true,
      progressCallback
    } = options;

    const defaultMapping = {
      name: ['name', 'goal_name', 'Name', 'Goal Name'],
      description: ['description', 'Description', 'notes'],
      targetAmount: ['target_amount', 'targetAmount', 'Target Amount', 'amount'],
      currentAmount: ['current_amount', 'currentAmount', 'Current Amount', 'saved'],
      targetDate: ['target_date', 'targetDate', 'Target Date', 'deadline'],
      priority: ['priority', 'Priority'],
      status: ['status', 'Status']
    };

    const fieldMapping = { ...defaultMapping, ...mappingConfig };
    const validatedGoals = [];
    const validationErrors = [];
    const duplicates = [];

    // Get existing goals for duplicate detection
    let existingGoals = [];
    if (skipDuplicates) {
      existingGoals = await Goal.find({ user: userId })
        .select('name targetAmount targetDate')
        .lean();
    }

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 1;

      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: rawData.length,
          phase: 'validation'
        });
      }

      try {
        const mappedData = this.mapFields(row, fieldMapping);
        const validatedGoal = await this.validateGoal(mappedData, userId, validationRules);

        // Check for duplicates
        if (skipDuplicates && this.isDuplicateGoal(validatedGoal, existingGoals)) {
          duplicates.push({
            row: rowNumber,
            data: mappedData,
            reason: 'Duplicate goal found'
          });
          continue;
        }

        validatedGoals.push(validatedGoal);

      } catch (error) {
        validationErrors.push({
          row: rowNumber,
          data: row,
          error: error.message
        });
      }
    }

    // Import valid goals
    const importedGoals = [];
    try {
      const savedGoals = await Goal.insertMany(validatedGoals);
      importedGoals.push(...savedGoals);
    } catch (error) {
      throw new ValidationError(`Failed to import goals: ${error.message}`);
    }

    return {
      recordsProcessed: rawData.length,
      recordsImported: importedGoals.length,
      recordsSkipped: duplicates.length,
      errors: validationErrors,
      warnings: [],
      summary: {
        processed: rawData.length,
        validated: validatedGoals.length,
        imported: importedGoals.length,
        skipped: duplicates.length,
        errors: validationErrors.length
      }
    };
  }

  /**
   * Validate goal data
   * @param {Object} data - Goal data
   * @param {string} userId - User ID
   * @param {Object} validationRules - Custom validation rules
   * @returns {Promise<Object>} Validated goal
   */
  static async validateGoal(data, userId, validationRules = {}) {
    const errors = [];

    // Required fields
    const requiredFields = ['name', 'targetAmount'];
    requiredFields.forEach(field => {
      if (!data[field]) {
        errors.push(`${field} is required`);
      }
    });

    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }

    // Parse target amount
    let targetAmount;
    try {
      targetAmount = parseFloat(data.targetAmount.toString().replace(/[,$]/g, ''));
      if (isNaN(targetAmount) || targetAmount <= 0) {
        throw new Error('Invalid target amount');
      }
    } catch (amountError) {
      throw new ValidationError(`Invalid target amount: ${data.targetAmount}`);
    }

    // Parse current amount
    let currentAmount = 0;
    if (data.currentAmount) {
      try {
        currentAmount = parseFloat(data.currentAmount.toString().replace(/[,$]/g, ''));
        if (isNaN(currentAmount) || currentAmount < 0) {
          currentAmount = 0;
        }
      } catch (currentAmountError) {
        currentAmount = 0;
      }
    }

    // Parse target date
    let targetDate;
    if (data.targetDate) {
      targetDate = moment(data.targetDate).toDate();
      if (!moment(targetDate).isValid()) {
        throw new ValidationError(`Invalid target date: ${data.targetDate}`);
      }
    } else {
      // Default to one year from now
      targetDate = moment().add(1, 'year').toDate();
    }

    // Validate priority
    const priority = data.priority || 'medium';
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      throw new ValidationError(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
    }

    // Validate status
    const status = data.status || 'active';
    const validStatuses = ['active', 'paused', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    return {
      name: data.name.toString().trim(),
      description: data.description ? data.description.toString().trim() : undefined,
      targetAmount,
      currentAmount,
      targetDate,
      priority,
      status,
      user: userId,
      isActive: status === 'active',
      reminderFrequency: 'monthly' // default
    };
  }

  /**
   * Check if goal is duplicate
   * @param {Object} goal - Goal to check
   * @param {Array} existingGoals - Existing goals
   * @returns {boolean} True if duplicate found
   */
  static isDuplicateGoal(goal, existingGoals) {
    return existingGoals.some(existing => {
      const sameName = existing.name.toLowerCase() === goal.name.toLowerCase();
      const sameTargetAmount = Math.abs(existing.targetAmount - goal.targetAmount) < 0.01;
      const sameTargetDate = moment(existing.targetDate).isSame(moment(goal.targetDate), 'day');
      
      return sameName && (sameTargetAmount || sameTargetDate);
    });
  }

  /**
   * Import categories
   * @param {string} userId - User ID
   * @param {Array} rawData - Raw category data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  static async importCategories(userId, rawData, options) {
    const {
      mappingConfig = {},
      validationRules = {},
      skipDuplicates = true,
      progressCallback
    } = options;

    const defaultMapping = {
      name: ['name', 'category_name', 'Name', 'Category Name'],
      type: ['type', 'Type', 'category_type'],
      description: ['description', 'Description', 'notes'],
      color: ['color', 'Color'],
      icon: ['icon', 'Icon'],
      budget: ['budget', 'Budget', 'monthly_budget']
    };

    const fieldMapping = { ...defaultMapping, ...mappingConfig };
    const validatedCategories = [];
    const validationErrors = [];
    const duplicates = [];

    // Get existing categories for duplicate detection
    let existingCategories = [];
    if (skipDuplicates) {
      existingCategories = await Category.find({ user: userId })
        .select('name type')
        .lean();
    }

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 1;

      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: rawData.length,
          phase: 'validation'
        });
      }

      try {
        const mappedData = this.mapFields(row, fieldMapping);
        const validatedCategory = await this.validateCategory(mappedData, userId, validationRules);

        // Check for duplicates
        if (skipDuplicates && this.isDuplicateCategory(validatedCategory, existingCategories)) {
          duplicates.push({
            row: rowNumber,
            data: mappedData,
            reason: 'Duplicate category found'
          });
          continue;
        }

        validatedCategories.push(validatedCategory);

      } catch (error) {
        validationErrors.push({
          row: rowNumber,
          data: row,
          error: error.message
        });
      }
    }

    // Import valid categories
    const importedCategories = [];
    try {
      const savedCategories = await Category.insertMany(validatedCategories);
      importedCategories.push(...savedCategories);
    } catch (error) {
      throw new ValidationError(`Failed to import categories: ${error.message}`);
    }

    return {
      recordsProcessed: rawData.length,
      recordsImported: importedCategories.length,
      recordsSkipped: duplicates.length,
      errors: validationErrors,
      warnings: [],
      summary: {
        processed: rawData.length,
        validated: validatedCategories.length,
        imported: importedCategories.length,
        skipped: duplicates.length,
        errors: validationErrors.length
      }
    };
  }

  /**
   * Validate category data
   * @param {Object} data - Category data
   * @param {string} userId - User ID
   * @param {Object} validationRules - Custom validation rules
   * @returns {Promise<Object>} Validated category
   */
  static async validateCategory(data, userId, validationRules = {}) {
    const errors = [];

    // Required fields
    if (!data.name) {
      errors.push('Category name is required');
    }

    if (errors.length > 0) {
      throw new ValidationError(errors.join(', '));
    }

    // Validate type
    const type = data.type || 'expense';
    const validTypes = ['income', 'expense'];
    if (!validTypes.includes(type)) {
      throw new ValidationError(`Invalid category type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Parse budget if provided
    let budget = null;
    if (data.budget) {
      try {
        budget = parseFloat(data.budget.toString().replace(/[,$]/g, ''));
        if (isNaN(budget) || budget < 0) {
          budget = null;
        }
      } catch (budgetError) {
        budget = null;
      }
    }

    // Default colors for different types
    const defaultColors = {
      income: '#28a745',
      expense: '#dc3545'
    };

    return {
      name: data.name.toString().trim(),
      type,
      description: data.description ? data.description.toString().trim() : undefined,
      color: data.color || defaultColors[type],
      icon: data.icon || (type === 'income' ? 'fa-plus' : 'fa-minus'),
      budget,
      user: userId,
      isActive: true
    };
  }

  /**
   * Check if category is duplicate
   * @param {Object} category - Category to check
   * @param {Array} existingCategories - Existing categories
   * @returns {boolean} True if duplicate found
   */
  static isDuplicateCategory(category, existingCategories) {
    return existingCategories.some(existing => {
      const sameName = existing.name.toLowerCase() === category.name.toLowerCase();
      const sameType = existing.type === category.type;
      
      return sameName && sameType;
    });
  }

  /**
   * Import bank statement
   * @param {string} userId - User ID
   * @param {Array} rawData - Raw bank statement data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  static async importBankStatement(userId, rawData, options) {
    const {
      mappingConfig = {},
      validationRules = {},
      skipDuplicates = true,
      batchSize = 1000,
      progressCallback
    } = options;

    // Bank statement specific mapping
    const defaultMapping = {
      date: ['date', 'transaction_date', 'posting_date', 'Date', 'Transaction Date', 'Posting Date'],
      description: ['description', 'memo', 'transaction_description', 'Description', 'Memo', 'Details'],
      amount: ['amount', 'debit', 'credit', 'Amount', 'Debit', 'Credit'],
      debit: ['debit', 'Debit', 'debit_amount'],
      credit: ['credit', 'Credit', 'credit_amount'],
      balance: ['balance', 'Balance', 'running_balance'],
      reference: ['reference', 'Reference', 'ref_number', 'check_number'],
      payee: ['payee', 'Payee', 'merchant', 'Merchant', 'counterparty']
    };

    const fieldMapping = { ...defaultMapping, ...mappingConfig };
    
    // Process bank statement data to convert to transaction format
    const processedData = rawData.map(row => {
      const mapped = this.mapFields(row, fieldMapping);
      
      // Handle debit/credit format
      if (mapped.debit || mapped.credit) {
        const debitAmount = mapped.debit ? parseFloat(mapped.debit.toString().replace(/[,$]/g, '')) : 0;
        const creditAmount = mapped.credit ? parseFloat(mapped.credit.toString().replace(/[,$]/g, '')) : 0;
        
        if (debitAmount > 0) {
          mapped.amount = -debitAmount; // Debit is negative (expense)
          mapped.type = 'expense';
        } else if (creditAmount > 0) {
          mapped.amount = creditAmount; // Credit is positive (income)
          mapped.type = 'income';
        }
      }
      
      return mapped;
    });

    // Import as transactions
    return await this.importTransactions(userId, processedData, {
      mappingConfig: fieldMapping,
      validationRules,
      skipDuplicates,
      batchSize,
      progressCallback
    });
  }

  /**
   * Get import options and validation rules
   * @returns {Object} Import options
   */
  static getImportOptions() {
    return {
      supportedFormats: ['csv', 'excel', 'json'],
      supportedTypes: ['transactions', 'budgets', 'goals', 'categories', 'bankStatement'],
      fieldMappings: {
        transactions: {
          date: ['date', 'transaction_date', 'Date', 'Transaction Date'],
          description: ['description', 'memo', 'Description', 'Memo', 'Details'],
          amount: ['amount', 'Amount', 'value', 'Value'],
          type: ['type', 'Type', 'transaction_type', 'Transaction Type'],
          category: ['category', 'Category', 'category_name'],
          payee: ['payee', 'Payee', 'merchant', 'Merchant'],
          notes: ['notes', 'Notes', 'memo', 'comment'],
          reference: ['reference', 'Reference', 'ref', 'transaction_id']
        },
        budgets: {
          name: ['name', 'budget_name', 'Name', 'Budget Name'],
          amount: ['amount', 'budget_amount', 'Amount', 'Budget Amount'],
          period: ['period', 'Period', 'frequency', 'Frequency'],
          startDate: ['start_date', 'startDate', 'Start Date'],
          endDate: ['end_date', 'endDate', 'End Date'],
          category: ['category', 'Category', 'category_name'],
          description: ['description', 'Description', 'notes']
        },
        goals: {
          name: ['name', 'goal_name', 'Name', 'Goal Name'],
          description: ['description', 'Description', 'notes'],
          targetAmount: ['target_amount', 'targetAmount', 'Target Amount', 'amount'],
          currentAmount: ['current_amount', 'currentAmount', 'Current Amount', 'saved'],
          targetDate: ['target_date', 'targetDate', 'Target Date', 'deadline'],
          priority: ['priority', 'Priority'],
          status: ['status', 'Status']
        },
        categories: {
          name: ['name', 'category_name', 'Name', 'Category Name'],
          type: ['type', 'Type', 'category_type'],
          description: ['description', 'Description', 'notes'],
          color: ['color', 'Color'],
          icon: ['icon', 'Icon'],
          budget: ['budget', 'Budget', 'monthly_budget']
        }
      },
      validationRules: {
        transactions: {
          requiredFields: ['date', 'description', 'amount'],
          dateFormats: ['YYYY-MM-DD', 'MM/DD/YYYY', 'MM-DD-YYYY', 'DD/MM/YYYY'],
          amountValidation: {
            numeric: true,
            nonZero: true
          }
        },
        budgets: {
          requiredFields: ['name', 'amount'],
          validPeriods: ['weekly', 'monthly', 'quarterly', 'yearly']
        },
        goals: {
          requiredFields: ['name', 'targetAmount'],
          validPriorities: ['low', 'medium', 'high'],
          validStatuses: ['active', 'paused', 'completed', 'cancelled']
        },
        categories: {
          requiredFields: ['name'],
          validTypes: ['income', 'expense']
        }
      },
      maxFileSize: '10MB',
      maxRecords: 10000
    };
  }

  /**
   * Validate import file before processing
   * @param {string|Object} fileInput - File path or file object with buffer
   * @param {string} type - Data type
   * @returns {Promise<Object>} Validation result
   */
  static async validateImportFile(fileInput, type) {
    try {
      let data;
      
      // Handle both file path and file object with buffer
      if (typeof fileInput === 'string') {
        // File path provided
        data = await this.parseFile({ path: fileInput }, this.detectFileFormat({ mimetype: 'text/csv' }));
      } else if (fileInput && fileInput.buffer) {
        // File object with buffer provided
        data = await this.parseFileFromBuffer(fileInput.buffer, fileInput.mimetype, fileInput.originalname);
      } else {
        throw new ValidationError('Invalid file input provided');
      }
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new ValidationError('File appears to be empty or invalid format');
      }

      const options = this.getImportOptions();
      const requiredFields = options.validationRules[type]?.requiredFields || [];
      const availableFields = Object.keys(data[0] || {});
      
      const missingFields = requiredFields.filter(field => 
        !availableFields.some(available => 
          available.toLowerCase().includes(field.toLowerCase())
        )
      );

      return {
        isValid: missingFields.length === 0,
        recordCount: data.length,
        availableFields,
        requiredFields,
        missingFields,
        suggestions: this.generateFieldMappingSuggestions(availableFields, type)
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
        recordCount: 0,
        availableFields: [],
        requiredFields: [],
        missingFields: [],
        suggestions: {}
      };
    }
  }

  /**
   * Generate field mapping suggestions
   * @param {Array} availableFields - Available fields in file
   * @param {string} type - Data type
   * @returns {Object} Mapping suggestions
   */
  static generateFieldMappingSuggestions(availableFields, type) {
    const options = this.getImportOptions();
    const mappings = options.fieldMappings[type] || {};
    const suggestions = {};

    Object.keys(mappings).forEach(targetField => {
      const possibleFields = mappings[targetField];
      const match = availableFields.find(field => 
        possibleFields.some(possible => 
          field.toLowerCase().includes(possible.toLowerCase()) ||
          possible.toLowerCase().includes(field.toLowerCase())
        )
      );
      
      if (match) {
        suggestions[targetField] = match;
      }
    });

    return suggestions;
  }

  /**
   * Get import history for user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Import history
   */
  static async getImportHistory(userId, options = {}) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const [imports, total] = await Promise.all([
      ImportHistory.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ImportHistory.countDocuments({ userId })
    ]);

    return {
      imports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Cancel import operation
   * @param {string} userId - User ID
   * @param {string} importId - Import ID
   * @returns {Promise<Object>} Cancel result
   */
  static async cancelImport(userId, importId) {
    const importRecord = await ImportHistory.findOne({
      _id: importId,
      userId,
      status: { $in: ['pending', 'validating', 'processing'] }
    });

    if (!importRecord) {
      throw new ValidationError('Import not found or cannot be cancelled');
    }

    await importRecord.markAsCancelled();

    return {
      success: true,
      message: 'Import cancelled successfully'
    };
  }
}

module.exports = ImportService;
