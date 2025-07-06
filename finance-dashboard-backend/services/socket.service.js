/**
 * Socket Service
 * Implements real-time features using WebSocket technology for the Personal Finance Dashboard
 */

const socketIO = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const redis = require('redis');
const { authenticateSocket } = require('../middleware/socket.middleware');

// Services that will emit events
const transactionService = require('./transaction.service');
const budgetService = require('./budget.service');
const goalService = require('./goal.service');

// Event types constants
const EVENT_TYPES = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  RECONNECT: 'reconnect',
  
  // Authentication events
  AUTHENTICATE: 'authenticate',
  AUTHENTICATION_ERROR: 'authentication_error',
  AUTHENTICATION_SUCCESS: 'authentication_success',
  
  // Room events
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  
  // Transaction events
  TRANSACTION_CREATED: 'transaction:created',
  TRANSACTION_UPDATED: 'transaction:updated',
  TRANSACTION_DELETED: 'transaction:deleted',
  TRANSACTION_BULK_IMPORT: 'transaction:bulk_import',
  
  // Budget events
  BUDGET_ALERT: 'budget:alert',
  BUDGET_THRESHOLD_EXCEEDED: 'budget:threshold_exceeded',
  BUDGET_UPDATED: 'budget:updated',
  BUDGET_PERIOD_TRANSITION: 'budget:period_transition',
  
  // Goal events
  GOAL_PROGRESS_UPDATED: 'goal:progress_updated',
  GOAL_MILESTONE_REACHED: 'goal:milestone_reached',
  GOAL_COMPLETED: 'goal:completed',
  GOAL_DEADLINE_APPROACHING: 'goal:deadline_approaching',
  
  // Balance events
  BALANCE_UPDATED: 'balance:updated',
  BALANCE_RECONCILED: 'balance:reconciled',
  
  // System events
  SYSTEM_NOTIFICATION: 'system:notification'
};

// Room types constants
const ROOM_TYPES = {
  USER: 'user:', // Prefix for user-specific rooms (e.g., user:123)
  ADMIN: 'admin', // Admin room for system-wide notifications
  TRANSACTION: 'transaction:', // Prefix for transaction-specific rooms
  BUDGET: 'budget:', // Prefix for budget-specific rooms
  GOAL: 'goal:' // Prefix for goal-specific rooms
};

// Rate limiting configuration
const RATE_LIMITS = {
  DEFAULT: { points: 100, duration: 60 }, // 100 events per minute
  MESSAGE: { points: 20, duration: 10 },  // 20 messages per 10 seconds
  JOIN: { points: 5, duration: 10 }       // 5 join/leave operations per 10 seconds
};

let io = null;
let redisClient = null;
let redisPublisher = null;

/**
 * Initialize Socket.IO server
 * @param {Object} server - HTTP server instance
 * @param {Object} options - Configuration options
 */
function initialize(server, options = {}) {
  if (io) {
    logger.warn('Socket.IO server already initialized');
    return io;
  }

  // Initialize Socket.IO with the HTTP server
  io = socketIO(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:4200'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    transports: ['websocket', 'polling'], // Enable both WebSocket and long-polling
    maxHttpBufferSize: 1e6 // 1 MB
  });  // Set up Redis adapter for multi-server support if configured
  if (process.env.REDIS_ENABLED === 'true' && process.env.NODE_ENV !== 'test') {
    try {
      // Create Redis clients with new API
      redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DB) || 0
      });
      
      redisPublisher = redisClient.duplicate();
      
      // Connect the clients
      Promise.all([
        redisClient.connect(),
        redisPublisher.connect()
      ]).then(() => {
        // Set up Redis adapter with new API
        io.adapter(createAdapter(redisPublisher, redisClient));
        logger.info('Socket.IO Redis adapter configured successfully');
      }).catch(error => {
        logger.error('Failed to connect Redis clients for Socket.IO adapter:', error);
      });
      
    } catch (error) {
      logger.error('Failed to configure Socket.IO Redis adapter:', error);
    }
  } else if (process.env.NODE_ENV === 'test') {
    logger.info('Socket.IO Redis adapter disabled during tests');
  }

  // Set up middleware for authentication and rate limiting
  io.use(authenticateSocket);
  io.use(socketRateLimiter);

  // Set up connection handler
  io.on(EVENT_TYPES.CONNECT, handleConnection);

  logger.info('Socket.IO server initialized successfully');
  return io;
}

/**
 * Socket rate limiter middleware
 * @param {Object} socket - Socket instance
 * @param {Function} next - Next function
 */
function socketRateLimiter(socket, next) {
  // Implement rate limiting logic
  // This is a simplified version - in production, use Redis-based rate limiting
  
  // Set initial rate limit data
  socket.rateLimit = {
    events: {
      count: 0,
      lastReset: Date.now()
    },
    messages: {
      count: 0,
      lastReset: Date.now()
    },
    joins: {
      count: 0,
      lastReset: Date.now()
    }
  };
  
  // Check rate limits on events
  socket.on('*', () => {
    const now = Date.now();
    const events = socket.rateLimit.events;
    
    // Reset counter if duration has passed
    if (now - events.lastReset > RATE_LIMITS.DEFAULT.duration * 1000) {
      events.count = 0;
      events.lastReset = now;
    }
    
    events.count++;
    
    // Disconnect if limit exceeded
    if (events.count > RATE_LIMITS.DEFAULT.points) {
      logger.warn('Socket rate limit exceeded, disconnecting', { 
        userId: socket.user?.id, 
        socketId: socket.id 
      });
      
      socket.emit(EVENT_TYPES.ERROR, { message: 'Rate limit exceeded' });
      socket.disconnect(true);
    }
  });
  
  next();
}

/**
 * Handle new socket connection
 * @param {Object} socket - Socket instance
 */
function handleConnection(socket) {
  logger.info('New socket connection established', { 
    socketId: socket.id, 
    userId: socket.user?.id
  });
  
  // Join user to their private room
  if (socket.user?.id) {
    const userRoom = `${ROOM_TYPES.USER}${socket.user.id}`;
    socket.join(userRoom);
    
    // Join admin room if user is admin
    if (socket.user.role === 'admin') {
      socket.join(ROOM_TYPES.ADMIN);
    }
    
    logger.debug('User joined room', { 
      userId: socket.user.id, 
      room: userRoom 
    });
  }
  
  // Set up event handlers
  setupEventHandlers(socket);
  
  // Send authentication success
  socket.emit(EVENT_TYPES.AUTHENTICATION_SUCCESS, { 
    userId: socket.user?.id,
    socketId: socket.id
  });
  
  // Handle disconnect
  socket.on(EVENT_TYPES.DISCONNECT, () => {
    logger.info('Socket disconnected', { 
      socketId: socket.id, 
      userId: socket.user?.id 
    });
  });
}

/**
 * Set up event handlers for socket
 * @param {Object} socket - Socket instance
 */
function setupEventHandlers(socket) {
  // Room management
  socket.on(EVENT_TYPES.JOIN_ROOM, (data) => handleJoinRoom(socket, data));
  socket.on(EVENT_TYPES.LEAVE_ROOM, (data) => handleLeaveRoom(socket, data));
  
  // Add more event handlers as needed
}

/**
 * Handle join room request
 * @param {Object} socket - Socket instance
 * @param {Object} data - Room data
 */
function handleJoinRoom(socket, data) {
  const { room, type } = data;
  
  if (!room) {
    return socket.emit(EVENT_TYPES.ERROR, { message: 'Room name is required' });
  }
  
  // Rate limit join operations
  const now = Date.now();
  const joins = socket.rateLimit.joins;
  
  // Reset counter if duration has passed
  if (now - joins.lastReset > RATE_LIMITS.JOIN.duration * 1000) {
    joins.count = 0;
    joins.lastReset = now;
  }
  
  joins.count++;
  
  // Reject if limit exceeded
  if (joins.count > RATE_LIMITS.JOIN.points) {
    return socket.emit(EVENT_TYPES.ERROR, { message: 'Join rate limit exceeded' });
  }
  
  // Security check - verify user has access to the room
  if (!canJoinRoom(socket.user, room, type)) {
    logger.warn('Unauthorized room join attempt', { 
      userId: socket.user?.id, 
      room, 
      type 
    });
    return socket.emit(EVENT_TYPES.ERROR, { message: 'Unauthorized' });
  }
  
  // Join the room
  socket.join(room);
  
  logger.debug('User joined room', { 
    userId: socket.user?.id, 
    socketId: socket.id, 
    room 
  });
  
  socket.emit('joined', { room });
}

/**
 * Handle leave room request
 * @param {Object} socket - Socket instance
 * @param {Object} data - Room data
 */
function handleLeaveRoom(socket, data) {
  const { room } = data;
  
  if (!room) {
    return socket.emit(EVENT_TYPES.ERROR, { message: 'Room name is required' });
  }
  
  // Rate limit operations same as join
  const now = Date.now();
  const joins = socket.rateLimit.joins;
  
  if (now - joins.lastReset > RATE_LIMITS.JOIN.duration * 1000) {
    joins.count = 0;
    joins.lastReset = now;
  }
  
  joins.count++;
  
  if (joins.count > RATE_LIMITS.JOIN.points) {
    return socket.emit(EVENT_TYPES.ERROR, { message: 'Rate limit exceeded' });
  }
  
  // Leave the room
  socket.leave(room);
  
  logger.debug('User left room', { 
    userId: socket.user?.id, 
    socketId: socket.id, 
    room 
  });
  
  socket.emit('left', { room });
}

/**
 * Check if user can join a specific room
 * @param {Object} user - User object
 * @param {string} room - Room name
 * @param {string} type - Room type
 * @returns {boolean} - True if user can join the room
 */
function canJoinRoom(user, room, type) {
  if (!user) return false;
  
  // Admin can join any room
  if (user.role === 'admin') return true;
  
  // User-specific room
  if (room === `${ROOM_TYPES.USER}${user.id}`) return true;
  
  // Check other room types
  switch (type) {
    case 'transaction':
      // Verify transaction belongs to user (would need service call)
      return room.startsWith(ROOM_TYPES.TRANSACTION);
      
    case 'budget':
      // Verify budget belongs to user (would need service call)
      return room.startsWith(ROOM_TYPES.BUDGET);
      
    case 'goal':
      // Verify goal belongs to user (would need service call)
      return room.startsWith(ROOM_TYPES.GOAL);
      
    default:
      return false;
  }
}

/**
 * Emit event to a specific room
 * @param {string} room - Room name
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function emitToRoom(room, event, data) {
  if (!io) {
    logger.error('Socket.IO not initialized');
    return;
  }
  
  io.to(room).emit(event, data);
  
  logger.debug('Event emitted to room', { 
    room, 
    event, 
    data 
  });
}

/**
 * Emit event to a specific user
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function emitToUser(userId, event, data) {
  if (!io) {
    logger.error('Socket.IO not initialized');
    return;
  }
  
  const userRoom = `${ROOM_TYPES.USER}${userId}`;
  emitToRoom(userRoom, event, data);
}

/**
 * Emit system-wide notification
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function emitSystemNotification(event, data) {
  if (!io) {
    logger.error('Socket.IO not initialized');
    return;
  }
  
  io.to(ROOM_TYPES.ADMIN).emit(event, {
    ...data,
    isSystemNotification: true,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('System notification emitted', { 
    event, 
    data 
  });
}

/**
 * Notify user about budget threshold exceeded
 * @param {string} userId - User ID
 * @param {Object} budgetData - Budget data
 */
function notifyBudgetThresholdExceeded(userId, budgetData) {
  emitToUser(userId, EVENT_TYPES.BUDGET_THRESHOLD_EXCEEDED, {
    ...budgetData,
    timestamp: new Date().toISOString()
  });
  
  logger.info('Budget threshold exceeded notification sent', { 
    userId, 
    budgetId: budgetData.budgetId 
  });
}

/**
 * Notify user about transaction created
 * @param {string} userId - User ID
 * @param {Object} transactionData - Transaction data
 */
function notifyTransactionCreated(userId, transactionData) {
  emitToUser(userId, EVENT_TYPES.TRANSACTION_CREATED, {
    ...transactionData,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('Transaction created notification sent', { 
    userId, 
    transactionId: transactionData.transactionId 
  });
}

/**
 * Notify user about goal milestone reached
 * @param {string} userId - User ID
 * @param {Object} goalData - Goal data
 */
function notifyGoalMilestoneReached(userId, goalData) {
  emitToUser(userId, EVENT_TYPES.GOAL_MILESTONE_REACHED, {
    ...goalData,
    timestamp: new Date().toISOString()
  });
  
  logger.info('Goal milestone reached notification sent', { 
    userId, 
    goalId: goalData.goalId,
    milestone: goalData.milestone
  });
}

/**
 * Update balance information in real-time
 * @param {string} userId - User ID
 * @param {Object} balanceData - Balance data
 */
function updateBalance(userId, balanceData) {
  emitToUser(userId, EVENT_TYPES.BALANCE_UPDATED, {
    ...balanceData,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('Balance update sent', { 
    userId, 
    balance: balanceData.balance 
  });
}

/**
 * Update budget performance in real-time
 * @param {string} userId - User ID
 * @param {Object} budgetData - Budget data
 */
function updateBudgetPerformance(userId, budgetData) {
  emitToUser(userId, EVENT_TYPES.BUDGET_UPDATED, {
    ...budgetData,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('Budget performance update sent', { 
    userId, 
    budgetId: budgetData.budgetId 
  });
}

/**
 * Update goal progress in real-time
 * @param {string} userId - User ID
 * @param {Object} goalData - Goal data
 */
function updateGoalProgress(userId, goalData) {
  emitToUser(userId, EVENT_TYPES.GOAL_PROGRESS_UPDATED, {
    ...goalData,
    timestamp: new Date().toISOString()
  });
  
  logger.debug('Goal progress update sent', { 
    userId, 
    goalId: goalData.goalId 
  });
}

/**
 * Get current socket connection statistics
 * @returns {Object} Statistics object
 */
function getStats() {
  if (!io) {
    logger.error('Socket.IO not initialized');
    return { error: 'Socket.IO not initialized' };
  }
  
  return {
    connections: io.engine.clientsCount,
    rooms: io.sockets.adapter.rooms ? Object.keys(io.sockets.adapter.rooms).length : 0,
    timestamp: new Date().toISOString()
  };
}

/**
 * Cleanup function for graceful shutdown
 */
function cleanup() {
  if (redisClient) {
    redisClient.disconnect();
  }
  
  if (redisPublisher) {
    redisPublisher.disconnect();
  }
  
  if (io) {
    io.close();
  }
  
  logger.info('Socket.IO resources cleaned up');
}

module.exports = {
  initialize,
  emitToRoom,
  emitToUser,
  emitSystemNotification,
  notifyBudgetThresholdExceeded,
  notifyTransactionCreated,
  notifyGoalMilestoneReached,
  updateBalance,
  updateBudgetPerformance,
  updateGoalProgress,
  getStats,
  cleanup,
  EVENT_TYPES,
  ROOM_TYPES
};
