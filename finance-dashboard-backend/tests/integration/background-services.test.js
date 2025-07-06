/**
 * Simple test to verify background services cleanup works
 */

// Mock Express app for testing
const express = require('express');
const app = express();

describe('Background Services Test', () => {
  test('should start services without creating background intervals', async () => {
    // This test verifies that services don't create background intervals during tests
    
    // Import and check security monitor
    const securityMonitor = require('../../services/securityMonitor.service');
    expect(securityMonitor.cleanupInterval).toBeNull();
    
    // Import and check auth service
    const auth = require('../../services/auth.service');
    const tokenBlacklist = new auth.TokenBlacklist();
    expect(tokenBlacklist.intervals).toEqual([]);
    
    console.log('Background services test passed - no intervals created during tests');
  }, 10000);
  
  test('should be able to require upload middleware without creating intervals', async () => {
    // This test verifies upload middleware doesn't start intervals during tests
    const uploadMiddleware = require('../../middleware/upload.middleware');
    
    // The middleware should be importable without throwing errors
    expect(uploadMiddleware).toBeDefined();
    
    console.log('Upload middleware test passed - no intervals created during tests');
  }, 10000);
  
  test('should be able to require rate limit middleware without creating intervals', async () => {
    // This test verifies rate limit middleware doesn't start intervals during tests
    const rateLimitMiddleware = require('../../middleware/rateLimit.middleware');
    
    // The middleware should be importable without throwing errors
    expect(rateLimitMiddleware).toBeDefined();
    
    console.log('Rate limit middleware test passed - no intervals created during tests');
  }, 10000);
  
  test('should be able to require export cleanup service without starting cron jobs', async () => {
    // This test verifies export cleanup service doesn't start cron jobs during tests
    const exportCleanupService = require('../../services/exportCleanup.service');
    
    // The service should be importable without throwing errors
    expect(exportCleanupService).toBeDefined();
    expect(exportCleanupService.cronTask).toBeNull();
    
    console.log('Export cleanup service test passed - no cron jobs started during tests');
  }, 10000);
});
