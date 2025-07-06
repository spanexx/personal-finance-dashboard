/**
 * Email Preferences Service Unit Tests
 * Tests email preference management functionality
 */

const EmailPreferencesService = require('../../services/emailPreferences.service');
const User = require('../../models/User');
const logger = require('../../utils/logger');
const { ValidationError, NotFoundError } = require('../../utils/errorHandler');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../utils/logger');
jest.mock('../../utils/errorHandler');

describe('EmailPreferencesService', () => {
  let mockUser;
  let mockUserId;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    mockUserId = 'user123';
    mockUser = {
      _id: mockUserId,
      email: 'test@example.com',
      notificationPreferences: {
        email: {
          types: {
            security: true,
            marketing: false,
            transactional: true,
            reports: false,
            newsletter: false,
            productUpdates: false
          },
          frequency: 'weekly'
        },
        budgetAlerts: {
          enabled: true,
          threshold: 80
        },
        goalReminders: {
          enabled: true,
          frequency: 'weekly'
        }
      },
      save: jest.fn().mockResolvedValue(true)
    };
  });

  describe('getUserEmailPreferences', () => {
    test('should get user email preferences successfully', async () => {
      // Arrange
      const mockUserSelect = {
        select: jest.fn().mockResolvedValue(mockUser)
      };
      User.findById.mockReturnValue(mockUserSelect);

      // Act
      const result = await EmailPreferencesService.getUserEmailPreferences(mockUserId);

      // Assert
      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(mockUserSelect.select).toHaveBeenCalledWith('notificationPreferences email');
      expect(result).toEqual({
        email: mockUser.email,
        preferences: mockUser.notificationPreferences
      });
    });    test('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      const mockUserSelect = {
        select: jest.fn().mockResolvedValue(null)
      };
      User.findById.mockReturnValue(mockUserSelect);

      // Act & Assert
      await expect(EmailPreferencesService.getUserEmailPreferences(mockUserId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateEmailPreferences', () => {
    test('should update all email preferences successfully', async () => {
      // Arrange
      User.findById.mockResolvedValue(mockUser);
      
      const preferencesData = {
        securityAlerts: true,
        marketingEmails: true,
        transactionalEmails: false,
        weeklyReports: true,
        budgetAlerts: false,
        goalReminders: false,
        productUpdates: true,
        newsletter: true,
        frequency: 'daily'
      };

      // Act
      const result = await EmailPreferencesService.updateEmailPreferences(mockUserId, preferencesData);

      // Assert
      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(mockUser.notificationPreferences.email.types.security).toBe(true);
      expect(mockUser.notificationPreferences.email.types.marketing).toBe(true);
      expect(mockUser.notificationPreferences.email.types.transactional).toBe(false);
      expect(mockUser.notificationPreferences.email.types.reports).toBe(true);
      expect(mockUser.notificationPreferences.budgetAlerts.enabled).toBe(false);
      expect(mockUser.notificationPreferences.goalReminders.enabled).toBe(false);
      expect(mockUser.notificationPreferences.email.frequency).toBe('daily');
      expect(mockUser.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Email preferences updated', {
        userId: mockUserId,
        preferences: mockUser.notificationPreferences
      });
      expect(result).toEqual({
        preferences: mockUser.notificationPreferences
      });
    });

    test('should update only specified preferences', async () => {
      // Arrange
      User.findById.mockResolvedValue(mockUser);
      
      const preferencesData = {
        securityAlerts: false,
        budgetAlerts: true
      };

      // Act
      const result = await EmailPreferencesService.updateEmailPreferences(mockUserId, preferencesData);

      // Assert
      expect(mockUser.notificationPreferences.email.types.security).toBe(false);
      expect(mockUser.notificationPreferences.budgetAlerts.enabled).toBe(true);
      // Other preferences should remain unchanged
      expect(mockUser.notificationPreferences.email.types.marketing).toBe(false);
      expect(mockUser.notificationPreferences.email.types.transactional).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();
    });

    test('should handle empty preferences data', async () => {
      // Arrange
      User.findById.mockResolvedValue(mockUser);
      const originalPreferences = { ...mockUser.notificationPreferences };

      // Act
      const result = await EmailPreferencesService.updateEmailPreferences(mockUserId, {});

      // Assert
      expect(mockUser.notificationPreferences).toEqual(originalPreferences);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual({
        preferences: mockUser.notificationPreferences
      });
    });

    test('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      User.findById.mockResolvedValue(null);
      
      const preferencesData = {
        securityAlerts: true
      };      // Act & Assert
      await expect(EmailPreferencesService.updateEmailPreferences(mockUserId, preferencesData))
        .rejects.toThrow(NotFoundError);
    });

    test('should handle undefined preferences gracefully', async () => {
      // Arrange
      User.findById.mockResolvedValue(mockUser);
      
      const preferencesData = {
        securityAlerts: undefined,
        marketingEmails: null,
        budgetAlerts: false
      };

      // Act
      const result = await EmailPreferencesService.updateEmailPreferences(mockUserId, preferencesData);      // Assert
      // Only budgetAlerts should be updated (false), others should remain unchanged
      expect(mockUser.notificationPreferences.budgetAlerts.enabled).toBe(false);
      expect(mockUser.notificationPreferences.email.types.security).toBe(true); // unchanged
      expect(mockUser.notificationPreferences.email.types.marketing).toBe(null); // set to null
      expect(mockUser.save).toHaveBeenCalled();
    });

    test('should handle database save error', async () => {
      // Arrange
      User.findById.mockResolvedValue(mockUser);
      mockUser.save.mockRejectedValue(new Error('Database save failed'));
      
      const preferencesData = {
        securityAlerts: true
      };

      // Act & Assert
      await expect(EmailPreferencesService.updateEmailPreferences(mockUserId, preferencesData))
        .rejects.toThrow('Database save failed');
    });
  });

  describe('unsubscribeUserFromEmailType', () => {
    beforeEach(() => {
      User.findOne.mockResolvedValue(mockUser);
    });

    test('should unsubscribe from marketing emails', async () => {
      // Act
      const result = await EmailPreferencesService.unsubscribeUserFromEmailType(
        mockUser.email, 
        'marketing'
      );

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: mockUser.email });
      expect(mockUser.notificationPreferences.email.types.marketing).toBe(false);
      expect(mockUser.notificationPreferences.email.types.newsletter).toBe(false);
      expect(mockUser.notificationPreferences.email.types.productUpdates).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('User unsubscribed from email type', {
        email: mockUser.email,
        type: 'marketing',
        userId: mockUser._id
      });
      expect(result).toEqual({
        email: mockUser.email,
        unsubscribedFrom: 'marketing',
        success: true,
        preferences: mockUser.notificationPreferences
      });
    });

    test('should unsubscribe from transactional emails', async () => {
      // Act
      const result = await EmailPreferencesService.unsubscribeUserFromEmailType(
        mockUser.email, 
        'transactional'
      );

      // Assert
      expect(mockUser.notificationPreferences.email.types.transactional).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.unsubscribedFrom).toBe('transactional');
    });

    test('should unsubscribe from reports emails', async () => {
      // Act
      const result = await EmailPreferencesService.unsubscribeUserFromEmailType(
        mockUser.email, 
        'reports'
      );

      // Assert
      expect(mockUser.notificationPreferences.email.types.reports).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.unsubscribedFrom).toBe('reports');
    });

    test('should unsubscribe from all email types except security', async () => {
      // Arrange
      mockUser.notificationPreferences.email.types = {
        security: true,
        marketing: true,
        transactional: true,
        reports: true,
        newsletter: true,
        productUpdates: true
      };

      // Act
      const result = await EmailPreferencesService.unsubscribeUserFromEmailType(
        mockUser.email, 
        'all'
      );

      // Assert
      expect(mockUser.notificationPreferences.email.types.security).toBe(true); // Should remain true
      expect(mockUser.notificationPreferences.email.types.marketing).toBe(false);
      expect(mockUser.notificationPreferences.email.types.transactional).toBe(false);
      expect(mockUser.notificationPreferences.email.types.reports).toBe(false);
      expect(mockUser.notificationPreferences.email.types.newsletter).toBe(false);
      expect(mockUser.notificationPreferences.email.types.productUpdates).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.unsubscribedFrom).toBe('all');
    });

    test('should not unsubscribe from security emails directly', async () => {
      // Act
      const result = await EmailPreferencesService.unsubscribeUserFromEmailType(
        mockUser.email, 
        'security'
      );

      // Assert
      expect(mockUser.notificationPreferences.email.types.security).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.unsubscribedFrom).toBe('security');
    });

    test('should throw NotFoundError when user does not exist', async () => {      // Arrange
      User.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(EmailPreferencesService.unsubscribeUserFromEmailType(
        'nonexistent@example.com', 
        'marketing'
      )).rejects.toThrow(NotFoundError);
    });

    test('should throw ValidationError for invalid email type', async () => {
      // Act & Assert      await expect(EmailPreferencesService.unsubscribeUserFromEmailType(
        mockUser.email, 
        'invalid_type'
      )).rejects.toThrow(ValidationError);

      expect(mockUser.save).not.toHaveBeenCalled();
    });

    test('should throw ValidationError when notification preferences not configured', async () => {
      // Arrange
      const userWithoutPreferences = {
        ...mockUser,
        notificationPreferences: null
      };      User.findOne.mockResolvedValue(userWithoutPreferences);

      // Act & Assert
      await expect(EmailPreferencesService.unsubscribeUserFromEmailType(
        mockUser.email, 
        'marketing'
      )).rejects.toThrow(ValidationError);
    });

    test('should throw ValidationError when email types not configured', async () => {
      // Arrange
      const userWithoutEmailTypes = {
        ...mockUser,
        notificationPreferences: {
          email: {}
        }
      };      User.findOne.mockResolvedValue(userWithoutEmailTypes);

      // Act & Assert
      await expect(EmailPreferencesService.unsubscribeUserFromEmailType(
        mockUser.email, 
        'marketing'
      )).rejects.toThrow(ValidationError);
    });

    test('should handle database save error during unsubscribe', async () => {
      // Arrange
      mockUser.save.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(EmailPreferencesService.unsubscribeUserFromEmailType(
        mockUser.email, 
        'marketing'
      )).rejects.toThrow('Database error');
    });

    test('should validate all supported email types', async () => {
      const validTypes = ['marketing', 'transactional', 'security', 'reports', 'all'];
      
      for (const type of validTypes) {
        // Reset mock user for each test
        mockUser.save.mockClear();
        User.findOne.mockResolvedValue(mockUser);

        const result = await EmailPreferencesService.unsubscribeUserFromEmailType(
          mockUser.email, 
          type
        );

        expect(result.unsubscribedFrom).toBe(type);
        expect(result.success).toBe(true);
        expect(mockUser.save).toHaveBeenCalled();
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed user data gracefully', async () => {
      // Arrange
      const malformedUser = {
        _id: mockUserId,
        email: 'test@example.com',
        notificationPreferences: {
          // Missing email object
        },
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(malformedUser);

      const preferencesData = {
        securityAlerts: true
      };

      // Act & Assert - Should not throw error, but won't update anything
      await expect(EmailPreferencesService.updateEmailPreferences(mockUserId, preferencesData))
        .resolves.toBeDefined();
    });

    test('should handle concurrent updates safely', async () => {
      // Arrange
      User.findById.mockResolvedValue(mockUser);
      
      const preferencesData1 = { securityAlerts: true };
      const preferencesData2 = { marketingEmails: false };

      // Act - Simulate concurrent updates
      const promises = await Promise.allSettled([
        EmailPreferencesService.updateEmailPreferences(mockUserId, preferencesData1),
        EmailPreferencesService.updateEmailPreferences(mockUserId, preferencesData2)
      ]);

      // Assert - Both should complete successfully
      expect(promises[0].status).toBe('fulfilled');
      expect(promises[1].status).toBe('fulfilled');
      expect(mockUser.save).toHaveBeenCalledTimes(2);
    });

    test('should handle extremely long email addresses', async () => {
      // Arrange
      const longEmail = 'a'.repeat(200) + '@example.com';
      User.findOne.mockResolvedValue({ ...mockUser, email: longEmail });

      // Act
      const result = await EmailPreferencesService.unsubscribeUserFromEmailType(
        longEmail, 
        'marketing'
      );

      // Assert
      expect(result.email).toBe(longEmail);
      expect(result.success).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    test('should handle bulk preference updates efficiently', async () => {
      // Arrange
      User.findById.mockResolvedValue(mockUser);
      
      const bulkPreferences = {
        securityAlerts: true,
        marketingEmails: false,
        transactionalEmails: true,
        weeklyReports: false,
        budgetAlerts: true,
        goalReminders: false,
        productUpdates: true,
        newsletter: false,
        frequency: 'monthly'
      };

      const startTime = Date.now();

      // Act
      const result = await EmailPreferencesService.updateEmailPreferences(mockUserId, bulkPreferences);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Assert
      expect(executionTime).toBeLessThan(100); // Should complete within 100ms
      expect(result.preferences).toBeDefined();
      expect(mockUser.save).toHaveBeenCalledTimes(1);
    });

    test('should handle multiple concurrent unsubscribe requests', async () => {
      // Arrange
      const emailTypes = ['marketing', 'reports', 'transactional'];
      const promises = emailTypes.map(type => {
        User.findOne.mockResolvedValue({
          ...mockUser,
          save: jest.fn().mockResolvedValue(true)
        });
        return EmailPreferencesService.unsubscribeUserFromEmailType(mockUser.email, type);
      });

      // Act
      const results = await Promise.allSettled(promises);

      // Assert
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        expect(result.value.unsubscribedFrom).toBe(emailTypes[index]);
      });
    });
  });

  describe('Logging and Monitoring', () => {
    test('should log preference updates with correct context', async () => {
      // Arrange
      User.findById.mockResolvedValue(mockUser);
      
      const preferencesData = {
        securityAlerts: false,
        marketingEmails: true
      };

      // Act
      await EmailPreferencesService.updateEmailPreferences(mockUserId, preferencesData);

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Email preferences updated', {
        userId: mockUserId,
        preferences: mockUser.notificationPreferences
      });
    });

    test('should log unsubscribe actions with user context', async () => {
      // Arrange
      User.findOne.mockResolvedValue(mockUser);

      // Act
      await EmailPreferencesService.unsubscribeUserFromEmailType(mockUser.email, 'marketing');

      // Assert
      expect(logger.info).toHaveBeenCalledWith('User unsubscribed from email type', {
        email: mockUser.email,
        type: 'marketing',
        userId: mockUser._id
      });
    });
  });
});
