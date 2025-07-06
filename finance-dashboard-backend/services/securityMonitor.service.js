/**
 * Security Monitoring Service
 * Monitors and detects suspicious activities
 */

const User = require('../models/User');
const emailQueue = require('./emailQueue.service');
const logger = require('../utils/logger');

class SecurityMonitor {
  constructor() {
    this.loginAttempts = new Map(); // IP -> attempts
    this.suspiciousIPs = new Set();
    this.recentActivities = new Map(); // userId -> activities array
    this.maxLoginAttempts = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
    this.monitoringEnabled = process.env.SECURITY_MONITORING_ENABLED !== 'false';
    this.cleanupInterval = null;
    
    // Start cleanup interval if not in test environment
    this.startCleanupInterval();
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    if (process.env.NODE_ENV === 'test') {
      logger.info('Security monitor cleanup interval disabled during tests');
      return;
    }

    if (this.cleanupInterval) {
      logger.info('Security monitor cleanup interval already running');
      return;
    }

    // Cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);

    // Track interval for test cleanup if in test environment tracking mode
    if (global.testIntervalTracker) {
      global.testIntervalTracker.addInterval(this.cleanupInterval);
    }

    logger.info('Security monitor cleanup interval started (every hour)');
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Security monitor cleanup interval stopped');
    }
  }

  /**
   * Log user activity
   * @param {string} userId - User ID
   * @param {Object} activityData - Activity information
   */
  logActivity(userId, activityData) {
    if (!this.monitoringEnabled) return;

    const activity = {
      type: activityData.type,
      timestamp: new Date(),
      ipAddress: activityData.ipAddress,
      userAgent: activityData.userAgent,
      location: activityData.location,
      success: activityData.success !== false
    };

    // Store recent activities for analysis
    if (!this.recentActivities.has(userId)) {
      this.recentActivities.set(userId, []);
    }

    const userActivities = this.recentActivities.get(userId);
    userActivities.push(activity);

    // Keep only last 50 activities per user
    if (userActivities.length > 50) {
      userActivities.shift();
    }

    // Analyze for suspicious patterns
    this.analyzeActivity(userId, activity);

    logger.info('User activity logged', {
      userId,
      type: activity.type,
      ipAddress: activity.ipAddress,
      success: activity.success
    });
  }

  /**
   * Track failed login attempts
   * @param {string} ipAddress - IP address
   * @param {string} email - Email attempted
   * @returns {Object} - Login attempt status
   */
  trackFailedLogin(ipAddress, email) {
    if (!this.monitoringEnabled) {
      return { blocked: false, attemptsLeft: this.maxLoginAttempts };
    }

    const key = `${ipAddress}:${email}`;
    const now = Date.now();

    if (!this.loginAttempts.has(key)) {
      this.loginAttempts.set(key, { count: 0, lastAttempt: now, blocked: false });
    }

    const attempts = this.loginAttempts.get(key);

    // Reset if lockout period has passed
    if (attempts.blocked && (now - attempts.lastAttempt > this.lockoutDuration)) {
      attempts.count = 0;
      attempts.blocked = false;
    }

    attempts.count++;
    attempts.lastAttempt = now;

    // Block if max attempts exceeded
    if (attempts.count >= this.maxLoginAttempts) {
      attempts.blocked = true;
      this.suspiciousIPs.add(ipAddress);
      
      logger.warn('IP blocked due to failed login attempts', {
        ipAddress,
        email,
        attempts: attempts.count
      });

      // Send security alert if user exists
      this.sendLoginAbuseAlert(email, ipAddress);
    }

    return {
      blocked: attempts.blocked,
      attemptsLeft: Math.max(0, this.maxLoginAttempts - attempts.count),
      blockExpiresAt: attempts.blocked ? new Date(attempts.lastAttempt + this.lockoutDuration) : null
    };
  }

  /**
   * Reset login attempts for successful login
   * @param {string} ipAddress - IP address
   * @param {string} email - Email
   */
  resetLoginAttempts(ipAddress, email) {
    const key = `${ipAddress}:${email}`;
    this.loginAttempts.delete(key);
  }

  /**
   * Check if IP is suspicious
   * @param {string} ipAddress - IP address
   * @returns {boolean} - Is suspicious
   */
  isSuspiciousIP(ipAddress) {
    return this.suspiciousIPs.has(ipAddress);
  }

  /**
   * Analyze activity for suspicious patterns
   * @param {string} userId - User ID
   * @param {Object} activity - Current activity
   */
  analyzeActivity(userId, activity) {
    const userActivities = this.recentActivities.get(userId);
    if (!userActivities || userActivities.length < 2) return;

    const recentActivities = userActivities.slice(-10); // Last 10 activities
    const lastActivity = recentActivities[recentActivities.length - 2];

    // Check for suspicious patterns
    const alerts = [];

    // 1. Login from new location
    if (activity.type === 'login' && activity.success) {
      const recentLogins = recentActivities.filter(a => a.type === 'login' && a.success);
      const knownLocations = [...new Set(recentLogins.map(a => a.location))];
      
      if (knownLocations.length > 1 && !knownLocations.includes(activity.location)) {
        alerts.push({
          type: 'Login from new location',
          message: `Login detected from a new location: ${activity.location}`,
          riskLevel: 'medium'
        });
      }
    }

    // 2. Rapid succession logins from different IPs
    if (activity.type === 'login' && activity.success) {
      const recentLogins = recentActivities
        .filter(a => a.type === 'login' && a.success)
        .slice(-3);
      
      if (recentLogins.length >= 2) {
        const uniqueIPs = [...new Set(recentLogins.map(a => a.ipAddress))];
        const timeDiff = activity.timestamp - recentLogins[0].timestamp;
        
        if (uniqueIPs.length > 1 && timeDiff < 5 * 60 * 1000) { // 5 minutes
          alerts.push({
            type: 'Rapid logins from multiple IPs',
            message: 'Multiple logins detected from different IP addresses within 5 minutes',
            riskLevel: 'high'
          });
        }
      }
    }

    // 3. Unusual login time
    if (activity.type === 'login' && activity.success) {
      const hour = activity.timestamp.getHours();
      const recentLogins = recentActivities
        .filter(a => a.type === 'login' && a.success)
        .slice(-20);
      
      if (recentLogins.length > 5) {
        const normalHours = recentLogins.map(a => a.timestamp.getHours());
        const avgHour = normalHours.reduce((a, b) => a + b, 0) / normalHours.length;
        
        if (Math.abs(hour - avgHour) > 6) { // More than 6 hours difference
          alerts.push({
            type: 'Unusual login time',
            message: `Login at unusual time: ${hour}:00`,
            riskLevel: 'low'
          });
        }
      }
    }

    // 4. Multiple failed attempts followed by success
    if (activity.type === 'login' && activity.success) {
      const recentAttempts = recentActivities
        .filter(a => a.type === 'login')
        .slice(-5);
      
      const failedCount = recentAttempts.filter(a => !a.success).length;
      if (failedCount >= 3) {
        alerts.push({
          type: 'Login after multiple failures',
          message: `Successful login after ${failedCount} failed attempts`,
          riskLevel: 'medium'
        });
      }
    }

    // Send alerts if any
    if (alerts.length > 0) {
      this.sendSecurityAlerts(userId, activity, alerts);
    }
  }

  /**
   * Send security alerts to user
   * @param {string} userId - User ID
   * @param {Object} activity - Current activity
   * @param {Array} alerts - Security alerts
   */
  async sendSecurityAlerts(userId, activity, alerts) {
    try {
      const user = await User.findById(userId).select('email firstName notificationPreferences');
      if (!user || !user.notificationPreferences.email.enabled) {
        return;
      }

      // Only send high and medium risk alerts by email
      const criticalAlerts = alerts.filter(alert => 
        alert.riskLevel === 'high' || alert.riskLevel === 'medium'
      );

      if (criticalAlerts.length === 0) return;

      for (const alert of criticalAlerts) {
        const alertData = {
          type: alert.type,
          message: alert.message,
          riskLevel: alert.riskLevel,
          activityType: activity.type,
          timestamp: activity.timestamp,
          ipAddress: activity.ipAddress,
          location: activity.location || 'Unknown',
          userAgent: activity.userAgent || 'Unknown'
        };

        // Add to email queue
        emailQueue.addToQueue({
          templateName: 'security-alert',
          templateData: {
            user,
            alertData
          }
        }, { priority: alert.riskLevel === 'high' ? 'high' : 'normal' });

        logger.warn('Security alert sent', {
          userId,
          alertType: alert.type,
          riskLevel: alert.riskLevel
        });
      }

    } catch (error) {
      logger.error('Failed to send security alerts:', error);
    }
  }

  /**
   * Send login abuse alert
   * @param {string} email - Email being abused
   * @param {string} ipAddress - Abusive IP
   */
  async sendLoginAbuseAlert(email, ipAddress) {
    try {
      const user = await User.findOne({ email }).select('firstName email notificationPreferences');
      if (!user || !user.notificationPreferences.email.enabled) {
        return;
      }

      const alertData = {
        type: 'Multiple failed login attempts',
        message: `Multiple failed login attempts detected from IP: ${ipAddress}`,
        riskLevel: 'high',
        activityType: 'failed_login',
        timestamp: new Date(),
        ipAddress,
        location: 'Unknown',
        userAgent: 'Unknown'
      };

      emailQueue.addToQueue({
        templateName: 'security-alert',
        templateData: {
          user,
          alertData
        }
      }, { priority: 'high' });

    } catch (error) {
      logger.error('Failed to send login abuse alert:', error);
    }
  }

  /**
   * Get security statistics
   * @returns {Object} - Security stats
   */
  getSecurityStats() {
    return {
      suspiciousIPs: this.suspiciousIPs.size,
      activeLoginAttempts: this.loginAttempts.size,
      monitoredUsers: this.recentActivities.size,
      monitoringEnabled: this.monitoringEnabled
    };
  }

  /**
   * Clean up old data
   */
  cleanup() {
    const now = Date.now();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours

    // Clean old login attempts
    for (const [key, attempts] of this.loginAttempts.entries()) {
      if (now - attempts.lastAttempt > cleanupThreshold) {
        this.loginAttempts.delete(key);
      }
    }

    // Clean old activities
    for (const [userId, activities] of this.recentActivities.entries()) {
      const recentActivities = activities.filter(
        activity => now - activity.timestamp.getTime() < cleanupThreshold
      );
      
      if (recentActivities.length === 0) {
        this.recentActivities.delete(userId);
      } else {
        this.recentActivities.set(userId, recentActivities);
      }
    }

    logger.info('Security monitoring cleanup completed', {
      loginAttempts: this.loginAttempts.size,
      monitoredUsers: this.recentActivities.size
    });
  }
}

// Create singleton instance
const securityMonitor = new SecurityMonitor();

module.exports = securityMonitor;
