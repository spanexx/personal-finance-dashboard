/**
 * Export Cleanup Job
 * Cleans up expired export files to save disk space
 */

const cron = require('node-cron');
const ExportHistory = require('../models/ExportHistory');
const logger = require('../utils/logger');

class ExportCleanupJob {
  constructor() {
    this.isRunning = false;
    this.cronTask = null;
  }

  /**
   * Start the cleanup job
   * Runs daily at 2 AM
   */
  start() {
    // Don't start cron jobs during tests
    if (process.env.NODE_ENV === 'test') {
      logger.info('Export cleanup job disabled during tests');
      return;
    }

    if (this.cronTask) {
      logger.info('Export cleanup job already scheduled');
      return;
    }

    // Run every day at 2:00 AM
    this.cronTask = cron.schedule('0 2 * * *', async () => {
      if (this.isRunning) {
        logger.warn('Export cleanup job is already running, skipping this execution');
        return;
      }

      this.isRunning = true;
      logger.info('Starting export files cleanup job');

      try {
        const cleanupResult = await ExportHistory.cleanupExpiredFiles();
        
        logger.info('Export cleanup job completed', {
          filesDeleted: cleanupResult.filesDeleted,
          errors: cleanupResult.errors.length
        });

        if (cleanupResult.errors.length > 0) {
          logger.warn('Some files could not be deleted during cleanup', {
            errors: cleanupResult.errors
          });
        }
      } catch (error) {
        logger.error('Export cleanup job failed:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'UTC'
    });

    logger.info('Export cleanup job scheduled to run daily at 2:00 AM');
  }

  /**
   * Stop the cleanup job
   */
  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
      logger.info('Export cleanup job stopped');
    }
  }

  /**
   * Run cleanup manually (for testing or immediate cleanup)
   */
  async runManualCleanup() {
    if (this.isRunning) {
      throw new Error('Cleanup job is already running');
    }

    this.isRunning = true;
    logger.info('Starting manual export files cleanup');

    try {
      const cleanupResult = await ExportHistory.cleanupExpiredFiles();
      
      logger.info('Manual export cleanup completed', {
        filesDeleted: cleanupResult.filesDeleted,
        errors: cleanupResult.errors.length
      });

      return cleanupResult;
    } catch (error) {
      logger.error('Manual export cleanup failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
  /**
   * Get cleanup job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.cronTask ? 'Daily at 2:00 AM' : 'Not scheduled'
    };
  }
}

// Create singleton instance
const exportCleanupJob = new ExportCleanupJob();

module.exports = exportCleanupJob;
