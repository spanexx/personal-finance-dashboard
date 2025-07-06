/**
 * Email Verification Service Unit Tests
 * Tests for email verification-related business logic
 */

const EmailVerificationService = require('../../services/emailVerification.service');
const User = require('../../models/User');
const emailQueue = require('../../services/emailQueue.service');
const logger = require('../../utils/logger');
const { 
  ValidationError, 
  NotFoundError,
  RateLimitError 
} = require('../../utils/errorHandler');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../services/emailQueue.service');
jest.mock('../../utils/logger');
jest.mock('../../utils/errorHandler');

describe('EmailVerificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('sendVerificationEmail', () => {
    const mockEmail = 'test@example.com';
    const mockUserId = 'user123';
    const mockQueueId = 'queue456';
    const mockToken = 'verification-token-123';

    beforeEach(() => {
      // Setup default mocks
      emailQueue.addToQueue = jest.fn().mockReturnValue(mockQueueId);
      logger.info = jest.fn();
    });

    it('should successfully send verification email for valid user', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isEmailVerified: false,
        emailVerificationAttempts: 1,
        lastEmailVerificationSent: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        canResendEmailVerification: jest.fn().mockReturnValue(true),
        generateEmailVerificationToken: jest.fn().mockReturnValue(mockToken),
        save: jest.fn().mockResolvedValue()
      };

      User.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await EmailVerificationService.sendVerificationEmail(mockEmail);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: mockEmail });
      expect(mockUser.canResendEmailVerification).toHaveBeenCalled();
      expect(mockUser.generateEmailVerificationToken).toHaveBeenCalled();
      expect(mockUser.save).toHaveBeenCalled();
      expect(emailQueue.addToQueue).toHaveBeenCalledWith({
        templateName: 'email-verification',
        templateData: {
          user: mockUser,
          token: mockToken
        }
      }, { priority: 'high' });
      expect(logger.info).toHaveBeenCalledWith('Email verification requested', {
        userId: mockUserId,
        email: mockEmail,
        queueId: mockQueueId,
        attempts: 1
      });
      expect(result).toEqual({ queueId: mockQueueId });
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      User.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(EmailVerificationService.sendVerificationEmail(mockEmail))
        .rejects.toThrow(NotFoundError);
      expect(User.findOne).toHaveBeenCalledWith({ email: mockEmail });
      expect(emailQueue.addToQueue).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when email is already verified', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isEmailVerified: true
      };

      User.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(EmailVerificationService.sendVerificationEmail(mockEmail))
        .rejects.toThrow(ValidationError);
      expect(User.findOne).toHaveBeenCalledWith({ email: mockEmail });
      expect(emailQueue.addToQueue).not.toHaveBeenCalled();
    });

    it('should throw RateLimitError when resend cooldown is active', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isEmailVerified: false,
        lastEmailVerificationSent: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
        canResendEmailVerification: jest.fn().mockReturnValue(false)
      };

      User.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(EmailVerificationService.sendVerificationEmail(mockEmail))
        .rejects.toThrow(RateLimitError);
      expect(mockUser.canResendEmailVerification).toHaveBeenCalled();
      expect(emailQueue.addToQueue).not.toHaveBeenCalled();
    });

    it('should throw RateLimitError when maximum verification attempts exceeded', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isEmailVerified: false,
        emailVerificationAttempts: 5,
        canResendEmailVerification: jest.fn().mockReturnValue(true)
      };

      User.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(EmailVerificationService.sendVerificationEmail(mockEmail))
        .rejects.toThrow(RateLimitError);
      expect(emailQueue.addToQueue).not.toHaveBeenCalled();
    });

    it('should handle database errors during user lookup', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      User.findOne.mockRejectedValue(dbError);

      // Act & Assert
      await expect(EmailVerificationService.sendVerificationEmail(mockEmail))
        .rejects.toThrow(dbError);
    });

    it('should handle errors during token generation', async () => {
      // Arrange
      const tokenError = new Error('Token generation failed');
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isEmailVerified: false,
        emailVerificationAttempts: 1,
        canResendEmailVerification: jest.fn().mockReturnValue(true),
        generateEmailVerificationToken: jest.fn().mockImplementation(() => {
          throw tokenError;
        })
      };

      User.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(EmailVerificationService.sendVerificationEmail(mockEmail))
        .rejects.toThrow(tokenError);
    });

    it('should handle errors during user save', async () => {
      // Arrange
      const saveError = new Error('Failed to save user');
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isEmailVerified: false,
        emailVerificationAttempts: 1,
        canResendEmailVerification: jest.fn().mockReturnValue(true),
        generateEmailVerificationToken: jest.fn().mockReturnValue(mockToken),
        save: jest.fn().mockRejectedValue(saveError)
      };

      User.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(EmailVerificationService.sendVerificationEmail(mockEmail))
        .rejects.toThrow(saveError);
    });

    it('should handle edge case with zero verification attempts', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isEmailVerified: false,
        emailVerificationAttempts: 0,
        canResendEmailVerification: jest.fn().mockReturnValue(true),
        generateEmailVerificationToken: jest.fn().mockReturnValue(mockToken),
        save: jest.fn().mockResolvedValue()
      };

      User.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await EmailVerificationService.sendVerificationEmail(mockEmail);

      // Assert
      expect(result).toEqual({ queueId: mockQueueId });
      expect(logger.info).toHaveBeenCalledWith('Email verification requested', {
        userId: mockUserId,
        email: mockEmail,
        queueId: mockQueueId,
        attempts: 0
      });
    });

    it('should handle boundary case with exactly 4 verification attempts', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isEmailVerified: false,
        emailVerificationAttempts: 4,
        canResendEmailVerification: jest.fn().mockReturnValue(true),
        generateEmailVerificationToken: jest.fn().mockReturnValue(mockToken),
        save: jest.fn().mockResolvedValue()
      };

      User.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await EmailVerificationService.sendVerificationEmail(mockEmail);

      // Assert
      expect(result).toEqual({ queueId: mockQueueId });
      expect(emailQueue.addToQueue).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    const mockEmail = 'test@example.com';
    const mockToken = 'verification-token-123';
    const mockUserId = 'user123';

    it('should successfully verify email with valid token and email', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isEmailVerified: false,
        verifyEmail: jest.fn().mockResolvedValue()
      };

      User.findByEmailVerificationToken.mockResolvedValue(mockUser);

      // Act
      const result = await EmailVerificationService.verifyEmail(mockToken, mockEmail);

      // Assert
      expect(User.findByEmailVerificationToken).toHaveBeenCalledWith(mockToken);
      expect(mockUser.verifyEmail).toHaveBeenCalled();
      expect(result).toEqual({
        verified: true,
        userId: mockUserId,
        email: mockEmail
      });
    });

    it('should throw ValidationError when token is invalid or expired', async () => {
      // Arrange
      User.findByEmailVerificationToken.mockResolvedValue(null);

      // Act & Assert
      await expect(EmailVerificationService.verifyEmail(mockToken, mockEmail))
        .rejects.toThrow(ValidationError);
      expect(User.findByEmailVerificationToken).toHaveBeenCalledWith(mockToken);
    });

    it('should throw ValidationError when email does not match token', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        email: 'different@example.com',
        isEmailVerified: false
      };

      User.findByEmailVerificationToken.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(EmailVerificationService.verifyEmail(mockToken, mockEmail))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when email is already verified', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isEmailVerified: true
      };

      User.findByEmailVerificationToken.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(EmailVerificationService.verifyEmail(mockToken, mockEmail))
        .rejects.toThrow(ValidationError);
    });

    it('should handle database errors during token lookup', async () => {
      // Arrange
      const dbError = new Error('Database query failed');
      User.findByEmailVerificationToken.mockRejectedValue(dbError);

      // Act & Assert
      await expect(EmailVerificationService.verifyEmail(mockToken, mockEmail))
        .rejects.toThrow(dbError);
    });

    it('should handle errors during email verification', async () => {
      // Arrange
      const verifyError = new Error('Verification failed');
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isEmailVerified: false,
        verifyEmail: jest.fn().mockRejectedValue(verifyError)
      };

      User.findByEmailVerificationToken.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(EmailVerificationService.verifyEmail(mockToken, mockEmail))
        .rejects.toThrow(verifyError);
    });

    it('should handle empty token', async () => {
      // Arrange
      User.findByEmailVerificationToken.mockResolvedValue(null);

      // Act & Assert
      await expect(EmailVerificationService.verifyEmail('', mockEmail))
        .rejects.toThrow(ValidationError);
      expect(User.findByEmailVerificationToken).toHaveBeenCalledWith('');
    });

    it('should handle empty email', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        email: mockEmail,
        isEmailVerified: false
      };

      User.findByEmailVerificationToken.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(EmailVerificationService.verifyEmail(mockToken, ''))
        .rejects.toThrow(ValidationError);
    });

    it('should handle case-sensitive email comparison', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        email: 'Test@Example.Com',
        isEmailVerified: false
      };

      User.findByEmailVerificationToken.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(EmailVerificationService.verifyEmail(mockToken, 'test@example.com'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('checkVerificationStatus', () => {
    const mockEmail = 'test@example.com';
    const mockUserId = 'user123';

    it('should return verification status for existing user', async () => {
      // Arrange
      const lastSent = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const mockUser = {
        _id: mockUserId,
        isEmailVerified: false,
        emailVerificationAttempts: 2,
        lastEmailVerificationSent: lastSent,
        canResendEmailVerification: jest.fn().mockReturnValue(true)
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      // Act
      const result = await EmailVerificationService.checkVerificationStatus(mockEmail);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: mockEmail });
      expect(mockUser.canResendEmailVerification).toHaveBeenCalled();
      expect(result).toEqual({
        isVerified: false,
        attempts: 2,
        lastSent: lastSent,
        canResend: true
      });
    });

    it('should return status for verified user', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        isEmailVerified: true,
        emailVerificationAttempts: 1,
        lastEmailVerificationSent: new Date(),
        canResendEmailVerification: jest.fn().mockReturnValue(false)
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      // Act
      const result = await EmailVerificationService.checkVerificationStatus(mockEmail);

      // Assert
      expect(result.isVerified).toBe(true);
      expect(result.canResend).toBe(false);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      // Act & Assert
      await expect(EmailVerificationService.checkVerificationStatus(mockEmail))
        .rejects.toThrow(NotFoundError);
    });

    it('should handle database errors during user lookup', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      User.findOne.mockReturnValue({
        select: jest.fn().mockRejectedValue(dbError)
      });

      // Act & Assert
      await expect(EmailVerificationService.checkVerificationStatus(mockEmail))
        .rejects.toThrow(dbError);
    });

    it('should handle user with no verification attempts', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        isEmailVerified: false,
        emailVerificationAttempts: 0,
        lastEmailVerificationSent: null,
        canResendEmailVerification: jest.fn().mockReturnValue(true)
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      // Act
      const result = await EmailVerificationService.checkVerificationStatus(mockEmail);

      // Assert
      expect(result).toEqual({
        isVerified: false,
        attempts: 0,
        lastSent: null,
        canResend: true
      });
    });

    it('should handle user with maximum verification attempts', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        isEmailVerified: false,
        emailVerificationAttempts: 5,
        lastEmailVerificationSent: new Date(),
        canResendEmailVerification: jest.fn().mockReturnValue(false)
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      // Act
      const result = await EmailVerificationService.checkVerificationStatus(mockEmail);

      // Assert
      expect(result.attempts).toBe(5);
      expect(result.canResend).toBe(false);
    });

    it('should select only required fields', async () => {
      // Arrange
      const mockUser = {
        _id: mockUserId,
        isEmailVerified: true,
        emailVerificationAttempts: 1,
        lastEmailVerificationSent: new Date(),
        canResendEmailVerification: jest.fn().mockReturnValue(false)
      };

      const selectSpy = jest.fn().mockResolvedValue(mockUser);
      User.findOne.mockReturnValue({ select: selectSpy });

      // Act
      await EmailVerificationService.checkVerificationStatus(mockEmail);

      // Assert
      expect(selectSpy).toHaveBeenCalledWith('isEmailVerified emailVerificationAttempts lastEmailVerificationSent');
    });
  });

  describe('Error Handling', () => {
    it('should propagate ValidationError correctly', async () => {
      // Arrange
      const mockError = new ValidationError('Test validation error');
      User.findOne.mockRejectedValue(mockError);

      // Act & Assert
      await expect(EmailVerificationService.sendVerificationEmail('test@example.com'))
        .rejects.toBeInstanceOf(ValidationError);
    });

    it('should propagate NotFoundError correctly', async () => {
      // Arrange
      const mockError = new NotFoundError('Test not found error');
      User.findOne.mockRejectedValue(mockError);

      // Act & Assert
      await expect(EmailVerificationService.sendVerificationEmail('test@example.com'))
        .rejects.toBeInstanceOf(NotFoundError);
    });

    it('should propagate RateLimitError correctly', async () => {
      // Arrange
      const mockError = new RateLimitError('Test rate limit error');
      User.findOne.mockRejectedValue(mockError);

      // Act & Assert
      await expect(EmailVerificationService.sendVerificationEmail('test@example.com'))
        .rejects.toBeInstanceOf(RateLimitError);
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent verification requests', async () => {
      // Arrange
      const emails = Array.from({ length: 10 }, (_, i) => `user${i}@example.com`);
      const mockUsers = emails.map((email, i) => ({
        _id: `user${i}`,
        email,
        isEmailVerified: false,
        emailVerificationAttempts: 0,
        canResendEmailVerification: jest.fn().mockReturnValue(true),
        generateEmailVerificationToken: jest.fn().mockReturnValue(`token${i}`),
        save: jest.fn().mockResolvedValue()
      }));

      User.findOne.mockImplementation(({ email }) => {
        const index = emails.indexOf(email);
        return Promise.resolve(mockUsers[index]);
      });

      emailQueue.addToQueue.mockImplementation((_, options) => `queue${Math.random()}`);

      // Act
      const startTime = Date.now();
      const promises = emails.map(email => 
        EmailVerificationService.sendVerificationEmail(email)
      );
      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Assert
      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(User.findOne).toHaveBeenCalledTimes(10);
      expect(emailQueue.addToQueue).toHaveBeenCalledTimes(10);
    });

    it('should handle verification status checks efficiently', async () => {
      // Arrange
      const emails = Array.from({ length: 20 }, (_, i) => `user${i}@example.com`);
      const mockUsers = emails.map((email, i) => ({
        _id: `user${i}`,
        isEmailVerified: i % 2 === 0, // Half verified, half not
        emailVerificationAttempts: i % 5,
        lastEmailVerificationSent: new Date(),
        canResendEmailVerification: jest.fn().mockReturnValue(i % 3 === 0)
      }));

      User.findOne.mockImplementation(({ email }) => ({
        select: jest.fn().mockResolvedValue(
          mockUsers[emails.indexOf(email)]
        )
      }));

      // Act
      const startTime = Date.now();
      const promises = emails.map(email => 
        EmailVerificationService.checkVerificationStatus(email)
      );
      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Assert
      expect(results).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
      expect(User.findOne).toHaveBeenCalledTimes(20);
    });

    it('should handle rapid verification token checks', async () => {
      // Arrange
      const tokens = Array.from({ length: 15 }, (_, i) => `token${i}`);
      const mockUsers = tokens.map((_, i) => ({
        _id: `user${i}`,
        email: `user${i}@example.com`,
        isEmailVerified: false,
        verifyEmail: jest.fn().mockResolvedValue()
      }));

      User.findByEmailVerificationToken.mockImplementation((token) => {
        const index = tokens.indexOf(token);
        return Promise.resolve(mockUsers[index]);
      });

      // Act
      const startTime = Date.now();
      const promises = tokens.map((token, i) => 
        EmailVerificationService.verifyEmail(token, `user${i}@example.com`)
      );
      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Assert
      expect(results).toHaveLength(15);
      expect(endTime - startTime).toBeLessThan(750); // Should complete within 750ms
      expect(User.findByEmailVerificationToken).toHaveBeenCalledTimes(15);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed email addresses gracefully', async () => {
      // Arrange
      const malformedEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        '',
        null,
        undefined
      ];

      User.findOne.mockResolvedValue(null);

      // Act & Assert
      for (const email of malformedEmails) {
        await expect(EmailVerificationService.sendVerificationEmail(email))
          .rejects.toThrow(NotFoundError);
      }
    });

    it('should handle very long verification tokens', async () => {
      // Arrange
      const longToken = 'a'.repeat(1000);
      User.findByEmailVerificationToken.mockResolvedValue(null);

      // Act & Assert
      await expect(EmailVerificationService.verifyEmail(longToken, 'test@example.com'))
        .rejects.toThrow(ValidationError);
      expect(User.findByEmailVerificationToken).toHaveBeenCalledWith(longToken);
    });

    it('should handle special characters in tokens', async () => {
      // Arrange
      const specialToken = 'token-with-special-chars!@#$%^&*()';
      User.findByEmailVerificationToken.mockResolvedValue(null);

      // Act & Assert
      await expect(EmailVerificationService.verifyEmail(specialToken, 'test@example.com'))
        .rejects.toThrow(ValidationError);
    });

    it('should handle user with undefined lastEmailVerificationSent', async () => {
      // Arrange
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        isEmailVerified: false,
        emailVerificationAttempts: 0,
        lastEmailVerificationSent: undefined,
        canResendEmailVerification: jest.fn().mockReturnValue(true),
        generateEmailVerificationToken: jest.fn().mockReturnValue('token'),
        save: jest.fn().mockResolvedValue()
      };

      User.findOne.mockResolvedValue(mockUser);
      emailQueue.addToQueue.mockReturnValue('queue123');

      // Act
      const result = await EmailVerificationService.sendVerificationEmail('test@example.com');

      // Assert
      expect(result).toEqual({ queueId: 'queue123' });
    });

    it('should handle boundary verification attempt values', async () => {
      // Test with exactly 5 attempts
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        isEmailVerified: false,
        emailVerificationAttempts: 5,
        canResendEmailVerification: jest.fn().mockReturnValue(true)
      };

      User.findOne.mockResolvedValue(mockUser);

      await expect(EmailVerificationService.sendVerificationEmail('test@example.com'))
        .rejects.toThrow(RateLimitError);
    });
  });
});
