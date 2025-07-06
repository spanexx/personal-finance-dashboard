/**
 * Rate Limiting Middleware
 * Implements tiered rate limiting for different endpoint types
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Create rate limit middleware with custom configuration
 * @param {Object} options - Rate limit options
 * @returns {Function} Rate limit middleware
 */
const createRateLimit = (options) => {
  const defaultOptions = {
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP ${req.ip}`, {
        ip: req.ip,
        url: req.originalUrl,
        userAgent: req.get('user-agent'),
        limit: options.max,
        windowMs: options.windowMs
      });
      
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: options.message || 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.round(options.windowMs / 1000)
      });
    },
    ...options
  };

  return rateLimit(defaultOptions);
};

/**
 * Global rate limiting - applies to all requests
 * 1000 requests per hour per IP
 */
const globalRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour
  message: 'Too many requests from this IP. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Authentication endpoints rate limiting
 * Development: 100 attempts per 15 minutes, Production: 5 attempts per 15 minutes
 */
const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // Higher limit for development
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator: (req) => {
    // Use combination of IP and email for more granular control
    const email = req.body?.email || 'unknown';
    return `auth_${req.ip}_${email}`;
  }
});

/**
 * Strict authentication rate limiting for sensitive operations
 * 3 attempts per hour per IP (for password reset, etc.)
 */
const strictAuthRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many sensitive authentication attempts. Please try again in 1 hour.',
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown';
    return `strict_auth_${req.ip}_${email}`;
  }
});

/**
 * API endpoints rate limiting
 * 100 requests per 15 minutes per authenticated user
 */
const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'API rate limit exceeded. Please try again later.',
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user?.id || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for certain endpoints if needed
    const skipPaths = ['/health', '/status'];
    return skipPaths.includes(req.path);
  }
});

/**
 * Password reset specific rate limiting
 * 3 attempts per hour per email address
 */
const passwordResetRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour per email
  message: 'Too many password reset attempts. Please try again in 1 hour.',
  keyGenerator: (req) => {
    const email = req.body?.email || req.query?.email || 'unknown';
    return `password_reset_${email}`;
  }
});

/**
 * Registration rate limiting
 * Development: 50 registrations per hour, Production: 5 registrations per hour
 */
const registrationRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // Higher limit for development
  message: 'Too many registration attempts. Please try again later.',
  skipSuccessfulRequests: false
});

/**
 * Email verification rate limiting
 * 10 verification requests per hour per IP
 */
const emailVerificationRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 verification requests per hour
  message: 'Too many email verification requests. Please try again later.'
});

/**
 * File upload rate limiting
 * 50 uploads per hour per user
 */
const fileUploadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: 'Too many file uploads. Please try again later.',
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

/**
 * Search rate limiting
 * 200 searches per hour per user (search can be resource intensive)
 */
const searchRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200, // 200 searches per hour
  message: 'Too many search requests. Please try again later.',
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

/**
 * Export rate limiting
 * 5 data exports per hour per user
 */
const exportRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 exports per hour
  message: 'Too many export requests. Please try again later.',
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

/**
 * Enhanced rate limiter with suspicious activity detection
 */
class SuspiciousActivityDetector {
  constructor() {
    this.suspiciousIPs = new Map();
    this.blockedIPs = new Set();
    this.cleanupInterval = null;
    
    // Start cleanup interval if not in test environment
    this.startCleanupInterval();
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    if (process.env.NODE_ENV === 'test') {
      logger.info('Suspicious activity detector cleanup disabled during tests');
      return;
    }

    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000); // Clean up every hour
    
    // Track interval for test cleanup if in test environment tracking mode
    if (global.testIntervalTracker) {
      global.testIntervalTracker.addInterval(this.cleanupInterval);
    }

    logger.info('Suspicious activity detector cleanup interval started');
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Suspicious activity detector cleanup interval stopped');
    }
  }

  /**
   * Check if IP shows suspicious activity
   * @param {string} ip - IP address
   * @param {string} endpoint - Endpoint being accessed
   * @returns {boolean} - Whether IP is suspicious
   */
  isSuspicious(ip, endpoint) {
    if (this.blockedIPs.has(ip)) {
      return true;
    }

    const activity = this.suspiciousIPs.get(ip) || {
      rapidRequests: 0,
      failedAuth: 0,
      lastActivity: Date.now(),
      endpoints: new Set()
    };

    // Update activity
    activity.endpoints.add(endpoint);
    activity.lastActivity = Date.now();

    // Check for suspicious patterns
    const now = Date.now();
    const timeDiff = now - activity.lastActivity;

    // Rapid requests (more than 100 requests in 1 minute)
    if (timeDiff < 60000) {
      activity.rapidRequests++;
      if (activity.rapidRequests > 100) {
        this.blockIP(ip, 'Rapid requests detected');
        return true;
      }
    } else {
      activity.rapidRequests = 0;
    }

    // Too many different endpoints accessed rapidly
    if (activity.endpoints.size > 50 && timeDiff < 300000) { // 50 endpoints in 5 minutes
      this.blockIP(ip, 'Scanning behavior detected');
      return true;
    }

    this.suspiciousIPs.set(ip, activity);
    return false;
  }

  /**
   * Record failed authentication attempt
   * @param {string} ip - IP address
   */
  recordFailedAuth(ip) {
    const activity = this.suspiciousIPs.get(ip) || {
      rapidRequests: 0,
      failedAuth: 0,
      lastActivity: Date.now(),
      endpoints: new Set()
    };

    activity.failedAuth++;
    activity.lastActivity = Date.now();

    // Block IP after too many failed auth attempts
    if (activity.failedAuth > 20) { // 20 failed attempts
      this.blockIP(ip, 'Multiple failed authentication attempts');
    }

    this.suspiciousIPs.set(ip, activity);
  }

  /**
   * Block an IP address
   * @param {string} ip - IP address to block
   * @param {string} reason - Reason for blocking
   */
  blockIP(ip, reason) {
    this.blockedIPs.add(ip);
    logger.warn(`IP ${ip} has been blocked: ${reason}`, {
      ip,
      reason,
      timestamp: new Date().toISOString()
    });

    // Auto-unblock after 24 hours
    setTimeout(() => {
      this.unblockIP(ip);
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Unblock an IP address
   * @param {string} ip - IP address to unblock
   */
  unblockIP(ip) {
    this.blockedIPs.delete(ip);
    this.suspiciousIPs.delete(ip);
    logger.info(`IP ${ip} has been unblocked`, { ip });
  }

  /**
   * Clean up old activity records
   */
  cleanup() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [ip, activity] of this.suspiciousIPs.entries()) {
      if (now - activity.lastActivity > oneHour) {
        this.suspiciousIPs.delete(ip);
      }
    }

    logger.debug(`Cleaned up suspicious activity records. Active IPs: ${this.suspiciousIPs.size}`);
  }

  /**
   * Get middleware to check for suspicious activity
   * @returns {Function} Express middleware
   */
  getMiddleware() {
    return (req, res, next) => {
      const ip = req.ip;
      
      if (this.isSuspicious(ip, req.path)) {
        logger.warn(`Blocked request from suspicious IP: ${ip}`, {
          ip,
          url: req.originalUrl,
          userAgent: req.get('user-agent')
        });
        
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Your IP has been temporarily blocked due to suspicious activity.'
        });
      }

      next();
    };
  }
}

// Create singleton instance
const suspiciousActivityDetector = new SuspiciousActivityDetector();

/**
 * Middleware to record failed authentication attempts
 */
const recordFailedAuth = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Check if response indicates failed authentication
    if (res.statusCode === 401 || res.statusCode === 403) {
      suspiciousActivityDetector.recordFailedAuth(req.ip);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  globalRateLimit,
  authRateLimit,
  strictAuthRateLimit,
  apiRateLimit,
  passwordResetRateLimit,
  registrationRateLimit,
  emailVerificationRateLimit,
  fileUploadRateLimit,
  searchRateLimit,
  exportRateLimit,
  suspiciousActivityDetector,
  recordFailedAuth,
  createRateLimit
};
