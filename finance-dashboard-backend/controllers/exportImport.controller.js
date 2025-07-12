/**
 * Export/Import Controller
 * Handles comprehensive data export and import operations
 */

const { exportService, importService, emailService } = require('../services');
const { validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs').promises;

class ExportImportController {
  /**
   * Export user data in specified format
   */
  async exportData(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const { format, type, dateRange, includeAttachments = false } = req.body;

      const exportResult = await exportService.exportUserData(userId, {
        format,
        type,
        dateRange,
        includeAttachments
      });

      // Send notification email about successful export
      await emailService.sendExportNotification(req.user.email, {
        exportType: type,
        format,
        fileName: exportResult.fileName,
        downloadUrl: exportResult.downloadUrl
      });

      res.json({
        success: true,
        message: 'Data exported successfully',
        data: {
          fileName: exportResult.fileName,
          downloadUrl: exportResult.downloadUrl,
          fileSize: exportResult.fileSize,
          recordCount: exportResult.recordCount,
          format,
          type
        }
      });
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        message: 'Export failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Import data from uploaded file
   */
  async importData(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const userId = req.user.id;
      const { type, options = {} } = req.body;
      
      // Get file path from upload results if available
      let filePath = null;
      if (req.uploadResults && req.uploadResults.length > 0) {
        filePath = req.uploadResults[0].filePath;
      }
      
      // Create file object for import service
      const fileForImport = filePath ? { path: filePath } : {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype
      };

      // Parse options if it's a string
      let parsedOptions = {};
      if (typeof options === 'string') {
        try {
          parsedOptions = JSON.parse(options);
        } catch (e) {
          parsedOptions = {};
        }
      } else if (typeof options === 'object') {
        parsedOptions = options;
      }

      const importResult = await importService.importData(userId, fileForImport, {
        dataType: type,
        format: req.file.mimetype.includes('csv') ? 'csv' : 
                req.file.mimetype.includes('excel') || req.file.mimetype.includes('sheet') ? 'excel' : 'json',
        ...parsedOptions
      });

      // Send notification email about import completion
      await emailService.sendImportNotification(req.user.email, {
        importType: type,
        fileName: req.file.originalname,
        recordsProcessed: importResult.recordsProcessed,
        recordsImported: importResult.recordsImported,
        errors: importResult.errors
      });

      // Clean up uploaded file
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup uploaded file:', cleanupError);
      }

      res.json({
        success: true,
        message: 'Data imported successfully',
        data: {
          recordsProcessed: importResult.recordsProcessed,
          recordsImported: importResult.recordsImported,
          recordsSkipped: importResult.recordsSkipped,
          errors: importResult.errors,
          warnings: importResult.warnings,
          summary: importResult.summary
        }
      });
    } catch (error) {
      console.error('Import error:', error);
      
      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.warn('Failed to cleanup uploaded file after error:', cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Import failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get export history for user
   */
  async getExportHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const history = await exportService.getExportHistory(userId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Get export history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve export history',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get import history for user
   */
  async getImportHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const history = await importService.getImportHistory(userId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Get import history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve import history',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Download exported file
   */
  async downloadExport(req, res) {
    try {
      const userId = req.user.id;
      const { exportId } = req.params;

      const exportRecord = await exportService.getExportRecord(userId, exportId);
      
      if (!exportRecord) {
        return res.status(404).json({
          success: false,
          message: 'Export not found'
        });
      }

      const filePath = path.join(process.cwd(), 'exports', exportRecord.fileName);
      
      try {
        await fs.access(filePath);
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: 'Export file not found'
        });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${exportRecord.fileName}"`);
      res.setHeader('Content-Type', exportRecord.mimeType || 'application/octet-stream');
      
      res.sendFile(filePath);
    } catch (error) {
      console.error('Download export error:', error);
      res.status(500).json({
        success: false,
        message: 'Download failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get available export formats and types
   */
  async getExportOptions(req, res) {
    try {
      const options = await exportService.getExportOptions();
      
      res.json({
        success: true,
        data: options
      });
    } catch (error) {
      console.error('Get export options error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve export options',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get supported import formats and validation rules
   */
  async getImportOptions(req, res) {
    try {
      const options = await importService.getImportOptions();
      
      res.json({
        success: true,
        data: options
      });
    } catch (error) {
      console.error('Get import options error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve import options',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Validate import file before processing
   */
  async validateImportFile(req, res) {
    try {
      console.log('validateImportFile - req.file:', req.file);
      console.log('validateImportFile - req.body:', req.body);
      console.log('validateImportFile - req.user:', req.user);
      console.log('validateImportFile - req.uploadResults:', req.uploadResults);
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const { type } = req.body;
      
      // Get file path from upload results if available, otherwise use buffer
      let filePath = null;
      if (req.uploadResults && req.uploadResults.length > 0) {
        filePath = req.uploadResults[0].filePath;
      }
      
      console.log('validateImportFile - filePath:', filePath);

      // If we don't have a file path, we can work with the buffer directly
      if (!filePath && !req.file.buffer) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file upload'
        });
      }

      // Use file path if available, otherwise pass file object with buffer
      const fileToValidate = filePath ? filePath : {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype
      };

      const validation = await importService.validateImportFile(fileToValidate, type);

      // Clean up uploaded file after validation
      if (filePath) {
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup validation file:', cleanupError);
        }
      }

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      console.error('Validate import file error:', error);
      
      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.warn('Failed to cleanup validation file after error:', cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'File validation failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Cancel ongoing export/import operation
   */
  async cancelOperation(req, res) {
    try {
      const userId = req.user.id;
      const { operationId, type } = req.params;

      let result;
      if (type === 'export') {
        result = await exportService.cancelExport(userId, operationId);
      } else if (type === 'import') {
        result = await importService.cancelImport(userId, operationId);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid operation type'
        });
      }

      res.json({
        success: true,
        message: `${type} operation cancelled successfully`,
        data: result
      });
    } catch (error) {
      console.error('Cancel operation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel operation',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new ExportImportController();
