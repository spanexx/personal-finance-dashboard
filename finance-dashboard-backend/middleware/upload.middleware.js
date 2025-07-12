/**
 * File Upload Middleware
 * Comprehensive file upload system with security, validation, and storage management
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const AWS = require('aws-sdk');
const fileType = require('file-type');
const logger = require('../utils/logger');
const config = require('../config/environment');
const { ValidationError, SecurityError } = require('../utils/errorHandler');

/**
 * Configuration for file upload system
 */
class UploadConfig {
  static getConfig() {
    const uploadConfig = config.getUploadConfig();
    const env = process.env.NODE_ENV || 'development';
    
    return {
      // File size limits by type
      limits: {
        image: {
          maxSize: 5 * 1024 * 1024, // 5MB
          maxFiles: 5,
          allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        },
        document: {
          maxSize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          allowedTypes: [
            'application/pdf',
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain'
          ]
        },
        avatar: {
          maxSize: 3 * 1024 * 1024, // 3MB
          maxFiles: 1,
          allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        }
      },
      
      // Storage configuration
      storage: {
        type: uploadConfig.storageType || 'local',
        local: {
          basePath: uploadConfig.uploadPath || './uploads',
          tempPath: './uploads/temp',
          structure: env === 'production' ? 'date' : 'type'
        },
        aws: {
          region: uploadConfig.aws?.region || process.env.AWS_REGION,
          bucket: uploadConfig.aws?.bucketName || process.env.AWS_BUCKET_NAME,
          accessKeyId: uploadConfig.aws?.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: uploadConfig.aws?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY
        }
      },
      
      // Security configuration
      security: {
        enableMagicNumberValidation: true,
        enableVirusScanning: env === 'production',
        quarantinePath: './uploads/quarantine',
        maxTotalUploadSize: 50 * 1024 * 1024 // 50MB total per request
      },
      
      // Processing configuration
      processing: {
        enableImageProcessing: true,
        generateThumbnails: true,
        optimizeImages: true,
        thumbnailSizes: [150, 300, 600]
      },
      
      // Cleanup configuration
      cleanup: {
        tempFileLifetime: 24 * 60 * 60 * 1000, // 24 hours
        orphanedFileCheckInterval: 60 * 60 * 1000, // 1 hour
        enableAutoCleanup: true
      }
    };
  }
}

/**
 * File Type Validator
 */
class FileValidator {
  /**
   * Validate file type using magic numbers
   */  static async validateFileType(buffer, mimeType, filename) {
    try {
      // Use file-type library for magic number detection
      // For file-type v16, use fromBuffer directly
      const detectedType = await fileType.fromBuffer(buffer);
      
      // For CSV and text files, detection might fail, so allow them through
      if (!detectedType && (mimeType === 'text/csv' || mimeType === 'text/plain')) {
        return true;
      }
      
      if (!detectedType) {
        logger.warn('Unable to determine file type, allowing through for common formats', {
          filename,
          mimeType
        });
        // Allow common document formats through if detection fails
        const allowedWithoutDetection = [
          'text/csv',
          'text/plain',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (allowedWithoutDetection.includes(mimeType)) {
          return true;
        }
        throw new ValidationError('Unable to determine file type');
      }
      
      // Cross-verify MIME type (skip for CSV as it's often detected as text/plain)
      if (detectedType.mime !== mimeType && mimeType !== 'text/csv') {
        logger.warn('MIME type mismatch detected', {
          filename,
          declaredType: mimeType,
          detectedType: detectedType.mime
        });
        // Allow through if it's a common mismatch (e.g., CSV detected as text/plain)
        const commonMismatches = [
          { declared: 'text/csv', detected: 'text/plain' },
          { declared: 'application/vnd.ms-excel', detected: 'application/zip' }
        ];
        const isCommonMismatch = commonMismatches.some(mm => 
          mm.declared === mimeType && mm.detected === detectedType.mime
        );
        if (!isCommonMismatch) {
          throw new SecurityError('File type mismatch detected');
        }
      }
      
      // Validate file extension
      const extension = path.extname(filename).toLowerCase();
      const expectedExtensions = this.getExpectedExtensions(detectedType.mime || mimeType);
      
      if (!expectedExtensions.includes(extension)) {
        throw new SecurityError('File extension does not match file type');
      }
      
      return {
        isValid: true,
        detectedType: detectedType.mime,
        extension: detectedType.ext
      };
    } catch (error) {
      logger.error('File type validation error:', error);
      throw error;
    }
  }
  
  /**
   * Get expected file extensions for MIME type
   */
  static getExpectedExtensions(mimeType) {
    const extensionMap = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    };
    
    return extensionMap[mimeType] || [];
  }
  
  /**
   * Validate image dimensions and quality
   */
  static async validateImageContent(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      
      // Check minimum dimensions
      if (metadata.width < 50 || metadata.height < 50) {
        throw new ValidationError('Image dimensions too small (minimum 50x50)');
      }
      
      // Check maximum dimensions
      if (metadata.width > 10000 || metadata.height > 10000) {
        throw new ValidationError('Image dimensions too large (maximum 10000x10000)');
      }
      
      // Check if image is corrupted
      if (!metadata.format) {
        throw new ValidationError('Corrupted image file');
      }
      
      return {
        isValid: true,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        channels: metadata.channels,
        density: metadata.density
      };
    } catch (error) {
      logger.error('Image validation error:', error);
      throw new ValidationError('Invalid image file');
    }
  }
  
  /**
   * Validate document structure
   */
  static async validateDocumentContent(buffer, mimeType) {
    try {
      // Basic validation for now - can be extended with specific parsers
      if (buffer.length === 0) {
        throw new ValidationError('Empty document file');
      }
      
      // Check for basic PDF structure
      if (mimeType === 'application/pdf') {
        const header = buffer.slice(0, 5).toString();
        if (header !== '%PDF-') {
          throw new ValidationError('Invalid PDF file structure');
        }
      }
      
      // Check for CSV structure
      if (mimeType === 'text/csv') {
        const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
        if (!content.includes(',') && !content.includes('\t')) {
          throw new ValidationError('Invalid CSV file structure');
        }
      }
      
      return { isValid: true };
    } catch (error) {
      logger.error('Document validation error:', error);
      throw error;
    }
  }
}

/**
 * File Security Scanner
 */
class SecurityScanner {
  /**
   * Scan file for security threats
   */
  static async scanFile(buffer, filename) {
    try {
      // Check for executable file patterns
      await this.checkExecutablePatterns(buffer);
      
      // Check for embedded scripts
      await this.checkEmbeddedScripts(buffer);
      
      // Log security scan
      logger.info('File security scan completed', {
        filename,
        size: buffer.length,
        status: 'clean'
      });
      
      return { isClean: true };
    } catch (error) {
      logger.error('Security scan failed:', error);
      throw new SecurityError('File failed security scan');
    }
  }
  
  /**
   * Check for executable file patterns
   */
  static async checkExecutablePatterns(buffer) {
    const dangerousPatterns = [
      Buffer.from([0x4D, 0x5A]), // PE executable
      Buffer.from('#!/bin/sh'),
      Buffer.from('#!/bin/bash'),
      Buffer.from('<script'),
      Buffer.from('javascript:'),
      Buffer.from('vbscript:')
    ];
    
    for (const pattern of dangerousPatterns) {
      if (buffer.includes(pattern)) {
        throw new SecurityError('Dangerous executable pattern detected');
      }
    }
  }
  
  /**
   * Check for embedded scripts
   */
  static async checkEmbeddedScripts(buffer) {
    const content = buffer.toString('utf8');
    const scriptPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi
    ];
    
    for (const pattern of scriptPatterns) {
      if (pattern.test(content)) {
        throw new SecurityError('Embedded script detected');
      }
    }
  }
}

/**
 * Storage Manager
 */
class StorageManager {
  constructor() {
    this.config = UploadConfig.getConfig();
    this.s3Client = null;
    
    if (this.config.storage.type === 'aws') {
      this.initializeS3();
    }
  }
  
  /**
   * Initialize AWS S3 client
   */
  initializeS3() {
    try {
      AWS.config.update({
        accessKeyId: this.config.storage.aws.accessKeyId,
        secretAccessKey: this.config.storage.aws.secretAccessKey,
        region: this.config.storage.aws.region
      });
      
      this.s3Client = new AWS.S3();
      logger.info('AWS S3 client initialized');
    } catch (error) {
      logger.error('Failed to initialize S3 client:', error);
      throw error;
    }
  }
  
  /**
   * Generate unique filename
   */
  generateFilename(originalName, uploadType = 'general') {
    const timestamp = Date.now();
    const uuid = uuidv4();
    const extension = path.extname(originalName);
    const name = path.basename(originalName, extension);
    
    // Sanitize original name
    const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    
    return `${uploadType}_${timestamp}_${uuid}_${sanitizedName}${extension}`;
  }
  
  /**
   * Get destination path based on configuration
   */
  getDestinationPath(uploadType, userId) {
    console.log('getDestinationPath called with:', { uploadType, userId, userIdType: typeof userId });
    
    const basePath = this.config.storage.local.basePath;
    const userIdStr = userId.toString(); // Convert ObjectId to string
    
    console.log('Converting userId to string:', { original: userId, converted: userIdStr });
    
    if (this.config.storage.local.structure === 'date') {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      
      const result = path.join(basePath, uploadType, year.toString(), month, day, userIdStr);
      console.log('Date-based path result:', result);
      return result;
    } else {
      const result = path.join(basePath, uploadType, userIdStr);
      console.log('Type-based path result:', result);
      return result;
    }
  }
  
  /**
   * Ensure directory exists
   */
  async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
      logger.info('Created directory:', dirPath);
    }
  }
  
  /**
   * Save file locally
   */
  async saveLocal(buffer, filename, uploadType, userId) {
    try {
      const destPath = this.getDestinationPath(uploadType, userId);
      await this.ensureDirectory(destPath);
      
      const fullPath = path.join(destPath, filename);
      await fs.writeFile(fullPath, buffer);
      
      logger.info('File saved locally', { filename, path: fullPath });
      
      return {
        filename,
        path: fullPath,
        url: `/uploads/${uploadType}/${userId}/${filename}`,
        storage: 'local'
      };
    } catch (error) {
      logger.error('Failed to save file locally:', error);
      throw error;
    }
  }
  
  /**
   * Upload to S3
   */
  async uploadToS3(buffer, filename, uploadType, userId) {
    try {
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }
      
      const key = `${uploadType}/${userId}/${filename}`;
      
      const params = {
        Bucket: this.config.storage.aws.bucket,
        Key: key,
        Body: buffer,
        ServerSideEncryption: 'AES256',
        Metadata: {
          'original-filename': path.basename(filename),
          'upload-type': uploadType,
          'user-id': userId,
          'uploaded-at': new Date().toISOString()
        }
      };
      
      const result = await this.s3Client.upload(params).promise();
      
      logger.info('File uploaded to S3', { filename, key, location: result.Location });
      
      return {
        filename,
        path: key,
        url: result.Location,
        storage: 's3'
      };
    } catch (error) {
      logger.error('Failed to upload to S3:', error);
      throw error;
    }
  }
  
  /**
   * Save file based on configuration
   */
  async saveFile(buffer, filename, uploadType, userId) {
    if (this.config.storage.type === 'aws') {
      return await this.uploadToS3(buffer, filename, uploadType, userId);
    } else {
      return await this.saveLocal(buffer, filename, uploadType, userId);
    }
  }
}

/**
 * Image Processor
 */
class ImageProcessor {
  constructor() {
    this.config = UploadConfig.getConfig();
  }
  
  /**
   * Process and optimize image
   */
  async processImage(buffer, options = {}) {
    try {
      const {
        maxWidth = 2048,
        maxHeight = 2048,
        quality = 85,
        format = 'jpeg'
      } = options;
      
      let processor = sharp(buffer);
      
      // Resize if necessary
      const metadata = await processor.metadata();
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        processor = processor.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }
      
      // Optimize based on format
      switch (format) {
        case 'jpeg':
          processor = processor.jpeg({ quality, progressive: true });
          break;
        case 'png':
          processor = processor.png({ quality, progressive: true });
          break;
        case 'webp':
          processor = processor.webp({ quality });
          break;
      }
      
      const processedBuffer = await processor.toBuffer();
      
      logger.info('Image processed', {
        originalSize: buffer.length,
        processedSize: processedBuffer.length,
        reduction: ((buffer.length - processedBuffer.length) / buffer.length * 100).toFixed(2) + '%'
      });
      
      return processedBuffer;
    } catch (error) {
      logger.error('Image processing error:', error);
      throw error;
    }
  }
  
  /**
   * Generate thumbnails
   */
  async generateThumbnails(buffer) {
    try {
      const thumbnails = {};
      
      for (const size of this.config.processing.thumbnailSizes) {
        const thumbnail = await sharp(buffer)
          .resize(size, size, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 80 })
          .toBuffer();
        
        thumbnails[`${size}x${size}`] = thumbnail;
      }
      
      return thumbnails;
    } catch (error) {
      logger.error('Thumbnail generation error:', error);
      throw error;
    }
  }
}

/**
 * File Cleanup Manager
 */
class CleanupManager {
  constructor() {
    this.config = UploadConfig.getConfig();
    this.intervals = [];
    this.isRunning = false;
  }
  
  /**
   * Clean temporary files
   */
  async cleanTempFiles() {
    try {
      const tempPath = this.config.storage.local.tempPath;
      
      // Ensure temp directory exists
      try {
        await fs.access(tempPath);
      } catch (error) {
        logger.info('Temp directory does not exist, skipping cleanup');
        return;
      }
      
      const files = await fs.readdir(tempPath);
      const now = Date.now();
      let cleaned = 0;
      
      for (const file of files) {
        const filePath = path.join(tempPath, file);
        try {
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtime.getTime() > this.config.cleanup.tempFileLifetime) {
            await fs.unlink(filePath);
            cleaned++;
            logger.debug('Cleaned temp file:', filePath);
          }
        } catch (error) {
          logger.warn('Failed to process temp file:', { file, error: error.message });
        }
      }
      
      if (cleaned > 0) {
        logger.info(`Cleaned ${cleaned} temporary files`);
      }
    } catch (error) {
      logger.error('Temp file cleanup error:', error);
    }
  }
  
  /**
   * Clean orphaned files that are not referenced in database
   * @param {string} userId - Optional user ID for user-specific cleanup
   * @returns {Object} Cleanup results
   */
  async cleanOrphanedFiles(userId = null) {
    try {
      const results = {
        totalScanned: 0,
        orphanedFound: 0,
        cleaned: 0,
        errors: []
      };
      
      // This is a placeholder implementation
      // In a real implementation, you would:
      // 1. Get all file paths from storage
      // 2. Check against database records
      // 3. Delete files not found in database
      
      logger.info('Orphaned file cleanup completed', results);
      return results;
      
    } catch (error) {
      logger.error('Orphaned file cleanup error:', error);
      throw error;
    }
  }
  
  /**
   * Clean files based on retention policy
   * @returns {Object} Cleanup results
   */
  async cleanExpiredFiles() {
    try {
      if (!this.config.cleanup.retentionPolicy?.enabled) {
        logger.info('Retention policy disabled, skipping cleanup');
        return { message: 'Retention policy disabled' };
      }
      
      const results = {
        totalScanned: 0,
        expiredFound: 0,
        cleaned: 0,
        errors: []
      };
      
      const retentionDays = this.config.cleanup.retentionPolicy.defaultRetentionDays;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      logger.info('Retention policy cleanup completed', {
        ...results,
        retentionDays,
        cutoffDate
      });
      
      return results;
      
    } catch (error) {
      logger.error('Retention policy cleanup error:', error);
      throw error;
    }
  }
  
  /**
   * Clean quarantined files older than specified time
   * @returns {Object} Cleanup results
   */
  async cleanQuarantinedFiles() {
    try {
      const quarantinePath = this.config.security.quarantinePath;
      
      // Ensure quarantine directory exists
      try {
        await fs.access(quarantinePath);
      } catch (error) {
        logger.info('Quarantine directory does not exist, skipping cleanup');
        return { message: 'Quarantine directory does not exist' };
      }
      
      const files = await fs.readdir(quarantinePath);
      const now = Date.now();
      const quarantineLifetime = 7 * 24 * 60 * 60 * 1000; // 7 days
      let cleaned = 0;
      
      for (const file of files) {
        const filePath = path.join(quarantinePath, file);
        try {
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtime.getTime() > quarantineLifetime) {
            await fs.unlink(filePath);
            cleaned++;
            logger.debug('Cleaned quarantined file:', filePath);
          }
        } catch (error) {
          logger.warn('Failed to process quarantined file:', { file, error: error.message });
        }
      }
      
      logger.info(`Cleaned ${cleaned} quarantined files`);
      return { cleaned };
      
    } catch (error) {
      logger.error('Quarantined file cleanup error:', error);
      throw error;
    }
  }
  
  /**
   * Monitor storage space usage
   * @returns {Object} Storage usage information
   */
  async monitorStorageSpace() {
    try {
      const basePath = this.config.storage.local.basePath;
      
      // Ensure upload directory exists
      try {
        await fs.access(basePath);
      } catch (error) {
        logger.info('Upload directory does not exist, skipping monitoring');
        return { message: 'Upload directory does not exist' };
      }
      
      const stats = await this.calculateDirectorySize(basePath);
      
      // Warning thresholds
      const warningThreshold = 1024 * 1024 * 1024; // 1GB
      const criticalThreshold = 5 * 1024 * 1024 * 1024; // 5GB
      
      if (stats.totalSize > criticalThreshold) {
        logger.error('Critical storage usage detected', stats);
      } else if (stats.totalSize > warningThreshold) {
        logger.warn('High storage usage detected', stats);
      }
      
      return stats;
      
    } catch (error) {
      logger.error('Storage monitoring error:', error);
      throw error;
    }
  }
  
  /**
   * Calculate directory size recursively
   * @param {string} dirPath - Directory path
   * @returns {Object} Size statistics
   */
  async calculateDirectorySize(dirPath) {
    let totalSize = 0;
    let fileCount = 0;
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          const subStats = await this.calculateDirectorySize(fullPath);
          totalSize += subStats.totalSize;
          fileCount += subStats.fileCount;
        } else if (item.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
          fileCount++;
        }
      }
    } catch (error) {
      logger.error('Error calculating directory size:', error);
    }
    
    return {
      totalSize,
      fileCount,
      formattedSize: this.formatBytes(totalSize)
    };
  }
  
  /**
   * Format bytes to human readable string
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
    /**
   * Start automatic cleanup
   */
  startAutoCleanup() {
    // Don't start cleanup during tests
    if (process.env.NODE_ENV === 'test') {
      logger.info('Automatic cleanup disabled during tests');
      return;
    }

    if (!this.config.cleanup?.enableAutoCleanup) {
      logger.info('Automatic cleanup disabled');
      return;
    }

    if (this.isRunning) {
      logger.info('Automatic cleanup already running');
      return;
    }

    this.isRunning = true;
    
    // Store interval IDs for proper cleanup
    // Temporary files cleanup
    const tempCleanupInterval = setInterval(() => {
      this.cleanTempFiles();
    }, this.config.cleanup.orphanedFileCheckInterval || 300000); // default 5 minutes
    this.intervals.push(tempCleanupInterval);
    
    // Track interval for test cleanup if in test environment tracking mode
    if (global.testIntervalTracker) {
      global.testIntervalTracker.addInterval(tempCleanupInterval);
    }
    
    // Quarantined files cleanup (every 24 hours)
    const quarantineCleanupInterval = setInterval(() => {
      this.cleanQuarantinedFiles();
    }, 24 * 60 * 60 * 1000);
    this.intervals.push(quarantineCleanupInterval);
    
    if (global.testIntervalTracker) {
      global.testIntervalTracker.addInterval(quarantineCleanupInterval);
    }
    
    // Storage monitoring (every hour)
    const storageMonitorInterval = setInterval(() => {
      this.monitorStorageSpace();
    }, 60 * 60 * 1000);
    this.intervals.push(storageMonitorInterval);
    
    if (global.testIntervalTracker) {
      global.testIntervalTracker.addInterval(storageMonitorInterval);
    }
    
    // Retention policy cleanup (once per day)
    const retentionCleanupInterval = setInterval(() => {
      this.cleanExpiredFiles();
    }, 24 * 60 * 60 * 1000);
    this.intervals.push(retentionCleanupInterval);
    
    if (global.testIntervalTracker) {
      global.testIntervalTracker.addInterval(retentionCleanupInterval);
    }
    
    logger.info('Automatic file cleanup started with intervals:', {
      tempFiles: this.config.cleanup.orphanedFileCheckInterval || 300000,
      quarantine: '24 hours',
      monitoring: '1 hour',
      retention: '24 hours',
      totalIntervals: this.intervals.length
    });
  }
    /**
   * Stop automatic cleanup
   */
  stopAutoCleanup() {
    if (this.intervals.length === 0) {
      logger.info('No cleanup intervals to stop');
      return;
    }

    // Clear all stored intervals
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    
    this.intervals = [];
    this.isRunning = false;
    
    logger.info('Automatic cleanup stopped - cleared all intervals');
  }
  
  /**
   * Run comprehensive cleanup
   * @param {Object} options - Cleanup options
   * @returns {Object} Comprehensive cleanup results
   */
  async runComprehensiveCleanup(options = {}) {
    try {
      logger.info('Starting comprehensive cleanup');
      
      const results = {
        tempFiles: await this.cleanTempFiles(),
        quarantinedFiles: await this.cleanQuarantinedFiles(),
        storageStats: await this.monitorStorageSpace(),
        timestamp: new Date()
      };
      
      if (options.includeOrphaned) {
        results.orphanedFiles = await this.cleanOrphanedFiles(options.userId);
      }
      
      if (options.includeRetention) {
        results.expiredFiles = await this.cleanExpiredFiles();
      }
      
      logger.info('Comprehensive cleanup completed', results);
      return results;
      
    } catch (error) {
      logger.error('Comprehensive cleanup error:', error);
      throw error;
    }
  }
}

/**
 * Main Upload Middleware Class
 */
class UploadMiddleware {
  constructor() {
    this.config = UploadConfig.getConfig();
    this.storageManager = new StorageManager();
    this.imageProcessor = new ImageProcessor();
    this.cleanupManager = new CleanupManager();
    
    // Start cleanup if enabled
    this.cleanupManager.startAutoCleanup();
  }
  
  /**
   * Create multer instance for specific upload type
   */
  createMulterInstance(uploadType = 'general') {
    const limits = this.config.limits[uploadType] || this.config.limits.document;
    
    // Memory storage for processing
    const storage = multer.memoryStorage();
    
    // File filter
    const fileFilter = async (req, file, cb) => {
      try {
        // Check file type
        if (!limits.allowedTypes.includes(file.mimetype)) {
          return cb(new ValidationError(`File type ${file.mimetype} not allowed for ${uploadType}`));
        }
        
        cb(null, true);
      } catch (error) {
        cb(error);
      }
    };
    
    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: limits.maxSize,
        files: limits.maxFiles,
        fieldSize: 1024 * 1024, // 1MB field size
        totalSize: this.config.security.maxTotalUploadSize
      }
    });
  }
  
  /**
   * Process uploaded files
   */
  async processFiles(files, uploadType, userId) {
    console.log('processFiles called with:', { filesCount: files.length, uploadType, userId, userIdType: typeof userId });
    
    const results = [];
    
    for (const file of files) {
      try {
        // Validate file type
        await FileValidator.validateFileType(file.buffer, file.mimetype, file.originalname);
        
        // Security scan
        await SecurityScanner.scanFile(file.buffer, file.originalname);
        
        // Content validation
        if (file.mimetype.startsWith('image/')) {
          await FileValidator.validateImageContent(file.buffer);
        } else {
          await FileValidator.validateDocumentContent(file.buffer, file.mimetype);
        }
        
        // Process file
        let processedBuffer = file.buffer;
        let thumbnails = null;
        
        if (file.mimetype.startsWith('image/') && this.config.processing.enableImageProcessing) {
          processedBuffer = await this.imageProcessor.processImage(file.buffer);
          
          if (this.config.processing.generateThumbnails) {
            thumbnails = await this.imageProcessor.generateThumbnails(processedBuffer);
          }
        }
        
        // Generate filename and save
        const filename = this.storageManager.generateFilename(file.originalname, uploadType);
        const fileInfo = await this.storageManager.saveFile(processedBuffer, filename, uploadType, userId);
        
        // Save thumbnails if generated
        const thumbnailUrls = {};
        if (thumbnails) {
          for (const [size, buffer] of Object.entries(thumbnails)) {
            const thumbFilename = this.storageManager.generateFilename(
              `thumb_${size}_${file.originalname}`,
              `${uploadType}_thumbnails`
            );
            const thumbInfo = await this.storageManager.saveFile(buffer, thumbFilename, `${uploadType}_thumbnails`, userId);
            thumbnailUrls[size] = thumbInfo.url;
          }
        }
        
        results.push({
          originalName: file.originalname,
          filename: fileInfo.filename,
          path: fileInfo.path,
          url: fileInfo.url,
          size: processedBuffer.length,
          mimeType: file.mimetype,
          storage: fileInfo.storage,
          thumbnails: thumbnailUrls,
          uploadedAt: new Date()
        });
        
      } catch (error) {
        logger.error('File processing error:', error);
        results.push({
          originalName: file.originalname,
          error: error.message,
          failed: true
        });
      }
    }
    
    return results;
  }
  
  /**
   * Get middleware for avatar uploads
   */
  getAvatarUploadMiddleware() {
    const upload = this.createMulterInstance('avatar');
    
    return [
      upload.single('avatar'),
      async (req, res, next) => {
        try {
          if (!req.file) {
            return next();
          }
          
          const results = await this.processFiles([req.file], 'avatar', req.user._id);
          req.uploadResults = results;
          next();
        } catch (error) {
          next(error);
        }
      }
    ];
  }
  
  /**
   * Get middleware for transaction attachments
   */
  getAttachmentUploadMiddleware() {
    const upload = this.createMulterInstance('document');
    
    return [
      upload.array('attachments', 5),
      async (req, res, next) => {
        try {
          if (!req.files || req.files.length === 0) {
            return next();
          }
          
          const results = await this.processFiles(req.files, 'transaction_attachments', req.user._id);
          req.uploadResults = results;
          next();
        } catch (error) {
          next(error);
        }
      }
    ];
  }
  
  /**
   * Get middleware for import files
   */
  getImportUploadMiddleware() {
    const upload = this.createMulterInstance('document');
    
    return [
      upload.single('importFile'),
      async (req, res, next) => {
        try {
          if (!req.file) {
            return next();
          }
          
          console.log('Import upload middleware - req.user:', req.user);
          console.log('Import upload middleware - req.user._id:', req.user._id, typeof req.user._id);
          
          const results = await this.processFiles([req.file], 'import', req.user._id);
          req.uploadResults = results;
          next();
        } catch (error) {
          console.error('Import upload middleware error:', error);
          next(error);
        }
      }
    ];
  }
}

// Create singleton instance
const uploadMiddleware = new UploadMiddleware();

module.exports = {
  UploadMiddleware,
  UploadConfig,
  FileValidator,
  SecurityScanner,
  StorageManager,
  ImageProcessor,
  CleanupManager,
  // Export middleware functions
  avatarUpload: uploadMiddleware.getAvatarUploadMiddleware(),
  attachmentUpload: uploadMiddleware.getAttachmentUploadMiddleware(),
  importUpload: uploadMiddleware.getImportUploadMiddleware()
};
