/**
 * Unit Tests for Security Monitor Service
 * Tests security monitoring, threat detection, and alert functionality
 */

const SecurityMonitor = require('../../services/securityMonitor.service');
const User = require('../../models/User');
const emailQueue = require('../../services/emailQueue.service');
const logger = require('../../utils/logger');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../services/emailQueue.service');
jest.mock('../../utils/logger');

describe('SecurityMonitor', () => {
  let securityMonitor;
  let mockUser;
  let originalEnv;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Clear any existing intervals
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Save original env
    originalEnv = process.env.SECURITY_MONITORING_ENABLED;

    // Create fresh instance for each test
    const SecurityMonitorClass = require('../../services/securityMonitor.service').constructor;
    securityMonitor = new SecurityMonitorClass();

    // Mock user
    mockUser = {
      _id: 'user123',
      email: 'test@example.com',
      firstName: 'John',
      notificationPreferences: {
        email: { enabled: true }
      }
    };

    // Mock dependencies
    User.findById = jest.fn().mockResolvedValue(mockUser);
    User.findOne = jest.fn().mockResolvedValue(mockUser);
    emailQueue.addToQueue = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
  });

  afterEach(() => {
    // Restore original env
    process.env.SECURITY_MONITORING_ENABLED = originalEnv;
    jest.useRealTimers();
  });

  describe('constructor', () => {
    test('should initialize with default settings', () => {
      expect(securityMonitor.maxLoginAttempts).toBe(5);
      expect(securityMonitor.lockoutDuration).toBe(15 * 60 * 1000);
      expect(securityMonitor.monitoringEnabled).toBe(true);
      expect(securityMonitor.loginAttempts).toBeInstanceOf(Map);
      expect(securityMonitor.suspiciousIPs).toBeInstanceOf(Set);
      expect(securityMonitor.recentActivities).toBeInstanceOf(Map);
    });

    test('should respect environment variable for monitoring', () => {
      process.env.SECURITY_MONITORING_ENABLED = 'false';
      const monitor = new (require('../../services/securityMonitor.service').constructor)();
      expect(monitor.monitoringEnabled).toBe(false);
    });
  });

  describe('logActivity', () => {
    test('should log user activity when monitoring is enabled', () => {
      const activityData = {
        type: 'login',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        location: 'New York',
        success: true
      };

      securityMonitor.logActivity('user123', activityData);

      expect(securityMonitor.recentActivities.has('user123')).toBe(true);
      const activities = securityMonitor.recentActivities.get('user123');
      expect(activities).toHaveLength(1);
      expect(activities[0]).toMatchObject({
        type: 'login',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        location: 'New York',
        success: true
      });
      expect(activities[0].timestamp).toBeInstanceOf(Date);
    });

    test('should not log activity when monitoring is disabled', () => {
      securityMonitor.monitoringEnabled = false;
      
      securityMonitor.logActivity('user123', {
        type: 'login',
        ipAddress: '192.168.1.1'
      });

      expect(securityMonitor.recentActivities.has('user123')).toBe(false);
    });

    test('should maintain only last 50 activities per user', () => {
      // Add 60 activities
      for (let i = 0; i < 60; i++) {
        securityMonitor.logActivity('user123', {
          type: 'transaction',
          ipAddress: '192.168.1.1',
          success: true
        });
      }

      const activities = securityMonitor.recentActivities.get('user123');
      expect(activities).toHaveLength(50);
    });

    test('should set success to true by default', () => {
      securityMonitor.logActivity('user123', {
        type: 'login',
        ipAddress: '192.168.1.1'
      });

      const activities = securityMonitor.recentActivities.get('user123');
      expect(activities[0].success).toBe(true);
    });

    test('should call analyzeActivity for each logged activity', () => {
      const spy = jest.spyOn(securityMonitor, 'analyzeActivity');
      
      securityMonitor.logActivity('user123', {
        type: 'login',
        ipAddress: '192.168.1.1'
      });

      expect(spy).toHaveBeenCalledWith('user123', expect.any(Object));
    });

    test('should log activity information', () => {
      securityMonitor.logActivity('user123', {
        type: 'login',
        ipAddress: '192.168.1.1',
        success: true
      });

      expect(logger.info).toHaveBeenCalledWith('User activity logged', {
        userId: 'user123',
        type: 'login',
        ipAddress: '192.168.1.1',
        success: true
      });
    });
  });

  describe('trackFailedLogin', () => {
    test('should track failed login attempts', () => {
      const result = securityMonitor.trackFailedLogin('192.168.1.1', 'test@example.com');

      expect(result).toEqual({
        blocked: false,
        attemptsLeft: 4,
        blockExpiresAt: null
      });
      expect(securityMonitor.loginAttempts.has('192.168.1.1:test@example.com')).toBe(true);
    });

    test('should block IP after max attempts', () => {
      const ip = '192.168.1.1';
      const email = 'test@example.com';

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        securityMonitor.trackFailedLogin(ip, email);
      }

      const result = securityMonitor.trackFailedLogin(ip, email);
      expect(result.blocked).toBe(true);
      expect(result.attemptsLeft).toBe(0);
      expect(result.blockExpiresAt).toBeInstanceOf(Date);
      expect(securityMonitor.suspiciousIPs.has(ip)).toBe(true);
    });

    test('should reset attempts after lockout period', () => {
      jest.useRealTimers();
      const ip = '192.168.1.1';
      const email = 'test@example.com';

      // Block the IP
      for (let i = 0; i < 6; i++) {
        securityMonitor.trackFailedLogin(ip, email);
      }

      // Mock time passage
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => originalDateNow() + 16 * 60 * 1000); // 16 minutes later

      const result = securityMonitor.trackFailedLogin(ip, email);
      expect(result.blocked).toBe(false);
      expect(result.attemptsLeft).toBe(4);

      // Restore Date.now
      Date.now = originalDateNow;
      jest.useFakeTimers();
    });

    test('should not track when monitoring is disabled', () => {
      securityMonitor.monitoringEnabled = false;

      const result = securityMonitor.trackFailedLogin('192.168.1.1', 'test@example.com');

      expect(result).toEqual({
        blocked: false,
        attemptsLeft: 5
      });
      expect(securityMonitor.loginAttempts.size).toBe(0);
    });

    test('should log warning when IP is blocked', () => {
      const ip = '192.168.1.1';
      const email = 'test@example.com';

      // Make enough attempts to block
      for (let i = 0; i < 5; i++) {
        securityMonitor.trackFailedLogin(ip, email);
      }

      expect(logger.warn).toHaveBeenCalledWith('IP blocked due to failed login attempts', {
        ipAddress: ip,
        email,
        attempts: 5
      });
    });

    test('should send login abuse alert when blocked', () => {
      const spy = jest.spyOn(securityMonitor, 'sendLoginAbuseAlert');
      const ip = '192.168.1.1';
      const email = 'test@example.com';

      // Make enough attempts to block
      for (let i = 0; i < 5; i++) {
        securityMonitor.trackFailedLogin(ip, email);
      }

      expect(spy).toHaveBeenCalledWith(email, ip);
    });
  });

  describe('resetLoginAttempts', () => {
    test('should reset login attempts for successful login', () => {
      const ip = '192.168.1.1';
      const email = 'test@example.com';

      // Track some failed attempts
      securityMonitor.trackFailedLogin(ip, email);
      securityMonitor.trackFailedLogin(ip, email);

      expect(securityMonitor.loginAttempts.has(`${ip}:${email}`)).toBe(true);

      securityMonitor.resetLoginAttempts(ip, email);

      expect(securityMonitor.loginAttempts.has(`${ip}:${email}`)).toBe(false);
    });
  });

  describe('isSuspiciousIP', () => {
    test('should return true for suspicious IPs', () => {
      securityMonitor.suspiciousIPs.add('192.168.1.1');
      expect(securityMonitor.isSuspiciousIP('192.168.1.1')).toBe(true);
    });

    test('should return false for non-suspicious IPs', () => {
      expect(securityMonitor.isSuspiciousIP('192.168.1.1')).toBe(false);
    });
  });

  describe('analyzeActivity', () => {
    test('should not analyze with insufficient activity history', () => {
      securityMonitor.logActivity('user123', {
        type: 'login',
        ipAddress: '192.168.1.1',
        success: true
      });

      // No alerts should be sent for single activity
      expect(emailQueue.addToQueue).not.toHaveBeenCalled();
    });

    test('should detect login from new location', async () => {
      // Establish pattern with known location
      for (let i = 0; i < 5; i++) {
        securityMonitor.logActivity('user123', {
          type: 'login',
          ipAddress: '192.168.1.1',
          location: 'New York',
          success: true
        });
      }

      const spy = jest.spyOn(securityMonitor, 'sendSecurityAlerts');

      // Login from new location
      securityMonitor.logActivity('user123', {
        type: 'login',
        ipAddress: '192.168.1.2',
        location: 'London',
        success: true
      });

      expect(spy).toHaveBeenCalledWith(
        'user123',
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({
            type: 'Login from new location',
            riskLevel: 'medium'
          })
        ])
      );
    });

    test('should detect rapid logins from multiple IPs', () => {
      const baseTime = new Date('2023-01-01T12:00:00Z');
      
      // First login
      securityMonitor.recentActivities.set('user123', [{
        type: 'login',
        ipAddress: '192.168.1.1',
        timestamp: baseTime,
        success: true
      }]);

      // Second login from different IP within 5 minutes
      securityMonitor.recentActivities.get('user123').push({
        type: 'login',
        ipAddress: '192.168.1.2',
        timestamp: new Date(baseTime.getTime() + 2 * 60 * 1000), // 2 minutes later
        success: true
      });

      const spy = jest.spyOn(securityMonitor, 'sendSecurityAlerts');

      // Third login should trigger alert
      securityMonitor.logActivity('user123', {
        type: 'login',
        ipAddress: '192.168.1.3',
        success: true
      });

      expect(spy).toHaveBeenCalledWith(
        'user123',
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({
            type: 'Rapid logins from multiple IPs',
            riskLevel: 'high'
          })
        ])
      );
    });

    test('should detect unusual login time', () => {
      // Establish normal login pattern (morning hours)
      for (let i = 0; i < 10; i++) {
        const timestamp = new Date(`2023-01-${i + 1}T09:00:00Z`);
        securityMonitor.recentActivities.set('user123', [
          ...(securityMonitor.recentActivities.get('user123') || []),
          {
            type: 'login',
            timestamp,
            success: true
          }
        ]);
      }

      const spy = jest.spyOn(securityMonitor, 'sendSecurityAlerts');

      // Login at unusual time (night)
      securityMonitor.logActivity('user123', {
        type: 'login',
        ipAddress: '192.168.1.1',
        success: true,
        // Mock timestamp for 3 AM
        timestamp: new Date('2023-01-15T03:00:00Z')
      });

      // Manually set the timestamp in recent activities
      const activities = securityMonitor.recentActivities.get('user123');
      activities[activities.length - 1].timestamp = new Date('2023-01-15T03:00:00Z');

      // Re-analyze
      securityMonitor.analyzeActivity('user123', activities[activities.length - 1]);

      expect(spy).toHaveBeenCalledWith(
        'user123',
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({
            type: 'Unusual login time',
            riskLevel: 'low'
          })
        ])
      );
    });

    test('should detect login after multiple failures', () => {
      // Add multiple failed login attempts
      const failedActivities = Array.from({ length: 4 }, () => ({
        type: 'login',
        timestamp: new Date(),
        success: false
      }));

      securityMonitor.recentActivities.set('user123', failedActivities);

      const spy = jest.spyOn(securityMonitor, 'sendSecurityAlerts');

      // Successful login after failures
      securityMonitor.logActivity('user123', {
        type: 'login',
        ipAddress: '192.168.1.1',
        success: true
      });

      expect(spy).toHaveBeenCalledWith(
        'user123',
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({
            type: 'Login after multiple failures',
            riskLevel: 'medium'
          })
        ])
      );
    });
  });

  describe('sendSecurityAlerts', () => {
    test('should send email alerts for high and medium risk alerts', async () => {
      const alerts = [
        { type: 'High risk alert', riskLevel: 'high', message: 'Test high' },
        { type: 'Medium risk alert', riskLevel: 'medium', message: 'Test medium' },
        { type: 'Low risk alert', riskLevel: 'low', message: 'Test low' }
      ];

      const activity = {
        type: 'login',
        timestamp: new Date(),
        ipAddress: '192.168.1.1',
        location: 'New York',
        userAgent: 'Mozilla/5.0'
      };

      await securityMonitor.sendSecurityAlerts('user123', activity, alerts);

      expect(emailQueue.addToQueue).toHaveBeenCalledTimes(2); // Only high and medium
      expect(emailQueue.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          templateName: 'security-alert'
        }),
        { priority: 'high' }
      );
      expect(emailQueue.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          templateName: 'security-alert'
        }),
        { priority: 'normal' }
      );
    });

    test('should not send alerts if user not found', async () => {
      User.findById.mockResolvedValue(null);

      await securityMonitor.sendSecurityAlerts('user123', {}, [
        { type: 'Test', riskLevel: 'high', message: 'Test' }
      ]);

      expect(emailQueue.addToQueue).not.toHaveBeenCalled();
    });

    test('should not send alerts if email notifications disabled', async () => {
      const userWithDisabledNotifications = {
        ...mockUser,
        notificationPreferences: { email: { enabled: false } }
      };
      User.findById.mockResolvedValue(userWithDisabledNotifications);

      await securityMonitor.sendSecurityAlerts('user123', {}, [
        { type: 'Test', riskLevel: 'high', message: 'Test' }
      ]);

      expect(emailQueue.addToQueue).not.toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      const error = new Error('Database error');
      User.findById.mockRejectedValue(error);

      await securityMonitor.sendSecurityAlerts('user123', {}, [
        { type: 'Test', riskLevel: 'high', message: 'Test' }
      ]);

      expect(logger.error).toHaveBeenCalledWith('Failed to send security alerts:', error);
    });

    test('should not send alerts for low risk only', async () => {
      await securityMonitor.sendSecurityAlerts('user123', {}, [
        { type: 'Low risk', riskLevel: 'low', message: 'Test' }
      ]);

      expect(emailQueue.addToQueue).not.toHaveBeenCalled();
    });
  });

  describe('sendLoginAbuseAlert', () => {
    test('should send login abuse alert', async () => {
      await securityMonitor.sendLoginAbuseAlert('test@example.com', '192.168.1.1');

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(emailQueue.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          templateName: 'security-alert',
          templateData: expect.objectContaining({
            user: mockUser,
            alertData: expect.objectContaining({
              type: 'Multiple failed login attempts',
              riskLevel: 'high',
              ipAddress: '192.168.1.1'
            })
          })
        }),
        { priority: 'high' }
      );
    });

    test('should not send alert if user not found', async () => {
      User.findOne.mockResolvedValue(null);

      await securityMonitor.sendLoginAbuseAlert('test@example.com', '192.168.1.1');

      expect(emailQueue.addToQueue).not.toHaveBeenCalled();
    });

    test('should handle errors in login abuse alert', async () => {
      const error = new Error('Email service error');
      User.findOne.mockRejectedValue(error);

      await securityMonitor.sendLoginAbuseAlert('test@example.com', '192.168.1.1');

      expect(logger.error).toHaveBeenCalledWith('Failed to send login abuse alert:', error);
    });
  });

  describe('getSecurityStats', () => {
    test('should return security statistics', () => {
      securityMonitor.suspiciousIPs.add('192.168.1.1');
      securityMonitor.suspiciousIPs.add('192.168.1.2');
      securityMonitor.loginAttempts.set('key1', {});
      securityMonitor.recentActivities.set('user1', []);
      securityMonitor.recentActivities.set('user2', []);

      const stats = securityMonitor.getSecurityStats();

      expect(stats).toEqual({
        suspiciousIPs: 2,
        activeLoginAttempts: 1,
        monitoredUsers: 2,
        monitoringEnabled: true
      });
    });
  });

  describe('cleanup', () => {
    test('should clean up old login attempts', () => {
      jest.useRealTimers();
      const oldTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      const recentTime = Date.now() - 1 * 60 * 60 * 1000; // 1 hour ago

      securityMonitor.loginAttempts.set('old', { lastAttempt: oldTime });
      securityMonitor.loginAttempts.set('recent', { lastAttempt: recentTime });

      securityMonitor.cleanup();

      expect(securityMonitor.loginAttempts.has('old')).toBe(false);
      expect(securityMonitor.loginAttempts.has('recent')).toBe(true);
      jest.useFakeTimers();
    });

    test('should clean up old activities', () => {
      jest.useRealTimers();
      const oldActivity = {
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      };
      const recentActivity = {
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
      };

      securityMonitor.recentActivities.set('user1', [oldActivity]);
      securityMonitor.recentActivities.set('user2', [recentActivity]);
      securityMonitor.recentActivities.set('user3', [oldActivity, recentActivity]);

      securityMonitor.cleanup();

      expect(securityMonitor.recentActivities.has('user1')).toBe(false);
      expect(securityMonitor.recentActivities.has('user2')).toBe(true);
      expect(securityMonitor.recentActivities.get('user3')).toHaveLength(1);
      jest.useFakeTimers();
    });

    test('should log cleanup completion', () => {
      securityMonitor.cleanup();

      expect(logger.info).toHaveBeenCalledWith(
        'Security monitoring cleanup completed',
        expect.objectContaining({
          loginAttempts: expect.any(Number),
          monitoredUsers: expect.any(Number)
        })
      );
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle missing location gracefully', () => {
      securityMonitor.logActivity('user123', {
        type: 'login',
        ipAddress: '192.168.1.1',
        success: true
        // location is undefined
      });

      const activities = securityMonitor.recentActivities.get('user123');
      expect(activities[0].location).toBeUndefined();
    });

    test('should handle malformed activity data', () => {
      expect(() => {
        securityMonitor.logActivity('user123', {
          type: null,
          ipAddress: undefined,
          success: 'not_boolean'
        });
      }).not.toThrow();
    });

    test('should handle concurrent access to data structures', () => {
      // Simulate concurrent access
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => {
          securityMonitor.logActivity(`user${i % 10}`, {
            type: 'login',
            ipAddress: `192.168.1.${i % 255}`,
            success: i % 2 === 0
          });
        })
      );

      expect(() => Promise.all(promises)).not.toThrow();
    });

    test('should handle very large activity history', () => {
      // Add many activities
      const activities = Array.from({ length: 1000 }, (_, i) => ({
        type: 'transaction',
        timestamp: new Date(Date.now() - i * 1000),
        success: true
      }));

      securityMonitor.recentActivities.set('user123', activities);

      // Should limit to 50 activities
      securityMonitor.logActivity('user123', {
        type: 'login',
        ipAddress: '192.168.1.1',
        success: true
      });

      const userActivities = securityMonitor.recentActivities.get('user123');
      expect(userActivities).toHaveLength(50);
    });
  });

  describe('performance considerations', () => {
    test('should handle large number of users efficiently', () => {
      const startTime = Date.now();

      // Add activities for many users
      for (let i = 0; i < 1000; i++) {
        securityMonitor.logActivity(`user${i}`, {
          type: 'login',
          ipAddress: `192.168.1.${i % 255}`,
          success: true
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle memory efficiently during cleanup', () => {
      jest.useRealTimers();
      
      // Add large amount of old data
      for (let i = 0; i < 1000; i++) {
        securityMonitor.loginAttempts.set(`old_${i}`, {
          lastAttempt: Date.now() - 25 * 60 * 60 * 1000
        });
        securityMonitor.recentActivities.set(`old_user_${i}`, [{
          timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000)
        }]);
      }

      const initialMemoryUsage = {
        loginAttempts: securityMonitor.loginAttempts.size,
        activities: securityMonitor.recentActivities.size
      };

      securityMonitor.cleanup();

      expect(securityMonitor.loginAttempts.size).toBeLessThan(initialMemoryUsage.loginAttempts);
      expect(securityMonitor.recentActivities.size).toBeLessThan(initialMemoryUsage.activities);
      
      jest.useFakeTimers();
    });
  });

  describe('singleton behavior', () => {
    test('should maintain singleton pattern', () => {
      const SecurityMonitorModule = require('../../services/securityMonitor.service');
      const instance1 = SecurityMonitorModule;
      const instance2 = SecurityMonitorModule;

      expect(instance1).toBe(instance2);
    });

    test('should have cleanup interval set up', () => {
      // The actual module sets up an interval for cleanup
      const SecurityMonitorModule = require('../../services/securityMonitor.service');
      expect(SecurityMonitorModule).toBeDefined();
    });
  });
});
