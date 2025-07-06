/**
 * Transaction Attachment Service
 * Handles attachment-related operations for transactions
 */

const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const { ValidationError, NotFoundError } = require('../utils/errorHandler');

class TransactionAttachmentService {
  /**
   * Upload attachments to a transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} userId - User ID
   * @param {Array} files - Uploaded files
   * @returns {Promise<Object>} Upload result
   */
  static async uploadAttachments(transactionId, userId, files) {
    if (!mongoose.isValidObjectId(transactionId)) {
      throw new ValidationError('Invalid transaction ID format');
    }

    if (!files || files.length === 0) {
      throw new ValidationError('No files uploaded');
    }

    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId,
      isDeleted: { $ne: true }
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Check attachment limit
    if (transaction.attachments.length + files.length > 5) {
      throw new ValidationError(`Cannot have more than 5 attachments per transaction. Current: ${transaction.attachments.length}, Attempting to add: ${files.length}`);
    }

    const uploadedAttachments = [];

    for (const file of files) {
      const attachmentData = {
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date()
      };

      transaction.attachments.push(attachmentData);
      uploadedAttachments.push({
        id: transaction.attachments[transaction.attachments.length - 1]._id,
        filename: attachmentData.filename,
        originalName: attachmentData.originalName,
        size: attachmentData.size,
        mimeType: attachmentData.mimeType
      });
    }

    await transaction.save();

    return {
      transactionId,
      uploadedAttachments,
      totalAttachments: transaction.attachments.length
    };
  }

  /**
   * Delete an attachment from a transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} attachmentId - Attachment ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deletion result
   */
  static async deleteAttachment(transactionId, attachmentId, userId) {
    if (!mongoose.isValidObjectId(transactionId) || !mongoose.isValidObjectId(attachmentId)) {
      throw new ValidationError('Invalid ID format');
    }

    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId,
      isDeleted: { $ne: true }
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    const attachment = transaction.attachments.id(attachmentId);
    if (!attachment) {
      throw new NotFoundError('Attachment not found');
    }

    // Store attachment info for response before deletion
    const deletedAttachmentInfo = {
      id: attachment._id,
      filename: attachment.filename,
      originalName: attachment.originalName,
      size: attachment.size
    };

    // Remove attachment from transaction
    transaction.attachments.pull(attachmentId);
    await transaction.save();

    // Delete physical file
    try {
      await fs.unlink(attachment.path);
    } catch (fileError) {
      console.warn('Failed to delete physical file:', fileError.message);
      // Continue execution as the attachment record has been removed
    }

    return {
      transactionId,
      deletedAttachment: deletedAttachmentInfo,
      remainingAttachments: transaction.attachments.length
    };
  }

  /**
   * Get attachment details for download
   * @param {string} transactionId - Transaction ID
   * @param {string} attachmentId - Attachment ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Attachment details
   */
  static async getAttachmentForDownload(transactionId, attachmentId, userId) {
    if (!mongoose.isValidObjectId(transactionId) || !mongoose.isValidObjectId(attachmentId)) {
      throw new ValidationError('Invalid ID format');
    }

    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId,
      isDeleted: { $ne: true }
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    const attachment = transaction.attachments.id(attachmentId);
    if (!attachment) {
      throw new NotFoundError('Attachment not found');
    }

    // Check if file exists
    try {
      await fs.access(attachment.path);
    } catch (accessError) {
      throw new NotFoundError('Attachment file not found on server');
    }

    return {
      path: attachment.path,
      mimeType: attachment.mimeType,
      originalName: attachment.originalName,
      size: attachment.size
    };
  }
}

module.exports = TransactionAttachmentService;
