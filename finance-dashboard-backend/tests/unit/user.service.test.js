/**
 * User Service Unit Tests
 * Comprehensive test suite for user management functionality
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const UserService = require('../../services/user.service');
const User = require('../../models/User');
const PasswordService = require('../../services/password.service');
const fs = require('fs').promises;
const path = require('path');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  AuthenticationError 
} = require('../../utils/errorHandler');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../services/password.service');
jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn()
  }
}));
jest.mock('bcryptjs');
jest.mock('mongoose', () => ({
  Types: {
    ObjectId: {
      isValid: jest.fn()
    }
  }
}));

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.Types.ObjectId.isValid.mockReturnValue(true);
  });

  describe('getUserProfile', () => {
    const mockUserId = '60d5ecb74b24a0001c5e4b75';
    const mockUser = {
      _id: mockUserId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      profileImage: 'profile.jpg',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001'
      },
      preferences: {
        currency: 'USD',
        theme: 'dark'
      }
    };

    it('should return user profile with completeness calculation', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await UserService.getUserProfile(mockUserId);

      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('profileCompleteness');
      expect(result.user).toEqual(mockUser);
      expect(result.profileCompleteness).toHaveProperty('percentage');
      expect(result.profileCompleteness).toHaveProperty('missingFields');
      expect(result.profileCompleteness).toHaveProperty('isComplete');
    });

    it('should throw ValidationError for invalid user ID', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(UserService.getUserProfile('invalid-id'))
        .rejects.toThrow(ValidationError);
      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith('invalid-id');
    });

    it('should throw NotFoundError when user does not exist', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await expect(UserService.getUserProfile(mockUserId))
        .rejects.toThrow(NotFoundError);
    });

    it('should calculate profile completeness correctly', async () => {
      const incompleteUser = {
        _id: mockUserId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com'
        // Missing phone, dateOfBirth, profileImage, address, preferences
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(incompleteUser)
      });

      const result = await UserService.getUserProfile(mockUserId);

      expect(result.profileCompleteness.percentage).toBeLessThan(100);
      expect(result.profileCompleteness.missingFields).toContain('phone');
      expect(result.profileCompleteness.missingFields).toContain('dateOfBirth');
      expect(result.profileCompleteness.missingFields).toContain('profileImage');
      expect(result.profileCompleteness.isComplete).toBe(false);
    });
  });

  describe('updateUserProfile', () => {
    const mockUserId = '60d5ecb74b24a0001c5e4b75';
    const mockCurrentUser = {
      _id: mockUserId,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      address: { city: 'New York' },
      preferences: { theme: 'light' }
    };

    const mockUpdateData = {
      firstName: 'Jane',
      phone: '+0987654321',
      address: { city: 'Los Angeles' },
      invalidField: 'should be ignored'
    };

    it('should update user profile and track changes', async () => {
      User.findById.mockResolvedValue(mockCurrentUser);
      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockCurrentUser,
          ...mockUpdateData
        })
      });

      const result = await UserService.updateUserProfile(mockUserId, mockUpdateData);

      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          firstName: 'Jane',
          phone: '+0987654321',
          address: { city: 'Los Angeles' },
          lastUpdated: expect.any(Date)
        }),
        { new: true, runValidators: true }
      );
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('changes');
      expect(result.changes).toContain('firstName');
      expect(result.changes).toContain('phone');
      expect(result.changes).toContain('address');
      expect(result.changes).not.toContain('invalidField');
    });

    it('should throw ValidationError for invalid user ID', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(UserService.updateUserProfile('invalid-id', mockUpdateData))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      User.findById.mockResolvedValue(null);

      await expect(UserService.updateUserProfile(mockUserId, mockUpdateData))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when no valid fields to update', async () => {
      User.findById.mockResolvedValue(mockCurrentUser);

      await expect(UserService.updateUserProfile(mockUserId, { invalidField: 'value' }))
        .rejects.toThrow(ValidationError);
    });

    it('should not create changes for identical values', async () => {
      const sameValueUpdate = {
        firstName: 'John', // Same as current
        lastName: 'Smith'  // Different from current
      };

      User.findById.mockResolvedValue(mockCurrentUser);
      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockCurrentUser,
          lastName: 'Smith'
        })
      });

      const result = await UserService.updateUserProfile(mockUserId, sameValueUpdate);

      expect(result.changes).toContain('lastName');
      expect(result.changes).not.toContain('firstName');
    });
  });

  describe('updateProfileImage', () => {
    const mockUserId = '60d5ecb74b24a0001c5e4b75';
    const mockUser = {
      _id: mockUserId,
      profileImage: 'old-image.jpg'
    };
    const newFilename = 'new-image.jpg';

    it('should update profile image and delete old image', async () => {
      User.findById.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          profileImage: newFilename
        })
      });
      fs.unlink.mockResolvedValue();

      const result = await UserService.updateProfileImage(mockUserId, newFilename);

      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('old-image.jpg')
      );
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          profileImage: newFilename,
          lastUpdated: expect.any(Date)
        }),
        { new: true }
      );
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('imageUrl');
      expect(result.imageUrl).toBe(`/uploads/profiles/${newFilename}`);
    });

    it('should handle case when old image does not exist', async () => {
      User.findById.mockResolvedValue(mockUser);
      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          profileImage: newFilename
        })
      });
      fs.unlink.mockRejectedValue(new Error('File not found'));

      const result = await UserService.updateProfileImage(mockUserId, newFilename);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('imageUrl');
    });

    it('should work when user has no existing profile image', async () => {
      const userWithoutImage = { ...mockUser, profileImage: null };
      User.findById.mockResolvedValue(userWithoutImage);
      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...userWithoutImage,
          profileImage: newFilename
        })
      });

      const result = await UserService.updateProfileImage(mockUserId, newFilename);

      expect(fs.unlink).not.toHaveBeenCalled();
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('imageUrl');
    });

    it('should throw ValidationError for invalid user ID', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(UserService.updateProfileImage('invalid-id', newFilename))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      User.findById.mockResolvedValue(null);

      await expect(UserService.updateProfileImage(mockUserId, newFilename))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('changePassword', () => {
    const mockUserId = '60d5ecb74b24a0001c5e4b75';
    const mockUser = {
      _id: mockUserId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'hashedCurrentPassword',
      passwordHistory: [
        { password: 'hashedOldPassword1', changedAt: new Date() },
        { password: 'hashedOldPassword2', changedAt: new Date() }
      ]
    };

    const currentPassword = 'currentPassword123';
    const newPassword = 'newPassword456';

    it('should change password successfully with valid inputs', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });
      bcrypt.compare
        .mockResolvedValueOnce(true)  // Current password is correct
        .mockResolvedValueOnce(false) // New password not in history
        .mockResolvedValueOnce(false); // New password not in history
      
      PasswordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        score: 4
      });
      bcrypt.hash.mockResolvedValue('hashedNewPassword');
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await UserService.changePassword(mockUserId, currentPassword, newPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, mockUser.password);
      expect(PasswordService.validatePasswordStrength).toHaveBeenCalledWith(
        newPassword, 
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        })
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          password: 'hashedNewPassword',
          passwordChangedAt: expect.any(Date),
          $push: expect.any(Object)
        })
      );
      expect(result.success).toBe(true);
      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('email');
    });

    it('should throw ValidationError for invalid user ID', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(UserService.changePassword('invalid-id', currentPassword, newPassword))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await expect(UserService.changePassword(mockUserId, currentPassword, newPassword))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw AuthenticationError for incorrect current password', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });
      bcrypt.compare.mockResolvedValue(false);

      await expect(UserService.changePassword(mockUserId, 'wrongPassword', newPassword))
        .rejects.toThrow(AuthenticationError);
    });

    it('should throw ValidationError when trying to reuse recent password', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });
      bcrypt.compare
        .mockResolvedValueOnce(true)  // Current password is correct
        .mockResolvedValueOnce(true); // New password matches history

      await expect(UserService.changePassword(mockUserId, currentPassword, newPassword))
        .rejects.toThrow(ValidationError);
      
      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
    });

    it('should throw ValidationError for weak password', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });
      bcrypt.compare
        .mockResolvedValueOnce(true)  // Current password is correct
        .mockResolvedValueOnce(false) // Not in history
        .mockResolvedValueOnce(false); // Not in history
      
      PasswordService.validatePasswordStrength.mockReturnValue({
        isValid: false,
        errors: ['Password too weak'],
        suggestions: ['Use more characters']
      });

      await expect(UserService.changePassword(mockUserId, currentPassword, 'weak'))
        .rejects.toThrow(ValidationError);
    });

    it('should handle user without password history', async () => {
      const userWithoutHistory = { ...mockUser, passwordHistory: null };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithoutHistory)
      });
      bcrypt.compare.mockResolvedValue(true);
      PasswordService.validatePasswordStrength.mockReturnValue({
        isValid: true,
        score: 4
      });
      bcrypt.hash.mockResolvedValue('hashedNewPassword');
      User.findByIdAndUpdate.mockResolvedValue(userWithoutHistory);

      const result = await UserService.changePassword(mockUserId, currentPassword, newPassword);

      expect(result.success).toBe(true);
    });
  });

  describe('deactivateAccount', () => {
    const mockUserId = '60d5ecb74b24a0001c5e4b75';
    const mockUser = { _id: mockUserId, isActive: true };

    it('should deactivate user account successfully', async () => {
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await UserService.deactivateAccount(mockUserId, 'User request');

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          isActive: false,
          deactivatedAt: expect.any(Date),
          deactivationReason: 'User request',
          lastUpdated: expect.any(Date)
        })
      );
      expect(result.success).toBe(true);
    });

    it('should use default reason when none provided', async () => {
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      await UserService.deactivateAccount(mockUserId);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          deactivationReason: 'User requested deactivation'
        })
      );
    });

    it('should throw ValidationError for invalid user ID', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(UserService.deactivateAccount('invalid-id'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      User.findByIdAndUpdate.mockResolvedValue(null);

      await expect(UserService.deactivateAccount(mockUserId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('exportUserData', () => {
    const mockUserId = '60d5ecb74b24a0001c5e4b75';
    const mockUser = {
      _id: mockUserId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com'
    };

    it('should export user data successfully', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await UserService.exportUserData(mockUserId);

      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(result).toHaveProperty('exportedAt');
      expect(result).toHaveProperty('exportVersion');
      expect(result).toHaveProperty('userData');
      expect(result.userData.profile).toEqual(mockUser);
      expect(result.exportedAt).toBeInstanceOf(Date);
    });

    it('should throw ValidationError for invalid user ID', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(UserService.exportUserData('invalid-id'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await expect(UserService.exportUserData(mockUserId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteAccount', () => {
    const mockUserId = '60d5ecb74b24a0001c5e4b75';
    const mockUser = {
      _id: mockUserId,
      profileImage: 'profile.jpg'
    };

    it('should delete user account and profile image successfully', async () => {
      User.findById.mockResolvedValue(mockUser);
      User.findByIdAndDelete.mockResolvedValue(mockUser);
      fs.unlink.mockResolvedValue();

      const result = await UserService.deleteAccount(mockUserId);

      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('profile.jpg')
      );
      expect(User.findByIdAndDelete).toHaveBeenCalledWith(mockUserId);
      expect(result.success).toBe(true);
    });

    it('should handle case when profile image does not exist', async () => {
      User.findById.mockResolvedValue(mockUser);
      User.findByIdAndDelete.mockResolvedValue(mockUser);
      fs.unlink.mockRejectedValue(new Error('File not found'));

      const result = await UserService.deleteAccount(mockUserId);

      expect(result.success).toBe(true);
    });

    it('should work when user has no profile image', async () => {
      const userWithoutImage = { ...mockUser, profileImage: null };
      User.findById.mockResolvedValue(userWithoutImage);
      User.findByIdAndDelete.mockResolvedValue(userWithoutImage);

      const result = await UserService.deleteAccount(mockUserId);

      expect(fs.unlink).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should throw ValidationError for invalid user ID', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(UserService.deleteAccount('invalid-id'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      User.findById.mockResolvedValue(null);

      await expect(UserService.deleteAccount(mockUserId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getUserPreferences', () => {
    const mockUserId = '60d5ecb74b24a0001c5e4b75';
    const mockUser = {
      _id: mockUserId,
      firstName: 'John',
      lastName: 'Doe',
      preferences: {
        currency: 'EUR',
        theme: 'dark',
        language: 'fr'
      }
    };

    it('should return user preferences with defaults merged', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await UserService.getUserPreferences(mockUserId);

      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(result).toHaveProperty('preferences');
      expect(result).toHaveProperty('user');
      expect(result.preferences.currency).toBe('EUR'); // User's preference
      expect(result.preferences.theme).toBe('dark'); // User's preference
      expect(result.preferences.dateFormat).toBe('MM/DD/YYYY'); // Default
      expect(result.user.firstName).toBe('John');
    });

    it('should return default preferences when user has none', async () => {
      const userWithoutPrefs = {
        _id: mockUserId,
        firstName: 'John',
        lastName: 'Doe',
        preferences: {}
      };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(userWithoutPrefs)
      });

      const result = await UserService.getUserPreferences(mockUserId);

      expect(result.preferences.currency).toBe('USD');
      expect(result.preferences.theme).toBe('light');
      expect(result.preferences.language).toBe('en');
    });

    it('should throw ValidationError for invalid user ID', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(UserService.getUserPreferences('invalid-id'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await expect(UserService.getUserPreferences(mockUserId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateUserPreferences', () => {
    const mockUserId = '60d5ecb74b24a0001c5e4b75';
    const mockUser = {
      _id: mockUserId,
      firstName: 'John',
      lastName: 'Doe',
      preferences: {
        currency: 'USD',
        theme: 'light'
      }
    };

    const preferencesUpdate = {
      currency: 'EUR',
      theme: 'dark',
      language: 'fr',
      invalidField: 'should be ignored'
    };

    it('should update user preferences successfully', async () => {
      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          preferences: {
            currency: 'EUR',
            theme: 'dark',
            language: 'fr'
          }
        })
      });

      const result = await UserService.updateUserPreferences(mockUserId, preferencesUpdate);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        {
          $set: {
            preferences: {
              currency: 'EUR',
              theme: 'dark',
              language: 'fr'
            }
          }
        },
        { new: true, runValidators: true }
      );
      expect(result).toHaveProperty('preferences');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('changes');
      expect(result.changes).toContain('currency');
      expect(result.changes).toContain('theme');
      expect(result.changes).toContain('language');
      expect(result.changes).not.toContain('invalidField');
    });

    it('should throw ValidationError for invalid user ID', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);

      await expect(UserService.updateUserPreferences('invalid-id', preferencesUpdate))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when no valid preferences to update', async () => {
      await expect(UserService.updateUserPreferences(mockUserId, { invalidField: 'value' }))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await expect(UserService.updateUserPreferences(mockUserId, preferencesUpdate))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('calculateProfileCompleteness', () => {
    it('should calculate 100% completeness for complete profile', () => {
      const completeUser = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        dateOfBirth: new Date('1990-01-01'),
        profileImage: 'profile.jpg',
        address: { city: 'New York' },
        preferences: { theme: 'dark' }
      };

      const result = UserService.calculateProfileCompleteness(completeUser);

      expect(result.percentage).toBe(100);
      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toHaveLength(0);
      expect(result.requiredCompleted).toBe(6);
      expect(result.optionalCompleted).toBe(2);
    });

    it('should calculate partial completeness for incomplete profile', () => {
      const incompleteUser = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
        // Missing phone, dateOfBirth, profileImage, address, preferences
      };

      const result = UserService.calculateProfileCompleteness(incompleteUser);

      expect(result.percentage).toBeLessThan(100);
      expect(result.isComplete).toBe(false);
      expect(result.missingFields).toContain('phone');
      expect(result.missingFields).toContain('dateOfBirth');
      expect(result.missingFields).toContain('profileImage');
      expect(result.requiredCompleted).toBe(3);
      expect(result.optionalCompleted).toBe(0);
    });

    it('should handle empty user object', () => {
      const emptyUser = {};

      const result = UserService.calculateProfileCompleteness(emptyUser);

      expect(result.percentage).toBe(0);
      expect(result.isComplete).toBe(false);
      expect(result.requiredCompleted).toBe(0);
      expect(result.optionalCompleted).toBe(0);
      expect(result.missingFields).toHaveLength(6);
    });

    it('should weight required fields more than optional fields', () => {
      const userWithRequiredOnly = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        dateOfBirth: new Date('1990-01-01'),
        profileImage: 'profile.jpg'
        // No optional fields
      };

      const userWithOptionalOnly = {
        address: { city: 'New York' },
        preferences: { theme: 'dark' }
        // No required fields
      };

      const requiredOnlyResult = UserService.calculateProfileCompleteness(userWithRequiredOnly);
      const optionalOnlyResult = UserService.calculateProfileCompleteness(userWithOptionalOnly);

      expect(requiredOnlyResult.percentage).toBeGreaterThan(optionalOnlyResult.percentage);
      expect(requiredOnlyResult.percentage).toBe(80); // 100% of required (80% weight)
      expect(optionalOnlyResult.percentage).toBe(20); // 100% of optional (20% weight)
    });
  });

  describe('Performance Tests', () => {
    it('should handle large user profile updates efficiently', async () => {
      const mockUserId = '60d5ecb74b24a0001c5e4b75';
      const largeUpdateData = {
        firstName: 'John',
        lastName: 'Doe',
        address: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA'
        },
        preferences: {
          currency: 'USD',
          dateFormat: 'MM/DD/YYYY',
          language: 'en',
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
            desktop: true
          },
          privacy: {
            showProfile: false,
            allowAnalytics: true
          }
        }
      };

      const mockCurrentUser = {
        _id: mockUserId,
        firstName: 'Jane',
        lastName: 'Smith',
        address: {},
        preferences: {}
      };

      User.findById.mockResolvedValue(mockCurrentUser);
      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockCurrentUser,
          ...largeUpdateData
        })
      });

      const startTime = Date.now();
      const result = await UserService.updateUserProfile(mockUserId, largeUpdateData);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('changes');
    });

    it('should handle profile completeness calculation efficiently', () => {
      const mockUser = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        dateOfBirth: new Date('1990-01-01'),
        profileImage: 'profile.jpg',
        address: { city: 'New York' },
        preferences: { theme: 'dark' }
      };

      const startTime = Date.now();
      const result = UserService.calculateProfileCompleteness(mockUser);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10); // Should complete in under 10ms
      expect(result).toHaveProperty('percentage');
      expect(result).toHaveProperty('missingFields');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      const mockUserId = '60d5ecb74b24a0001c5e4b75';
      User.findById.mockRejectedValue(new Error('Database connection failed'));

      await expect(UserService.getUserProfile(mockUserId))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle mongoose validation errors', async () => {
      const mockUserId = '60d5ecb74b24a0001c5e4b75';
      const mockCurrentUser = { _id: mockUserId, firstName: 'John' };
      
      User.findById.mockResolvedValue(mockCurrentUser);
      User.findByIdAndUpdate.mockRejectedValue(new Error('Validation failed'));

      await expect(UserService.updateUserProfile(mockUserId, { firstName: 'Jane' }))
        .rejects.toThrow('Validation failed');
    });

    it('should handle bcrypt errors during password change', async () => {
      const mockUserId = '60d5ecb74b24a0001c5e4b75';
      const mockUser = {
        _id: mockUserId,
        password: 'hashedPassword',
        passwordHistory: []
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });
      bcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      await expect(UserService.changePassword(mockUserId, 'current', 'new'))
        .rejects.toThrow('Bcrypt error');
    });
  });
});
