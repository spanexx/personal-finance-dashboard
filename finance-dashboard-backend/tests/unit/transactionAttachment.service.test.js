/**
 * Transaction Attachment Service Unit Tests
 * Tests for transaction file attachment handling
 */

const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const TransactionAttachmentService = require('../../services/transactionAttachment.service');
const Transaction = require('../../models/Transaction');
const { ValidationError, NotFoundError } = require('../../utils/errorHandler');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    unlink: jest.fn()
  }
}));
jest.mock('path');
jest.mock('mongoose');
jest.mock('../../models/Transaction');
jest.mock('../../utils/logger');
jest.mock('../../models/Transaction', () => {
  const mockSchema = {
    virtual: jest.fn(() => ({ get: jest.fn() }))
  };
  return {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    schema: mockSchema
  };
});
jest.mock('../../utils/errorHandler');

describe('TransactionAttachmentService', () => {
  let mockTransaction;
  let mockAttachment;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // Mock console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Setup mongoose mocks
    mongoose.isValidObjectId = jest.fn();

    // Setup attachment mock
    mockAttachment = {
      _id: 'attachment123',
      filename: 'receipt-001.pdf',
      originalName: 'receipt.pdf',
      path: '/uploads/receipt-001.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      uploadedAt: new Date()
    };

    // Setup transaction mock
    mockTransaction = {
      _id: 'transaction123',
      user: 'user123',
      attachments: [mockAttachment],
      save: jest.fn().mockResolvedValue(),
      isDeleted: false
    };

    // Mock Transaction.findOne
    Transaction.findOne = jest.fn();

    // Mock fs operations
    fs.access = jest.fn().mockResolvedValue();
    fs.unlink = jest.fn().mockResolvedValue();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('uploadAttachments', () => {
    it('should successfully upload attachments to transaction', async () => {
      // Arrange
      const transactionId = 'transaction123';
      const userId = 'user123';
      const files = [
        {
          filename: 'receipt-001.pdf',
          originalname: 'receipt.pdf',
          path: '/uploads/receipt-001.pdf',
          mimetype: 'application/pdf',
          size: 1024
        },
        {
          filename: 'invoice-002.jpg',
          originalname: 'invoice.jpg',
          path: '/uploads/invoice-002.jpg',
          mimetype: 'image/jpeg',
          size: 2048
        }
      ];

      const emptyTransaction = {
        _id: transactionId,
        user: userId,
        attachments: [],
        save: jest.fn().mockResolvedValue()
      };

      // Mock attachments.push to simulate adding attachments
      emptyTransaction.attachments.push = jest.fn().mockImplementation((attachment) => {
        emptyTransaction.attachments.length++;
        return emptyTransaction.attachments.length - 1;
      });

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(emptyTransaction);

      // Act
      const result = await TransactionAttachmentService.uploadAttachments(
        transactionId,
        userId,
        files
      );

      // Assert
      expect(mongoose.isValidObjectId).toHaveBeenCalledWith(transactionId);
      expect(Transaction.findOne).toHaveBeenCalledWith({
        _id: transactionId,
        user: userId,
        isDeleted: { $ne: true }
      });
      expect(emptyTransaction.attachments.push).toHaveBeenCalledTimes(2);
      expect(emptyTransaction.save).toHaveBeenCalled();
      expect(result).toEqual({
        transactionId,
        uploadedAttachments: expect.arrayContaining([
          expect.objectContaining({
            filename: 'receipt-001.pdf',
            originalName: 'receipt.pdf',
            mimeType: 'application/pdf',
            size: 1024
          }),
          expect.objectContaining({
            filename: 'invoice-002.jpg',
            originalName: 'invoice.jpg',
            mimeType: 'image/jpeg',
            size: 2048
          })
        ]),
        totalAttachments: 2
      });
    });

    it('should throw ValidationError for invalid transaction ID', async () => {
      // Arrange
      mongoose.isValidObjectId.mockReturnValue(false);

      // Act & Assert
      await expect(
        TransactionAttachmentService.uploadAttachments('invalid-id', 'user123', [])
      ).rejects.toThrow(ValidationError);
      expect(mongoose.isValidObjectId).toHaveBeenCalledWith('invalid-id');
    });

    it('should throw ValidationError when no files are uploaded', async () => {
      // Arrange
      mongoose.isValidObjectId.mockReturnValue(true);

      // Act & Assert
      await expect(
        TransactionAttachmentService.uploadAttachments('transaction123', 'user123', [])
      ).rejects.toThrow(ValidationError);

      await expect(
        TransactionAttachmentService.uploadAttachments('transaction123', 'user123', null)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when transaction does not exist', async () => {
      // Arrange
      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(null);

      const files = [{ filename: 'test.pdf' }];

      // Act & Assert
      await expect(
        TransactionAttachmentService.uploadAttachments('transaction123', 'user123', files)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when attachment limit is exceeded', async () => {
      // Arrange
      const transactionWithMaxAttachments = {
        _id: 'transaction123',
        user: 'user123',
        attachments: new Array(5).fill(mockAttachment), // Already has 5 attachments
        save: jest.fn()
      };

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(transactionWithMaxAttachments);

      const files = [{ filename: 'test.pdf' }];

      // Act & Assert
      await expect(
        TransactionAttachmentService.uploadAttachments('transaction123', 'user123', files)
      ).rejects.toThrow(ValidationError);
    });

    it('should handle edge case with exactly 5 attachments (boundary test)', async () => {
      // Arrange
      const transactionWith4Attachments = {
        _id: 'transaction123',
        user: 'user123',
        attachments: new Array(4).fill(mockAttachment),
        save: jest.fn().mockResolvedValue()
      };

      transactionWith4Attachments.attachments.push = jest.fn().mockImplementation(() => {
        transactionWith4Attachments.attachments.length++;
      });

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(transactionWith4Attachments);

      const files = [{ 
        filename: 'test.pdf',
        originalname: 'test.pdf',
        path: '/uploads/test.pdf',
        mimetype: 'application/pdf',
        size: 1024
      }];

      // Act
      const result = await TransactionAttachmentService.uploadAttachments(
        'transaction123',
        'user123',
        files
      );

      // Assert
      expect(result.totalAttachments).toBe(5);
      expect(transactionWith4Attachments.save).toHaveBeenCalled();
    });

    it('should handle database errors during transaction save', async () => {
      // Arrange
      const transactionWithError = {
        _id: 'transaction123',
        user: 'user123',
        attachments: [],
        save: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      transactionWithError.attachments.push = jest.fn();

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(transactionWithError);

      const files = [{ 
        filename: 'test.pdf',
        originalname: 'test.pdf',
        path: '/uploads/test.pdf',
        mimetype: 'application/pdf',
        size: 1024
      }];

      // Act & Assert
      await expect(
        TransactionAttachmentService.uploadAttachments('transaction123', 'user123', files)
      ).rejects.toThrow('Database error');
    });
  });

  describe('deleteAttachment', () => {
    it('should successfully delete attachment', async () => {
      // Arrange
      const transactionId = 'transaction123';
      const attachmentId = 'attachment123';
      const userId = 'user123';

      const mockTransactionWithPull = {
        ...mockTransaction,
        attachments: {
          id: jest.fn().mockReturnValue(mockAttachment),
          pull: jest.fn(),
          length: 0
        }
      };

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(mockTransactionWithPull);

      // Act
      const result = await TransactionAttachmentService.deleteAttachment(
        transactionId,
        attachmentId,
        userId
      );

      // Assert
      expect(mongoose.isValidObjectId).toHaveBeenCalledWith(transactionId);
      expect(mongoose.isValidObjectId).toHaveBeenCalledWith(attachmentId);
      expect(Transaction.findOne).toHaveBeenCalledWith({
        _id: transactionId,
        user: userId,
        isDeleted: { $ne: true }
      });
      expect(mockTransactionWithPull.attachments.id).toHaveBeenCalledWith(attachmentId);
      expect(mockTransactionWithPull.attachments.pull).toHaveBeenCalledWith(attachmentId);
      expect(mockTransactionWithPull.save).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalledWith(mockAttachment.path);
      expect(result).toEqual({
        transactionId,
        deletedAttachment: {
          id: mockAttachment._id,
          filename: mockAttachment.filename,
          originalName: mockAttachment.originalName,
          size: mockAttachment.size
        },
        remainingAttachments: 0
      });
    });

    it('should throw ValidationError for invalid transaction ID', async () => {
      // Arrange
      mongoose.isValidObjectId.mockImplementation((id) => id !== 'invalid-transaction');

      // Act & Assert
      await expect(
        TransactionAttachmentService.deleteAttachment('invalid-transaction', 'attachment123', 'user123')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid attachment ID', async () => {
      // Arrange
      mongoose.isValidObjectId.mockImplementation((id) => id !== 'invalid-attachment');

      // Act & Assert
      await expect(
        TransactionAttachmentService.deleteAttachment('transaction123', 'invalid-attachment', 'user123')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when transaction does not exist', async () => {
      // Arrange
      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        TransactionAttachmentService.deleteAttachment('transaction123', 'attachment123', 'user123')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when attachment does not exist', async () => {
      // Arrange
      const mockTransactionWithNoAttachment = {
        ...mockTransaction,
        attachments: {
          id: jest.fn().mockReturnValue(null)
        }
      };

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(mockTransactionWithNoAttachment);

      // Act & Assert
      await expect(
        TransactionAttachmentService.deleteAttachment('transaction123', 'attachment123', 'user123')
      ).rejects.toThrow(NotFoundError);
    });

    it('should continue execution when physical file deletion fails', async () => {
      // Arrange
      const mockTransactionWithPull = {
        ...mockTransaction,
        attachments: {
          id: jest.fn().mockReturnValue(mockAttachment),
          pull: jest.fn(),
          length: 0
        }
      };

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(mockTransactionWithPull);
      fs.unlink.mockRejectedValue(new Error('File not found'));

      // Act
      const result = await TransactionAttachmentService.deleteAttachment(
        'transaction123',
        'attachment123',
        'user123'
      );

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to delete physical file:', 'File not found');
      expect(result.transactionId).toBe('transaction123');
      expect(mockTransactionWithPull.save).toHaveBeenCalled();
    });

    it('should handle database errors during transaction save', async () => {
      // Arrange
      const mockTransactionWithError = {
        ...mockTransaction,
        attachments: {
          id: jest.fn().mockReturnValue(mockAttachment),
          pull: jest.fn()
        },
        save: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(mockTransactionWithError);

      // Act & Assert
      await expect(
        TransactionAttachmentService.deleteAttachment('transaction123', 'attachment123', 'user123')
      ).rejects.toThrow('Database error');
    });
  });

  describe('getAttachmentForDownload', () => {
    it('should successfully retrieve attachment details for download', async () => {
      // Arrange
      const transactionId = 'transaction123';
      const attachmentId = 'attachment123';
      const userId = 'user123';

      const mockTransactionWithAttachment = {
        ...mockTransaction,
        attachments: {
          id: jest.fn().mockReturnValue(mockAttachment)
        }
      };

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(mockTransactionWithAttachment);

      // Act
      const result = await TransactionAttachmentService.getAttachmentForDownload(
        transactionId,
        attachmentId,
        userId
      );

      // Assert
      expect(mongoose.isValidObjectId).toHaveBeenCalledWith(transactionId);
      expect(mongoose.isValidObjectId).toHaveBeenCalledWith(attachmentId);
      expect(Transaction.findOne).toHaveBeenCalledWith({
        _id: transactionId,
        user: userId,
        isDeleted: { $ne: true }
      });
      expect(fs.access).toHaveBeenCalledWith(mockAttachment.path);
      expect(result).toEqual({
        path: mockAttachment.path,
        mimeType: mockAttachment.mimeType,
        originalName: mockAttachment.originalName,
        size: mockAttachment.size
      });
    });

    it('should throw ValidationError for invalid transaction ID', async () => {
      // Arrange
      mongoose.isValidObjectId.mockImplementation((id) => id !== 'invalid-transaction');

      // Act & Assert
      await expect(
        TransactionAttachmentService.getAttachmentForDownload('invalid-transaction', 'attachment123', 'user123')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid attachment ID', async () => {
      // Arrange
      mongoose.isValidObjectId.mockImplementation((id) => id !== 'invalid-attachment');

      // Act & Assert
      await expect(
        TransactionAttachmentService.getAttachmentForDownload('transaction123', 'invalid-attachment', 'user123')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when transaction does not exist', async () => {
      // Arrange
      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        TransactionAttachmentService.getAttachmentForDownload('transaction123', 'attachment123', 'user123')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when attachment does not exist', async () => {
      // Arrange
      const mockTransactionWithNoAttachment = {
        ...mockTransaction,
        attachments: {
          id: jest.fn().mockReturnValue(null)
        }
      };

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(mockTransactionWithNoAttachment);

      // Act & Assert
      await expect(
        TransactionAttachmentService.getAttachmentForDownload('transaction123', 'attachment123', 'user123')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when physical file does not exist', async () => {
      // Arrange
      const mockTransactionWithAttachment = {
        ...mockTransaction,
        attachments: {
          id: jest.fn().mockReturnValue(mockAttachment)
        }
      };

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(mockTransactionWithAttachment);
      fs.access.mockRejectedValue(new Error('File not found'));

      // Act & Assert
      await expect(
        TransactionAttachmentService.getAttachmentForDownload('transaction123', 'attachment123', 'user123')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Error Handling', () => {
    it('should propagate ValidationError correctly', async () => {
      // Arrange
      mongoose.isValidObjectId.mockReturnValue(false);

      // Act & Assert
      await expect(
        TransactionAttachmentService.uploadAttachments('invalid', 'user123', [{}])
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should propagate NotFoundError correctly', async () => {
      // Arrange
      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        TransactionAttachmentService.uploadAttachments('transaction123', 'user123', [{}])
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should handle mongoose connection errors', async () => {
      // Arrange
      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockRejectedValue(new Error('Connection timeout'));

      // Act & Assert
      await expect(
        TransactionAttachmentService.uploadAttachments('transaction123', 'user123', [{}])
      ).rejects.toThrow('Connection timeout');
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple file uploads efficiently', async () => {
      // Arrange
      const largeFileSet = Array.from({ length: 5 }, (_, i) => ({
        filename: `file-${i}.pdf`,
        originalname: `file-${i}.pdf`,
        path: `/uploads/file-${i}.pdf`,
        mimetype: 'application/pdf',
        size: 1024 * (i + 1)
      }));

      const emptyTransaction = {
        _id: 'transaction123',
        user: 'user123',
        attachments: [],
        save: jest.fn().mockResolvedValue()
      };

      emptyTransaction.attachments.push = jest.fn().mockImplementation(() => {
        emptyTransaction.attachments.length++;
      });

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(emptyTransaction);

      // Act
      const startTime = Date.now();
      const result = await TransactionAttachmentService.uploadAttachments(
        'transaction123',
        'user123',
        largeFileSet
      );
      const endTime = Date.now();

      // Assert
      expect(result.uploadedAttachments).toHaveLength(5);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle rapid attachment operations efficiently', async () => {
      // Arrange
      const mockTransactionWithAttachment = {
        ...mockTransaction,
        attachments: {
          id: jest.fn().mockReturnValue(mockAttachment)
        }
      };

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(mockTransactionWithAttachment);

      // Act
      const startTime = Date.now();
      const promises = Array.from({ length: 10 }, () =>
        TransactionAttachmentService.getAttachmentForDownload('transaction123', 'attachment123', 'user123')
      );
      await Promise.all(promises);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty attachment array', async () => {
      // Arrange
      const transactionWithEmptyAttachments = {
        _id: 'transaction123',
        user: 'user123',
        attachments: [],
        save: jest.fn().mockResolvedValue()
      };

      transactionWithEmptyAttachments.attachments.push = jest.fn().mockImplementation(() => {
        transactionWithEmptyAttachments.attachments.length++;
      });

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(transactionWithEmptyAttachments);

      const files = [{
        filename: 'test.pdf',
        originalname: 'test.pdf',
        path: '/uploads/test.pdf',
        mimetype: 'application/pdf',
        size: 1024
      }];

      // Act
      const result = await TransactionAttachmentService.uploadAttachments(
        'transaction123',
        'user123',
        files
      );

      // Assert
      expect(result.totalAttachments).toBe(1);
    });

    it('should handle very large file sizes', async () => {
      // Arrange
      const largeFile = {
        filename: 'large-file.pdf',
        originalname: 'large-file.pdf',
        path: '/uploads/large-file.pdf',
        mimetype: 'application/pdf',
        size: 100 * 1024 * 1024 // 100MB
      };

      const emptyTransaction = {
        _id: 'transaction123',
        user: 'user123',
        attachments: [],
        save: jest.fn().mockResolvedValue()
      };

      emptyTransaction.attachments.push = jest.fn();

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(emptyTransaction);

      // Act
      const result = await TransactionAttachmentService.uploadAttachments(
        'transaction123',
        'user123',
        [largeFile]
      );

      // Assert
      expect(result.uploadedAttachments[0].size).toBe(100 * 1024 * 1024);
    });

    it('should handle special characters in filenames', async () => {
      // Arrange
      const specialFile = {
        filename: 'receipt-#1@company.com.pdf',
        originalname: 'receipt #1@company.com.pdf',
        path: '/uploads/receipt-#1@company.com.pdf',
        mimetype: 'application/pdf',
        size: 1024
      };

      const emptyTransaction = {
        _id: 'transaction123',
        user: 'user123',
        attachments: [],
        save: jest.fn().mockResolvedValue()
      };

      emptyTransaction.attachments.push = jest.fn();

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(emptyTransaction);

      // Act
      const result = await TransactionAttachmentService.uploadAttachments(
        'transaction123',
        'user123',
        [specialFile]
      );

      // Assert
      expect(result.uploadedAttachments[0].originalName).toBe('receipt #1@company.com.pdf');
    });

    it('should handle undefined/null attachment properties gracefully', async () => {
      // Arrange
      const incompleteFile = {
        filename: 'test.pdf',
        originalname: null,
        path: '/uploads/test.pdf',
        mimetype: undefined,
        size: 1024
      };

      const emptyTransaction = {
        _id: 'transaction123',
        user: 'user123',
        attachments: [],
        save: jest.fn().mockResolvedValue()
      };

      emptyTransaction.attachments.push = jest.fn();

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(emptyTransaction);

      // Act
      const result = await TransactionAttachmentService.uploadAttachments(
        'transaction123',
        'user123',
        [incompleteFile]
      );

      // Assert
      expect(result.uploadedAttachments[0].originalName).toBeNull();
      expect(result.uploadedAttachments[0].mimeType).toBeUndefined();
    });

    it('should handle transactions marked as deleted', async () => {
      // Arrange
      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(null); // Simulates isDeleted: true filtering

      // Act & Assert
      await expect(
        TransactionAttachmentService.uploadAttachments('transaction123', 'user123', [{}])
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle attachment with missing path during file access', async () => {
      // Arrange
      const attachmentWithNoPath = {
        ...mockAttachment,
        path: null
      };

      const mockTransactionWithBadAttachment = {
        ...mockTransaction,
        attachments: {
          id: jest.fn().mockReturnValue(attachmentWithNoPath)
        }
      };

      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(mockTransactionWithBadAttachment);
      fs.access.mockRejectedValue(new Error('Path is null'));

      // Act & Assert
      await expect(
        TransactionAttachmentService.getAttachmentForDownload('transaction123', 'attachment123', 'user123')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Security Tests', () => {
    it('should verify user ownership before allowing operations', async () => {
      // Arrange
      mongoose.isValidObjectId.mockReturnValue(true);
      Transaction.findOne.mockResolvedValue(null); // User doesn't own transaction

      // Act & Assert
      await expect(
        TransactionAttachmentService.uploadAttachments('transaction123', 'different-user', [{}])
      ).rejects.toThrow(NotFoundError);

      expect(Transaction.findOne).toHaveBeenCalledWith({
        _id: 'transaction123',
        user: 'different-user',
        isDeleted: { $ne: true }
      });
    });

    it('should filter out deleted transactions', async () => {
      // Arrange
      mongoose.isValidObjectId.mockReturnValue(true);

      // Act
      await TransactionAttachmentService.uploadAttachments('transaction123', 'user123', [{}])
        .catch(() => {}); // Ignore the error for this test

      // Assert
      expect(Transaction.findOne).toHaveBeenCalledWith({
        _id: 'transaction123',
        user: 'user123',
        isDeleted: { $ne: true }
      });
    });
  });
});
