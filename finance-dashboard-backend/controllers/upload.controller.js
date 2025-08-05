/**
 * Upload Controller
 * Handles file upload operations for the finance dashboard
 */

const { FileService } = require('../services');
const { fileService } = require('../services');
const { File } = require('../models');
const logger = require('../utils/logger');
const { createResponse } = require('../utils/helpers');

class UploadController {
  /**
   * Upload a single file
   */
  async uploadSingle(req, res) {
    try {
      const { entityType, entityId } = req.body;
      const userId = req.user.id;

      if (!req.file) {
        return res.status(400).json(
          createResponse('error', 'No file provided', null)
        );
      }

      // Validate entity type
      const validEntityTypes = ['transaction', 'user_avatar', 'document', 'receipt'];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json(
          createResponse('error', 'Invalid entity type', null)
        );
      }

      // Upload file using FileService
      const uploadResult = await fileService.uploadFile(req.file, {
        entityType,
        entityId,
        userId,
        generateThumbnail: entityType === 'user_avatar' || req.body.generateThumbnail === 'true'
      });

      logger.info(`File uploaded successfully: ${uploadResult.id}`, {
        userId,
        fileId: uploadResult.id,
        entityType,
        entityId
      });

      res.status(201).json(
        createResponse('success', 'File uploaded successfully', uploadResult)
      );
    } catch (error) {
      logger.error('File upload error:', error);
      res.status(500).json(
        createResponse('error', 'Failed to upload file', null)
      );
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultiple(req, res) {
    try {
      const { entityType, entityId } = req.body;
      const userId = req.user.id;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json(
          createResponse('error', 'No files provided', null)
        );
      }

      // Validate entity type
      const validEntityTypes = ['transaction', 'document', 'receipt'];
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json(
          createResponse('error', 'Invalid entity type', null)
        );
      }

      // Upload files using FileService
      const uploadResults = await fileService.uploadMultipleFiles(req.files, {
        entityType,
        entityId,
        userId,
        generateThumbnail: req.body.generateThumbnail === 'true'
      });

      logger.info(`Multiple files uploaded successfully: ${uploadResults.length} files`, {
        userId,
        fileCount: uploadResults.length,
        entityType,
        entityId
      });

      res.status(201).json(
        createResponse('success', 'Files uploaded successfully', uploadResults)
      );
    } catch (error) {
      logger.error('Multiple file upload error:', error);
      res.status(500).json(
        createResponse('error', 'Failed to upload files', null)
      );
    }
  }

  /**
   * Get file details by ID
   */
  async getFile(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const file = await File.findOne({
        _id: id,
        isDeleted: false
      });

      if (!file) {
        return res.status(404).json(
          createResponse('error', 'File not found', null)
        );
      }

      // Check access permissions
      const hasAccess = file.userId.toString() === userId || 
                       file.permissions.some(p => p.userId.toString() === userId);

      if (!hasAccess) {
        return res.status(403).json(
          createResponse('error', 'Access denied', null)
        );
      }

      // Generate signed URL for file access
      const fileUrl = await fileService.generateFileUrl(file);

      const response = {
        ...file.toObject(),
        url: fileUrl
      };

      res.json(createResponse('success', 'File retrieved successfully', response));
    } catch (error) {
      logger.error('Get file error:', error);
      res.status(500).json(
        createResponse('error', 'Failed to retrieve file', null)
      );
    }
  }

  /**
   * Get files by entity
   */
  async getFilesByEntity(req, res) {
    try {
      const { entityType, entityId } = req.params;
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const files = await File.find({
        entityType,
        entityId,
        userId,
        isDeleted: false
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

      const total = await File.countDocuments({
        entityType,
        entityId,
        userId,
        isDeleted: false
      });

      // Generate signed URLs for all files
      const filesWithUrls = await Promise.all(
        files.map(async (file) => {
          const fileUrl = await fileService.generateFileUrl(file);
          return {
            ...file.toObject(),
            url: fileUrl
          };
        })
      );

      const response = {
        files: filesWithUrls,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };

      res.json(createResponse('success', 'Files retrieved successfully', response));
    } catch (error) {
      logger.error('Get files by entity error:', error);
      res.status(500).json(
        createResponse('error', 'Failed to retrieve files', null)
      );
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const file = await File.findOne({
        _id: id,
        userId,
        isDeleted: false
      });

      if (!file) {
        return res.status(404).json(
          createResponse('error', 'File not found', null)
        );
      }

      // Delete file using FileService
      await fileService.deleteFile(file);

      logger.info(`File deleted successfully: ${id}`, {
        userId,
        fileId: id
      });

      res.json(createResponse('success', 'File deleted successfully', null));
    } catch (error) {
      logger.error('Delete file error:', error);
      res.status(500).json(
        createResponse('error', 'Failed to delete file', null)
      );
    }
  }

  /**
   * Get user's avatar
   */
  async getUserAvatar(req, res) {
    try {
      const userId = req.user.id;

      const avatar = await File.findOne({
        userId,
        entityType: 'user_avatar',
        isDeleted: false
      }).sort({ createdAt: -1 });

      if (!avatar) {
        return res.status(404).json(
          createResponse('error', 'Avatar not found', null)
        );
      }

      // Generate signed URL for avatar
      const avatarUrl = await fileService.generateFileUrl(avatar);

      const response = {
        ...avatar.toObject(),
        url: avatarUrl
      };

      res.json(createResponse('success', 'Avatar retrieved successfully', response));
    } catch (error) {
      logger.error('Get user avatar error:', error);
      res.status(500).json(
        createResponse('error', 'Failed to retrieve avatar', null)
      );
    }
  }

  /**
   * Update file metadata
   */
  async updateFile(req, res) {
    try {
      const { id } = req.params;
      const { name, description, tags } = req.body;
      const userId = req.user.id;

      const file = await File.findOne({
        _id: id,
        userId,
        isDeleted: false
      });

      if (!file) {
        return res.status(404).json(
          createResponse('error', 'File not found', null)
        );
      }

      // Update allowed fields
      if (name) file.originalName = name;
      if (description) file.description = description;
      if (tags && Array.isArray(tags)) file.tags = tags;

      file.updatedAt = new Date();
      await file.save();

      logger.info(`File metadata updated: ${id}`, {
        userId,
        fileId: id
      });

      res.json(createResponse('success', 'File updated successfully', file));
    } catch (error) {
      logger.error('Update file error:', error);
      res.status(500).json(
        createResponse('error', 'Failed to update file', null)
      );
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(req, res) {
    try {
      const userId = req.user.id;

      const stats = await fileService.getStorageStats(userId);

      res.json(createResponse('success', 'Storage statistics retrieved', stats));
    } catch (error) {
      logger.error('Get storage stats error:', error);
      res.status(500).json(
        createResponse('error', 'Failed to retrieve storage statistics', null)
      );
    }
  }

  /**
   * Download file
   */
  async downloadFile(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const file = await File.findOne({
        _id: id,
        isDeleted: false
      });

      if (!file) {
        return res.status(404).json(
          createResponse('error', 'File not found', null)
        );
      }

      // Check access permissions
      const hasAccess = file.userId.toString() === userId || 
                       file.permissions.some(p => p.userId.toString() === userId);

      if (!hasAccess) {
        return res.status(403).json(
          createResponse('error', 'Access denied', null)
        );
      }

      // Update download count
      file.downloadCount += 1;
      file.lastAccessedAt = new Date();
      await file.save();

      // Generate download URL
      const downloadUrl = await fileService.generateFileUrl(file, { download: true });

      res.json(createResponse('success', 'Download URL generated', { 
        downloadUrl,
        filename: file.originalName
      }));
    } catch (error) {
      logger.error('Download file error:', error);
      res.status(500).json(
        createResponse('error', 'Failed to generate download URL', null)
      );
    }
  }
}

module.exports = new UploadController();
