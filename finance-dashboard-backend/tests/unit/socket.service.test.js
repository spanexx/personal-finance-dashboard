/**
 * Unit Tests for Socket Service
 * Tests WebSocket functionality, real-time events, and connection management
 */

const socketService = require('../../services/socket.service');
const socketIO = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const redis = require('redis');
const { authenticateSocket } = require('../../middleware/socket.middleware');
const logger = require('../../utils/logger');

// Mock dependencies
jest.mock('socket.io');
jest.mock('@socket.io/redis-adapter');
jest.mock('redis');
jest.mock('../../middleware/socket.middleware');
jest.mock('../../utils/logger');

describe('SocketService', () => {
  let mockIO;
  let mockServer;
  let mockSocket;
  let mockRedisClient;
  let mockRedisPublisher;
  let originalEnv;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Save original environment
    originalEnv = process.env;

    // Mock server
    mockServer = {
      listen: jest.fn(),
      on: jest.fn()
    };

    // Mock socket
    mockSocket = {
      id: 'socket123',
      user: {
        id: 'user123',
        email: 'test@example.com',
        role: 'user'
      },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn(),
      rooms: new Set(),
      rateLimit: {
        events: { count: 0, lastReset: Date.now() },
        messages: { count: 0, lastReset: Date.now() },
        joins: { count: 0, lastReset: Date.now() }
      }
    };

    // Mock IO
    mockIO = {
      use: jest.fn(),
      on: jest.fn(),
      adapter: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: {
        adapter: {
          rooms: new Map()
        }
      },
      engine: {
        clientsCount: 0
      }
    };
    socketIO.mockReturnValue(mockIO);

    // Mock Redis clients
    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(),
      duplicate: jest.fn()
    };
    mockRedisPublisher = {
      connect: jest.fn().mockResolvedValue()
    };
    mockRedisClient.duplicate.mockReturnValue(mockRedisPublisher);
    redis.createClient = jest.fn().mockReturnValue(mockRedisClient);

    // Mock create adapter
    createAdapter.mockReturnValue({});

    // Mock authenticate middleware
    authenticateSocket.mockImplementation((socket, next) => next());

    // Mock logger
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
    logger.debug = jest.fn();

    // Reset module state
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initialize', () => {
    test('should initialize Socket.IO server successfully', () => {
      const result = socketService.initialize(mockServer);

      expect(socketIO).toHaveBeenCalledWith(mockServer, expect.objectContaining({
        cors: expect.objectContaining({
          origin: expect.any(Array),
          methods: ['GET', 'POST'],
          credentials: true
        }),
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'],
        maxHttpBufferSize: 1e6
      }));

      expect(mockIO.use).toHaveBeenCalledWith(authenticateSocket);
      expect(mockIO.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith('Socket.IO server initialized successfully');
    });

    test('should not reinitialize if already initialized', () => {
      socketService.initialize(mockServer);
      const result = socketService.initialize(mockServer);

      expect(logger.warn).toHaveBeenCalledWith('Socket.IO server already initialized');
      expect(socketIO).toHaveBeenCalledTimes(1);
    });

    test('should configure Redis adapter when Redis is enabled', async () => {
      process.env.REDIS_ENABLED = 'true';
      process.env.REDIS_URL = 'redis://localhost:6379';

      socketService.initialize(mockServer);

      expect(redis.createClient).toHaveBeenCalledWith({
        url: 'redis://localhost:6379',
        password: undefined,
        database: 0
      });

      // Wait for Redis connection promises
      await Promise.resolve();
      await Promise.resolve();

      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisPublisher.connect).toHaveBeenCalled();
    });

    test('should handle Redis configuration error', () => {
      process.env.REDIS_ENABLED = 'true';
      redis.createClient.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      socketService.initialize(mockServer);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to configure Socket.IO Redis adapter:',
        expect.any(Error)
      );
    });

    test('should use custom CORS origins from environment', () => {
      process.env.ALLOWED_ORIGINS = 'https://app.example.com,https://admin.example.com';

      socketService.initialize(mockServer);

      expect(socketIO).toHaveBeenCalledWith(
        mockServer,
        expect.objectContaining({
          cors: expect.objectContaining({
            origin: ['https://app.example.com', 'https://admin.example.com']
          })
        })
      );
    });

    test('should use default CORS origins when not specified', () => {
      delete process.env.ALLOWED_ORIGINS;

      socketService.initialize(mockServer);

      expect(socketIO).toHaveBeenCalledWith(
        mockServer,
        expect.objectContaining({
          cors: expect.objectContaining({
            origin: ['http://localhost:3000', 'http://localhost:4200']
          })
        })
      );
    });
  });

  describe('connection handling', () => {
    let handleConnection;

    beforeEach(() => {
      socketService.initialize(mockServer);
      handleConnection = mockIO.on.mock.calls.find(call => call[0] === 'connect')[1];
    });

    test('should handle new socket connection', () => {
      handleConnection(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('user:user123');
      expect(mockSocket.emit).toHaveBeenCalledWith('authentication_success', {
        userId: 'user123',
        socketId: 'socket123'
      });
      expect(logger.info).toHaveBeenCalledWith('New socket connection established', {
        socketId: 'socket123',
        userId: 'user123'
      });
    });

    test('should join admin room for admin users', () => {
      mockSocket.user.role = 'admin';

      handleConnection(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('user:user123');
      expect(mockSocket.join).toHaveBeenCalledWith('admin');
    });

    test('should handle connection without user', () => {
      mockSocket.user = null;

      handleConnection(mockSocket);

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('authentication_success', {
        userId: undefined,
        socketId: 'socket123'
      });
    });

    test('should set up disconnect handler', () => {
      handleConnection(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    test('should handle disconnect event', () => {
      handleConnection(mockSocket);
      
      const disconnectHandler = mockSocket.on.mock.calls
        .find(call => call[0] === 'disconnect')[1];
      
      disconnectHandler();

      expect(logger.info).toHaveBeenCalledWith('Socket disconnected', {
        socketId: 'socket123',
        userId: 'user123'
      });
    });

    test('should set up event handlers', () => {
      handleConnection(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith('join_room', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('leave_room', expect.any(Function));
    });
  });

  describe('rate limiting', () => {
    let rateLimiter;

    beforeEach(() => {
      socketService.initialize(mockServer);
      rateLimiter = mockIO.use.mock.calls.find(call => 
        call[0].name === 'socketRateLimiter'
      )[0];
    });

    test('should initialize rate limiting for socket', () => {
      const next = jest.fn();
      
      rateLimiter(mockSocket, next);

      expect(mockSocket.rateLimit).toBeDefined();
      expect(mockSocket.rateLimit.events).toBeDefined();
      expect(mockSocket.rateLimit.messages).toBeDefined();
      expect(mockSocket.rateLimit.joins).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    test('should track and enforce rate limits', () => {
      const next = jest.fn();
      
      rateLimiter(mockSocket, next);

      // Simulate rate limit check on event
      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === '*')[1];
      
      // Simulate multiple events
      for (let i = 0; i < 101; i++) {
        eventHandler();
      }

      expect(mockSocket.emit).toHaveBeenCalledWith('error', { 
        message: 'Rate limit exceeded' 
      });
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    test('should reset rate limit counters after duration', () => {
      const next = jest.fn();
      
      // Mock time
      const originalDateNow = Date.now;
      let mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      rateLimiter(mockSocket, next);

      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === '*')[1];
      
      // Generate events
      for (let i = 0; i < 50; i++) {
        eventHandler();
      }

      // Move time forward beyond duration
      mockTime += 61000; // 61 seconds

      // Should reset counter
      eventHandler();

      expect(mockSocket.rateLimit.events.count).toBe(1);

      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('room management', () => {
    let handleJoinRoom;
    let handleLeaveRoom;

    beforeEach(() => {
      socketService.initialize(mockServer);
      const handleConnection = mockIO.on.mock.calls.find(call => call[0] === 'connect')[1];
      handleConnection(mockSocket);
      
      handleJoinRoom = mockSocket.on.mock.calls.find(call => call[0] === 'join_room')[1];
      handleLeaveRoom = mockSocket.on.mock.calls.find(call => call[0] === 'leave_room')[1];
    });

    test('should handle join room request', () => {
      const roomData = { room: 'budget:123', type: 'budget' };
      
      handleJoinRoom(roomData);

      expect(mockSocket.join).toHaveBeenCalledWith('budget:123');
      expect(logger.debug).toHaveBeenCalledWith('User joined room', {
        userId: 'user123',
        socketId: 'socket123',
        room: 'budget:123'
      });
    });

    test('should reject join room without room name', () => {
      const roomData = { type: 'budget' };
      
      handleJoinRoom(roomData);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Room name is required'
      });
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    test('should enforce join rate limits', () => {
      // Exceed join rate limit
      for (let i = 0; i < 6; i++) {
        handleJoinRoom({ room: `room${i}`, type: 'test' });
      }

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Join rate limit exceeded'
      });
    });

    test('should handle unauthorized room join attempts', () => {
      // Mock canJoinRoom to return false
      const roomData = { room: 'admin:secret', type: 'admin' };
      
      handleJoinRoom(roomData);

      expect(logger.warn).toHaveBeenCalledWith('Unauthorized room join attempt', {
        userId: 'user123',
        room: 'admin:secret',
        type: 'admin'
      });
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Unauthorized'
      });
    });
  });

  describe('event emission', () => {
    beforeEach(() => {
      socketService.initialize(mockServer);
    });

    test('should emit transaction events', () => {
      const transactionData = {
        id: 'trans123',
        amount: 100,
        userId: 'user123'
      };

      socketService.emitTransactionCreated(transactionData);

      expect(mockIO.to).toHaveBeenCalledWith('user:user123');
      expect(mockIO.emit).toHaveBeenCalledWith('transaction:created', transactionData);
    });

    test('should emit budget alerts', () => {
      const budgetAlert = {
        budgetId: 'budget123',
        userId: 'user123',
        message: 'Budget exceeded'
      };

      socketService.emitBudgetAlert(budgetAlert);

      expect(mockIO.to).toHaveBeenCalledWith('user:user123');
      expect(mockIO.emit).toHaveBeenCalledWith('budget:alert', budgetAlert);
    });

    test('should emit goal milestone events', () => {
      const goalData = {
        goalId: 'goal123',
        userId: 'user123',
        milestone: 50
      };

      socketService.emitGoalMilestone(goalData);

      expect(mockIO.to).toHaveBeenCalledWith('user:user123');
      expect(mockIO.emit).toHaveBeenCalledWith('goal:milestone_reached', goalData);
    });

    test('should emit system notifications', () => {
      const notification = {
        message: 'System maintenance scheduled',
        type: 'info'
      };

      socketService.emitSystemNotification(notification);

      expect(mockIO.emit).toHaveBeenCalledWith('system:notification', notification);
    });

    test('should emit to specific rooms', () => {
      const data = { message: 'Room specific event' };

      socketService.emitToRoom('budget:123', 'budget:updated', data);

      expect(mockIO.to).toHaveBeenCalledWith('budget:123');
      expect(mockIO.emit).toHaveBeenCalledWith('budget:updated', data);
    });
  });

  describe('connection statistics', () => {
    beforeEach(() => {
      socketService.initialize(mockServer);
    });

    test('should get connection statistics', () => {
      mockIO.engine.clientsCount = 25;
      mockIO.sockets.adapter.rooms.set('user:123', new Set(['socket1', 'socket2']));
      mockIO.sockets.adapter.rooms.set('budget:456', new Set(['socket1']));

      const stats = socketService.getConnectionStats();

      expect(stats).toEqual({
        totalConnections: 25,
        totalRooms: 2,
        activeUsers: expect.any(Number)
      });
    });

    test('should handle stats when no connections', () => {
      mockIO.engine.clientsCount = 0;

      const stats = socketService.getConnectionStats();

      expect(stats.totalConnections).toBe(0);
      expect(stats.totalRooms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    test('should handle Socket.IO initialization errors', () => {
      socketIO.mockImplementation(() => {
        throw new Error('Socket.IO initialization failed');
      });

      expect(() => socketService.initialize(mockServer)).toThrow('Socket.IO initialization failed');
    });

    test('should handle Redis connection errors gracefully', async () => {
      process.env.REDIS_ENABLED = 'true';
      mockRedisClient.connect.mockRejectedValue(new Error('Redis connection failed'));

      socketService.initialize(mockServer);

      // Wait for the promise to be rejected
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to connect Redis clients for Socket.IO adapter:',
        expect.any(Error)
      );
    });

    test('should handle malformed event data', () => {
      socketService.initialize(mockServer);
      const handleConnection = mockIO.on.mock.calls.find(call => call[0] === 'connect')[1];
      handleConnection(mockSocket);

      const handleJoinRoom = mockSocket.on.mock.calls.find(call => call[0] === 'join_room')[1];

      // Test with malformed data
      expect(() => {
        handleJoinRoom(null);
        handleJoinRoom({});
        handleJoinRoom({ room: null });
      }).not.toThrow();
    });

    test('should handle socket disconnection during rate limiting', () => {
      const rateLimiter = mockIO.use.mock.calls.find(call => 
        call[0].name === 'socketRateLimiter'
      )[0];
      
      const next = jest.fn();
      rateLimiter(mockSocket, next);

      // Simulate socket disconnection
      mockSocket.disconnect.mockImplementation(() => {
        mockSocket.connected = false;
      });

      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === '*')[1];
      
      // Should not throw when disconnected
      expect(() => {
        for (let i = 0; i < 150; i++) {
          eventHandler();
        }
      }).not.toThrow();
    });
  });

  describe('performance considerations', () => {
    test('should handle large number of concurrent connections', () => {
      socketService.initialize(mockServer);
      const handleConnection = mockIO.on.mock.calls.find(call => call[0] === 'connect')[1];

      // Simulate many connections
      for (let i = 0; i < 1000; i++) {
        const socket = {
          ...mockSocket,
          id: `socket${i}`,
          user: { id: `user${i}`, role: 'user' }
        };
        
        expect(() => handleConnection(socket)).not.toThrow();
      }
    });

    test('should handle high frequency events efficiently', () => {
      socketService.initialize(mockServer);

      const startTime = Date.now();
      
      // Emit many events
      for (let i = 0; i < 1000; i++) {
        socketService.emitToRoom(`room${i}`, 'test:event', { data: i });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle memory efficiently with many rooms', () => {
      socketService.initialize(mockServer);
      
      // Simulate many rooms
      for (let i = 0; i < 10000; i++) {
        mockIO.sockets.adapter.rooms.set(`room${i}`, new Set([`socket${i}`]));
      }

      const stats = socketService.getConnectionStats();
      expect(stats.totalRooms).toBe(10000);
    });
  });

  describe('security considerations', () => {
    test('should apply authentication middleware', () => {
      socketService.initialize(mockServer);

      expect(mockIO.use).toHaveBeenCalledWith(authenticateSocket);
    });

    test('should prevent unauthorized access to admin rooms', () => {
      socketService.initialize(mockServer);
      const handleConnection = mockIO.on.mock.calls.find(call => call[0] === 'connect')[1];
      
      // Non-admin user
      mockSocket.user.role = 'user';
      handleConnection(mockSocket);

      expect(mockSocket.join).not.toHaveBeenCalledWith('admin');
    });

    test('should validate room access permissions', () => {
      socketService.initialize(mockServer);
      const handleConnection = mockIO.on.mock.calls.find(call => call[0] === 'connect')[1];
      handleConnection(mockSocket);

      const handleJoinRoom = mockSocket.on.mock.calls.find(call => call[0] === 'join_room')[1];

      // Attempt to join unauthorized room
      handleJoinRoom({ room: 'admin:sensitive', type: 'admin' });

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Unauthorized'
      });
    });

    test('should enforce rate limits to prevent abuse', () => {
      const rateLimiter = mockIO.use.mock.calls.find(call => 
        call[0].name === 'socketRateLimiter'
      )[0];
      
      const next = jest.fn();
      rateLimiter(mockSocket, next);

      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === '*')[1];
      
      // Simulate rapid events
      for (let i = 0; i < 101; i++) {
        eventHandler();
      }

      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'Socket rate limit exceeded, disconnecting',
        { userId: 'user123', socketId: 'socket123' }
      );
    });
  });

  describe('cleanup and shutdown', () => {
    test('should handle graceful shutdown', () => {
      socketService.initialize(mockServer);
      
      mockIO.close = jest.fn();
      
      socketService.shutdown();

      expect(mockIO.close).toHaveBeenCalled();
    });

    test('should close Redis connections on shutdown', () => {
      process.env.REDIS_ENABLED = 'true';
      
      mockRedisClient.quit = jest.fn();
      mockRedisPublisher.quit = jest.fn();
      
      socketService.initialize(mockServer);
      socketService.shutdown();

      expect(mockRedisClient.quit).toHaveBeenCalled();
      expect(mockRedisPublisher.quit).toHaveBeenCalled();
    });
  });
});
