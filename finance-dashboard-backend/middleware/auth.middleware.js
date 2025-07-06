const AuthService = require('../services/auth.service');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Handles JWT token verification and user context
 */
class AuthMiddleware {
  /**
   * Verify JWT token and attach user to request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static async verifyToken(req, res, next) {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      const token = AuthService.extractTokenFromHeader(authHeader);

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token is required',
          error: 'MISSING_TOKEN'
        });
      }      // Verify token
      const decoded = await AuthService.verifyAccessToken(token);

      // Validate token payload
      if (!AuthService.validateTokenPayload(decoded)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token payload',
          error: 'INVALID_TOKEN_PAYLOAD'
        });
      }

      // Get user from database
      const user = await User.findById(decoded.userId).select('-password -refreshTokens');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }

      // Check if user account is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is inactive',
          error: 'ACCOUNT_INACTIVE'
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        return res.status(401).json({
          success: false,
          message: 'Account is temporarily locked',
          error: 'ACCOUNT_LOCKED'
        });
      }

      // Check if email is verified (if required)
      if (!user.isEmailVerified && process.env.REQUIRE_EMAIL_VERIFICATION === 'true') {
        return res.status(401).json({
          success: false,
          message: 'Email verification required',
          error: 'EMAIL_NOT_VERIFIED'
        });
      }

      // Attach user and token info to request
      req.user = user;
      req.token = token;
      req.tokenPayload = decoded;

      // Update last activity
      user.lastActivity = new Date();
      await user.save();

      next();
    } catch (error) {
      console.error('Token verification error:', error.message);

      // Handle specific token errors
      if (error.message.includes('expired')) {
        return res.status(401).json({
          success: false,
          message: 'Access token has expired',
          error: 'TOKEN_EXPIRED'
        });
      }

      if (error.message.includes('invalid') || error.message.includes('malformed')) {
        return res.status(401).json({
          success: false,
          message: 'Invalid access token',
          error: 'INVALID_TOKEN'
        });
      }

      if (error.message.includes('revoked')) {
        return res.status(401).json({
          success: false,
          message: 'Token has been revoked',
          error: 'TOKEN_REVOKED'
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Authentication failed',
        error: 'AUTH_FAILED'
      });
    }
  }

  /**
   * Optional authentication - doesn't fail if no token provided
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = AuthService.extractTokenFromHeader(authHeader);

      if (!token) {
        // No token provided, continue without user context
        req.user = null;
        req.isAuthenticated = false;
        return next();
      }      // Try to verify token
      const decoded = await AuthService.verifyAccessToken(token);
      
      if (AuthService.validateTokenPayload(decoded)) {
        const user = await User.findById(decoded.userId).select('-password -refreshTokens');
        if (user && user.isActive && !user.isLocked) {
          req.user = user;
          req.token = token;
          req.tokenPayload = decoded;
          req.isAuthenticated = true;
          
          // Update last activity
          user.lastActivity = new Date();
          await user.save();
        } else {
          req.user = null;
          req.isAuthenticated = false;
        }
      } else {
        req.user = null;
        req.isAuthenticated = false;
      }

      next();
    } catch (error) {
      // If token verification fails, continue without user context
      req.user = null;
      req.isAuthenticated = false;
      next();
    }
  }

  /**
   * Verify refresh token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static async verifyRefreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token is required',
          error: 'MISSING_REFRESH_TOKEN'
        });
      }      // Verify refresh token
      const decoded = await AuthService.verifyRefreshToken(refreshToken);

      // Get user from database
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is inactive',
          error: 'ACCOUNT_INACTIVE'
        });
      }

      // Verify refresh token exists in user's stored tokens
      const storedToken = user.refreshTokens.find(rt => rt.token === refreshToken);
      if (!storedToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token not found',
          error: 'REFRESH_TOKEN_NOT_FOUND'
        });
      }

      // Attach user and token info to request
      req.user = user;
      req.refreshToken = refreshToken;
      req.refreshTokenPayload = decoded;

      next();
    } catch (error) {
      console.error('Refresh token verification error:', error.message);

      if (error.message.includes('expired')) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token has expired',
          error: 'REFRESH_TOKEN_EXPIRED'
        });
      }

      if (error.message.includes('invalid') || error.message.includes('malformed')) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token',
          error: 'INVALID_REFRESH_TOKEN'
        });
      }

      if (error.message.includes('revoked')) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token has been revoked',
          error: 'REFRESH_TOKEN_REVOKED'
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Refresh token verification failed',
        error: 'REFRESH_TOKEN_VERIFICATION_FAILED'
      });
    }
  }

  /**
   * Role-based authorization middleware
   * @param {string|Array} allowedRoles - Role(s) allowed to access the route
   * @returns {Function} Express middleware function
   */
  static authorize(allowedRoles) {
    // Normalize to array
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return async (req, res, next) => {
      try {
        // Check if user is authenticated
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required',
            error: 'AUTH_REQUIRED'
          });
        }

        // Check if user has required role
        if (!roles.includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions',
            error: 'INSUFFICIENT_PERMISSIONS',
            requiredRoles: roles,
            userRole: req.user.role
          });
        }

        next();
      } catch (error) {
        console.error('Authorization error:', error.message);
        return res.status(403).json({
          success: false,
          message: 'Authorization failed',
          error: 'AUTHORIZATION_FAILED'
        });
      }
    };
  }

  /**
   * Check if user owns the resource or has admin privileges
   * @param {string} resourceUserIdPath - Path to user ID in request (e.g., 'params.userId', 'body.userId')
   * @returns {Function} Express middleware function
   */
  static authorizeOwnerOrAdmin(resourceUserIdPath = 'params.userId') {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required',
            error: 'AUTH_REQUIRED'
          });
        }

        // Admin can access any resource
        if (req.user.role === 'admin') {
          return next();
        }

        // Get resource user ID from request
        const pathParts = resourceUserIdPath.split('.');
        let resourceUserId = req;
        
        for (const part of pathParts) {
          resourceUserId = resourceUserId[part];
          if (!resourceUserId) {
            return res.status(400).json({
              success: false,
              message: 'Resource user ID not found in request',
              error: 'RESOURCE_USER_ID_MISSING'
            });
          }
        }

        // Check if user owns the resource
        if (req.user._id.toString() !== resourceUserId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You can only access your own resources',
            error: 'RESOURCE_ACCESS_DENIED'
          });
        }

        next();
      } catch (error) {
        console.error('Owner authorization error:', error.message);
        return res.status(403).json({
          success: false,
          message: 'Authorization failed',
          error: 'AUTHORIZATION_FAILED'
        });
      }
    };
  }
  /**
   * Rate limiting based on user authentication status
   * @param {Object} options - Rate limiting options
   * @param {number} options.authenticatedLimit - Limit for authenticated users
   * @param {number} options.unauthenticatedLimit - Limit for unauthenticated users
   * @param {number} options.windowMs - Time window in milliseconds
   * @returns {Function} Express middleware function
   */
  static dynamicRateLimit(options = {}) {
    const {
      authenticatedLimit = 1000,
      unauthenticatedLimit = 100,
      windowMs = 15 * 60 * 1000 // 15 minutes
    } = options;

    const userRequests = new Map();
    const ipRequests = new Map();
    let cleanupInterval = null;

    // Clean up old entries periodically - only if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      cleanupInterval = setInterval(() => {
        const now = Date.now();
        const cutoff = now - windowMs;

        // Clean user requests
        for (const [key, requests] of userRequests.entries()) {
          const validRequests = requests.filter(time => time > cutoff);
          if (validRequests.length === 0) {
            userRequests.delete(key);
          } else {
            userRequests.set(key, validRequests);
          }
        }

        // Clean IP requests
        for (const [key, requests] of ipRequests.entries()) {
          const validRequests = requests.filter(time => time > cutoff);
          if (validRequests.length === 0) {
            ipRequests.delete(key);
          } else {
            ipRequests.set(key, validRequests);
          }
        }
      }, windowMs);

      // Track interval for test cleanup if in test environment tracking mode
      if (global.testIntervalTracker) {
        global.testIntervalTracker.addInterval(cleanupInterval);
      }

      logger.info('Dynamic rate limit cleanup interval started');
    } else {
      logger.info('Dynamic rate limit cleanup disabled during tests');
    }

    return async (req, res, next) => {
      const now = Date.now();
      const cutoff = now - windowMs;
      const ip = req.ip || req.connection.remoteAddress;

      let identifier, limit;
      
      if (req.user) {
        // Authenticated user
        identifier = `user:${req.user._id}`;
        limit = authenticatedLimit;
      } else {
        // Unauthenticated user - use IP
        identifier = `ip:${ip}`;
        limit = unauthenticatedLimit;
      }

      // Get request history
      const requestMap = req.user ? userRequests : ipRequests;
      const requests = requestMap.get(identifier) || [];
      
      // Filter to current window
      const recentRequests = requests.filter(time => time > cutoff);
      
      // Check limit
      if (recentRequests.length >= limit) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded',
          error: 'RATE_LIMIT_EXCEEDED',
          limit,
          windowMs,
          retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
        });
      }

      // Add current request
      recentRequests.push(now);
      requestMap.set(identifier, recentRequests);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': limit,
        'X-RateLimit-Remaining': Math.max(0, limit - recentRequests.length),
        'X-RateLimit-Reset': Math.ceil((now + windowMs) / 1000)
      });

      next();
    };
  }

  /**
   * Extract client information from request
   * @param {Object} req - Express request object
   * @returns {Object} Client information
   */
  static getClientInfo(req) {
    return {
      userAgent: req.get('User-Agent') || 'Unknown',
      ipAddress: req.ip || req.connection.remoteAddress || 'Unknown'
    };
  }

  /**
   * Security headers middleware
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static securityHeaders(req, res, next) {
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Only set HSTS in production with HTTPS
    if (process.env.NODE_ENV === 'production' && req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    next();
  }
}

// Export individual middleware functions for convenience
module.exports = {
  AuthMiddleware,
  verifyToken: AuthMiddleware.verifyToken,
  optionalAuth: AuthMiddleware.optionalAuth,
  verifyRefreshToken: AuthMiddleware.verifyRefreshToken,
  authorize: AuthMiddleware.authorize,
  authorizeOwnerOrAdmin: AuthMiddleware.authorizeOwnerOrAdmin,
  dynamicRateLimit: AuthMiddleware.dynamicRateLimit,
  getClientInfo: AuthMiddleware.getClientInfo,
  securityHeaders: AuthMiddleware.securityHeaders
};
