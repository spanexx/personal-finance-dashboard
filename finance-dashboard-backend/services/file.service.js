/**
 * File Service
 * Comprehensive file management service for file operations, metadata handling, and cleanup
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const AWS = require('aws-sdk');
// Note: file-type v21+ is ESM only, using dynamic import
let fileType;
const getFileType = async () => {
  if (!fileType) {
    fileType = await import('file-type');
  }
  return fileType;
};
const logger = require('../utils/logger');
const config = require('../config/environment');
const { 
  UploadConfig, 
  StorageManager,
  ImageProcessor, 
  FileValidator, 
  SecurityScanner,
  CleanupManager 
} = require('../middleware/upload.middleware');
const { ValidationError, SecurityError, AppError } = require('../utils/errorHandler');

/**
 * File Service Class
 * Provides high-level file management operations
 */
class FileService {
  constructor() {
    this.config = UploadConfig.getConfig();
    this.storageManager = new StorageManager();
    this.imageProcessor = new ImageProcessor();
    this.cleanupManager = new CleanupManager();
  }

  /**
   * Upload and process a single file
   * @param {Buffer} buffer - File buffer
   * @param {string} originalName - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} uploadType - Type of upload (avatar, document, etc.)
   * @param {string} userId - User ID
   * @param {Object} options - Additional options
   * @returns {Object} File information
   */
  async uploadFile(buffer, originalName, mimeType, uploadType, userId, options = {}) {
    try {
      // Validate file type
      await FileValidator.validateFileType(buffer, mimeType, originalName);

      // Security scan
      await SecurityScanner.scanFile(buffer, originalName);

      // Content validation
      if (mimeType.startsWith('image/')) {
        await FileValidator.validateImageContent(buffer);
      } else {
        await FileValidator.validateDocumentContent(buffer, mimeType);
      }

      // Process file if needed
      let processedBuffer = buffer;
      let thumbnails = null;
      let metadata = {};

      if (mimeType.startsWith('image/') && this.config.processing.enableImageProcessing) {
        const imageOptions = {
          maxWidth: options.maxWidth || 2048,
          maxHeight: options.maxHeight || 2048,
          quality: options.quality || 85,
          format: options.format || 'jpeg'
        };

        processedBuffer = await this.imageProcessor.processImage(buffer, imageOptions);

        // Get image metadata
        metadata = await sharp(processedBuffer).metadata();

        // Generate thumbnails if enabled
        if (this.config.processing.generateThumbnails) {
          thumbnails = await this.imageProcessor.generateThumbnails(processedBuffer);
        }
      }

      // Generate unique filename
      const filename = this.storageManager.generateFilename(originalName, uploadType);

      // Save main file
      const fileInfo = await this.storageManager.saveFile(processedBuffer, filename, uploadType, userId);

      // Save thumbnails if generated
      const thumbnailUrls = {};
      if (thumbnails) {
        for (const [size, thumbBuffer] of Object.entries(thumbnails)) {
          const thumbFilename = this.storageManager.generateFilename(
            `thumb_${size}_${originalName}`,
            `${uploadType}_thumbnails`
          );
          const thumbInfo = await this.storageManager.saveFile(
            thumbBuffer, 
            thumbFilename, 
            `${uploadType}_thumbnails`, 
            userId
          );
          thumbnailUrls[size] = thumbInfo.url;
        }
      }

      // Create file record
      const fileRecord = {
        id: uuidv4(),
        originalName,
        filename: fileInfo.filename,
        path: fileInfo.path,
        url: fileInfo.url,
        size: processedBuffer.length,
        mimeType,
        uploadType,
        userId,
        storage: fileInfo.storage,
        thumbnails: thumbnailUrls,
        metadata,
        uploadedAt: new Date(),
        isProcessed: true,
        checksum: await this.generateChecksum(processedBuffer)
      };

      logger.info('File uploaded successfully', {
        fileId: fileRecord.id,
        filename: fileRecord.filename,
        size: fileRecord.size,
        uploadType,
        userId
      });

      return fileRecord;

    } catch (error) {
      logger.error('File upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files
   * @param {Array} files - Array of file objects {buffer, originalName, mimeType}
   * @param {string} uploadType - Type of upload
   * @param {string} userId - User ID
   * @param {Object} options - Additional options
   * @returns {Array} Array of file information objects
   */
  async uploadMultipleFiles(files, uploadType, userId, options = {}) {
    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
        const result = await this.uploadFile(
          file.buffer,
          file.originalName,
          file.mimeType,
          uploadType,
          userId,
          options
        );
        results.push(result);
      } catch (error) {
        logger.error(`File upload failed for file ${i}:`, error);
        errors.push({
          index: i,
          filename: files[i].originalName,
          error: error.message
        });
      }
    }

    return {
      successful: results,
      failed: errors,
      totalProcessed: files.length,
      successCount: results.length,
      failureCount: errors.length
    };
  }

  /**
   * Get file information by ID or filename
   * @param {string} identifier - File ID or filename
   * @param {string} userId - User ID for ownership verification
   * @returns {Object} File information
   */
  async getFileInfo(identifier, userId) {
    try {
      // This would typically query a database for file metadata
      // For now, we'll implement basic file existence check
      logger.info('Getting file info', { identifier, userId });
      
      // Implementation would depend on your file metadata storage strategy
      throw new Error('File metadata storage not implemented');
    } catch (error) {
      logger.error('Failed to get file info:', error);
      throw error;
    }
  }

  /**
   * Delete a file and its metadata
   * @param {string} filePath - File path
   * @param {string} userId - User ID for ownership verification
   * @returns {boolean} Success status
   */
  async deleteFile(filePath, userId) {
    try {
      // Verify file ownership and existence
      await this.verifyFileOwnership(filePath, userId);

      // Delete from storage
      if (this.config.storage.type === 'aws') {
        await this.deleteFromS3(filePath);
      } else {
        await this.deleteFromLocal(filePath);
      }

      logger.info('File deleted successfully', { filePath, userId });
      return true;

    } catch (error) {
      logger.error('File deletion failed:', error);
      throw error;
    }
  }

  /**
   * Delete multiple files
   * @param {Array} filePaths - Array of file paths
   * @param {string} userId - User ID for ownership verification
   * @returns {Object} Deletion results
   */
  async deleteMultipleFiles(filePaths, userId) {
    const results = {
      successful: [],
      failed: [],
      totalProcessed: filePaths.length
    };

    for (const filePath of filePaths) {
      try {
        await this.deleteFile(filePath, userId);
        results.successful.push(filePath);
      } catch (error) {
        logger.error(`Failed to delete file ${filePath}:`, error);
        results.failed.push({
          filePath,
          error: error.message
        });
      }
    }

    results.successCount = results.successful.length;
    results.failureCount = results.failed.length;

    return results;
  }

  /**
   * Generate file URL for serving
   * @param {string} filePath - File path
   * @param {string} userId - User ID for ownership verification
   * @param {Object} options - URL generation options
   * @returns {string} File URL
   */
  async generateFileUrl(filePath, userId, options = {}) {
    try {
      await this.verifyFileOwnership(filePath, userId);

      if (this.config.storage.type === 'aws') {
        return await this.generateS3PresignedUrl(filePath, options);
      } else {
        return this.generateLocalFileUrl(filePath);
      }

    } catch (error) {
      logger.error('Failed to generate file URL:', error);
      throw error;
    }
  }

  /**
   * Generate multiple file URLs
   * @param {Array} filePaths - Array of file paths
   * @param {string} userId - User ID
   * @param {Object} options - URL generation options
   * @returns {Object} URLs mapping
   */
  async generateMultipleFileUrls(filePaths, userId, options = {}) {
    const urlsMap = {};
    const errors = [];

    for (const filePath of filePaths) {
      try {
        urlsMap[filePath] = await this.generateFileUrl(filePath, userId, options);
      } catch (error) {
        errors.push({
          filePath,
          error: error.message
        });
      }
    }

    return {
      urls: urlsMap,
      errors
    };
  }  /**
   * Clean up orphaned files
   * @param {string} userId - User ID (optional, for user-specific cleanup)
   * @returns {Object} Cleanup results
   */
  async cleanupOrphanedFiles(userId = null) {
    try {
      const orphanedFiles = await fileMetadataManager.findOrphaned();
      const cleanupResults = {
        totalFound: orphanedFiles.length,
        cleaned: 0,
        errors: []
      };

      for (const file of orphanedFiles) {
        try {
          // Only cleanup files for specific user if provided
          if (userId && file.user.toString() !== userId) {
            continue;
          }

          // Delete the actual file from storage
          await this.deleteFile(file.path, file.storageType);
          
          // Remove from database
          await file.softDelete();
          
          cleanupResults.cleaned++;
        } catch (error) {
          cleanupResults.errors.push({
            fileId: file._id,
            error: error.message
          });
        }
      }

      logger.info(`Orphaned file cleanup completed: ${cleanupResults.cleaned}/${cleanupResults.totalFound} files cleaned`);
      return cleanupResults;
    } catch (error) {
      logger.error('Orphaned file cleanup failed:', error);
      throw error;
    }
  }
  /**
   * Get file storage statistics
   * @param {string} userId - User ID (optional, for user-specific stats)
   * @returns {Object} Storage statistics
   */
  async getStorageStats(userId = null) {
    try {
      return await fileMetadataManager.getStorageStats(userId);
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      throw error;
    }
  }

  /**
   * Validate file before upload
   * @param {Buffer} buffer - File buffer
   * @param {string} originalName - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} uploadType - Upload type
   * @returns {Object} Validation result
   */
  async validateFile(buffer, originalName, mimeType, uploadType) {
    try {
      // Check file size limits
      const limits = this.config.limits[uploadType] || this.config.limits.document;
      
      if (buffer.length > limits.maxSize) {
        throw new ValidationError(`File size exceeds limit of ${limits.maxSize} bytes`);
      }

      // Check file type
      if (!limits.allowedTypes.includes(mimeType)) {
        throw new ValidationError(`File type ${mimeType} not allowed for ${uploadType}`);
      }

      // Validate file type using magic numbers
      const validation = await FileValidator.validateFileType(buffer, mimeType, originalName);

      // Security scan
      const securityScan = await SecurityScanner.scanFile(buffer, originalName);

      // Content validation
      let contentValidation = { isValid: true };
      if (mimeType.startsWith('image/')) {
        contentValidation = await FileValidator.validateImageContent(buffer);
      } else {
        contentValidation = await FileValidator.validateDocumentContent(buffer, mimeType);
      }

      return {
        isValid: true,
        typeValidation: validation,
        securityScan,
        contentValidation,
        size: buffer.length,
        limits
      };

    } catch (error) {
      return {
        isValid: false,
        error: error.message,
        type: error.constructor.name
      };
    }
  }

  /**
   * Process image with custom options
   * @param {Buffer} buffer - Image buffer
   * @param {Object} options - Processing options
   * @returns {Buffer} Processed image buffer
   */
  async processImage(buffer, options = {}) {
    try {
      return await this.imageProcessor.processImage(buffer, options);
    } catch (error) {
      logger.error('Image processing failed:', error);
      throw error;
    }
  }

  /**
   * Generate image thumbnails
   * @param {Buffer} buffer - Image buffer
   * @param {Array} sizes - Thumbnail sizes (optional)
   * @returns {Object} Thumbnails object
   */
  async generateThumbnails(buffer, sizes = null) {
    try {
      if (sizes) {
        // Override default thumbnail sizes
        const originalSizes = this.config.processing.thumbnailSizes;
        this.config.processing.thumbnailSizes = sizes;
        const result = await this.imageProcessor.generateThumbnails(buffer);
        this.config.processing.thumbnailSizes = originalSizes;
        return result;
      } else {
        return await this.imageProcessor.generateThumbnails(buffer);
      }
    } catch (error) {
      logger.error('Thumbnail generation failed:', error);
      throw error;
    }
  }

  // Private helper methods

  /**
   * Generate file checksum for integrity verification
   * @param {Buffer} buffer - File buffer
   * @returns {string} Checksum
   */
  async generateChecksum(buffer) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Verify file ownership
   * @param {string} filePath - File path
   * @param {string} userId - User ID
   */
  async verifyFileOwnership(filePath, userId) {
    // This would typically check against a database
    // For now, we'll check if the file path contains the user ID
    if (!filePath.includes(userId)) {
      throw new SecurityError('Access denied: File ownership verification failed');
    }
  }

  /**
   * Delete file from S3
   * @param {string} filePath - S3 key
   */
  async deleteFromS3(filePath) {
    if (!this.storageManager.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const params = {
      Bucket: this.config.storage.aws.bucket,
      Key: filePath
    };

    await this.storageManager.s3Client.deleteObject(params).promise();
  }

  /**
   * Delete file from local storage
   * @param {string} filePath - Local file path
   */
  async deleteFromLocal(filePath) {
    await fs.unlink(filePath);
  }

  /**
   * Generate S3 presigned URL
   * @param {string} filePath - S3 key
   * @param {Object} options - URL options
   * @returns {string} Presigned URL
   */
  async generateS3PresignedUrl(filePath, options = {}) {
    if (!this.storageManager.s3Client) {
      throw new Error('S3 client not initialized');
    }

    const params = {
      Bucket: this.config.storage.aws.bucket,
      Key: filePath,
      Expires: options.expiresIn || 3600 // 1 hour default
    };

    return this.storageManager.s3Client.getSignedUrl('getObject', params);
  }

  /**
   * Generate local file URL
   * @param {string} filePath - Local file path
   * @returns {string} File URL
   */
  generateLocalFileUrl(filePath) {
    // Convert absolute path to relative URL
    const relativePath = path.relative(this.config.storage.local.basePath, filePath);
    return `/uploads/${relativePath.replace(/\\/g, '/')}`;
  }
}

/**
 * File Metadata Manager
 * Handles file metadata storage and retrieval using File model
 */
class FileMetadataManager {  /**
   * Store file metadata
   * @param {Object} metadata - File metadata
   * @returns {Object} Saved file document
   */
  async storeMetadata(metadata) {
    try {
      // Import File model inside method to avoid circular dependency
      const { File } = require('../models');
      const file = new File(metadata);
      return await file.save();
    } catch (error) {
      logger.error('Failed to store file metadata:', error);
      throw error;
    }
  }
  /**
   * Get file metadata by ID
   * @param {string} fileId - File ID
   * @returns {Object} File metadata
   */
  async getMetadata(fileId) {
    try {
      // Import File model inside method to avoid circular dependency
      const { File } = require('../models');
      return await File.findById(fileId)
        .populate('user', 'firstName lastName email');
    } catch (error) {
      logger.error('Failed to get file metadata:', error);
      throw error;
    }
  }
  /**
   * Update file metadata
   * @param {string} fileId - File ID
   * @param {Object} updates - Metadata updates
   * @returns {Object} Updated file document
   */
  async updateMetadata(fileId, updates) {
    try {
      // Import File model inside method to avoid circular dependency
      const { File } = require('../models');
      return await File.findByIdAndUpdate(
        fileId,
        { ...updates, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('user', 'firstName lastName email');
    } catch (error) {
      logger.error('Failed to update file metadata:', error);
      throw error;
    }
  }
  /**
   * Delete file metadata
   * @param {string} fileId - File ID
   * @returns {boolean} Success status
   */
  async deleteMetadata(fileId) {
    try {
      // Import File model inside method to avoid circular dependency
      const { File } = require('../models');
      const file = await File.findById(fileId);
      if (file) {
        await file.softDelete();
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to delete file metadata:', error);
      throw error;
    }
  }
  /**
   * Get user files metadata
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} User's file metadata
   */
  async getUserFiles(userId, options = {}) {
    try {
      // Import File model inside method to avoid circular dependency
      const { File } = require('../models');
      return await File.findByUser(userId, options);
    } catch (error) {
      logger.error('Failed to get user files:', error);
      throw error;
    }
  }
  /**
   * Get files by entity
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity ID
   * @returns {Array} Entity files
   */
  async getEntityFiles(entityType, entityId) {
    try {
      // Import File model inside method to avoid circular dependency
      const { File } = require('../models');
      return await File.findByEntity(entityType, entityId);
    } catch (error) {
      logger.error('Failed to get entity files:', error);
      throw error;
    }
  }
  /**
   * Get storage statistics
   * @param {string} userId - User ID (optional)
   * @returns {Object} Storage statistics
   */
  async getStorageStats(userId = null) {
    try {
      // Import File model inside method to avoid circular dependency
      const { File } = require('../models');
      return await File.getStorageStats(userId);
    } catch (error) {
      logger.error('Failed to get storage stats:', error);
      throw error;
    }
  }
  /**
   * Find orphaned files
   * @returns {Array} Orphaned files
   */
  async findOrphaned() {
    try {
      // Import File model inside method to avoid circular dependency
      const { File } = require('../models');
      return await File.findOrphaned();
    } catch (error) {
      logger.error('Failed to find orphaned files:', error);
      throw error;
    }
  }
  /**
   * Cleanup deleted files
   * @param {number} olderThanDays - Days threshold
   * @returns {Object} Cleanup result
   */
  async cleanupDeleted(olderThanDays = 30) {
    try {
      // Import File model inside method to avoid circular dependency
      const { File } = require('../models');
      return await File.cleanupDeletedFiles(olderThanDays);
    } catch (error) {
      logger.error('Failed to cleanup deleted files:', error);
      throw error;
    }
  }
}

// Create service instances
const fileService = new FileService();
const fileMetadataManager = new FileMetadataManager();

module.exports = {
  FileService,
  FileMetadataManager,
  fileService,
  fileMetadataManager
};
