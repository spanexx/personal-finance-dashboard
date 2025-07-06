/**
 * Logging Middleware
 * Provides comprehensive request/response logging, performance monitoring, and security event tracking
 */

const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Configuration for logging middleware
 */
const LOGGING_CONFIG = {
  // Request/Response logging
  logRequests: process.env.LOG_REQUESTS !== 'false',
  logResponses: process.env.LOG_RESPONSES !== 'false',
  
  // Performance monitoring
  performanceThreshold: parseInt(process.env.PERFORMANCE_THRESHOLD) || 1000, // ms
  
  // Request body logging (be careful with sensitive data)
  logRequestBody: process.env.LOG_REQUEST_BODY === 'true',
  logResponseBody: process.env.LOG_RESPONSE_BODY === 'true',
  
  // Skip logging for certain paths
  skipPaths: [
    '/health',
    '/favicon.ico',
    '/robots.txt'
  ],
  
  // Maximum body size to log (in bytes)
  maxBodySize: parseInt(process.env.MAX_LOG_BODY_SIZE) || 1024 * 10, // 10KB
  
  // Sensitive fields to exclude from logging
  sensitiveFields: [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'cookie',
    'session',
    'pin',
    'ssn',
    'creditCard',
    'bankAccount'
  ]
};

/**
 * Remove sensitive information from objects
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive information
    const isSensitive = LOGGING_CONFIG.sensitiveFields.some(field => 
      lowerKey.includes(field.toLowerCase())
    );
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

/**
 * Truncate large strings for logging
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
const truncateString = (str, maxLength = 500) => {
  if (typeof str !== 'string' || str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '... (truncated)';
};

/**
 * Check if request should be skipped from logging
 * @param {Object} req - Express request object
 * @returns {boolean} Whether to skip logging
 */
const shouldSkipLogging = (req) => {
  return LOGGING_CONFIG.skipPaths.some(path => req.path.startsWith(path));
};

/**
 * Extract client information from request
 * @param {Object} req - Express request object
 * @returns {Object} Client information
 */
const extractClientInfo = (req) => {
  return {
    ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin'),
    referer: req.get('Referer'),
    acceptLanguage: req.get('Accept-Language'),
    acceptEncoding: req.get('Accept-Encoding')
  };
};

/**
 * Extract request information for logging
 * @param {Object} req - Express request object
 * @returns {Object} Request information
 */
const extractRequestInfo = (req) => {
  const info = {
    id: req.requestId,
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    query: sanitizeObject(req.query),
    params: sanitizeObject(req.params),
    headers: sanitizeObject(req.headers),
    client: extractClientInfo(req),
    user: req.user ? {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    } : null,
    timestamp: new Date().toISOString()
  };

  // Add request body if enabled and present
  if (LOGGING_CONFIG.logRequestBody && req.body) {
    const bodyString = JSON.stringify(req.body);
    if (bodyString.length <= LOGGING_CONFIG.maxBodySize) {
      info.body = sanitizeObject(req.body);
    } else {
      info.body = '[BODY_TOO_LARGE]';
      info.bodySize = bodyString.length;
    }
  }

  return info;
};

/**
 * Extract response information for logging
 * @param {Object} res - Express response object
 * @param {number} responseTime - Response time in milliseconds
 * @returns {Object} Response information
 */
const extractResponseInfo = (res, responseTime) => {
  const info = {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
    headers: sanitizeObject(res.getHeaders()),
    responseTime: responseTime,
    contentLength: res.get('Content-Length'),
    timestamp: new Date().toISOString()
  };

  return info;
};

/**
 * Generate request ID middleware
 * Adds a unique request ID to each request for tracing
 */
const requestIdMiddleware = (req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

/**
 * Request logging middleware
 * Logs incoming requests with comprehensive information
 */
const requestLogger = (req, res, next) => {
  // Skip logging for certain paths
  if (shouldSkipLogging(req)) {
    return next();
  }

  if (LOGGING_CONFIG.logRequests) {
    const requestInfo = extractRequestInfo(req);
    
    logger.info('Incoming request', {
      type: 'REQUEST',
      request: requestInfo
    });
  }

  next();
};

/**
 * Response logging middleware
 * Logs outgoing responses with performance metrics
 */
const responseLogger = (req, res, next) => {
  // Skip logging for certain paths
  if (shouldSkipLogging(req)) {
    return next();
  }

  const startTime = Date.now();

  // Override res.end to capture response
  const originalEnd = res.end;
  const originalSend = res.send;
  const originalJson = res.json;

  let responseBody = null;

  // Capture response body if enabled
  if (LOGGING_CONFIG.logResponseBody) {
    res.send = function(body) {
      if (body && typeof body === 'string' && body.length <= LOGGING_CONFIG.maxBodySize) {
        try {
          responseBody = JSON.parse(body);
        } catch (e) {
          responseBody = truncateString(body);
        }
      }
      return originalSend.call(this, body);
    };

    res.json = function(obj) {
      const jsonString = JSON.stringify(obj);
      if (jsonString.length <= LOGGING_CONFIG.maxBodySize) {
        responseBody = sanitizeObject(obj);
      }
      return originalJson.call(this, obj);
    };
  }

  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;

    if (LOGGING_CONFIG.logResponses) {
      const responseInfo = extractResponseInfo(res, responseTime);
      
      if (responseBody) {
        responseInfo.body = responseBody;
      }

      const logData = {
        type: 'RESPONSE',
        request: {
          id: req.requestId,
          method: req.method,
          url: req.originalUrl,
          user: req.user ? { id: req.user.id, email: req.user.email } : null
        },
        response: responseInfo
      };

      // Log as warning if response time exceeds threshold
      if (responseTime > LOGGING_CONFIG.performanceThreshold) {
        logger.warn('Slow response detected', logData);
      } else if (res.statusCode >= 400) {
        logger.warn('Error response', logData);
      } else {
        logger.info('Outgoing response', logData);
      }
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * User activity logging middleware
 * Tracks user actions for audit and analytics
 */
const userActivityLogger = (req, res, next) => {
  // Only log authenticated user activities
  if (!req.user) {
    return next();
  }

  // Skip logging for read-only operations
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const activityData = {
    type: 'USER_ACTIVITY',
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    },
    action: {
      method: req.method,
      endpoint: req.path,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    },
    client: extractClientInfo(req),
    requestId: req.requestId
  };

  logger.info('User activity', activityData);
  next();
};

/**
 * Security event logging middleware
 * Logs security-related events and potential threats
 */
const securityLogger = (req, res, next) => {
  const securityEvents = [];

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//g,                    // Path traversal
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // XSS
    /union\s+select/gi,           // SQL injection
    /drop\s+table/gi,             // SQL injection
    /eval\s*\(/gi,                // Code injection
    /javascript:/gi,              // JavaScript injection
    /vbscript:/gi,                // VBScript injection
    /onload\s*=/gi,              // Event handler injection
    /onerror\s*=/gi              // Event handler injection
  ];

  // Check URL and query parameters for suspicious content
  const checkString = req.originalUrl + JSON.stringify(req.query) + JSON.stringify(req.body || {});
  
  suspiciousPatterns.forEach((pattern, index) => {
    if (pattern.test(checkString)) {
      securityEvents.push({
        type: 'SUSPICIOUS_PATTERN',
        pattern: pattern.toString(),
        location: 'url_query_body',
        severity: 'medium'
      });
    }
  });

  // Check for unusual request headers
  const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip'];
  suspiciousHeaders.forEach(header => {
    if (req.headers[header] && req.headers[header].split(',').length > 3) {
      securityEvents.push({
        type: 'SUSPICIOUS_HEADERS',
        header: header,
        value: req.headers[header],
        severity: 'low'
      });
    }
  });

  // Log security events if any found
  if (securityEvents.length > 0) {
    logger.security('Security events detected', {
      type: 'SECURITY_SCAN',
      events: securityEvents,
      request: {
        id: req.requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        user: req.user ? { id: req.user.id, email: req.user.email } : null
      },
      timestamp: new Date().toISOString()
    });
  }

  next();
};

/**
 * Performance monitoring middleware
 * Tracks and logs performance metrics
 */
const performanceMonitor = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      external: endMemory.external - startMemory.external
    };

    const performanceData = {
      type: 'PERFORMANCE',
      request: {
        id: req.requestId,
        method: req.method,
        url: req.originalUrl,
        user: req.user ? { id: req.user.id } : null
      },
      metrics: {
        responseTime: responseTime,
        statusCode: res.statusCode,
        memory: {
          before: startMemory,
          after: endMemory,
          delta: memoryDelta
        }
      },
      timestamp: new Date().toISOString()
    };

    // Log performance warning if thresholds exceeded
    if (responseTime > LOGGING_CONFIG.performanceThreshold) {
      logger.warn('Performance threshold exceeded', performanceData);
    } else {
      logger.debug('Performance metrics', performanceData);
    }
  });

  next();
};

/**
 * Combined logging middleware that includes all logging features
 */
const loggingMiddleware = [
  requestIdMiddleware,
  requestLogger,
  responseLogger,
  userActivityLogger,
  securityLogger,
  performanceMonitor
];

/**
 * Create custom logger instance for specific modules
 * @param {string} module - Module name
 * @returns {Object} Custom logger instance
 */
const createModuleLogger = (module) => {
  return {
    info: (message, data = {}) => logger.info(message, { ...data, module }),
    warn: (message, data = {}) => logger.warn(message, { ...data, module }),
    error: (message, data = {}) => logger.error(message, { ...data, module }),
    debug: (message, data = {}) => logger.debug(message, { ...data, module }),
    security: (message, data = {}) => logger.security(message, { ...data, module })
  };
};

module.exports = {
  loggingMiddleware,
  requestIdMiddleware,
  requestLogger,
  responseLogger,
  userActivityLogger,
  securityLogger,
  performanceMonitor,
  createModuleLogger,
  LOGGING_CONFIG
};
