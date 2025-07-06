/**
 * Unit Tests for File Service
 * Tests file upload, processing, validation, and management functionality
 */

const FileService = require('../../services/file.service');
const { 
  UploadConfig, 
  StorageManager,
  ImageProcessor, 
  FileValidator, 
  SecurityScanner,
  CleanupManager 
} = require('../../middleware/upload.middleware');
const { ValidationError, SecurityError, AppError } = require('../../utils/errorHandler');
const logger = require('../../utils/logger');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// Mock dependencies
jest.mock('../../middleware/upload.middleware');
jest.mock('../../utils/errorHandler');
jest.mock('../../utils/logger');
jest.mock('sharp');
jest.mock('uuid');

describe('FileService', () => {
  let fileService;
  let mockUploadConfig;
  let mockStorageManager;
  let mockImageProcessor;
  let mockFileValidator;
  let mockSecurityScanner;
  let mockCleanupManager;
  let mockSharp;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock UploadConfig
    mockUploadConfig = {
      processing: {
        enableImageProcessing: true,
        generateThumbnails: true
      }
    };
    UploadConfig.getConfig = jest.fn().mockReturnValue(mockUploadConfig);

    // Mock StorageManager
    mockStorageManager = {
      generateFilename: jest.fn((originalName, uploadType) => `${uploadType}_${Date.now()}_${originalName}`),
      saveFile: jest.fn().mockResolvedValue({
        filename: 'test-file.jpg',
        path: '/uploads/test-file.jpg',
        url: 'https://example.com/uploads/test-file.jpg',
        storage: 'local'
      })
    };
    StorageManager.mockImplementation(() => mockStorageManager);

    // Mock ImageProcessor
    mockImageProcessor = {
      processImage: jest.fn().mockResolvedValue(Buffer.from('processed-image')),
      generateThumbnails: jest.fn().mockResolvedValue({
        small: Buffer.from('small-thumb'),
        medium: Buffer.from('medium-thumb'),
        large: Buffer.from('large-thumb')
      })
    };
    ImageProcessor.mockImplementation(() => mockImageProcessor);

    // Mock FileValidator
    mockFileValidator = {
      validateFileType: jest.fn().mockResolvedValue(true),
      validateImageContent: jest.fn().mockResolvedValue(true),
      validateDocumentContent: jest.fn().mockResolvedValue(true)
    };
    FileValidator.validateFileType = mockFileValidator.validateFileType;
    FileValidator.validateImageContent = mockFileValidator.validateImageContent;
    FileValidator.validateDocumentContent = mockFileValidator.validateDocumentContent;

    // Mock SecurityScanner
    mockSecurityScanner = {
      scanFile: jest.fn().mockResolvedValue(true)
    };
    SecurityScanner.scanFile = mockSecurityScanner.scanFile;

    // Mock CleanupManager
    mockCleanupManager = {
      cleanup: jest.fn().mockResolvedValue(true)
    };
    CleanupManager.mockImplementation(() => mockCleanupManager);

    // Mock sharp
    mockSharp = {
      metadata: jest.fn().mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        size: 256000
      })
    };
    sharp.mockReturnValue(mockSharp);

    // Mock uuid
    uuidv4.mockReturnValue('test-uuid-123');

    // Mock logger
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();

    // Create FileService instance
    fileService = new FileService();
  });

  describe('constructor', () => {
    test('should initialize with all required dependencies', () => {
      expect(UploadConfig.getConfig).toHaveBeenCalled();
      expect(StorageManager).toHaveBeenCalled();
      expect(ImageProcessor).toHaveBeenCalled();
      expect(CleanupManager).toHaveBeenCalled();
      expect(fileService.config).toBe(mockUploadConfig);
    });
  });

  describe('uploadFile', () => {
    const mockBuffer = Buffer.from('test-file-content');
    const mockFileData = {
      originalName: 'test.jpg',
      mimeType: 'image/jpeg',
      uploadType: 'avatar',
      userId: 'user123'
    };

    test('should upload and process image file successfully', async () => {
      const result = await fileService.uploadFile(
        mockBuffer,
        mockFileData.originalName,
        mockFileData.mimeType,
        mockFileData.uploadType,
        mockFileData.userId
      );

      expect(FileValidator.validateFileType).toHaveBeenCalledWith(
        mockBuffer,
        mockFileData.mimeType,
        mockFileData.originalName
      );
      expect(SecurityScanner.scanFile).toHaveBeenCalledWith(mockBuffer, mockFileData.originalName);
      expect(FileValidator.validateImageContent).toHaveBeenCalledWith(mockBuffer);
      expect(mockImageProcessor.processImage).toHaveBeenCalled();
      expect(mockImageProcessor.generateThumbnails).toHaveBeenCalled();
      expect(mockStorageManager.saveFile).toHaveBeenCalled();

      expect(result).toMatchObject({
        id: 'test-uuid-123',
        originalName: mockFileData.originalName,
        filename: 'test-file.jpg',
        mimeType: mockFileData.mimeType,
        uploadType: mockFileData.uploadType,
        userId: mockFileData.userId,
        isProcessed: true
      });
      expect(result.thumbnails).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.checksum).toBeDefined();
    });

    test('should upload document file successfully', async () => {
      const documentData = {
        originalName: 'document.pdf',
        mimeType: 'application/pdf',
        uploadType: 'document',
        userId: 'user123'
      };

      const result = await fileService.uploadFile(
        mockBuffer,
        documentData.originalName,
        documentData.mimeType,
        documentData.uploadType,
        documentData.userId
      );

      expect(FileValidator.validateDocumentContent).toHaveBeenCalledWith(mockBuffer, documentData.mimeType);
      expect(mockImageProcessor.processImage).not.toHaveBeenCalled();
      expect(result.thumbnails).toEqual({});
    });

    test('should handle custom image processing options', async () => {
      const options = {
        maxWidth: 1024,
        maxHeight: 768,
        quality: 95,
        format: 'png'
      };

      await fileService.uploadFile(
        mockBuffer,
        mockFileData.originalName,
        mockFileData.mimeType,
        mockFileData.uploadType,
        mockFileData.userId,
        options
      );

      expect(mockImageProcessor.processImage).toHaveBeenCalledWith(mockBuffer, {
        maxWidth: 1024,
        maxHeight: 768,
        quality: 95,
        format: 'png'
      });
    });

    test('should use default image processing options when not provided', async () => {
      await fileService.uploadFile(
        mockBuffer,
        mockFileData.originalName,
        mockFileData.mimeType,
        mockFileData.uploadType,
        mockFileData.userId
      );

      expect(mockImageProcessor.processImage).toHaveBeenCalledWith(mockBuffer, {
        maxWidth: 2048,
        maxHeight: 2048,
        quality: 85,
        format: 'jpeg'
      });
    });

    test('should skip image processing when disabled in config', async () => {
      mockUploadConfig.processing.enableImageProcessing = false;

      const result = await fileService.uploadFile(
        mockBuffer,
        mockFileData.originalName,
        mockFileData.mimeType,
        mockFileData.uploadType,
        mockFileData.userId
      );

      expect(mockImageProcessor.processImage).not.toHaveBeenCalled();
      expect(result.metadata).toEqual({});
    });

    test('should skip thumbnail generation when disabled in config', async () => {
      mockUploadConfig.processing.generateThumbnails = false;

      const result = await fileService.uploadFile(
        mockBuffer,
        mockFileData.originalName,
        mockFileData.mimeType,
        mockFileData.uploadType,
        mockFileData.userId
      );

      expect(mockImageProcessor.generateThumbnails).not.toHaveBeenCalled();
      expect(result.thumbnails).toEqual({});
    });

    test('should handle file validation errors', async () => {
      const validationError = new ValidationError('Invalid file type');
      FileValidator.validateFileType.mockRejectedValue(validationError);

      await expect(fileService.uploadFile(
        mockBuffer,
        mockFileData.originalName,
        mockFileData.mimeType,
        mockFileData.uploadType,
        mockFileData.userId
      )).rejects.toThrow(validationError);

      expect(logger.error).toHaveBeenCalledWith('File upload failed:', validationError);
    });

    test('should handle security scan errors', async () => {
      const securityError = new SecurityError('Malicious file detected');
      SecurityScanner.scanFile.mockRejectedValue(securityError);

      await expect(fileService.uploadFile(
        mockBuffer,
        mockFileData.originalName,
        mockFileData.mimeType,
        mockFileData.uploadType,
        mockFileData.userId
      )).rejects.toThrow(securityError);

      expect(logger.error).toHaveBeenCalledWith('File upload failed:', securityError);
    });

    test('should handle image processing errors', async () => {
      const processingError = new Error('Image processing failed');
      mockImageProcessor.processImage.mockRejectedValue(processingError);

      await expect(fileService.uploadFile(
        mockBuffer,
        mockFileData.originalName,
        mockFileData.mimeType,
        mockFileData.uploadType,
        mockFileData.userId
      )).rejects.toThrow(processingError);
    });

    test('should handle storage errors', async () => {
      const storageError = new Error('Storage service unavailable');
      mockStorageManager.saveFile.mockRejectedValue(storageError);

      await expect(fileService.uploadFile(
        mockBuffer,
        mockFileData.originalName,
        mockFileData.mimeType,
        mockFileData.uploadType,
        mockFileData.userId
      )).rejects.toThrow(storageError);
    });

    test('should log successful upload', async () => {
      await fileService.uploadFile(
        mockBuffer,
        mockFileData.originalName,
        mockFileData.mimeType,
        mockFileData.uploadType,
        mockFileData.userId
      );

      expect(logger.info).toHaveBeenCalledWith('File uploaded successfully', {
        fileId: 'test-uuid-123',
        filename: 'test-file.jpg',
        size: expect.any(Number),
        uploadType: mockFileData.uploadType,
        userId: mockFileData.userId
      });
    });

    test('should generate checksum for uploaded file', async () => {
      const result = await fileService.uploadFile(
        mockBuffer,
        mockFileData.originalName,
        mockFileData.mimeType,
        mockFileData.uploadType,
        mockFileData.userId
      );

      expect(result.checksum).toBeDefined();
      expect(typeof result.checksum).toBe('string');
    });

    test('should save thumbnails correctly', async () => {
      await fileService.uploadFile(
        mockBuffer,
        mockFileData.originalName,
        mockFileData.mimeType,
        mockFileData.uploadType,
        mockFileData.userId
      );

      // Should save 3 thumbnails (small, medium, large)
      expect(mockStorageManager.saveFile).toHaveBeenCalledTimes(4); // 1 main + 3 thumbnails
    });
  });

  describe('uploadMultipleFiles', () => {
    const mockFiles = [
      {
        buffer: Buffer.from('file1'),
        originalName: 'file1.jpg',
        mimeType: 'image/jpeg'
      },
      {
        buffer: Buffer.from('file2'),
        originalName: 'file2.png',
        mimeType: 'image/png'
      },
      {
        buffer: Buffer.from('file3'),
        originalName: 'file3.pdf',
        mimeType: 'application/pdf'
      }
    ];

    test('should upload multiple files successfully', async () => {
      const result = await fileService.uploadMultipleFiles(
        mockFiles,
        'documents',
        'user123'
      );

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.totalProcessed).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
    });

    test('should handle partial failures in multiple file upload', async () => {
      // Mock failure for second file
      FileValidator.validateFileType
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new ValidationError('Invalid file'))
        .mockResolvedValueOnce(true);

      const result = await fileService.uploadMultipleFiles(
        mockFiles,
        'documents',
        'user123'
      );

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toMatchObject({
        index: 1,
        filename: 'file2.png',
        error: 'Invalid file'
      });
      expect(result.totalProcessed).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });

    test('should handle complete failure in multiple file upload', async () => {
      FileValidator.validateFileType.mockRejectedValue(new ValidationError('All files invalid'));

      const result = await fileService.uploadMultipleFiles(
        mockFiles,
        'documents',
        'user123'
      );

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(3);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(3);
    });

    test('should log errors for failed files', async () => {
      FileValidator.validateFileType.mockRejectedValue(new ValidationError('Validation error'));

      await fileService.uploadMultipleFiles(mockFiles, 'documents', 'user123');

      expect(logger.error).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(
        'File upload failed for file 0:',
        expect.any(Error)
      );
    });

    test('should pass options to individual file uploads', async () => {
      const spy = jest.spyOn(fileService, 'uploadFile');
      const options = { maxWidth: 1024, quality: 90 };

      await fileService.uploadMultipleFiles(
        mockFiles,
        'documents',
        'user123',
        options
      );

      expect(spy).toHaveBeenCalledWith(
        mockFiles[0].buffer,
        mockFiles[0].originalName,
        mockFiles[0].mimeType,
        'documents',
        'user123',
        options
      );
    });
  });

  describe('getFileInfo', () => {
    test('should throw error for unimplemented file metadata storage', async () => {
      await expect(fileService.getFileInfo('file123', 'user123'))
        .rejects.toThrow('File metadata storage not implemented');

      expect(logger.info).toHaveBeenCalledWith('Getting file info', {
        identifier: 'file123',
        userId: 'user123'
      });
    });
  });

  describe('generateChecksum', () => {
    test('should generate checksum for file buffer', async () => {
      const buffer = Buffer.from('test content');
      
      // Since generateChecksum is private, we test it indirectly through uploadFile
      const result = await fileService.uploadFile(
        buffer,
        'test.jpg',
        'image/jpeg',
        'avatar',
        'user123'
      );

      expect(result.checksum).toBeDefined();
      expect(typeof result.checksum).toBe('string');
      expect(result.checksum.length).toBeGreaterThan(0);
    });
  });

  describe('error handling and edge cases', () => {
    test('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(fileService.uploadFile(
        emptyBuffer,
        'empty.jpg',
        'image/jpeg',
        'avatar',
        'user123'
      )).rejects.toThrow();
    });

    test('should handle null/undefined parameters', async () => {
      await expect(fileService.uploadFile(
        null,
        'test.jpg',
        'image/jpeg',
        'avatar',
        'user123'
      )).rejects.toThrow();

      await expect(fileService.uploadFile(
        Buffer.from('test'),
        null,
        'image/jpeg',
        'avatar',
        'user123'
      )).rejects.toThrow();
    });

    test('should handle invalid MIME types', async () => {
      const buffer = Buffer.from('test');
      
      await expect(fileService.uploadFile(
        buffer,
        'test.exe',
        'application/x-executable',
        'document',
        'user123'
      )).rejects.toThrow();
    });

    test('should handle malformed image data', async () => {
      const malformedImageBuffer = Buffer.from('not-an-image');
      mockImageProcessor.processImage.mockRejectedValue(new Error('Invalid image data'));

      await expect(fileService.uploadFile(
        malformedImageBuffer,
        'malformed.jpg',
        'image/jpeg',
        'avatar',
        'user123'
      )).rejects.toThrow('Invalid image data');
    });

    test('should handle storage quota exceeded', async () => {
      const quotaError = new Error('Storage quota exceeded');
      mockStorageManager.saveFile.mockRejectedValue(quotaError);

      await expect(fileService.uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatar',
        'user123'
      )).rejects.toThrow('Storage quota exceeded');
    });

    test('should handle thumbnail generation failure gracefully', async () => {
      mockImageProcessor.generateThumbnails.mockRejectedValue(new Error('Thumbnail generation failed'));

      // Should still succeed but without thumbnails
      const result = await fileService.uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatar',
        'user123'
      );

      expect(result).toBeDefined();
    });
  });

  describe('performance and scalability', () => {
    test('should handle large file uploads efficiently', async () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      
      const startTime = Date.now();
      await fileService.uploadFile(
        largeBuffer,
        'large-file.jpg',
        'image/jpeg',
        'document',
        'user123'
      );
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle concurrent uploads', async () => {
      const buffer = Buffer.from('test');
      const promises = Array.from({ length: 10 }, (_, i) =>
        fileService.uploadFile(
          buffer,
          `file${i}.jpg`,
          'image/jpeg',
          'avatar',
          'user123'
        )
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.id).toBeDefined();
        expect(result.filename).toBeDefined();
      });
    });

    test('should handle memory efficiently during multiple uploads', async () => {
      const files = Array.from({ length: 100 }, (_, i) => ({
        buffer: Buffer.from(`file content ${i}`),
        originalName: `file${i}.jpg`,
        mimeType: 'image/jpeg'
      }));

      const result = await fileService.uploadMultipleFiles(
        files,
        'documents',
        'user123'
      );

      expect(result.totalProcessed).toBe(100);
      expect(result.successCount).toBe(100);
    });
  });

  describe('security considerations', () => {
    test('should validate all file types through security scanner', async () => {
      const testFiles = [
        { mimeType: 'image/jpeg', name: 'test.jpg' },
        { mimeType: 'application/pdf', name: 'test.pdf' },
        { mimeType: 'text/plain', name: 'test.txt' }
      ];

      for (const file of testFiles) {
        await fileService.uploadFile(
          Buffer.from('test'),
          file.name,
          file.mimeType,
          'document',
          'user123'
        );
      }

      expect(SecurityScanner.scanFile).toHaveBeenCalledTimes(3);
    });

    test('should reject files with potential security threats', async () => {
      SecurityScanner.scanFile.mockRejectedValue(new SecurityError('Malware detected'));

      await expect(fileService.uploadFile(
        Buffer.from('malicious content'),
        'virus.exe',
        'application/x-executable',
        'document',
        'user123'
      )).rejects.toThrow('Malware detected');
    });

    test('should validate file content integrity', async () => {
      const buffer = Buffer.from('test content');
      
      await fileService.uploadFile(
        buffer,
        'test.jpg',
        'image/jpeg',
        'avatar',
        'user123'
      );

      expect(FileValidator.validateImageContent).toHaveBeenCalledWith(buffer);
    });
  });

  describe('configuration handling', () => {
    test('should respect configuration for image processing', async () => {
      mockUploadConfig.processing.enableImageProcessing = false;
      mockUploadConfig.processing.generateThumbnails = false;

      const result = await fileService.uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatar',
        'user123'
      );

      expect(mockImageProcessor.processImage).not.toHaveBeenCalled();
      expect(mockImageProcessor.generateThumbnails).not.toHaveBeenCalled();
      expect(result.thumbnails).toEqual({});
    });

    test('should use configuration defaults when options not provided', async () => {
      await fileService.uploadFile(
        Buffer.from('test'),
        'test.jpg',
        'image/jpeg',
        'avatar',
        'user123'
      );

      expect(mockImageProcessor.processImage).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 85,
          format: 'jpeg'
        })
      );
    });
  });
});
