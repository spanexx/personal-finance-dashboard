/**
 * Email Service
 * Handles all email functionality for the Personal Finance Dashboard
 */

// Accept self-signed certificates for SMTP (development only)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/environment');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.emailConfig = config.getEmailConfig();
    this.templatesCache = new Map();
    this.initializeTransporter();
  }
  /**
   * Initialize the email transporter
   */
  async initializeTransporter() {
    try {      if (!this.emailConfig.enabled) {
        logger.info('Email service is disabled');
        return;
      }

      // Handle SendGrid separately using official SDK
      if (this.emailConfig.provider === 'sendgrid') {
        logger.info('Configuring SendGrid email service');
        sgMail.setApiKey(this.emailConfig.sendgrid.apiKey);
        this.usingSendGrid = true;
        logger.info('SendGrid email service initialized successfully');
        return;
      }

      // Choose transporter based on configuration
      const transporterConfig = this.getTransporterConfig();
      this.transporter = nodemailer.createTransport(transporterConfig);

      // Verify the connection
      await this.transporter.verify();
      logger.info(`Email service initialized successfully with ${this.emailConfig.provider || 'SMTP'}`);
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.transporter = null;
    }
  }

  /**
   * Get transporter configuration based on provider
   * @returns {Object} - Transporter configuration
   */
  getTransporterConfig() {
    const provider = this.emailConfig.provider?.toLowerCase() || 'smtp';

    switch (provider) {
      case 'sendgrid':
        return this.getSendGridConfig();
      
      case 'mailgun':
        return this.getMailgunConfig();
      
      case 'ses':
      case 'amazon-ses':
        return this.getAmazonSESConfig();
      
      case 'smtp':
      default:
        return this.getSMTPConfig();
    }
  }

  /**
   * Get SendGrid configuration
   * @returns {Object} - SendGrid transporter config
   */
  getSendGridConfig() {
    logger.info('Configuring SendGrid email service');
    return {
      service: 'SendGrid',
      auth: {
        user: 'apikey', // SendGrid always uses 'apikey' as username
        pass: this.emailConfig.sendgrid.apiKey
      },
      // SendGrid specific options
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 10 // SendGrid allows higher rate limits
    };
  }

  /**
   * Get Mailgun configuration
   * @returns {Object} - Mailgun transporter config
   */
  getMailgunConfig() {
    logger.info('Configuring Mailgun email service');
    return {
      service: 'Mailgun',
      auth: {
        user: this.emailConfig.mailgun.username,
        pass: this.emailConfig.mailgun.apiKey
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100
    };
  }

  /**
   * Get Amazon SES configuration
   * @returns {Object} - Amazon SES transporter config
   */
  getAmazonSESConfig() {
    logger.info('Configuring Amazon SES email service');
    return {
      SES: {
        aws: {
          accessKeyId: this.emailConfig.ses.accessKeyId,
          secretAccessKey: this.emailConfig.ses.secretAccessKey,
          region: this.emailConfig.ses.region || 'us-east-1'
        }
      }
    };
  }

  /**
   * Get SMTP configuration
   * @returns {Object} - SMTP transporter config
   */
  getSMTPConfig() {
    logger.info('Configuring SMTP email service');
    return {
      host: this.emailConfig.smtp.host,
      port: this.emailConfig.smtp.port,
      secure: this.emailConfig.smtp.secure,
      auth: {
        user: this.emailConfig.smtp.auth.user,
        pass: this.emailConfig.smtp.auth.pass
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5
    };
  }
  /**
   * Send an email
   * @param {Object} options - Email options
   * @returns {Promise<Object>} - Send result
   */
  async sendEmail(options) {
    try {
      // Handle SendGrid separately
      if (this.usingSendGrid) {
        const msg = {
          to: options.to,
          from: {
            email: this.emailConfig.from.email,
            name: this.emailConfig.from.name
          },
          subject: options.subject,
          html: options.html,
          text: options.text || this.stripHtml(options.html)
        };

        const result = await sgMail.send(msg);
        
        logger.info(`Email sent successfully via SendGrid to ${options.to}`, {
          messageId: result[0].headers['x-message-id'],
          subject: options.subject
        });

        return { success: true, messageId: result[0].headers['x-message-id'] };
      }

      // Handle other providers via nodemailer
      if (!this.transporter) {
        if (process.env.NODE_ENV === 'development') {
          logger.info('Email would be sent:', options);
          return { success: true, messageId: 'dev-mode' };
        }
        throw new Error('Email service not available');
      }

      const mailOptions = {
        from: `${this.emailConfig.from.name} <${this.emailConfig.from.email}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html)
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info(`Email sent successfully to ${options.to}`, {
        messageId: result.messageId,
        subject: options.subject
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }
  /**
   * Send password reset email
   * @param {Object} user - User object
   * @param {string} resetToken - Reset token
   * @returns {Promise<Object>} - Send result
   */
  async sendPasswordResetEmail(user, resetToken) {
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
      
      const templateData = {
        firstName: user.firstName,
        email: user.email,
        resetUrl
      };

      const html = await this.loadTemplate('password-reset', templateData, 'html');
      const text = await this.loadTemplate('password-reset', templateData, 'txt');

      const result = await this.sendEmail({
        to: user.email,
        subject: 'Password Reset Request - Personal Finance Dashboard',
        html,
        text
      });

      logger.info('Password reset email sent successfully', {
        userId: user._id,
        email: user.email,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw error;
    }
  }
  /**
   * Send password change confirmation email
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Send result
   */
  async sendPasswordChangeConfirmation(user) {
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      
      const templateData = {
        firstName: user.firstName,
        email: user.email,
        dashboardUrl: `${baseUrl}/dashboard`,
        securityUrl: `${baseUrl}/account/security`
      };

      const html = await this.loadTemplate('password-changed', templateData, 'html');
      const text = await this.loadTemplate('password-changed', templateData, 'txt');

      const result = await this.sendEmail({
        to: user.email,
        subject: 'Password Changed Successfully - Personal Finance Dashboard',
        html,
        text
      });

      logger.info('Password change confirmation email sent successfully', {
        userId: user._id,
        email: user.email,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('Failed to send password change confirmation email:', error);
      throw error;
    }
  }
  /**
   * Send account verification email
   * @param {Object} user - User object
   * @param {string} verificationToken - Verification token
   * @returns {Promise<Object>} - Send result
   */
  async sendVerificationEmail(user, verificationToken) {
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;
      
      const templateData = {
        firstName: user.firstName,
        email: user.email,
        verificationUrl
      };

      const html = await this.loadTemplate('email-verification', templateData, 'html');
      const text = await this.loadTemplate('email-verification', templateData, 'txt');

      const result = await this.sendEmail({
        to: user.email,
        subject: 'Verify Your Account - Personal Finance Dashboard',
        html,
        text
      });

      logger.info('Account verification email sent successfully', {
        userId: user._id,
        email: user.email,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('Failed to send account verification email:', error);
      throw error;
    }
  }

  /**
   * Load and compile email template
   * @param {string} templateName - Template name (without extension)
   * @param {Object} data - Template data
   * @param {string} format - Template format ('html' or 'txt')
   * @returns {Promise<string>} - Compiled template
   */
  async loadTemplate(templateName, data, format = 'html') {
    try {
      const cacheKey = `${templateName}-${format}`;
      
      // Check cache first
      if (this.templatesCache.has(cacheKey)) {
        const compiledTemplate = this.templatesCache.get(cacheKey);
        return compiledTemplate(data);
      }

      // Load template file
      const templatePath = path.join(__dirname, '..', 'templates', 'email', `${templateName}.${format === 'html' ? 'hbs' : 'txt'}`);
      const templateSource = await fs.readFile(templatePath, 'utf8');
      
      // Compile template
      const compiledTemplate = handlebars.compile(templateSource);
      
      // Cache compiled template
      this.templatesCache.set(cacheKey, compiledTemplate);
      
      // Generate final content
      return compiledTemplate(data);
    } catch (error) {
      logger.error(`Failed to load email template ${templateName}:`, error);
      throw new Error(`Email template ${templateName} not found`);
    }
  }

  /**
   * Send email verification email
   * @param {Object} user - User object
   * @param {string} verificationToken - Verification token
   * @returns {Promise<Object>} - Send result
   */
  async sendEmailVerification(user, verificationToken) {
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;
      
      const templateData = {
        firstName: user.firstName,
        email: user.email,
        verificationUrl
      };

      const html = await this.loadTemplate('email-verification', templateData, 'html');
      const text = await this.loadTemplate('email-verification', templateData, 'txt');

      const result = await this.sendEmail({
        to: user.email,
        subject: 'Verify Your Email - Personal Finance Dashboard',
        html,
        text
      });

      logger.info('Email verification sent successfully', {
        userId: user._id,
        email: user.email,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('Failed to send email verification:', error);
      throw error;
    }
  }

  /**
   * Send welcome email after email verification
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Send result
   */
  async sendWelcomeEmail(user) {
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      
      const templateData = {
        firstName: user.firstName,
        email: user.email,
        dashboardUrl: `${baseUrl}/dashboard`,
        helpUrl: `${baseUrl}/help`
      };

      const html = await this.loadTemplate('welcome', templateData, 'html');
      
      const result = await this.sendEmail({
        to: user.email,
        subject: '🎉 Welcome to Personal Finance Dashboard!',
        html
      });

      logger.info('Welcome email sent successfully', {
        userId: user._id,
        email: user.email,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  /**
   * Send security alert email
   * @param {Object} user - User object
   * @param {Object} alertData - Alert information
   * @returns {Promise<Object>} - Send result
   */
  async sendSecurityAlertEmail(user, alertData) {
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      
      const templateData = {
        firstName: user.firstName,
        email: user.email,
        accountId: user._id.toString().substring(0, 8),
        alertType: alertData.type,
        alertMessage: alertData.message,
        activityType: alertData.activityType,
        timestamp: new Date(alertData.timestamp).toLocaleString(),
        ipAddress: alertData.ipAddress,
        location: alertData.location || 'Unknown',
        userAgent: alertData.userAgent || 'Unknown',
        isHighRisk: alertData.riskLevel === 'high',
        secureAccountUrl: `${baseUrl}/account/security`,
        changePasswordUrl: `${baseUrl}/account/change-password`
      };

      const html = await this.loadTemplate('security-alert', templateData, 'html');
      const text = await this.loadTemplate('security-alert', templateData, 'txt');

      const result = await this.sendEmail({
        to: user.email,
        subject: `🚨 Security Alert - ${alertData.type}`,
        html,
        text
      });

      logger.info('Security alert email sent successfully', {
        userId: user._id,
        email: user.email,
        alertType: alertData.type,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('Failed to send security alert email:', error);
      throw error;
    }
  }

  /**
   * Send bulk emails with rate limiting
   * @param {Array} emailList - List of email objects
   * @param {Object} options - Bulk email options
   * @returns {Promise<Object>} - Bulk send result
   */
  async sendBulkEmails(emailList, options = {}) {
    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    const batchSize = options.batchSize || 10;
    const delay = options.delay || 1000; // 1 second delay between batches

    for (let i = 0; i < emailList.length; i += batchSize) {
      const batch = emailList.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (emailData) => {
        try {
          await this.sendEmail(emailData);
          results.sent++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            email: emailData.to,
            error: error.message
          });
          logger.error(`Failed to send bulk email to ${emailData.to}:`, error);
        }
      });

      await Promise.all(batchPromises);

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < emailList.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.info('Bulk email sending completed', results);
    return results;
  }

  /**
   * Strip HTML tags from text
   * @param {string} html - HTML string
   * @returns {string} - Plain text
   */
  stripHtml(html) {
    return html ? html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
  }
  /**
   * Test email configuration
   * @returns {Promise<boolean>} - Test result
   */
  async testConnection() {
    try {
      // For SendGrid, test by checking if API key is configured
      if (this.usingSendGrid) {
        if (!this.emailConfig.sendgrid.apiKey) {
          throw new Error('SendGrid API key not configured');
        }
        // SendGrid doesn't have a traditional "verify" method, but we can check if it's initialized
        logger.info('SendGrid connection test: API key is configured');
        return true;
      }

      // For other providers, use nodemailer verify
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }
      
      await this.transporter.verify();
      return true;    } catch (error) {
      logger.error('Email connection test failed:', error);
      return false;
    }
  }

  /**
   * Send export completion notification
   */
  async sendExportNotification(email, exportData) {
    try {
      const { exportType, format, fileName, downloadUrl, fileSize } = exportData;
      
      const templateData = {
        exportType: exportType.charAt(0).toUpperCase() + exportType.slice(1),
        format: format.toUpperCase(),
        fileName,
        downloadUrl,
        fileSize: this.formatFileSize(fileSize || 0)
      };

      return await this.sendTemplatedEmail({
        to: email,
        subject: 'Your Data Export is Ready for Download',
        template: 'export-complete',
        data: templateData,
        priority: 'normal'
      });
    } catch (error) {
      logger.error('Failed to send export notification:', error);
      throw error;
    }
  }

  /**
   * Send import completion notification
   */
  async sendImportNotification(email, importData) {
    try {
      const { 
        importType, 
        fileName, 
        recordsProcessed, 
        recordsImported, 
        errors = [] 
      } = importData;
      
      const recordsSkipped = recordsProcessed - recordsImported - errors.length;
      const successRate = recordsProcessed > 0 
        ? Math.round((recordsImported / recordsProcessed) * 100) 
        : 0;

      const templateData = {
        importType: importType.charAt(0).toUpperCase() + importType.slice(1),
        fileName,
        recordsProcessed: recordsProcessed || 0,
        recordsImported: recordsImported || 0,
        recordsSkipped: recordsSkipped || 0,
        errorCount: errors.length,
        successRate,
        processingTime: 'Completed',
        errors: errors.slice(0, 10), // Limit to first 10 errors
        warnings: [] // Can be expanded later
      };

      return await this.sendTemplatedEmail({
        to: email,
        subject: 'Your Data Import Has Been Completed',
        template: 'import-complete',
        data: templateData,
        priority: 'normal'
      });
    } catch (error) {
      logger.error('Failed to send import notification:', error);
      throw error;
    }
  }

  /**
   * Send templated email using template system
   * @param {Object} options - Email options with template
   * @returns {Promise<Object>} - Send result
   */
  async sendTemplatedEmail(options) {
    try {
      const { to, subject, template, data, priority = 'normal' } = options;
      
      // Load templates
      const html = await this.loadTemplate(template, data, 'html');
      const text = await this.loadTemplate(template, data, 'txt');

      // Send email
      const result = await this.sendEmail({
        to,
        subject,
        html,
        text
      });

      logger.info('Templated email sent successfully', {
        to,
        template,
        subject,
        priority,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('Failed to send templated email:', error);
      throw error;
    }
  }

  /**
   * Send goal reminder email
   * @param {Object} user - User object
   * @param {Object} goalData - Goal data with reminder information
   * @returns {Promise<Object>} - Send result
   */
  async sendGoalReminder(user, goalData) {
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      
      const templateData = {
        firstName: user.firstName,
        email: user.email,
        appName: 'Personal Finance Dashboard',
        goalName: goalData.name,
        goalDescription: goalData.description,
        targetAmount: goalData.targetAmount,
        currentAmount: goalData.currentAmount,
        progressPercentage: goalData.progressPercentage,
        timeRemaining: goalData.timeRemaining,
        daysRemaining: goalData.daysRemaining,
        targetDate: goalData.targetDate,
        category: goalData.category,
        priority: goalData.priority,
        motivationalMessage: goalData.motivationalMessage,
        personalizedInsights: goalData.personalizedInsights,
        milestones: goalData.milestones || [],
        dashboardUrl: `${baseUrl}/dashboard`,
        goalUrl: `${baseUrl}/goals/${goalData._id}`,
        settingsUrl: `${baseUrl}/settings/notifications`,
        supportUrl: `${baseUrl}/help`
      };

      const html = await this.loadTemplate('goal-reminder', templateData, 'html');
      const text = await this.loadTemplate('goal-reminder', templateData, 'txt');

      const result = await this.sendEmail({
        to: user.email,
        subject: goalData.emailSubject || `🎯 Goal Reminder: ${goalData.name}`,
        html,
        text
      });

      logger.info('Goal reminder email sent successfully', {
        userId: user._id,
        email: user.email,
        goalId: goalData._id,
        goalName: goalData.name,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('Failed to send goal reminder email:', error);
      throw error;
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
