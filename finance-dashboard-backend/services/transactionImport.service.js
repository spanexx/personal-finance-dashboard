/**
 * Transaction Import Service
 * Handles importing transactions from various file formats
 */

const fs = require('fs').promises;
const csv = require('csv-parser');
const ExcelJS = require('exceljs');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const { ValidationError } = require('../utils/errorHandler');

class TransactionImportService {
  /**
   * Import transactions from a file
   * @param {string} userId - User ID
   * @param {Object} file - Uploaded file
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  static async importTransactions(userId, file, options) {
    const { 
      dateFormat = 'MM/DD/YYYY',
      skipFirstRow = true,
      categoryMapping = {},
      defaultCategoryId 
    } = options;

    if (!file) {
      throw new ValidationError('Import file is required');
    }

    const allowedTypes = [
      'text/csv', 
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new ValidationError('Invalid file type. Only CSV and Excel files are allowed.');
    }

    let transactions = [];

    try {
      if (file.mimetype === 'text/csv') {
        // Parse CSV file
        transactions = await this.parseCSVFile(file.path, skipFirstRow);
      } else {
        // Parse Excel file
        transactions = await this.parseExcelFile(file.path, skipFirstRow);
      }

      // Clean up uploaded file
      await fs.unlink(file.path);
    } catch (parseError) {
      // Clean up file on error
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        console.warn('Failed to clean up uploaded file:', unlinkError.message);
      }
      
      throw new ValidationError(`Failed to parse import file: ${parseError.message}`);
    }

    // Validate and process transactions
    const processedTransactions = [];
    const validationErrors = [];

    for (let i = 0; i < transactions.length; i++) {
      const row = transactions[i];
      const rowNumber = i + (skipFirstRow ? 2 : 1);

      try {
        // Map and validate transaction data
        const transactionData = await this.mapTransactionData(row, {
          userId,
          dateFormat,
          categoryMapping,
          defaultCategoryId,
          rowNumber
        });

        processedTransactions.push(transactionData);
      } catch (validationError) {
        validationErrors.push({
          row: rowNumber,
          error: validationError.message,
          data: row
        });
      }
    }

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      const errorData = {
        validationErrors,
        totalRows: transactions.length,
        validRows: processedTransactions.length,
        errorRows: validationErrors.length
      };
      
      throw new ValidationError('Import validation failed', errorData);
    }

    // Save all valid transactions
    const savedTransactions = await Transaction.insertMany(processedTransactions);

    return {
      importedCount: savedTransactions.length,
      totalRows: transactions.length,
      skippedRows: transactions.length - savedTransactions.length,
      transactions: savedTransactions.slice(0, 10) // Return first 10 for preview
    };
  }

  /**
   * Parse CSV file and return transaction data
   * @param {string} filePath - Path to CSV file
   * @param {boolean} skipFirstRow - Whether to skip header row
   * @returns {Promise<Array>} Array of transaction rows
   */
  static async parseCSVFile(filePath, skipFirstRow) {
    return new Promise((resolve, reject) => {
      const transactions = [];
      const stream = require('fs').createReadStream(filePath);

      let isFirstRow = true;
      
      stream
        .pipe(csv())
        .on('data', (row) => {
          if (skipFirstRow && isFirstRow) {
            isFirstRow = false;
            return;
          }
          transactions.push(row);
          isFirstRow = false;
        })
        .on('end', () => {
          resolve(transactions);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Parse Excel file and return transaction data
   * @param {string} filePath - Path to Excel file
   * @param {boolean} skipFirstRow - Whether to skip header row
   * @returns {Promise<Array>} Array of transaction data
   */
  static async parseExcelFile(filePath, skipFirstRow) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const worksheet = workbook.getWorksheet(1); // Get first worksheet
    const jsonData = [];
    
    // Convert worksheet to array of arrays
    worksheet.eachRow((row, rowNumber) => {
      if (skipFirstRow && rowNumber === 1) {
        return; // Skip header row
      }
      
      const rowData = [];
      row.eachCell((cell, colNumber) => {
        rowData[colNumber - 1] = cell.value || '';
      });
      
      // Ensure we have at least 7 columns
      while (rowData.length < 7) {
        rowData.push('');
      }
      
      jsonData.push(rowData);
    });

    // Convert arrays to objects with consistent keys
    const headers = ['date', 'description', 'amount', 'type', 'category', 'payee', 'notes'];
    return jsonData.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
  }

  /**
   * Map imported row data to transaction format
   * @param {Object} row - Row data from import file
   * @param {Object} options - Mapping options
   * @returns {Promise<Object>} Mapped transaction data
   */
  static async mapTransactionData(row, options) {
    const { userId, dateFormat, categoryMapping, defaultCategoryId, rowNumber } = options;

    // Required fields validation
    if (!row.date || !row.description || !row.amount) {
      throw new Error(`Missing required fields: date, description, or amount`);
    }

    // Parse amount
    const amount = parseFloat(row.amount.toString().replace(/[,$]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      throw new Error(`Invalid amount: ${row.amount}`);
    }

    // Parse date
    let date;
    try {
      // Handle different date formats
      const dateStr = row.date.toString().trim();
      date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (dateError) {
      throw new Error(`Invalid date: ${row.date}`);
    }

    // Determine transaction type
    let type = 'expense'; // default
    if (row.type) {
      const typeStr = row.type.toString().toLowerCase();
      if (['income', 'expense', 'transfer'].includes(typeStr)) {
        type = typeStr;
      }
    } else if (amount > 0 && row.description.toLowerCase().includes('deposit')) {
      type = 'income';
    }

    // Find or create category
    let categoryId = defaultCategoryId;
    if (row.category) {
      const categoryName = row.category.toString().trim();
      
      // Check mapping first
      if (categoryMapping[categoryName]) {
        categoryId = categoryMapping[categoryName];
      } else {
        // Try to find existing category
        const existingCategory = await Category.findOne({
          user: userId,
          name: { $regex: new RegExp(`^${categoryName}$`, 'i') }
        });

        if (existingCategory) {
          categoryId = existingCategory._id;
        }
      }
    }

    if (!categoryId) {
      throw new Error(`No category found or mapped for: ${row.category || 'N/A'}`);
    }

    return {
      amount,
      type,
      date,
      description: row.description.toString().trim(),
      user: userId,
      category: categoryId,
      payee: row.payee ? row.payee.toString().trim() : undefined,
      notes: row.notes ? row.notes.toString().trim() : undefined,
      status: 'completed',
      referenceNumber: row.reference ? row.reference.toString().trim() : undefined
    };
  }
}

module.exports = TransactionImportService;
