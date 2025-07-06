/**
 * Socket Middleware
 * Middleware for WebSocket authentication and security
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const AuthService = require('../services/auth.service');

/**
 * Authenticate socket connection using JWT
 * @param {Object} socket - Socket.IO socket object
 * @param {Function} next - Next function
 */
const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      logger.warn('Socket authentication failed: No token provided', {
        socketId: socket.id,
        ip: socket.handshake.address
      });
      return next(new Error('Authentication token is required'));
    }    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    // Check if token is blacklisted
    AuthService.isTokenBlacklisted(token)
      .then(isBlacklisted => {
        if (isBlacklisted) {          logger.warn('Socket authentication failed: Token is blacklisted', {
            socketId: socket.id,
            userId: decoded.userId,  // JWT payload uses 'userId' field
            ip: socket.handshake.address
          });
          return next(new Error('Invalid authentication token'));
        }
          // Store user data in socket for future reference
        socket.user = {
          id: decoded.userId,  // JWT payload uses 'userId' field
          email: decoded.email,
          role: decoded.role || 'user'
        };
        
        // Track socket connection for the user
        trackUserConnection(socket);
          logger.info('Socket authenticated successfully', {
          socketId: socket.id,
          userId: decoded.userId,  // JWT payload uses 'userId' field
          ip: socket.handshake.address
        });
        
        next();
      })
      .catch(err => {
        logger.error('Error checking token blacklist', {
          socketId: socket.id,
          error: err.message
        });
        next(new Error('Authentication error'));
      });
      
  } catch (error) {
    logger.warn('Socket authentication failed: Invalid token', {
      socketId: socket.id,
      error: error.message,
      ip: socket.handshake.address
    });
    next(new Error('Invalid authentication token'));
  }
};

/**
 * Track user connection for session management
 * @param {Object} socket - Socket.IO socket object
 */
const trackUserConnection = (socket) => {
  // In a production environment, this would be stored in Redis
  // For now, we'll use a simple in-memory approach
  
  const userId = socket.user.id;
  const socketId = socket.id;
  
  // Store socket reference in a global Map
  if (!global.userSockets) {
    global.userSockets = new Map();
  }
  
  if (!global.userSockets.has(userId)) {
    global.userSockets.set(userId, new Set());
  }
  
  global.userSockets.get(userId).add(socketId);
  
  // Handle disconnect to clean up
  socket.on('disconnect', () => {
    if (global.userSockets && global.userSockets.has(userId)) {
      global.userSockets.get(userId).delete(socketId);
      
      // Clean up empty sets
      if (global.userSockets.get(userId).size === 0) {
        global.userSockets.delete(userId);
      }
      
      logger.debug('Socket disconnected, session cleaned up', {
        socketId,
        userId
      });
    }
  });
};

/**
 * Apply rate limiting to socket connections
 * @param {Object} socket - Socket.IO socket object
 * @param {Function} next - Next function
 */
const applyRateLimiting = (socket, next) => {
  // In a production environment, use Redis for distributed rate limiting
  // This is a simplified version for demonstration
  
  const ip = socket.handshake.address;
  const now = Date.now();
  
  // Initialize rate limit tracking
  if (!global.socketRateLimits) {
    global.socketRateLimits = new Map();
  }
  
  if (!global.socketRateLimits.has(ip)) {
    global.socketRateLimits.set(ip, {
      count: 0,
      resetAt: now + 60000 // Reset after 1 minute
    });
  }
  
  const limit = global.socketRateLimits.get(ip);
  
  // Reset counter if time has elapsed
  if (now > limit.resetAt) {
    limit.count = 0;
    limit.resetAt = now + 60000;
  }
  
  // Increment counter
  limit.count++;
  
  // Check if limit exceeded
  const MAX_CONNECTIONS_PER_MINUTE = 60;
  if (limit.count > MAX_CONNECTIONS_PER_MINUTE) {
    logger.warn('Rate limit exceeded for socket connection', {
      ip,
      socketId: socket.id,
      count: limit.count
    });
    return next(new Error('Too many connection attempts. Please try again later.'));
  }
  
  next();
};

/**
 * Check if user has access to a specific resource
 * @param {Object} socket - Socket.IO socket object
 * @param {string} resourceType - Type of resource (e.g., 'transaction', 'budget')
 * @param {string} resourceId - ID of the resource
 * @returns {Promise<boolean>} - Whether user has access
 */
const checkResourceAccess = async (socket, resourceType, resourceId) => {
  if (!socket.user) {
    return false;
  }
  
  const userId = socket.user.id;
  
  // Admin has access to everything
  if (socket.user.role === 'admin') {
    return true;
  }
  
  try {
    // Different resource types require different service checks
    switch (resourceType) {
      case 'transaction':
        const transactionService = require('../services/transaction.service');
        return await transactionService.checkOwnership(resourceId, userId);
        
      case 'budget':
        const budgetService = require('../services/budget.service');
        return await budgetService.checkOwnership(resourceId, userId);
        
      case 'goal':
        const goalService = require('../services/goal.service');
        return await goalService.checkOwnership(resourceId, userId);
        
      default:
        return false;
    }
  } catch (error) {
    logger.error('Error checking resource access', {
      userId,
      resourceType,
      resourceId,
      error: error.message
    });
    return false;
  }
};

/**
 * Get connected sockets for a user
 * @param {string} userId - User ID
 * @returns {Array} - Array of socket IDs
 */
const getUserSockets = (userId) => {
  if (!global.userSockets || !global.userSockets.has(userId)) {
    return [];
  }
  
  return Array.from(global.userSockets.get(userId));
};

/**
 * Apply socket middleware to an existing socket.io instance
 * @param {Object} io - Socket.IO server instance
 */
const applySocketMiddleware = (io) => {
  if (!io) {
    logger.error('Cannot apply socket middleware: Socket.IO server not provided');
    return;
  }
  
  // Apply middleware to all incoming connections
  io.use(applyRateLimiting);
  io.use(authenticateSocket);
  
  logger.info('Socket middleware applied successfully');
};

module.exports = {
  authenticateSocket,
  applyRateLimiting,
  checkResourceAccess,
  getUserSockets,
  applySocketMiddleware
};
