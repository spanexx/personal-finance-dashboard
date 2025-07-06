/**
 * Export Cleanup Service Unit Tests
 * Tests for export file cleanup automation
 */

const cron = require('node-cron');
const ExportHistory = require('../../models/ExportHistory');
const logger = require('../../utils/logger');

// Import the service after setting up mocks
let exportCleanupJob;

// Mock dependencies
jest.mock('node-cron');
jest.mock('../../models/ExportHistory');
jest.mock('../../utils/logger');

describe('ExportCleanupService', () => {
  let mockSchedule;
  let mockGetTasks;
  let scheduledCallback;
  let originalEnv;

  beforeAll(() => {
    // Store original environment
    originalEnv = process.env.TZ;
  });

  afterAll(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.TZ = originalEnv;
    } else {
      delete process.env.TZ;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.resetModules();

    // Setup cron mocks
    mockSchedule = jest.fn();
    mockGetTasks = jest.fn();

    cron.schedule = mockSchedule;
    cron.getTasks = mockGetTasks;

    // Setup logger mocks
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    // Capture scheduled callback
    mockSchedule.mockImplementation((schedule, callback, options) => {
      scheduledCallback = callback;
      return { destroy: jest.fn() };
    });

    // Re-import the service to get a fresh instance
    exportCleanupJob = require('../../services/exportCleanup.service');
  });

  describe('constructor', () => {
    it('should initialize with isRunning set to false', () => {
      // Act
      const status = exportCleanupJob.getStatus();

      // Assert
      expect(status.isRunning).toBe(false);
    });
  });

  describe('start', () => {
    it('should schedule cleanup job to run daily at 2:00 AM with default timezone', () => {
      // Act
      exportCleanupJob.start();

      // Assert
      expect(mockSchedule).toHaveBeenCalledWith(
        '0 2 * * *',
        expect.any(Function),
        {
          scheduled: true,
          timezone: 'UTC'
        }
      );
      expect(logger.info).toHaveBeenCalledWith('Export cleanup job scheduled to run daily at 2:00 AM');
    });

    it('should schedule cleanup job with custom timezone from environment', () => {
      // Arrange
      process.env.TZ = 'America/New_York';

      // Act
      exportCleanupJob.start();

      // Assert
      expect(mockSchedule).toHaveBeenCalledWith(
        '0 2 * * *',
        expect.any(Function),
        {
          scheduled: true,
          timezone: 'America/New_York'
        }
      );
    });

    it('should execute cleanup when scheduled callback is triggered', async () => {
      // Arrange
      const mockCleanupResult = {
        filesDeleted: 5,
        errors: []
      };

      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue(mockCleanupResult);
      exportCleanupJob.start();

      // Act
      await scheduledCallback();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Starting export files cleanup job');
      expect(ExportHistory.cleanupExpiredFiles).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Export cleanup job completed', {
        filesDeleted: 5,
        errors: 0
      });
    });

    it('should skip execution if cleanup is already running', async () => {
      // Arrange
      exportCleanupJob.start();
      exportCleanupJob.isRunning = true;

      // Act
      await scheduledCallback();

      // Assert
      expect(logger.warn).toHaveBeenCalledWith('Export cleanup job is already running, skipping this execution');
      expect(ExportHistory.cleanupExpiredFiles).not.toHaveBeenCalled();
    });

    it('should log warnings when cleanup has errors', async () => {
      // Arrange
      const mockCleanupResult = {
        filesDeleted: 3,
        errors: ['File not found: file1.pdf', 'Permission denied: file2.csv']
      };

      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue(mockCleanupResult);
      exportCleanupJob.start();

      // Act
      await scheduledCallback();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Export cleanup job completed', {
        filesDeleted: 3,
        errors: 2
      });
      expect(logger.warn).toHaveBeenCalledWith('Some files could not be deleted during cleanup', {
        errors: ['File not found: file1.pdf', 'Permission denied: file2.csv']
      });
    });

    it('should handle and log errors during cleanup execution', async () => {
      // Arrange
      const cleanupError = new Error('Database connection failed');
      ExportHistory.cleanupExpiredFiles = jest.fn().mockRejectedValue(cleanupError);
      exportCleanupJob.start();

      // Act
      await scheduledCallback();

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Export cleanup job failed:', cleanupError);
      expect(exportCleanupJob.isRunning).toBe(false);
    });

    it('should always reset isRunning flag after execution', async () => {
      // Arrange
      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue({
        filesDeleted: 0,
        errors: []
      });
      exportCleanupJob.start();

      // Act
      await scheduledCallback();

      // Assert
      expect(exportCleanupJob.isRunning).toBe(false);
    });

    it('should reset isRunning flag even when cleanup throws error', async () => {
      // Arrange
      ExportHistory.cleanupExpiredFiles = jest.fn().mockRejectedValue(new Error('Test error'));
      exportCleanupJob.start();

      // Act
      await scheduledCallback();

      // Assert
      expect(exportCleanupJob.isRunning).toBe(false);
    });
  });

  describe('runManualCleanup', () => {
    it('should successfully run manual cleanup', async () => {
      // Arrange
      const mockCleanupResult = {
        filesDeleted: 10,
        errors: []
      };

      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue(mockCleanupResult);

      // Act
      const result = await exportCleanupJob.runManualCleanup();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Starting manual export files cleanup');
      expect(ExportHistory.cleanupExpiredFiles).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Manual export cleanup completed', {
        filesDeleted: 10,
        errors: 0
      });
      expect(result).toEqual(mockCleanupResult);
      expect(exportCleanupJob.isRunning).toBe(false);
    });

    it('should throw error if cleanup is already running', async () => {
      // Arrange
      exportCleanupJob.isRunning = true;

      // Act & Assert
      await expect(exportCleanupJob.runManualCleanup())
        .rejects.toThrow('Cleanup job is already running');
      expect(ExportHistory.cleanupExpiredFiles).not.toHaveBeenCalled();
    });

    it('should handle and propagate cleanup errors', async () => {
      // Arrange
      const cleanupError = new Error('File system error');
      ExportHistory.cleanupExpiredFiles = jest.fn().mockRejectedValue(cleanupError);

      // Act & Assert
      await expect(exportCleanupJob.runManualCleanup())
        .rejects.toThrow('File system error');
      expect(logger.error).toHaveBeenCalledWith('Manual export cleanup failed:', cleanupError);
      expect(exportCleanupJob.isRunning).toBe(false);
    });

    it('should log manual cleanup results with errors', async () => {
      // Arrange
      const mockCleanupResult = {
        filesDeleted: 7,
        errors: ['Access denied: file3.xlsx']
      };

      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue(mockCleanupResult);

      // Act
      const result = await exportCleanupJob.runManualCleanup();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Manual export cleanup completed', {
        filesDeleted: 7,
        errors: 1
      });
      expect(result).toEqual(mockCleanupResult);
    });

    it('should set and reset isRunning flag correctly', async () => {
      // Arrange
      const mockCleanupResult = {
        filesDeleted: 2,
        errors: []
      };

      ExportHistory.cleanupExpiredFiles = jest.fn().mockImplementation(async () => {
        expect(exportCleanupJob.isRunning).toBe(true);
        return mockCleanupResult;
      });

      // Act
      const result = await exportCleanupJob.runManualCleanup();

      // Assert
      expect(result).toEqual(mockCleanupResult);
      expect(exportCleanupJob.isRunning).toBe(false);
    });

    it('should handle zero files deleted scenario', async () => {
      // Arrange
      const mockCleanupResult = {
        filesDeleted: 0,
        errors: []
      };

      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue(mockCleanupResult);

      // Act
      const result = await exportCleanupJob.runManualCleanup();

      // Assert
      expect(result.filesDeleted).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('Manual export cleanup completed', {
        filesDeleted: 0,
        errors: 0
      });
    });
  });

  describe('getStatus', () => {
    it('should return status when job is not running and tasks exist', () => {
      // Arrange
      mockGetTasks.mockReturnValue(new Map([['task1', {}]]));

      // Act
      const status = exportCleanupJob.getStatus();

      // Assert
      expect(status).toEqual({
        isRunning: false,
        nextRun: 'Daily at 2:00 AM'
      });
    });

    it('should return status when job is running', () => {
      // Arrange
      exportCleanupJob.isRunning = true;
      mockGetTasks.mockReturnValue(new Map([['task1', {}]]));

      // Act
      const status = exportCleanupJob.getStatus();

      // Assert
      expect(status).toEqual({
        isRunning: true,
        nextRun: 'Daily at 2:00 AM'
      });
    });

    it('should return status when no tasks are scheduled', () => {
      // Arrange
      mockGetTasks.mockReturnValue(new Map());

      // Act
      const status = exportCleanupJob.getStatus();

      // Assert
      expect(status).toEqual({
        isRunning: false,
        nextRun: 'Not scheduled'
      });
    });

    it('should handle getTasks returning null or undefined', () => {
      // Arrange
      mockGetTasks.mockReturnValue(null);

      // Act
      const status = exportCleanupJob.getStatus();

      // Assert
      expect(status.nextRun).toBe('Not scheduled');
    });
  });

  describe('Concurrent Execution Prevention', () => {
    it('should prevent concurrent scheduled executions', async () => {
      // Arrange
      let resolveCleanup;
      const cleanupPromise = new Promise(resolve => {
        resolveCleanup = resolve;
      });

      ExportHistory.cleanupExpiredFiles = jest.fn().mockReturnValue(cleanupPromise);
      exportCleanupJob.start();

      // Act - Start first execution
      const firstExecution = scheduledCallback();

      // Attempt second execution while first is running
      const secondExecution = scheduledCallback();

      // Resolve the cleanup
      resolveCleanup({ filesDeleted: 1, errors: [] });

      await Promise.all([firstExecution, secondExecution]);

      // Assert
      expect(ExportHistory.cleanupExpiredFiles).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith('Export cleanup job is already running, skipping this execution');
    });

    it('should prevent manual cleanup when scheduled job is running', async () => {
      // Arrange
      let resolveCleanup;
      const cleanupPromise = new Promise(resolve => {
        resolveCleanup = resolve;
      });

      ExportHistory.cleanupExpiredFiles = jest.fn().mockReturnValue(cleanupPromise);
      exportCleanupJob.start();

      // Act - Start scheduled execution
      const scheduledExecution = scheduledCallback();

      // Attempt manual cleanup while scheduled is running
      const manualCleanupPromise = exportCleanupJob.runManualCleanup();

      // Assert
      await expect(manualCleanupPromise).rejects.toThrow('Cleanup job is already running');

      // Cleanup
      resolveCleanup({ filesDeleted: 1, errors: [] });
      await scheduledExecution;
    });

    it('should allow manual cleanup after scheduled job completes', async () => {
      // Arrange
      const mockCleanupResult = {
        filesDeleted: 3,
        errors: []
      };

      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue(mockCleanupResult);
      exportCleanupJob.start();

      // Act - Complete scheduled execution first
      await scheduledCallback();

      // Then run manual cleanup
      const result = await exportCleanupJob.runManualCleanup();

      // Assert
      expect(result).toEqual(mockCleanupResult);
      expect(ExportHistory.cleanupExpiredFiles).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from ExportHistory model errors', async () => {
      // Arrange
      ExportHistory.cleanupExpiredFiles = jest.fn()
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ filesDeleted: 5, errors: [] });

      exportCleanupJob.start();

      // Act - First execution fails
      await scheduledCallback();
      expect(exportCleanupJob.isRunning).toBe(false);

      // Second execution succeeds
      await scheduledCallback();

      // Assert
      expect(ExportHistory.cleanupExpiredFiles).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Export cleanup job completed', {
        filesDeleted: 5,
        errors: 0
      });
    });

    it('should handle undefined cleanup result gracefully', async () => {
      // Arrange
      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue(undefined);
      exportCleanupJob.start();

      // Act & Assert
      await expect(scheduledCallback()).rejects.toThrow();
      expect(exportCleanupJob.isRunning).toBe(false);
    });

    it('should handle malformed cleanup result', async () => {
      // Arrange
      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue({
        filesDeleted: 'invalid',
        errors: 'not-an-array'
      });
      exportCleanupJob.start();

      // Act
      await scheduledCallback();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Export cleanup job completed', {
        filesDeleted: 'invalid',
        errors: 'not-an-array'
      });
      expect(exportCleanupJob.isRunning).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large cleanup results efficiently', async () => {
      // Arrange
      const largeErrorArray = Array.from({ length: 1000 }, (_, i) => `Error ${i}`);
      const mockCleanupResult = {
        filesDeleted: 5000,
        errors: largeErrorArray
      };

      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue(mockCleanupResult);

      // Act
      const startTime = Date.now();
      const result = await exportCleanupJob.runManualCleanup();
      const endTime = Date.now();

      // Assert
      expect(result).toEqual(mockCleanupResult);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(logger.warn).toHaveBeenCalledWith('Some files could not be deleted during cleanup', {
        errors: largeErrorArray
      });
    });

    it('should handle rapid status checks without performance issues', () => {
      // Arrange
      const iterations = 1000;

      // Act
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        exportCleanupJob.getStatus();
      }
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle concurrent manual cleanup attempts efficiently', async () => {
      // Arrange
      const attempts = 10;
      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue({
        filesDeleted: 1,
        errors: []
      });

      // Act - First attempt succeeds, others should fail quickly
      const promises = Array.from({ length: attempts }, () => 
        exportCleanupJob.runManualCleanup().catch(error => error)
      );

      const results = await Promise.all(promises);

      // Assert
      const successCount = results.filter(r => r && r.filesDeleted !== undefined).length;
      const errorCount = results.filter(r => r instanceof Error).length;

      expect(successCount).toBe(1);
      expect(errorCount).toBe(attempts - 1);
      expect(ExportHistory.cleanupExpiredFiles).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle cleanup result with negative filesDeleted', async () => {
      // Arrange
      const mockCleanupResult = {
        filesDeleted: -1,
        errors: []
      };

      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue(mockCleanupResult);

      // Act
      const result = await exportCleanupJob.runManualCleanup();

      // Assert
      expect(result.filesDeleted).toBe(-1);
      expect(logger.info).toHaveBeenCalledWith('Manual export cleanup completed', {
        filesDeleted: -1,
        errors: 0
      });
    });

    it('should handle cleanup result with null errors array', async () => {
      // Arrange
      const mockCleanupResult = {
        filesDeleted: 5,
        errors: null
      };

      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue(mockCleanupResult);

      // Act
      const result = await exportCleanupJob.runManualCleanup();

      // Assert
      expect(result).toEqual(mockCleanupResult);
      expect(logger.info).toHaveBeenCalledWith('Manual export cleanup completed', {
        filesDeleted: 5,
        errors: null
      });
    });

    it('should handle extremely long error messages', async () => {
      // Arrange
      const longError = 'x'.repeat(10000);
      const mockCleanupResult = {
        filesDeleted: 1,
        errors: [longError]
      };

      ExportHistory.cleanupExpiredFiles = jest.fn().mockResolvedValue(mockCleanupResult);
      exportCleanupJob.start();

      // Act
      await scheduledCallback();

      // Assert
      expect(logger.warn).toHaveBeenCalledWith('Some files could not be deleted during cleanup', {
        errors: [longError]
      });
    });

    it('should handle environment timezone changes', () => {
      // Arrange
      delete process.env.TZ;

      // Act
      exportCleanupJob.start();

      // Assert
      expect(mockSchedule).toHaveBeenCalledWith(
        '0 2 * * *',
        expect.any(Function),
        {
          scheduled: true,
          timezone: 'UTC'
        }
      );
    });
  });
});
