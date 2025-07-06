/**
 * Security Headers Middleware
 * Implements comprehensive security headers using Helmet.js and custom configurations
 */

const helmet = require('helmet');
const config = require('../config/environment');
const logger = require('../utils/logger');

/**
 * Get environment-specific configuration
 */
const getSecurityConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  const isProduction = env === 'production';
  
  return {
    isDevelopment,
    isProduction,
    corsOrigins: config.getCORSConfig().origin,
    trustedDomains: process.env.TRUSTED_DOMAINS ? 
      process.env.TRUSTED_DOMAINS.split(',').map(domain => domain.trim()) : []
  };
};

/**
 * Content Security Policy configuration
 */
const getCSPConfig = () => {
  const { isDevelopment, corsOrigins, trustedDomains } = getSecurityConfig();
  
  // Base CSP configuration
  const cspConfig = {
    directives: {
      defaultSrc: ["'self'"],
      
      // Script sources
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for some dashboard features
        ...(isDevelopment ? ["'unsafe-eval'"] : []), // Only in development
        'https://cdn.jsdelivr.net', // For CDN resources
        'https://unpkg.com' // For some chart libraries
      ],
      
      // Style sources
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for dynamic styling
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net'
      ],
      
      // Font sources
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdn.jsdelivr.net',
        'data:' // For base64 encoded fonts
      ],
      
      // Image sources
      imgSrc: [
        "'self'",
        'data:', // For base64 images
        'blob:', // For generated images
        'https:', // Allow HTTPS images
        ...(isDevelopment ? ['http:'] : []) // HTTP only in development
      ],
      
      // Connect sources (for AJAX, WebSocket, etc.)
      connectSrc: [
        "'self'",
        ...corsOrigins,
        ...trustedDomains,
        'https://api.exchangerate-api.com', // For currency conversion
        'wss:', // WebSocket secure
        ...(isDevelopment ? ['ws:', 'http:'] : []) // WebSocket and HTTP in development
      ],
      
      // Media sources
      mediaSrc: [
        "'self'",
        'blob:',
        'data:'
      ],
      
      // Object sources (plugins)
      objectSrc: ["'none'"],
      
      // Frame sources
      frameSrc: [
        "'self'",
        'https://www.google.com' // For reCAPTCHA if needed
      ],
      
      // Base URI
      baseUri: ["'self'"],
      
      // Form action
      formAction: ["'self'"],
      
      // Frame ancestors (who can embed this page)
      frameAncestors: ["'none'"],
      
      // Upgrade insecure requests in production
      ...(isDevelopment ? {} : { upgradeInsecureRequests: [] })
    },
    
    // Report violations in development
    ...(isDevelopment ? {
      reportOnly: false, // Set to true to only report, not block
      reportUri: '/api/csp-report'
    } : {})
  };

  return cspConfig;
};

/**
 * HTTP Strict Transport Security (HSTS) configuration
 */
const getHSTSConfig = () => {
  const { isProduction } = getSecurityConfig();
  
  return {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: isProduction // Only enable preload in production
  };
};

/**
 * Referrer Policy configuration
 */
const getReferrerPolicyConfig = () => {
  return {
    policy: ['strict-origin-when-cross-origin']
  };
};

/**
 * Permissions Policy (formerly Feature Policy) configuration
 */
const getPermissionsPolicyConfig = () => {
  return {
    features: {
      // Camera and microphone
      camera: ['none'],
      microphone: ['none'],
      
      // Location
      geolocation: ['self'], // Allow for location-based features
      
      // Payment
      payment: ['self'], // Allow for payment features
      
      // USB and other hardware
      usb: ['none'],
      
      // Autoplay
      autoplay: ['none'],
      
      // Fullscreen
      fullscreen: ['self'],
      
      // Picture in picture
      'picture-in-picture': ['none'],
      
      // Accelerometer and gyroscope
      accelerometer: ['none'],
      gyroscope: ['none'],
      magnetometer: ['none'],
      
      // Ambient light sensor
      'ambient-light-sensor': ['none'],
      
      // Display capture
      'display-capture': ['none'],
      
      // Encrypted media
      'encrypted-media': ['none'],
      
      // MIDI
      midi: ['none'],
      
      // Sync XHR
      'sync-xhr': ['none']
    }
  };
};

/**
 * Custom security middleware for additional headers
 */
const customSecurityHeaders = (req, res, next) => {
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-Frame-Options (also set by helmet, but ensuring it's set)
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-XSS-Protection (for older browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // X-Download-Options (IE specific)
  res.setHeader('X-Download-Options', 'noopen');
  
  // X-Permitted-Cross-Domain-Policies (Flash/PDF)
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Clear-Site-Data on logout
  if (req.path === '/api/auth/logout') {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage", "executionContexts"');
  }
  
  // Cache control for sensitive endpoints
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
};

/**
 * Security event logging middleware
 */
const securityLogger = (req, res, next) => {
  // Log security-relevant events
  const securityEvents = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/user/change-password'
  ];
  
  if (securityEvents.includes(req.path)) {
    logger.info('Security-sensitive endpoint accessed', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
      userId: req.user?.id || 'anonymous'
    });
  }
  
  next();
};

/**
 * CSP violation reporting endpoint
 */
const cspReportHandler = (req, res) => {
  try {
    const report = req.body;
    
    logger.warn('CSP Violation Report', {
      report,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error processing CSP report:', error);
    res.status(400).json({ error: 'Invalid CSP report' });
  }
};

/**
 * Main security middleware configuration
 */
const configureSecurityMiddleware = () => {
  const { isDevelopment } = getSecurityConfig();
  
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: getCSPConfig(),
    
    // HTTP Strict Transport Security
    hsts: getHSTSConfig(),
    
    // Referrer Policy
    referrerPolicy: getReferrerPolicyConfig(),
    
    // Hide X-Powered-By header
    hidePoweredBy: true,
    
    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },
    
    // X-Content-Type-Options
    noSniff: true,
    
    // X-XSS-Protection
    xssFilter: true,
    
    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false
    },
    
    // Don't infer MIME type
    noSniff: true,
    
    // Permissions Policy
    permissionsPolicy: getPermissionsPolicyConfig(),
    
    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: isDevelopment ? false : true,
    
    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: {
      policy: 'same-origin'
    },
    
    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  });
};

/**
 * Environment-specific security configurations
 */
const getEnvironmentSecurityConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        trustProxy: true,
        secure: true,
        sameSite: 'strict',
        httpOnly: true
      };
      
    case 'staging':
      return {
        trustProxy: true,
        secure: true,
        sameSite: 'strict',
        httpOnly: true
      };
      
    case 'development':
    default:
      return {
        trustProxy: false,
        secure: false,
        sameSite: 'lax',
        httpOnly: true
      };
  }
};

/**
 * Session security configuration
 */
const getSessionSecurityConfig = () => {
  const envConfig = getEnvironmentSecurityConfig();
  
  return {
    name: 'sessionId', // Don't use default session name
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on activity
    cookie: {
      ...envConfig,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };
};

module.exports = {
  configureSecurityMiddleware,
  customSecurityHeaders,
  securityLogger,
  cspReportHandler,
  getCSPConfig,
  getHSTSConfig,
  getReferrerPolicyConfig,
  getPermissionsPolicyConfig,
  getSessionSecurityConfig,
  getEnvironmentSecurityConfig
};
