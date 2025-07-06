/**
 * Upload Routes
 * Handles file upload API endpoints
 */

const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { UploadMiddleware } = require('../middleware/upload.middleware');
const { verifyToken } = require('../middleware/auth.middleware');
const { validateUpload } = require('../middleware/validation');

// Create upload middleware instance
const uploadMiddleware = new UploadMiddleware();

// Apply authentication to all upload routes
router.use(verifyToken);

/**
 * @route   POST /api/uploads/single
 * @desc    Upload a single file
 * @access  Private
 * @body    {string} entityType - Type of entity (transaction, user_avatar, document, receipt)
 * @body    {string} entityId - ID of the associated entity
 * @body    {boolean} generateThumbnail - Whether to generate thumbnail (optional)
 * @file    file - The file to upload
 */
router.post('/single', 
  uploadMiddleware.createMulterInstance('document').single('file'),
  validateUpload.single,
  uploadController.uploadSingle
);

/**
 * @route   POST /api/uploads/multiple
 * @desc    Upload multiple files
 * @access  Private
 * @body    {string} entityType - Type of entity (transaction, document, receipt)
 * @body    {string} entityId - ID of the associated entity
 * @body    {boolean} generateThumbnail - Whether to generate thumbnails (optional)
 * @files   files - Array of files to upload (max 10)
 */
router.post('/multiple',
  uploadMiddleware.createMulterInstance('document').array('files', 10),
  validateUpload.multiple,
  uploadController.uploadMultiple
);

/**
 * @route   POST /api/uploads/avatar
 * @desc    Upload user avatar
 * @access  Private
 * @file    avatar - The avatar image file
 */
router.post('/avatar',
  uploadMiddleware.createMulterInstance('avatar').single('avatar'),
  validateUpload.avatar,
  (req, res, next) => {
    // Set entity type for avatar
    req.body.entityType = 'user_avatar';
    req.body.entityId = req.user.id;
    req.body.generateThumbnail = 'true';
    next();
  },
  uploadController.uploadSingle
);

/**
 * @route   GET /api/uploads/:id
 * @desc    Get file details by ID
 * @access  Private
 * @param   {string} id - File ID
 */
router.get('/:id', uploadController.getFile);

/**
 * @route   GET /api/uploads/entity/:entityType/:entityId
 * @desc    Get files by entity
 * @access  Private
 * @param   {string} entityType - Type of entity
 * @param   {string} entityId - ID of the entity
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 10)
 */
router.get('/entity/:entityType/:entityId', uploadController.getFilesByEntity);

/**
 * @route   GET /api/uploads/avatar/current
 * @desc    Get current user's avatar
 * @access  Private
 */
router.get('/avatar/current', uploadController.getUserAvatar);

/**
 * @route   PUT /api/uploads/:id
 * @desc    Update file metadata
 * @access  Private
 * @param   {string} id - File ID
 * @body    {string} name - New file name (optional)
 * @body    {string} description - File description (optional)
 * @body    {string[]} tags - File tags (optional)
 */
router.put('/:id', 
  validateUpload.update,
  uploadController.updateFile
);

/**
 * @route   DELETE /api/uploads/:id
 * @desc    Delete a file
 * @access  Private
 * @param   {string} id - File ID
 */
router.delete('/:id', uploadController.deleteFile);

/**
 * @route   GET /api/uploads/stats/storage
 * @desc    Get user's storage statistics
 * @access  Private
 */
router.get('/stats/storage', uploadController.getStorageStats);

/**
 * @route   GET /api/uploads/:id/download
 * @desc    Generate download URL for file
 * @access  Private
 * @param   {string} id - File ID
 */
router.get('/:id/download', uploadController.downloadFile);

module.exports = router;
