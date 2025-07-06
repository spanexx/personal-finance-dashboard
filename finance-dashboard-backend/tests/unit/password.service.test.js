/**
 * Password Service Unit Tests
 * Tests password hashing, validation, strength checking, and security features
 */

const PasswordService = require('../../services/password.service');
const User = require('../../models/User');
const EmailService = require('../../services/email.service');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../services/email.service');
jest.mock('../../utils/logger');
jest.mock('bcryptjs');
jest.mock('crypto');

describe('PasswordService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set test environment variables
    process.env.BCRYPT_SALT_ROUNDS = '12';
  });

  describe('Password Hashing', () => {
    describe('hashPassword', () => {
      it('should hash password with proper salt rounds', async () => {
        const password = 'testPassword123!';
        const mockSalt = 'mockSalt';
        const mockHash = 'mockHashedPassword';

        bcrypt.genSalt.mockResolvedValue(mockSalt);
        bcrypt.hash.mockResolvedValue(mockHash);

        const result = await PasswordService.hashPassword(password);

        expect(bcrypt.genSalt).toHaveBeenCalledWith(12);
        expect(bcrypt.hash).toHaveBeenCalledWith(password, mockSalt);
        expect(result).toBe(mockHash);
      });

      it('should use default salt rounds when env var is not set', async () => {
        delete process.env.BCRYPT_SALT_ROUNDS;
        
        const password = 'testPassword123!';
        bcrypt.genSalt.mockResolvedValue('mockSalt');
        bcrypt.hash.mockResolvedValue('mockHash');

        await PasswordService.hashPassword(password);

        expect(bcrypt.genSalt).toHaveBeenCalledWith(12); // Default value
      });

      it('should handle various salt round configurations', async () => {
        const testCases = [
          { saltRounds: '10', expected: 10 },
          { saltRounds: '14', expected: 14 },
          { saltRounds: 'invalid', expected: 12 }, // Should default to 12
        ];

        bcrypt.genSalt.mockResolvedValue('mockSalt');
        bcrypt.hash.mockResolvedValue('mockHash');

        for (const testCase of testCases) {
          process.env.BCRYPT_SALT_ROUNDS = testCase.saltRounds;
          await PasswordService.hashPassword('password');
          expect(bcrypt.genSalt).toHaveBeenCalledWith(testCase.expected);
          bcrypt.genSalt.mockClear();
        }
      });

      it('should throw error when hashing fails', async () => {
        const password = 'testPassword123!';
        bcrypt.genSalt.mockRejectedValue(new Error('Salt generation failed'));

        await expect(
          PasswordService.hashPassword(password)
        ).rejects.toThrow('Password hashing failed');
      });

      it('should handle empty or null passwords', async () => {
        const invalidPasswords = [null, undefined, ''];

        for (const password of invalidPasswords) {
          bcrypt.genSalt.mockResolvedValue('mockSalt');
          bcrypt.hash.mockRejectedValue(new Error('Invalid password'));

          await expect(
            PasswordService.hashPassword(password)
          ).rejects.toThrow('Password hashing failed');
        }
      });
    });

    describe('verifyPassword', () => {
      it('should verify correct password', async () => {
        const password = 'testPassword123!';
        const hash = 'hashedPassword';

        bcrypt.compare.mockResolvedValue(true);

        const result = await PasswordService.verifyPassword(password, hash);

        expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
        expect(result).toBe(true);
      });

      it('should reject incorrect password', async () => {
        const password = 'wrongPassword';
        const hash = 'hashedPassword';

        bcrypt.compare.mockResolvedValue(false);

        const result = await PasswordService.verifyPassword(password, hash);

        expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
        expect(result).toBe(false);
      });

      it('should handle verification errors', async () => {
        const password = 'testPassword123!';
        const hash = 'hashedPassword';

        bcrypt.compare.mockRejectedValue(new Error('Comparison failed'));

        await expect(
          PasswordService.verifyPassword(password, hash)
        ).rejects.toThrow('Password verification failed');
      });

      it('should handle null or undefined inputs', async () => {
        const testCases = [
          [null, 'hash'],
          ['password', null],
          [undefined, 'hash'],
          ['password', undefined]
        ];

        for (const [password, hash] of testCases) {
          bcrypt.compare.mockRejectedValue(new Error('Invalid input'));

          await expect(
            PasswordService.verifyPassword(password, hash)
          ).rejects.toThrow('Password verification failed');
        }
      });
    });
  });

  describe('Password Strength Validation', () => {
    describe('validatePasswordStrength', () => {
      it('should validate strong password', () => {
        const strongPassword = 'StrongP@ssw0rd123!';
        const userInfo = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        };

        const result = PasswordService.validatePasswordStrength(strongPassword, userInfo);

        expect(result.isValid).toBe(true);
        expect(result.score).toBeGreaterThan(6);
        expect(result.errors).toHaveLength(0);
        expect(result.strength).toBe('strong');
      });

      it('should reject weak passwords', () => {
        const weakPasswords = [
          'weak',
          '123456',
          'password',
          'qwerty',
          'abc123'
        ];

        weakPasswords.forEach(password => {
          const result = PasswordService.validatePasswordStrength(password);
          
          expect(result.isValid).toBe(false);
          expect(result.score).toBeLessThan(5);
          expect(result.errors.length).toBeGreaterThan(0);
        });
      });

      it('should enforce minimum length requirement', () => {
        const shortPassword = 'Ab1!';
        
        const result = PasswordService.validatePasswordStrength(shortPassword);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password must be at least 8 characters long');
      });

      it('should enforce character variety requirements', () => {
        const testCases = [
          {
            password: 'onlylowercase',
            expectedError: 'Password must contain at least one uppercase letter'
          },
          {
            password: 'ONLYUPPERCASE',
            expectedError: 'Password must contain at least one lowercase letter'
          },
          {
            password: 'NoNumbers!',
            expectedError: 'Password must contain at least one number'
          },
          {
            password: 'NoSpecialChars123',
            expectedError: 'Password must contain at least one special character'
          }
        ];

        testCases.forEach(({ password, expectedError }) => {
          const result = PasswordService.validatePasswordStrength(password);
          
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain(expectedError);
        });
      });

      it('should detect common passwords', () => {
        const commonPasswords = [
          'password123',
          'qwerty123',
          'abc123456',
          'letmein123',
          'welcome123'
        ];

        commonPasswords.forEach(password => {
          const result = PasswordService.validatePasswordStrength(password);
          
          expect(result.isValid).toBe(false);
          expect(result.errors.some(error => 
            error.includes('too common')
          )).toBe(true);
        });
      });

      it('should detect personal information in passwords', () => {
        const userInfo = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        };

        const personalPasswords = [
          'John123!',
          'Doe123!',
          'johndoe123!',
          'john.doe123!'
        ];

        personalPasswords.forEach(password => {
          const result = PasswordService.validatePasswordStrength(password, userInfo);
          
          expect(result.isValid).toBe(false);
          expect(result.errors.some(error => 
            error.includes('personal information')
          )).toBe(true);
        });
      });

      it('should provide password strength scores', () => {
        const testCases = [
          { password: 'weak', expectedRange: [0, 3] },
          { password: 'Medium123!', expectedRange: [4, 6] },
          { password: 'VeryStr0ng!P@ssw0rd', expectedRange: [7, 10] }
        ];

        testCases.forEach(({ password, expectedRange }) => {
          const result = PasswordService.validatePasswordStrength(password);
          
          expect(result.score).toBeGreaterThanOrEqual(expectedRange[0]);
          expect(result.score).toBeLessThanOrEqual(expectedRange[1]);
        });
      });

      it('should provide helpful suggestions for weak passwords', () => {
        const weakPassword = 'weak';
        
        const result = PasswordService.validatePasswordStrength(weakPassword);
        
        expect(result.suggestions).toBeDefined();
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.suggestions).toContain('Use a mix of uppercase and lowercase letters');
      });

      it('should handle edge cases', () => {
        const edgeCases = [
          null,
          undefined,
          '',
          ' '.repeat(10), // Only spaces
          '🔒🔑💻🚀✨🎯', // Only emojis
          'àáâãäåæçèéêë' // Only accented characters
        ];

        edgeCases.forEach(password => {
          const result = PasswordService.validatePasswordStrength(password);
          expect(result.isValid).toBe(false);
        });
      });
    });

    describe('isCommonPassword', () => {
      it('should detect common passwords', () => {
        const commonPasswords = [
          'password',
          '123456',
          'qwerty',
          'admin',
          'letmein'
        ];

        commonPasswords.forEach(password => {
          const result = PasswordService.isCommonPassword(password);
          expect(result).toBe(true);
        });
      });

      it('should allow unique passwords', () => {
        const uniquePasswords = [
          'Str0ng!P@ssw0rd',
          'Un1qu3P@ssw0rd!',
          'MyS3cur3P@ss!'
        ];

        uniquePasswords.forEach(password => {
          const result = PasswordService.isCommonPassword(password);
          expect(result).toBe(false);
        });
      });

      it('should be case insensitive', () => {
        const variations = [
          'PASSWORD',
          'Password',
          'pAsSwOrD',
          'password'
        ];

        variations.forEach(password => {
          const result = PasswordService.isCommonPassword(password);
          expect(result).toBe(true);
        });
      });
    });

    describe('containsPersonalData', () => {
      const userInfo = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com'
      };

      it('should detect first name in password', () => {
        const passwords = ['john123', 'John123', 'JOHN123'];
        
        passwords.forEach(password => {
          const result = PasswordService.containsPersonalData(password, userInfo);
          expect(result.containsPersonalData).toBe(true);
          expect(result.found).toContain('firstName');
        });
      });

      it('should detect last name in password', () => {
        const passwords = ['doe123', 'Doe123', 'DOE123'];
        
        passwords.forEach(password => {
          const result = PasswordService.containsPersonalData(password, userInfo);
          expect(result.containsPersonalData).toBe(true);
          expect(result.found).toContain('lastName');
        });
      });

      it('should detect email parts in password', () => {
        const passwords = ['john.doe123', 'johndoe123'];
        
        passwords.forEach(password => {
          const result = PasswordService.containsPersonalData(password, userInfo);
          expect(result.containsPersonalData).toBe(true);
        });
      });

      it('should allow passwords without personal data', () => {
        const safePasswords = [
          'MyS3cur3P@ss!',
          'Str0ng!Password',
          'C0mpl3x!P@ssw0rd'
        ];
        
        safePasswords.forEach(password => {
          const result = PasswordService.containsPersonalData(password, userInfo);
          expect(result.containsPersonalData).toBe(false);
          expect(result.found).toHaveLength(0);
        });
      });

      it('should handle missing user info gracefully', () => {
        const password = 'TestPassword123!';
        
        const result = PasswordService.containsPersonalData(password, {});
        expect(result.containsPersonalData).toBe(false);
        expect(result.found).toHaveLength(0);
      });
    });
  });

  describe('Password Reset Functionality', () => {
    describe('generateResetToken', () => {
      it('should generate secure reset token', () => {
        const mockRandomBytes = Buffer.from('mockresettoken', 'hex');
        const mockHash = 'hashedtoken';

        crypto.randomBytes.mockReturnValue(mockRandomBytes);
        crypto.createHash.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue(mockHash)
        });

        const result = PasswordService.generateResetToken();

        expect(crypto.randomBytes).toHaveBeenCalledWith(32);
        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('hashedToken', mockHash);
        expect(result).toHaveProperty('expiresAt');
        expect(result.expiresAt).toBeInstanceOf(Date);
      });

      it('should set appropriate expiration time', () => {
        const mockRandomBytes = Buffer.from('mockresettoken', 'hex');
        crypto.randomBytes.mockReturnValue(mockRandomBytes);
        crypto.createHash.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue('hashedtoken')
        });

        const beforeGeneration = Date.now();
        const result = PasswordService.generateResetToken();
        const afterGeneration = Date.now();

        const expectedMin = beforeGeneration + (15 * 60 * 1000) - 1000; // 15 min - 1 sec tolerance
        const expectedMax = afterGeneration + (15 * 60 * 1000) + 1000; // 15 min + 1 sec tolerance

        expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
        expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
      });
    });

    describe('initiatePasswordReset', () => {
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        isVerified: true,
        save: jest.fn()
      };

      beforeEach(() => {
        User.findOne.mockReset();
        EmailService.sendPasswordReset.mockReset();
        mockUser.save.mockClear();
      });

      it('should initiate password reset for valid user', async () => {
        User.findOne.mockResolvedValue(mockUser);
        EmailService.sendPasswordReset.mockResolvedValue();

        const mockResetData = {
          token: 'resettoken',
          hashedToken: 'hashedtoken',
          expiresAt: new Date(Date.now() + 900000)
        };

        const generateResetTokenSpy = jest.spyOn(PasswordService, 'generateResetToken');
        generateResetTokenSpy.mockReturnValue(mockResetData);

        const result = await PasswordService.initiatePasswordReset('test@example.com');

        expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
        expect(generateResetTokenSpy).toHaveBeenCalled();
        expect(mockUser.resetPasswordToken).toBe(mockResetData.hashedToken);
        expect(mockUser.resetPasswordExpires).toBe(mockResetData.expiresAt);
        expect(mockUser.save).toHaveBeenCalled();
        expect(EmailService.sendPasswordReset).toHaveBeenCalledWith(
          mockUser,
          mockResetData.token
        );
        expect(result.success).toBe(true);
      });

      it('should not reveal user existence for security', async () => {
        User.findOne.mockResolvedValue(null);

        const result = await PasswordService.initiatePasswordReset('nonexistent@example.com');

        expect(result.success).toBe(true);
        expect(result.message).toContain('If the email exists');
        expect(EmailService.sendPasswordReset).not.toHaveBeenCalled();
      });

      it('should reject reset for unverified user', async () => {
        const unverifiedUser = { ...mockUser, isVerified: false };
        User.findOne.mockResolvedValue(unverifiedUser);

        await expect(
          PasswordService.initiatePasswordReset('test@example.com')
        ).rejects.toThrow('Account is not verified');
      });

      it('should handle email sending errors gracefully', async () => {
        User.findOne.mockResolvedValue(mockUser);
        EmailService.sendPasswordReset.mockRejectedValue(new Error('Email service error'));

        const generateResetTokenSpy = jest.spyOn(PasswordService, 'generateResetToken');
        generateResetTokenSpy.mockReturnValue({
          token: 'resettoken',
          hashedToken: 'hashedtoken',
          expiresAt: new Date()
        });

        await expect(
          PasswordService.initiatePasswordReset('test@example.com')
        ).rejects.toThrow('Email service error');
      });
    });

    describe('verifyResetToken', () => {
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        resetPasswordToken: 'hashedtoken',
        resetPasswordExpires: new Date(Date.now() + 900000)
      };

      beforeEach(() => {
        User.findOne.mockReset();
        crypto.createHash.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue('hashedtoken')
        });
      });

      it('should verify valid reset token', async () => {
        User.findOne.mockResolvedValue(mockUser);

        const result = await PasswordService.verifyResetToken('validtoken');

        expect(crypto.createHash).toHaveBeenCalledWith('sha256');
        expect(User.findOne).toHaveBeenCalledWith({
          resetPasswordToken: 'hashedtoken',
          resetPasswordExpires: { $gt: expect.any(Number) }
        });
        expect(result).toBe(mockUser);
      });

      it('should reject invalid reset token', async () => {
        User.findOne.mockResolvedValue(null);

        await expect(
          PasswordService.verifyResetToken('invalidtoken')
        ).rejects.toThrow('Invalid or expired reset token');
      });

      it('should reject expired reset token', async () => {
        const expiredUser = {
          ...mockUser,
          resetPasswordExpires: new Date(Date.now() - 900000) // Expired
        };
        User.findOne.mockResolvedValue(expiredUser);

        await expect(
          PasswordService.verifyResetToken('expiredtoken')
        ).rejects.toThrow('Invalid or expired reset token');
      });
    });

    describe('resetPassword', () => {
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'oldHashedPassword',
        resetPasswordToken: 'hashedtoken',
        resetPasswordExpires: new Date(Date.now() + 900000),
        loginAttempts: 3,
        lockUntil: new Date(Date.now() + 300000),
        save: jest.fn()
      };

      beforeEach(() => {
        mockUser.save.mockClear();
        EmailService.sendPasswordChangeConfirmation.mockReset();
      });

      it('should reset password with valid token', async () => {
        const verifyResetTokenSpy = jest.spyOn(PasswordService, 'verifyResetToken');
        verifyResetTokenSpy.mockResolvedValue(mockUser);

        const validatePasswordStrengthSpy = jest.spyOn(PasswordService, 'validatePasswordStrength');
        validatePasswordStrengthSpy.mockReturnValue({
          isValid: true,
          score: 8,
          errors: []
        });

        const isPasswordRecentlyUsedSpy = jest.spyOn(PasswordService, 'isPasswordRecentlyUsed');
        isPasswordRecentlyUsedSpy.mockResolvedValue(false);

        EmailService.sendPasswordChangeConfirmation.mockResolvedValue();

        const result = await PasswordService.resetPassword('validtoken', 'NewStr0ng!P@ssw0rd');

        expect(verifyResetTokenSpy).toHaveBeenCalledWith('validtoken');
        expect(validatePasswordStrengthSpy).toHaveBeenCalled();
        expect(isPasswordRecentlyUsedSpy).toHaveBeenCalledWith(mockUser._id, 'NewStr0ng!P@ssw0rd');
        expect(mockUser.password).toBe('NewStr0ng!P@ssw0rd');
        expect(mockUser.resetPasswordToken).toBeUndefined();
        expect(mockUser.resetPasswordExpires).toBeUndefined();
        expect(mockUser.loginAttempts).toBe(0);
        expect(mockUser.lockUntil).toBeUndefined();
        expect(mockUser.save).toHaveBeenCalled();
        expect(EmailService.sendPasswordChangeConfirmation).toHaveBeenCalledWith(mockUser);
        expect(result.success).toBe(true);
      });

      it('should reject weak new password', async () => {
        const verifyResetTokenSpy = jest.spyOn(PasswordService, 'verifyResetToken');
        verifyResetTokenSpy.mockResolvedValue(mockUser);

        const validatePasswordStrengthSpy = jest.spyOn(PasswordService, 'validatePasswordStrength');
        validatePasswordStrengthSpy.mockReturnValue({
          isValid: false,
          score: 2,
          errors: ['Password too weak']
        });

        await expect(
          PasswordService.resetPassword('validtoken', 'weak')
        ).rejects.toThrow('Password does not meet requirements');
      });

      it('should reject recently used password', async () => {
        const verifyResetTokenSpy = jest.spyOn(PasswordService, 'verifyResetToken');
        verifyResetTokenSpy.mockResolvedValue(mockUser);

        const validatePasswordStrengthSpy = jest.spyOn(PasswordService, 'validatePasswordStrength');
        validatePasswordStrengthSpy.mockReturnValue({
          isValid: true,
          score: 8,
          errors: []
        });

        const isPasswordRecentlyUsedSpy = jest.spyOn(PasswordService, 'isPasswordRecentlyUsed');
        isPasswordRecentlyUsedSpy.mockResolvedValue(true);

        await expect(
          PasswordService.resetPassword('validtoken', 'PreviouslyUsed!P@ssw0rd')
        ).rejects.toThrow('Password was recently used');
      });
    });
  });

  describe('Password History Management', () => {
    describe('isPasswordRecentlyUsed', () => {
      const mockUser = {
        _id: '123',
        passwordHistory: [
          { password: 'oldHash1', changedAt: new Date() },
          { password: 'oldHash2', changedAt: new Date() },
          { password: 'oldHash3', changedAt: new Date() }
        ]
      };

      beforeEach(() => {
        User.findById.mockReset();
        bcrypt.compare.mockReset();
      });

      it('should detect recently used password', async () => {
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser)
        });

        bcrypt.compare
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true) // Match found
          .mockResolvedValueOnce(false);

        const result = await PasswordService.isPasswordRecentlyUsed('123', 'previousPassword');

        expect(User.findById).toHaveBeenCalledWith('123');
        expect(bcrypt.compare).toHaveBeenCalledTimes(2); // Should stop after finding match
        expect(result).toBe(true);
      });

      it('should allow new password not in history', async () => {
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser)
        });

        bcrypt.compare.mockResolvedValue(false); // No matches

        const result = await PasswordService.isPasswordRecentlyUsed('123', 'newPassword');

        expect(bcrypt.compare).toHaveBeenCalledTimes(3); // Check all history
        expect(result).toBe(false);
      });

      it('should handle user without password history', async () => {
        const userWithoutHistory = { _id: '123', passwordHistory: [] };
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(userWithoutHistory)
        });

        const result = await PasswordService.isPasswordRecentlyUsed('123', 'newPassword');

        expect(bcrypt.compare).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });

      it('should handle non-existent user', async () => {
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue(null)
        });

        await expect(
          PasswordService.isPasswordRecentlyUsed('999', 'password')
        ).rejects.toThrow('User not found');
      });
    });
  });

  describe('Password Generation', () => {
    describe('generateSecurePassword', () => {
      it('should generate password with default length', () => {
        const password = PasswordService.generateSecurePassword();
        
        expect(password).toHaveLength(12);
        expect(/[a-z]/.test(password)).toBe(true); // Contains lowercase
        expect(/[A-Z]/.test(password)).toBe(true); // Contains uppercase
        expect(/\d/.test(password)).toBe(true); // Contains digit
        expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(true); // Contains special char
      });

      it('should generate password with custom length', () => {
        const lengths = [8, 16, 20, 32];
        
        lengths.forEach(length => {
          const password = PasswordService.generateSecurePassword(length);
          expect(password).toHaveLength(length);
        });
      });

      it('should generate different passwords on multiple calls', () => {
        const passwords = Array.from({ length: 10 }, () => 
          PasswordService.generateSecurePassword()
        );
        
        const uniquePasswords = new Set(passwords);
        expect(uniquePasswords.size).toBe(10); // All should be unique
      });

      it('should handle minimum viable length', () => {
        const password = PasswordService.generateSecurePassword(4);
        
        expect(password).toHaveLength(4);
        // Should still contain required character types
        expect(/[a-z]/.test(password)).toBe(true);
        expect(/[A-Z]/.test(password)).toBe(true);
        expect(/\d/.test(password)).toBe(true);
        expect(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)).toBe(true);
      });
    });

    describe('getPasswordStrengthMeter', () => {
      it('should return strength meter data for various passwords', () => {
        const testCases = [
          { password: 'weak', expectedStrength: 'very weak' },
          { password: 'Medium123', expectedStrength: 'fair' },
          { password: 'Strong123!', expectedStrength: 'good' },
          { password: 'VeryStr0ng!P@ssw0rd', expectedStrength: 'strong' }
        ];

        testCases.forEach(({ password, expectedStrength }) => {
          const result = PasswordService.getPasswordStrengthMeter(password);
          
          expect(result).toHaveProperty('score');
          expect(result).toHaveProperty('strength', expectedStrength);
          expect(result).toHaveProperty('feedback');
          expect(result.feedback).toBeInstanceOf(Array);
        });
      });

      it('should provide helpful feedback for weak passwords', () => {
        const weakPassword = 'weak';
        const result = PasswordService.getPasswordStrengthMeter(weakPassword);
        
        expect(result.feedback.length).toBeGreaterThan(0);
        expect(result.feedback.some(item => 
          item.includes('length') || item.includes('character')
        )).toBe(true);
      });

      it('should handle edge cases', () => {
        const edgeCases = [null, undefined, ''];
        
        edgeCases.forEach(password => {
          const result = PasswordService.getPasswordStrengthMeter(password);
          expect(result.strength).toBe('very weak');
          expect(result.score).toBe(0);
        });
      });
    });
  });

  describe('Cleanup Operations', () => {
    describe('cleanupExpiredResetTokens', () => {
      it('should clean up expired reset tokens', async () => {
        const mockResult = { modifiedCount: 5 };
        User.updateMany.mockResolvedValue(mockResult);

        const result = await PasswordService.cleanupExpiredResetTokens();

        expect(User.updateMany).toHaveBeenCalledWith(
          { resetPasswordExpires: { $lt: expect.any(Date) } },
          { 
            $unset: { 
              resetPasswordToken: 1, 
              resetPasswordExpires: 1 
            } 
          }
        );
        expect(result).toBe(5);
      });

      it('should handle cleanup errors', async () => {
        User.updateMany.mockRejectedValue(new Error('Database error'));

        await expect(
          PasswordService.cleanupExpiredResetTokens()
        ).rejects.toThrow('Database error');
      });
    });
  });

  describe('Performance Tests', () => {
    it('should hash passwords within performance threshold', async () => {
      const password = 'TestPassword123!';
      bcrypt.genSalt.mockResolvedValue('mockSalt');
      bcrypt.hash.mockResolvedValue('mockHash');

      const startTime = Date.now();
      await PasswordService.hashPassword(password);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should validate password strength within performance threshold', () => {
      const password = 'TestPassword123!';

      const startTime = Date.now();
      PasswordService.validatePasswordStrength(password);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should generate secure passwords quickly', () => {
      const startTime = Date.now();
      
      // Generate multiple passwords to test performance
      for (let i = 0; i < 10; i++) {
        PasswordService.generateSecurePassword();
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(50); // Should generate 10 passwords within 50ms
    });
  });

  describe('Error Edge Cases', () => {
    it('should handle crypto module errors', () => {
      crypto.randomBytes.mockImplementation(() => {
        throw new Error('Crypto error');
      });

      expect(() => {
        PasswordService.generateResetToken();
      }).toThrow();
    });

    it('should handle bcrypt configuration errors', async () => {
      bcrypt.genSalt.mockRejectedValue(new Error('Invalid salt rounds'));

      await expect(
        PasswordService.hashPassword('password')
      ).rejects.toThrow('Password hashing failed');
    });

    it('should handle database connection errors', async () => {
      User.findOne.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        PasswordService.initiatePasswordReset('test@example.com')
      ).rejects.toThrow('Database connection failed');
    });
  });
});
