/**
 * Email Queue Service Unit Tests
 * Tests for the email queue management service with mocked dependencies
 */

const emailQueue = require('../../services/emailQueue.service');
const emailService = require('../../services/email.service');
const logger = require('../../utils/logger');
const cron = require('node-cron');

// Mock all external dependencies
jest.mock('../../services/email.service');
jest.mock('../../utils/logger');
jest.mock('node-cron');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123')
}));

describe('EmailQueue Service', () => {
  let originalQueue;
  let originalProcessing;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Store original state
    originalQueue = [...emailQueue.queue];
    originalProcessing = emailQueue.processing;
    
    // Clear the queue
    emailQueue.queue = [];
    emailQueue.processing = false;
    
    // Mock cron.schedule
    cron.schedule = jest.fn();
    
    // Mock logger methods
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
    logger.debug = jest.fn();
    
    // Mock email service methods
    emailService.sendEmail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });
    emailService.sendEmailVerification = jest.fn().mockResolvedValue({ messageId: 'verification-message-id' });
    emailService.sendWelcomeEmail = jest.fn().mockResolvedValue({ messageId: 'welcome-message-id' });
    emailService.sendSecurityAlertEmail = jest.fn().mockResolvedValue({ messageId: 'security-message-id' });
    emailService.sendGoalReminder = jest.fn().mockResolvedValue({ messageId: 'goal-message-id' });
    emailService.sendTemplatedEmail = jest.fn().mockResolvedValue({ messageId: 'template-message-id' });
    emailService.loadTemplate = jest.fn().mockResolvedValue('<html>Template</html>');
  });

  afterEach(() => {
    // Restore original state
    emailQueue.queue = originalQueue;
    emailQueue.processing = originalProcessing;
  });

  describe('Constructor and Initialization', () => {
    test('should initialize email queue with correct defaults', () => {
      expect(emailQueue.maxRetries).toBe(3);
      expect(emailQueue.retryDelay).toBe(5000);
      expect(emailQueue.batchSize).toBe(5);
      expect(emailQueue.processInterval).toBe(30000);
      expect(emailQueue.emailService).toBe(emailService);
    });

    test('should initialize cron jobs', () => {
      expect(cron.schedule).toHaveBeenCalledWith('*/30 * * * * *', expect.any(Function));
      expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith('Email queue initialized with cron scheduling');
    });
  });

  describe('addToQueue', () => {
    test('should add email to queue with default priority', () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        text: 'Test'
      };

      const queueId = emailQueue.addToQueue(emailData);

      expect(queueId).toBe('mock-uuid-123');
      expect(emailQueue.queue).toHaveLength(1);
      
      const queueItem = emailQueue.queue[0];
      expect(queueItem.id).toBe('mock-uuid-123');
      expect(queueItem.emailData.to).toBe('test@example.com');
      expect(queueItem.priority).toBe('normal');
      expect(queueItem.status).toBe('pending');
      expect(queueItem.attempts).toBe(0);
    });

    test('should add high priority email to front of queue', () => {
      // Add normal priority email first
      emailQueue.addToQueue({ to: 'normal@example.com', subject: 'Normal' });
      
      // Add high priority email
      const queueId = emailQueue.addToQueue(
        { to: 'high@example.com', subject: 'High Priority' },
        { priority: 'high' }
      );

      expect(emailQueue.queue).toHaveLength(2);
      expect(emailQueue.queue[0].emailData.to).toBe('high@example.com');
      expect(emailQueue.queue[0].priority).toBe('high');
      expect(emailQueue.queue[1].emailData.to).toBe('normal@example.com');
    });

    test('should add template email data correctly', () => {
      const emailData = {
        to: 'test@example.com',
        templateName: 'email-verification',
        templateData: { user: { name: 'Test User' }, token: 'verification-token' }
      };

      emailQueue.addToQueue(emailData);

      const queueItem = emailQueue.queue[0];
      expect(queueItem.emailData.templateName).toBe('email-verification');
      expect(queueItem.emailData.templateData).toEqual({
        user: { name: 'Test User' },
        token: 'verification-token'
      });
    });

    test('should handle scheduled emails', () => {
      const scheduleAt = new Date(Date.now() + 3600000); // 1 hour from now
      const emailData = { to: 'test@example.com', subject: 'Scheduled' };

      emailQueue.addToQueue(emailData, { scheduleAt });

      const queueItem = emailQueue.queue[0];
      expect(queueItem.scheduledAt).toEqual(scheduleAt);
    });

    test('should handle custom retry limits', () => {
      const emailData = { to: 'test@example.com', subject: 'Custom Retry' };

      emailQueue.addToQueue(emailData, { maxRetries: 5 });

      const queueItem = emailQueue.queue[0];
      expect(queueItem.maxRetries).toBe(5);
    });

    test('should add metadata to queue item', () => {
      const emailData = { to: 'test@example.com', subject: 'With Metadata' };
      const metadata = { userId: 'user123', alertType: 'budget-exceeded' };

      emailQueue.addToQueue(emailData, { metadata });

      const queueItem = emailQueue.queue[0];
      expect(queueItem.metadata).toEqual(metadata);
    });

    test('should log email addition', () => {
      const emailData = { to: 'test@example.com', subject: 'Test' };
      
      emailQueue.addToQueue(emailData);

      expect(logger.info).toHaveBeenCalledWith('Email added to queue', {
        id: 'mock-uuid-123',
        to: 'test@example.com',
        subject: 'Test',
        priority: 'normal',
        queueSize: 1
      });
    });
  });

  describe('processQueue', () => {
    test('should not process if already processing', async () => {
      emailQueue.processing = true;
      
      await emailQueue.processQueue();
      
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    test('should process pending emails', async () => {
      const emailData = { to: 'test@example.com', subject: 'Test' };
      emailQueue.addToQueue(emailData);

      await emailQueue.processQueue();

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test',
        html: undefined,
        text: undefined,
        templateName: undefined,
        templateData: undefined
      });
    });

    test('should not process future scheduled emails', async () => {
      const futureTime = new Date(Date.now() + 3600000); // 1 hour from now
      const emailData = { to: 'test@example.com', subject: 'Future' };
      
      emailQueue.addToQueue(emailData, { scheduleAt: futureTime });

      await emailQueue.processQueue();

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    test('should not process emails that exceeded max retries', async () => {
      const emailData = { to: 'test@example.com', subject: 'Failed' };
      emailQueue.addToQueue(emailData);
      
      // Simulate max retries exceeded
      emailQueue.queue[0].attempts = 5;
      emailQueue.queue[0].maxRetries = 3;

      await emailQueue.processQueue();

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    test('should respect batch size limit', async () => {
      // Add more emails than batch size
      for (let i = 0; i < 10; i++) {
        emailQueue.addToQueue({ to: `test${i}@example.com`, subject: `Test ${i}` });
      }

      await emailQueue.processQueue();

      // Should only process batch size (5) emails
      expect(emailService.sendEmail).toHaveBeenCalledTimes(5);
    });

    test('should handle processing errors gracefully', async () => {
      emailService.sendEmail.mockRejectedValue(new Error('Send failed'));
      
      const emailData = { to: 'test@example.com', subject: 'Test' };
      emailQueue.addToQueue(emailData);

      await emailQueue.processQueue();

      expect(logger.error).toHaveBeenCalledWith('Error processing email queue:', expect.any(Error));
    });

    test('should set processing flag correctly', async () => {
      const emailData = { to: 'test@example.com', subject: 'Test' };
      emailQueue.addToQueue(emailData);

      const processPromise = emailQueue.processQueue();
      expect(emailQueue.processing).toBe(true);

      await processPromise;
      expect(emailQueue.processing).toBe(false);
    });
  });

  describe('processQueueItem', () => {
    test('should successfully process queue item', async () => {
      const queueItem = {
        id: 'test-id',
        emailData: { to: 'test@example.com', subject: 'Test' },
        attempts: 0,
        status: 'pending',
        maxRetries: 3
      };

      await emailQueue.processQueueItem(queueItem);

      expect(queueItem.status).toBe('sent');
      expect(queueItem.attempts).toBe(1);
      expect(queueItem.messageId).toBe('test-message-id');
      expect(queueItem.sentAt).toBeInstanceOf(Date);
      expect(queueItem.lastAttempt).toBeInstanceOf(Date);
    });

    test('should process template email', async () => {
      const queueItem = {
        id: 'test-id',
        emailData: {
          to: 'test@example.com',
          templateName: 'email-verification',
          templateData: { user: { name: 'Test' }, token: 'token' }
        },
        attempts: 0,
        status: 'pending',
        maxRetries: 3
      };

      await emailQueue.processQueueItem(queueItem);

      expect(emailService.sendEmailVerification).toHaveBeenCalledWith(
        { name: 'Test' },
        'token'
      );
      expect(queueItem.status).toBe('sent');
    });

    test('should handle processing failure and retry', async () => {
      emailService.sendEmail.mockRejectedValue(new Error('Network error'));
      
      const queueItem = {
        id: 'test-id',
        emailData: { to: 'test@example.com', subject: 'Test' },
        attempts: 0,
        status: 'pending',
        maxRetries: 3
      };

      await emailQueue.processQueueItem(queueItem);

      expect(queueItem.status).toBe('pending'); // Should remain pending for retry
      expect(queueItem.attempts).toBe(1);
      expect(queueItem.lastError).toBe('Network error');
    });

    test('should mark as failed after max retries', async () => {
      emailService.sendEmail.mockRejectedValue(new Error('Permanent error'));
      
      const queueItem = {
        id: 'test-id',
        emailData: { to: 'test@example.com', subject: 'Test' },
        attempts: 2,
        status: 'pending',
        maxRetries: 3
      };

      await emailQueue.processQueueItem(queueItem);

      expect(queueItem.status).toBe('failed');
      expect(queueItem.attempts).toBe(3);
      expect(queueItem.failedAt).toBeInstanceOf(Date);
    });

    test('should log processing attempts', async () => {
      const queueItem = {
        id: 'test-id',
        emailData: { to: 'test@example.com', subject: 'Test' },
        attempts: 0,
        status: 'pending',
        maxRetries: 3
      };

      await emailQueue.processQueueItem(queueItem);

      expect(logger.info).toHaveBeenCalledWith('Processing email queue item', {
        id: 'test-id',
        to: 'test@example.com',
        attempt: 1
      });

      expect(logger.info).toHaveBeenCalledWith('Email sent successfully', {
        id: 'test-id',
        to: 'test@example.com',
        messageId: 'test-message-id'
      });
    });
  });

  describe('sendTemplateEmail', () => {
    test('should send email verification template', async () => {
      const emailData = {
        templateName: 'email-verification',
        templateData: { user: { name: 'Test' }, token: 'verification-token' }
      };

      const result = await emailQueue.sendTemplateEmail(emailData);

      expect(emailService.sendEmailVerification).toHaveBeenCalledWith(
        { name: 'Test' },
        'verification-token'
      );
      expect(result.messageId).toBe('verification-message-id');
    });

    test('should send welcome template', async () => {
      const emailData = {
        templateName: 'welcome',
        templateData: { user: { name: 'Test User' } }
      };

      await emailQueue.sendTemplateEmail(emailData);

      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith({ name: 'Test User' });
    });

    test('should send security alert template', async () => {
      const emailData = {
        templateName: 'security-alert',
        templateData: {
          user: { name: 'Test' },
          alertData: { type: 'login', location: 'US' }
        }
      };

      await emailQueue.sendTemplateEmail(emailData);

      expect(emailService.sendSecurityAlertEmail).toHaveBeenCalledWith(
        { name: 'Test' },
        { type: 'login', location: 'US' }
      );
    });

    test('should send goal reminder template', async () => {
      const emailData = {
        templateName: 'goal-reminder',
        templateData: {
          user: { name: 'Test' },
          goalData: { title: 'Save $1000', progress: 50 }
        }
      };

      await emailQueue.sendTemplateEmail(emailData);

      expect(emailService.sendGoalReminder).toHaveBeenCalledWith(
        { name: 'Test' },
        { title: 'Save $1000', progress: 50 }
      );
    });

    test('should send export/import complete templates', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Export Complete',
        templateName: 'export-complete',
        templateData: { fileName: 'export.csv' }
      };

      await emailQueue.sendTemplateEmail(emailData);

      expect(emailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Export Complete',
        template: 'export-complete',
        data: { fileName: 'export.csv' }
      });
    });

    test('should handle budget templates', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Budget Alert',
        templateName: 'budget-exceeded',
        templateData: { budgetName: 'Groceries', amount: 500 }
      };

      await emailQueue.sendTemplateEmail(emailData);

      expect(emailService.loadTemplate).toHaveBeenCalledWith(
        'budget-exceeded',
        { budgetName: 'Groceries', amount: 500 },
        'html'
      );
      expect(emailService.loadTemplate).toHaveBeenCalledWith(
        'budget-exceeded',
        { budgetName: 'Groceries', amount: 500 },
        'txt'
      );
      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Budget Alert',
        html: '<html>Template</html>',
        text: '<html>Template</html>'
      });
    });

    test('should throw error for unknown template', async () => {
      const emailData = { templateName: 'unknown-template' };

      await expect(emailQueue.sendTemplateEmail(emailData))
        .rejects.toThrow('Unknown template: unknown-template');
    });
  });

  describe('sendBudgetTemplateEmail', () => {
    test('should load templates and send budget email', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Budget Warning',
        templateName: 'budget-warning',
        templateData: { budgetName: 'Food', spent: 400, limit: 500 }
      };

      const result = await emailQueue.sendBudgetTemplateEmail(emailData);

      expect(emailService.loadTemplate).toHaveBeenCalledTimes(2);
      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Budget Warning',
        html: '<html>Template</html>',
        text: '<html>Template</html>'
      });
      expect(result.messageId).toBe('test-message-id');
    });

    test('should handle template loading errors', async () => {
      emailService.loadTemplate.mockRejectedValue(new Error('Template not found'));
      
      const emailData = {
        templateName: 'budget-exceeded',
        templateData: {}
      };

      await expect(emailQueue.sendBudgetTemplateEmail(emailData))
        .rejects.toThrow('Template not found');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send budget template email budget-exceeded:',
        expect.any(Error)
      );
    });
  });

  describe('Queue Management', () => {
    test('should remove item from queue', () => {
      emailQueue.addToQueue({ to: 'test1@example.com', subject: 'Test 1' });
      emailQueue.addToQueue({ to: 'test2@example.com', subject: 'Test 2' });
      
      expect(emailQueue.queue).toHaveLength(2);
      
      emailQueue.removeFromQueue('mock-uuid-123');
      
      expect(emailQueue.queue).toHaveLength(1);
    });

    test('should handle removing non-existent item', () => {
      emailQueue.addToQueue({ to: 'test@example.com', subject: 'Test' });
      
      emailQueue.removeFromQueue('non-existent-id');
      
      expect(emailQueue.queue).toHaveLength(1);
    });

    test('should get queue status', () => {
      // Add emails with different statuses
      emailQueue.addToQueue({ to: 'test1@example.com', subject: 'Test 1' });
      emailQueue.addToQueue({ to: 'test2@example.com', subject: 'Test 2' });
      
      emailQueue.queue[0].status = 'sent';
      emailQueue.queue[1].status = 'failed';
      emailQueue.processing = true;

      const status = emailQueue.getQueueStatus();

      expect(status).toEqual({
        total: 2,
        pending: 0,
        processing: 0,
        failed: 1,
        sent: 1,
        isProcessing: true
      });
    });

    test('should get failed emails', () => {
      emailQueue.addToQueue({ to: 'test1@example.com', subject: 'Test 1' });
      emailQueue.addToQueue({ to: 'test2@example.com', subject: 'Test 2' });
      emailQueue.addToQueue({ to: 'test3@example.com', subject: 'Test 3' });
      
      emailQueue.queue[0].status = 'sent';
      emailQueue.queue[1].status = 'failed';
      emailQueue.queue[2].status = 'pending';

      const failedEmails = emailQueue.getFailedEmails();

      expect(failedEmails).toHaveLength(1);
      expect(failedEmails[0].emailData.to).toBe('test2@example.com');
    });

    test('should retry failed email', () => {
      emailQueue.addToQueue({ to: 'test@example.com', subject: 'Test' });
      emailQueue.queue[0].status = 'failed';
      emailQueue.queue[0].attempts = 3;
      emailQueue.queue[0].lastError = 'Previous error';

      const result = emailQueue.retryFailedEmail('mock-uuid-123');

      expect(result).toBe(true);
      expect(emailQueue.queue[0].status).toBe('pending');
      expect(emailQueue.queue[0].attempts).toBe(0);
      expect(emailQueue.queue[0].lastError).toBeNull();
      expect(logger.info).toHaveBeenCalledWith('Email marked for retry', { id: 'mock-uuid-123' });
    });

    test('should not retry non-existent or non-failed email', () => {
      emailQueue.addToQueue({ to: 'test@example.com', subject: 'Test' });
      emailQueue.queue[0].status = 'sent'; // Not failed

      const result = emailQueue.retryFailedEmail('mock-uuid-123');

      expect(result).toBe(false);
    });
  });

  describe('Cleanup Operations', () => {
    test('should cleanup old failed emails', () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

      // Add old failed email
      emailQueue.addToQueue({ to: 'old@example.com', subject: 'Old' });
      emailQueue.queue[0].status = 'failed';
      emailQueue.queue[0].failedAt = oldDate;

      // Add recent failed email
      emailQueue.addToQueue({ to: 'recent@example.com', subject: 'Recent' });
      emailQueue.queue[1].status = 'failed';
      emailQueue.queue[1].failedAt = recentDate;

      // Add non-failed email
      emailQueue.addToQueue({ to: 'pending@example.com', subject: 'Pending' });

      emailQueue.cleanupFailedEmails(24);

      expect(emailQueue.queue).toHaveLength(2);
      expect(emailQueue.queue.find(item => item.emailData.to === 'old@example.com')).toBeUndefined();
      expect(emailQueue.queue.find(item => item.emailData.to === 'recent@example.com')).toBeDefined();
      expect(emailQueue.queue.find(item => item.emailData.to === 'pending@example.com')).toBeDefined();
      
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 1 failed emails older than 24 hours');
    });

    test('should not log if no emails cleaned up', () => {
      emailQueue.addToQueue({ to: 'test@example.com', subject: 'Test' });
      
      emailQueue.cleanupFailedEmails(24);
      
      expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Cleaned up'));
    });
  });

  describe('Priority and Scheduling', () => {
    test('should send priority email immediately', async () => {
      const emailData = { to: 'priority@example.com', subject: 'Priority' };

      const result = await emailQueue.sendPriorityEmail(emailData);

      expect(emailService.sendEmail).toHaveBeenCalledWith(emailData);
      expect(result.messageId).toBe('test-message-id');
      expect(logger.info).toHaveBeenCalledWith('Sending priority email', { to: 'priority@example.com' });
    });

    test('should add priority email to queue if sending fails', async () => {
      emailService.sendEmail.mockRejectedValue(new Error('Send failed'));
      
      const emailData = { to: 'priority@example.com', subject: 'Priority' };

      await expect(emailQueue.sendPriorityEmail(emailData)).rejects.toThrow('Send failed');
      
      expect(emailQueue.queue).toHaveLength(1);
      expect(emailQueue.queue[0].priority).toBe('high');
      expect(logger.error).toHaveBeenCalledWith('Failed to send priority email:', expect.any(Error));
    });

    test('should schedule email for future delivery', () => {
      const scheduleAt = new Date(Date.now() + 3600000);
      const emailData = { to: 'scheduled@example.com', subject: 'Scheduled' };

      const queueId = emailQueue.scheduleEmail(emailData, scheduleAt);

      expect(queueId).toBe('mock-uuid-123');
      expect(emailQueue.queue[0].scheduledAt).toEqual(scheduleAt);
    });
  });

  describe('Recent Emails Filtering', () => {
    test('should get recent emails for user with metadata filters', () => {
      const cutoffTime = new Date(Date.now() - 60000); // 1 minute ago
      const recentTime = new Date();

      // Add old email (should be filtered out)
      emailQueue.addToQueue(
        { to: 'old@example.com', subject: 'Old' },
        { metadata: { userId: 'user123', alertType: 'budget-exceeded' } }
      );
      emailQueue.queue[0].createdAt = new Date(Date.now() - 120000); // 2 minutes ago

      // Add recent matching email
      emailQueue.addToQueue(
        { to: 'recent@example.com', subject: 'Recent' },
        { metadata: { userId: 'user123', alertType: 'budget-exceeded', budgetId: 'budget456' } }
      );
      emailQueue.queue[1].createdAt = recentTime;

      // Add recent non-matching email (different user)
      emailQueue.addToQueue(
        { to: 'other@example.com', subject: 'Other' },
        { metadata: { userId: 'user456', alertType: 'budget-exceeded' } }
      );
      emailQueue.queue[2].createdAt = recentTime;

      const recentEmails = emailQueue.getRecentEmails('user123', cutoffTime, {
        userId: 'user123',
        alertType: 'budget-exceeded'
      });

      expect(recentEmails).toHaveLength(1);
      expect(recentEmails[0].emailData.to).toBe('recent@example.com');
    });

    test('should filter by budget ID', () => {
      const cutoffTime = new Date(Date.now() - 60000);
      const recentTime = new Date();

      emailQueue.addToQueue(
        { to: 'budget1@example.com', subject: 'Budget 1' },
        { metadata: { userId: 'user123', budgetId: 'budget123' } }
      );
      emailQueue.queue[0].createdAt = recentTime;

      emailQueue.addToQueue(
        { to: 'budget2@example.com', subject: 'Budget 2' },
        { metadata: { userId: 'user123', budgetId: 'budget456' } }
      );
      emailQueue.queue[1].createdAt = recentTime;

      const recentEmails = emailQueue.getRecentEmails('user123', cutoffTime, {
        budgetId: 'budget123'
      });

      expect(recentEmails).toHaveLength(1);
      expect(recentEmails[0].emailData.to).toBe('budget1@example.com');
    });

    test('should filter by category ID', () => {
      const cutoffTime = new Date(Date.now() - 60000);
      const recentTime = new Date();

      emailQueue.addToQueue(
        { to: 'category1@example.com', subject: 'Category 1' },
        { metadata: { userId: 'user123', categoryId: 'cat123' } }
      );
      emailQueue.queue[0].createdAt = recentTime;

      emailQueue.addToQueue(
        { to: 'category2@example.com', subject: 'Category 2' },
        { metadata: { userId: 'user123', categoryId: 'cat456' } }
      );
      emailQueue.queue[1].createdAt = recentTime;

      const recentEmails = emailQueue.getRecentEmails('user123', cutoffTime, {
        categoryId: 'cat123'
      });

      expect(recentEmails).toHaveLength(1);
      expect(recentEmails[0].emailData.to).toBe('category1@example.com');
    });

    test('should return empty array if no recent emails match', () => {
      const cutoffTime = new Date();
      
      const recentEmails = emailQueue.getRecentEmails('user123', cutoffTime, {
        alertType: 'budget-exceeded'
      });

      expect(recentEmails).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle email service errors gracefully', async () => {
      emailService.sendEmail.mockRejectedValue(new Error('SMTP error'));
      
      const emailData = { to: 'test@example.com', subject: 'Test' };
      emailQueue.addToQueue(emailData);

      await emailQueue.processQueue();

      expect(emailQueue.queue[0].status).toBe('pending');
      expect(emailQueue.queue[0].lastError).toBe('SMTP error');
    });

    test('should handle template email errors', async () => {
      emailService.sendEmailVerification.mockRejectedValue(new Error('Template error'));
      
      const queueItem = {
        id: 'test-id',
        emailData: {
          templateName: 'email-verification',
          templateData: { user: {}, token: 'token' }
        },
        attempts: 0,
        status: 'pending',
        maxRetries: 3
      };

      await emailQueue.processQueueItem(queueItem);

      expect(queueItem.status).toBe('pending');
      expect(queueItem.lastError).toBe('Template error');
    });
  });

  describe('Performance Tests', () => {
    test('should handle large queue efficiently', async () => {
      const startTime = Date.now();
      
      // Add 100 emails to queue
      for (let i = 0; i < 100; i++) {
        emailQueue.addToQueue({ to: `test${i}@example.com`, subject: `Test ${i}` });
      }
      
      const addTime = Date.now() - startTime;
      expect(addTime).toBeLessThan(1000); // Should add 100 emails in less than 1 second
      expect(emailQueue.queue).toHaveLength(100);
    });

    test('should process queue in batches', async () => {
      // Add more emails than batch size
      for (let i = 0; i < 15; i++) {
        emailQueue.addToQueue({ to: `test${i}@example.com`, subject: `Test ${i}` });
      }

      await emailQueue.processQueue();

      // Should only process batch size (5) in one run
      expect(emailService.sendEmail).toHaveBeenCalledTimes(5);
      expect(emailQueue.queue.filter(item => item.status === 'sent')).toHaveLength(5);
    });

    test('should handle concurrent processing safely', async () => {
      for (let i = 0; i < 10; i++) {
        emailQueue.addToQueue({ to: `test${i}@example.com`, subject: `Test ${i}` });
      }

      // Try to process queue multiple times concurrently
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(emailQueue.processQueue());
      }

      await Promise.all(promises);

      // Should only process emails once (not duplicate processing)
      expect(emailService.sendEmail).toHaveBeenCalledTimes(5); // Batch size limit
    });
  });

  describe('Integration with Cron', () => {
    test('should setup cron jobs correctly', () => {
      expect(cron.schedule).toHaveBeenCalledWith('*/30 * * * * *', expect.any(Function));
      expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
    });

    test('should trigger queue processing via cron', async () => {
      // Get the cron callback function
      const cronCallback = cron.schedule.mock.calls[0][1];
      
      emailQueue.addToQueue({ to: 'test@example.com', subject: 'Cron Test' });
      
      // Execute the cron callback
      cronCallback();

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    test('should trigger cleanup via cron', () => {
      // Add old failed email
      emailQueue.addToQueue({ to: 'old@example.com', subject: 'Old' });
      emailQueue.queue[0].status = 'failed';
      emailQueue.queue[0].failedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);

      // Get the cleanup cron callback function
      const cleanupCallback = cron.schedule.mock.calls[1][1];
      
      // Execute the cleanup cron callback
      cleanupCallback();
      
      expect(emailQueue.queue).toHaveLength(0);
    });
  });
});
