/**
 * Email Queue Service
 * Manages email queue for reliable delivery and rate limiting
 */

const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const emailService = require('./email.service');

class EmailQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.emailService = emailService;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    this.batchSize = 5; // Process 5 emails at a time
    this.processInterval = 30000; // Process queue every 30 seconds
    this.cronTasks = [];
    
    this.initializeQueue();
  }

  /**
   * Initialize the email queue processing
   */
  initializeQueue() {
    // Don't start cron jobs during tests
    if (process.env.NODE_ENV === 'test') {
      logger.info('Email queue cron jobs disabled during tests');
      return;
    }

    // Process queue every 30 seconds
    const processTask = cron.schedule('*/30 * * * * *', () => {
      if (!this.processing && this.queue.length > 0) {
        this.processQueue();
      }
    });
    this.cronTasks.push(processTask);

    // Cleanup old failed emails every hour
    const cleanupTask = cron.schedule('0 * * * *', () => {
      this.cleanupFailedEmails();
    });
    this.cronTasks.push(cleanupTask);

    logger.info('Email queue initialized with cron scheduling');
  }

  /**
   * Stop all cron tasks
   */
  stopQueue() {
    this.cronTasks.forEach(task => {
      if (task && typeof task.stop === 'function') {
        task.stop();
      }
    });
    this.cronTasks = [];
    logger.info('Email queue cron tasks stopped');
  }
  /**
   * Add email to queue
   * @param {Object} emailData - Email data
   * @param {Object} options - Queue options
   * @returns {string} - Queue item ID
   */
  addToQueue(emailData, options = {}) {
    const queueItem = {
      id: uuidv4(),
      emailData: {
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        templateName: emailData.templateName,
        templateData: emailData.templateData
      },
      priority: options.priority || 'normal', // high, normal, low
      attempts: 0,
      maxRetries: options.maxRetries || this.maxRetries,
      scheduledAt: options.scheduleAt ? new Date(options.scheduleAt) : new Date(),
      createdAt: new Date(),
      status: 'pending', // pending, processing, sent, failed
      lastError: null,
      metadata: options.metadata || {}
    };

    // Insert based on priority
    if (queueItem.priority === 'high') {
      this.queue.unshift(queueItem);
    } else {
      this.queue.push(queueItem);
    }

    logger.info('Email added to queue', {
      id: queueItem.id,
      to: emailData.to,
      subject: emailData.subject,
      priority: queueItem.priority,
      queueSize: this.queue.length
    });

    return queueItem.id;
  }

  /**
   * Process the email queue
   */
  async processQueue() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    logger.info('Processing email queue', { queueSize: this.queue.length });

    try {
      const now = new Date();
      const readyEmails = this.queue
        .filter(item => 
          item.status === 'pending' && 
          item.scheduledAt <= now &&
          item.attempts < item.maxRetries
        )
        .slice(0, this.batchSize);

      if (readyEmails.length === 0) {
        this.processing = false;
        return;
      }

      const processingPromises = readyEmails.map(async (queueItem) => {
        return this.processQueueItem(queueItem);
      });

      await Promise.allSettled(processingPromises);

    } catch (error) {
      logger.error('Error processing email queue:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process individual queue item
   * @param {Object} queueItem - Queue item to process
   */
  async processQueueItem(queueItem) {
    try {
      queueItem.status = 'processing';
      queueItem.attempts++;
      queueItem.lastAttempt = new Date();

      logger.info('Processing email queue item', {
        id: queueItem.id,
        to: queueItem.emailData.to,
        attempt: queueItem.attempts
      });

      let result;
      
      // Send email using template if provided
      if (queueItem.emailData.templateName) {
        result = await this.sendTemplateEmail(queueItem.emailData);
      } else {
        result = await this.emailService.sendEmail(queueItem.emailData);
      }

      // Mark as sent
      queueItem.status = 'sent';
      queueItem.sentAt = new Date();
      queueItem.messageId = result.messageId;

      logger.info('Email sent successfully', {
        id: queueItem.id,
        to: queueItem.emailData.to,
        messageId: result.messageId
      });

      // Remove from queue
      this.removeFromQueue(queueItem.id);

    } catch (error) {
      logger.error('Failed to send email from queue', {
        id: queueItem.id,
        to: queueItem.emailData.to,
        attempt: queueItem.attempts,
        error: error.message
      });

      queueItem.lastError = error.message;
      queueItem.status = 'pending'; // Will retry if attempts < maxRetries

      // If max retries exceeded, mark as failed
      if (queueItem.attempts >= queueItem.maxRetries) {
        queueItem.status = 'failed';
        queueItem.failedAt = new Date();
        
        logger.error('Email permanently failed after max retries', {
          id: queueItem.id,
          to: queueItem.emailData.to,
          attempts: queueItem.attempts
        });
      }
    }
  }  /**
   * Send email using template
   * @param {Object} emailData - Email data with template info
   * @returns {Promise<Object>} - Send result
   */
  async sendTemplateEmail(emailData) {
    switch (emailData.templateName) {
      case 'email-verification':
        return await this.emailService.sendEmailVerification(
          emailData.templateData.user,
          emailData.templateData.token
        );
      
      case 'welcome':
        return await this.emailService.sendWelcomeEmail(
          emailData.templateData.user
        );
      
      case 'security-alert':
        return await this.emailService.sendSecurityAlertEmail(
          emailData.templateData.user,
          emailData.templateData.alertData
        );
      
      case 'budget-exceeded':
      case 'budget-warning':
      case 'category-overspend':
      case 'monthly-budget-summary':
        return await this.sendBudgetTemplateEmail(emailData);
      
      case 'goal-reminder':
        return await this.emailService.sendGoalReminder(
          emailData.templateData.user,
          emailData.templateData.goalData
        );
      
      case 'export-complete':
      case 'import-complete':
        return await this.emailService.sendTemplatedEmail({
          to: emailData.to,
          subject: emailData.subject,
          template: emailData.templateName,
          data: emailData.templateData
        });
      
      default:
        throw new Error(`Unknown template: ${emailData.templateName}`);
    }
  }

  /**
   * Send budget-related template email
   * @param {Object} emailData - Email data with budget template info
   * @returns {Promise<Object>} - Send result
   */
  async sendBudgetTemplateEmail(emailData) {
    try {
      // Load and compile the budget template
      const html = await this.emailService.loadTemplate(
        emailData.templateName, 
        emailData.templateData, 
        'html'
      );
      
      const text = await this.emailService.loadTemplate(
        emailData.templateName, 
        emailData.templateData, 
        'txt'
      );

      // Send the email
      return await this.emailService.sendEmail({
        to: emailData.to,
        subject: emailData.subject,
        html,
        text
      });
    } catch (error) {
      logger.error(`Failed to send budget template email ${emailData.templateName}:`, error);
      throw error;
    }
  }

  /**
   * Remove item from queue
   * @param {string} id - Queue item ID
   */
  removeFromQueue(id) {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * Get queue status
   * @returns {Object} - Queue statistics
   */
  getQueueStatus() {
    const stats = {
      total: this.queue.length,
      pending: 0,
      processing: 0,
      failed: 0,
      isProcessing: this.processing
    };

    this.queue.forEach(item => {
      stats[item.status] = (stats[item.status] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get failed emails
   * @returns {Array} - Failed email items
   */
  getFailedEmails() {
    return this.queue.filter(item => item.status === 'failed');
  }

  /**
   * Retry failed email
   * @param {string} id - Queue item ID
   * @returns {boolean} - Success status
   */
  retryFailedEmail(id) {
    const item = this.queue.find(item => item.id === id && item.status === 'failed');
    if (!item) {
      return false;
    }

    item.status = 'pending';
    item.attempts = 0;
    item.lastError = null;
    item.scheduledAt = new Date();

    logger.info('Email marked for retry', { id });
    return true;
  }

  /**
   * Clear failed emails older than specified hours
   * @param {number} hours - Hours threshold
   */
  cleanupFailedEmails(hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const initialLength = this.queue.length;
    
    this.queue = this.queue.filter(item => {
      if (item.status === 'failed' && item.failedAt < cutoff) {
        return false;
      }
      return true;
    });

    const removed = initialLength - this.queue.length;
    if (removed > 0) {
      logger.info(`Cleaned up ${removed} failed emails older than ${hours} hours`);
    }
  }

  /**
   * Priority email sending (bypasses queue)
   * @param {Object} emailData - Email data
   * @returns {Promise<Object>} - Send result
   */
  async sendPriorityEmail(emailData) {
    try {
      logger.info('Sending priority email', { to: emailData.to });
      return await this.emailService.sendEmail(emailData);
    } catch (error) {
      logger.error('Failed to send priority email:', error);
      // Add to queue as high priority for retry
      this.addToQueue(emailData, { priority: 'high' });
      throw error;
    }
  }
  /**
   * Schedule email for future delivery
   * @param {Date} scheduleAt - When to send the email
   * @returns {string} - Queue item ID
   */
  scheduleEmail(emailData, scheduleAt) {
    return this.addToQueue(emailData, { scheduleAt });
  }

  /**
   * Get recent emails for a user matching criteria
   * @param {string} userId - User ID
   * @param {Date} cutoffTime - Cutoff time for recent emails
   * @param {Object} metadata - Metadata criteria to match
   * @returns {Array} - Recent matching emails
   */
  getRecentEmails(userId, cutoffTime, metadata = {}) {
    return this.queue.filter(item => {
      // Check if email is recent
      if (item.createdAt < cutoffTime) {
        return false;
      }

      // Check if email is for the user (basic check by extracting from metadata)
      if (metadata.userId && item.metadata?.userId !== userId) {
        return false;
      }

      // Check metadata matches
      if (metadata.alertType && item.metadata?.alertType !== metadata.alertType) {
        return false;
      }

      if (metadata.budgetId && item.metadata?.budgetId !== metadata.budgetId) {
        return false;
      }

      if (metadata.categoryId && item.metadata?.categoryId !== metadata.categoryId) {
        return false;
      }

      return true;
    });
  }
}

// Create singleton instance
const emailQueue = new EmailQueue();

module.exports = emailQueue;
