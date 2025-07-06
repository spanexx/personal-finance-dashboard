/**
 * Email Service Unit Tests
 * Comprehensive test suite for email functionality
 */

const EmailService = require('../../services/email.service');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config/environment');
const logger = require('../../utils/logger');

// Mock dependencies
jest.mock('nodemailer');
jest.mock('@sendgrid/mail');
jest.mock('handlebars');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    access: jest.fn()
  }
}));
jest.mock('../../config/environment');
jest.mock('../../utils/logger');

describe('EmailService', () => {
  let emailService;
  let mockTransporter;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock config
    config.getEmailConfig.mockReturnValue({
      enabled: true,
      provider: 'smtp',
      smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@gmail.com',
          pass: 'password'
        }
      },
      sendgrid: {
        apiKey: 'SG.test-api-key'
      },
      mailgun: {
        domain: 'test.mailgun.org',
        apiKey: 'test-mailgun-key'
      },
      ses: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        region: 'us-east-1'
      },
      from: {
        name: 'Finance Dashboard',
        email: 'noreply@financedashboard.com'
      }
    });

    // Mock nodemailer transporter
    mockTransporter = {
      verify: jest.fn().mockResolvedValue(true),
      sendMail: jest.fn().mockResolvedValue({
        messageId: 'test-message-id',
        accepted: ['test@example.com'],
        rejected: []
      })
    };
    nodemailer.createTransporter.mockReturnValue(mockTransporter);

    // Mock handlebars
    handlebars.compile.mockReturnValue(jest.fn().mockReturnValue('compiled template'));

    // Create new instance for each test
    emailService = require('../../services/email.service');
  });

  describe('Initialization', () => {
    it('should initialize SMTP transporter successfully', async () => {
      expect(nodemailer.createTransporter).toHaveBeenCalled();
      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Email service initialized successfully')
      );
    });

    it('should initialize SendGrid when provider is sendgrid', async () => {
      config.getEmailConfig.mockReturnValue({
        enabled: true,
        provider: 'sendgrid',
        sendgrid: { apiKey: 'SG.test-key' }
      });

      // Create new instance to test SendGrid initialization
      const sendGridService = new (require('../../services/email.service').constructor)();
      await sendGridService.initializeTransporter();

      expect(sgMail.setApiKey).toHaveBeenCalledWith('SG.test-key');
      expect(sendGridService.usingSendGrid).toBe(true);
    });

    it('should handle disabled email service', async () => {
      config.getEmailConfig.mockReturnValue({
        enabled: false
      });

      const disabledService = new (require('../../services/email.service').constructor)();
      await disabledService.initializeTransporter();

      expect(logger.info).toHaveBeenCalledWith('Email service is disabled');
      expect(nodemailer.createTransporter).not.toHaveBeenCalled();
    });

    it('should handle transporter verification failure', async () => {
      const verificationError = new Error('SMTP connection failed');
      mockTransporter.verify.mockRejectedValue(verificationError);

      const failedService = new (require('../../services/email.service').constructor)();
      await failedService.initializeTransporter();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to initialize email service:',
        verificationError
      );
      expect(failedService.transporter).toBeNull();
    });
  });

  describe('getTransporterConfig', () => {
    it('should return SMTP config by default', () => {
      const result = emailService.getSMTPConfig();

      expect(result).toEqual({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@gmail.com',
          pass: 'password'
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5
      });
    });

    it('should return SendGrid config for sendgrid provider', () => {
      config.getEmailConfig.mockReturnValue({
        provider: 'sendgrid',
        sendgrid: { apiKey: 'SG.test-key' }
      });

      const result = emailService.getSendGridConfig();

      expect(result).toEqual({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: 'SG.test-key'
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 10
      });
    });

    it('should return Mailgun config for mailgun provider', () => {
      config.getEmailConfig.mockReturnValue({
        provider: 'mailgun',
        mailgun: {
          domain: 'test.mailgun.org',
          apiKey: 'test-mailgun-key'
        }
      });

      const result = emailService.getMailgunConfig();

      expect(result).toEqual({
        service: 'Mailgun',
        auth: {
          user: 'test-mailgun-key',
          pass: 'test.mailgun.org'
        },
        pool: true,
        maxConnections: 3,
        maxMessages: 50,
        rateDelta: 1000,
        rateLimit: 3
      });
    });

    it('should return Amazon SES config for ses provider', () => {
      config.getEmailConfig.mockReturnValue({
        provider: 'ses',
        ses: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
          region: 'us-east-1'
        }
      });

      const result = emailService.getAmazonSESConfig();

      expect(result).toEqual({
        SES: {
          aws: {
            accessKeyId: 'test-access-key',
            secretAccessKey: 'test-secret-key',
            region: 'us-east-1'
          }
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 10,
        rateDelta: 1000,
        rateLimit: 1
      });
    });
  });

  describe('sendEmail', () => {
    const emailOptions = {
      to: 'test@example.com',
      subject: 'Test Subject',
      text: 'Test message',
      html: '<p>Test message</p>'
    };

    it('should send email successfully with SMTP', async () => {
      emailService.transporter = mockTransporter;

      const result = await emailService.sendEmail(emailOptions);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'Finance Dashboard <noreply@financedashboard.com>',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test message',
        html: '<p>Test message</p>'
      });
      expect(result.messageId).toBe('test-message-id');
      expect(result.accepted).toEqual(['test@example.com']);
    });

    it('should send email successfully with SendGrid', async () => {
      emailService.usingSendGrid = true;
      sgMail.send.mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'sendgrid-message-id' }
      }]);

      const result = await emailService.sendEmail(emailOptions);

      expect(sgMail.send).toHaveBeenCalledWith({
        from: 'Finance Dashboard <noreply@financedashboard.com>',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test message',
        html: '<p>Test message</p>'
      });
      expect(result.messageId).toBe('sendgrid-message-id');
      expect(result.provider).toBe('sendgrid');
    });

    it('should handle multiple recipients', async () => {
      emailService.transporter = mockTransporter;
      const multiRecipientOptions = {
        ...emailOptions,
        to: ['test1@example.com', 'test2@example.com']
      };

      await emailService.sendEmail(multiRecipientOptions);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['test1@example.com', 'test2@example.com']
        })
      );
    });

    it('should handle email sending failure', async () => {
      emailService.transporter = mockTransporter;
      const sendError = new Error('SMTP send failed');
      mockTransporter.sendMail.mockRejectedValue(sendError);

      await expect(emailService.sendEmail(emailOptions))
        .rejects.toThrow('SMTP send failed');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send email:',
        sendError
      );
    });

    it('should throw error when email service is not initialized', async () => {
      emailService.transporter = null;
      emailService.usingSendGrid = false;

      await expect(emailService.sendEmail(emailOptions))
        .rejects.toThrow('Email service not initialized');
    });

    it('should include attachments when provided', async () => {
      emailService.transporter = mockTransporter;
      const emailWithAttachments = {
        ...emailOptions,
        attachments: [
          {
            filename: 'report.pdf',
            path: '/path/to/report.pdf'
          }
        ]
      };

      await emailService.sendEmail(emailWithAttachments);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            {
              filename: 'report.pdf',
              path: '/path/to/report.pdf'
            }
          ]
        })
      );
    });
  });

  describe('Template Methods', () => {
    const templateData = {
      user: { firstName: 'John', lastName: 'Doe' },
      resetUrl: 'http://example.com/reset'
    };

    beforeEach(() => {
      fs.readFile.mockResolvedValue('<p>Hello {{user.firstName}}</p>');
      fs.access.mockResolvedValue();
    });

    it('should load and compile template successfully', async () => {
      const template = await emailService.loadTemplate('password-reset');

      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('password-reset.hbs'),
        'utf8'
      );
      expect(handlebars.compile).toHaveBeenCalledWith('<p>Hello {{user.firstName}}</p>');
      expect(emailService.templatesCache.has('password-reset')).toBe(true);
    });

    it('should use cached template when available', async () => {
      const mockCompiledTemplate = jest.fn().mockReturnValue('cached template');
      emailService.templatesCache.set('password-reset', mockCompiledTemplate);

      const template = await emailService.loadTemplate('password-reset');

      expect(fs.readFile).not.toHaveBeenCalled();
      expect(template).toBe(mockCompiledTemplate);
    });

    it('should handle template file not found', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));

      await expect(emailService.loadTemplate('non-existent'))
        .rejects.toThrow('Template file not found');
    });

    it('should send templated email successfully', async () => {
      emailService.transporter = mockTransporter;
      const mockCompiledTemplate = jest.fn().mockReturnValue('<p>Hello John</p>');
      emailService.templatesCache.set('password-reset', mockCompiledTemplate);

      const result = await emailService.sendTemplatedEmail({
        to: 'test@example.com',
        subject: 'Password Reset',
        template: 'password-reset',
        data: templateData
      });

      expect(mockCompiledTemplate).toHaveBeenCalledWith(templateData);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Password Reset',
          html: '<p>Hello John</p>'
        })
      );
    });
  });

  describe('Specialized Email Methods', () => {
    const mockUser = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com'
    };

    beforeEach(() => {
      emailService.transporter = mockTransporter;
      emailService.sendTemplatedEmail = jest.fn().mockResolvedValue({
        messageId: 'test-message-id'
      });
    });

    it('should send password reset email', async () => {
      const resetToken = 'reset-token-123';

      await emailService.sendPasswordResetEmail(mockUser, resetToken);

      expect(emailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: 'Password Reset Request - Finance Dashboard',
        template: 'password-reset',
        data: {
          user: mockUser,
          resetUrl: expect.stringContaining(resetToken),
          expiresIn: '1 hour'
        },
        priority: 'high'
      });
    });

    it('should send password change confirmation email', async () => {
      await emailService.sendPasswordChangeConfirmation(mockUser);

      expect(emailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: 'Password Changed Successfully - Finance Dashboard',
        template: 'password-changed',
        data: {
          user: mockUser,
          changeTime: expect.any(String),
          supportEmail: expect.any(String)
        },
        priority: 'high'
      });
    });

    it('should send account verification email', async () => {
      const verificationToken = 'verify-token-456';

      await emailService.sendAccountVerificationEmail(mockUser, verificationToken);

      expect(emailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: 'Verify Your Email Address - Finance Dashboard',
        template: 'email-verification',
        data: {
          user: mockUser,
          verificationUrl: expect.stringContaining(verificationToken),
          expiresIn: '24 hours'
        },
        priority: 'high'
      });
    });

    it('should send welcome email', async () => {
      await emailService.sendWelcomeEmail(mockUser);

      expect(emailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: 'Welcome to Finance Dashboard!',
        template: 'welcome',
        data: {
          user: mockUser,
          loginUrl: expect.any(String),
          supportEmail: expect.any(String),
          features: expect.any(Array)
        },
        priority: 'normal'
      });
    });

    it('should send export notification email', async () => {
      const exportData = {
        exportType: 'transactions',
        format: 'CSV',
        fileName: 'transactions_export.csv',
        downloadUrl: 'http://example.com/download/123',
        fileSize: 1024000
      };

      await emailService.sendExportNotification(mockUser.email, exportData);

      expect(emailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: 'Your Data Export is Ready for Download',
        template: 'export-complete',
        data: {
          exportType: 'Transactions',
          format: 'CSV',
          fileName: 'transactions_export.csv',
          downloadUrl: 'http://example.com/download/123',
          fileSize: '1.00 MB'
        },
        priority: 'normal'
      });
    });

    it('should send import notification email', async () => {
      const importData = {
        importType: 'transactions',
        fileName: 'bank_statement.csv',
        recordsProcessed: 150,
        recordsImported: 140,
        errors: ['Invalid date format on row 5']
      };

      await emailService.sendImportNotification(mockUser.email, importData);

      expect(emailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: 'Your Data Import Has Been Completed',
        template: 'import-complete',
        data: {
          importType: 'Transactions',
          fileName: 'bank_statement.csv',
          recordsProcessed: 150,
          recordsImported: 140,
          recordsSkipped: 9,
          errorCount: 1,
          successRate: 93,
          processingTime: 'Completed',
          errors: ['Invalid date format on row 5'],
          warnings: []
        },
        priority: 'normal'
      });
    });

    it('should send goal reminder email', async () => {
      const goalData = {
        goal: {
          name: 'Emergency Fund',
          targetAmount: 10000,
          currentAmount: 7500,
          targetDate: new Date('2024-12-31')
        },
        progress: 75,
        daysRemaining: 120
      };

      await emailService.sendGoalReminder(mockUser, goalData);

      expect(emailService.sendTemplatedEmail).toHaveBeenCalledWith({
        to: mockUser.email,
        subject: `Goal Reminder: ${goalData.goal.name}`,
        template: 'goal-reminder',
        data: {
          user: mockUser,
          goal: goalData.goal,
          progress: goalData.progress,
          daysRemaining: goalData.daysRemaining,
          remainingAmount: 2500,
          progressStatus: expect.any(String)
        },
        priority: 'normal'
      });
    });
  });

  describe('Utility Methods', () => {
    it('should format file size correctly', () => {
      expect(emailService.formatFileSize(0)).toBe('0 Bytes');
      expect(emailService.formatFileSize(1024)).toBe('1.00 KB');
      expect(emailService.formatFileSize(1048576)).toBe('1.00 MB');
      expect(emailService.formatFileSize(1073741824)).toBe('1.00 GB');
      expect(emailService.formatFileSize(1536)).toBe('1.50 KB');
    });

    it('should validate email addresses', () => {
      expect(emailService.isValidEmail('test@example.com')).toBe(true);
      expect(emailService.isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(emailService.isValidEmail('invalid-email')).toBe(false);
      expect(emailService.isValidEmail('invalid@')).toBe(false);
      expect(emailService.isValidEmail('@invalid.com')).toBe(false);
      expect(emailService.isValidEmail('')).toBe(false);
    });

    it('should sanitize email content', () => {
      const unsafeContent = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = emailService.sanitizeEmailContent(unsafeContent);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Safe content</p>');
    });
  });

  describe('Error Handling', () => {
    it('should handle SendGrid API errors', async () => {
      emailService.usingSendGrid = true;
      const sendGridError = new Error('SendGrid API error');
      sendGridError.code = 402;
      sgMail.send.mockRejectedValue(sendGridError);

      await expect(emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test'
      })).rejects.toThrow('SendGrid API error');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send email:',
        sendGridError
      );
    });

    it('should handle template loading errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File read error'));

      await expect(emailService.loadTemplate('test-template'))
        .rejects.toThrow('File read error');
    });

    it('should handle handlebars compilation errors', async () => {
      fs.readFile.mockResolvedValue('{{invalid template syntax');
      handlebars.compile.mockImplementation(() => {
        throw new Error('Template compilation failed');
      });

      await expect(emailService.loadTemplate('invalid-template'))
        .rejects.toThrow('Template compilation failed');
    });

    it('should handle network timeouts gracefully', async () => {
      emailService.transporter = mockTransporter;
      const timeoutError = new Error('Network timeout');
      timeoutError.code = 'ETIMEDOUT';
      mockTransporter.sendMail.mockRejectedValue(timeoutError);

      await expect(emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test'
      })).rejects.toThrow('Network timeout');
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk email sending efficiently', async () => {
      emailService.transporter = mockTransporter;
      const emails = Array.from({ length: 100 }, (_, i) => ({
        to: `user${i}@example.com`,
        subject: `Test Email ${i}`,
        text: `Test message ${i}`
      }));

      const startTime = Date.now();
      const promises = emails.map(email => emailService.sendEmail(email));
      await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(100);
    });

    it('should cache templates efficiently', async () => {
      fs.readFile.mockResolvedValue('<p>Template content</p>');
      
      // Load template multiple times
      await emailService.loadTemplate('test-template');
      await emailService.loadTemplate('test-template');
      await emailService.loadTemplate('test-template');

      // Should only read file once due to caching
      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(emailService.templatesCache.size).toBe(1);
    });

    it('should handle large template data efficiently', async () => {
      emailService.transporter = mockTransporter;
      const mockCompiledTemplate = jest.fn().mockReturnValue('<p>Large template</p>');
      emailService.templatesCache.set('large-template', mockCompiledTemplate);

      const largeData = {
        user: mockUser,
        transactions: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          amount: Math.random() * 1000,
          description: `Transaction ${i}`
        }))
      };

      const startTime = Date.now();
      await emailService.sendTemplatedEmail({
        to: 'test@example.com',
        subject: 'Large Data Email',
        template: 'large-template',
        data: largeData
      });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Configuration Tests', () => {
    it('should handle missing configuration gracefully', () => {
      config.getEmailConfig.mockReturnValue({});

      const unconfiguredService = new (require('../../services/email.service').constructor)();

      expect(unconfiguredService.emailConfig).toEqual({});
    });

    it('should use environment variables for configuration', () => {
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'test@test.com';
      process.env.SMTP_PASS = 'testpass';

      config.getEmailConfig.mockReturnValue({
        enabled: true,
        provider: 'smtp',
        smtp: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        }
      });

      const result = emailService.getSMTPConfig();

      expect(result.host).toBe('smtp.test.com');
      expect(result.port).toBe('587');
      expect(result.auth.user).toBe('test@test.com');
    });
  });
});
