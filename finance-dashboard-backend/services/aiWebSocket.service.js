const jwt = require('jsonwebtoken');
const aiService = require('./ai.service');
const ChatHistory = require('../models/ChatHistory');

class AIWebSocketService {
  constructor(io) {
    // Use namespace instead of creating new Socket.IO instance
    this.io = io.of('/ai');
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware for WebSocket
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        console.log('WebSocket authentication attempt:', {
          hasToken: !!token,
          tokenLength: token?.length,
          tokenStart: token?.substring(0, 20) + '...',
          authKeys: Object.keys(socket.handshake.auth),
          headerKeys: Object.keys(socket.handshake.headers)
        });
        
        if (!token) {
          console.error('WebSocket auth failed: No token provided');
          return next(new Error('Authentication error: No token provided'));
        }

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        } catch (jwtError) {
          console.error('WebSocket authentication error:', jwtError.message);
          return next(new Error('Authentication error: Invalid token'));
        }

        const user = await require('../models/User').findById(decoded.userId);
        
        if (!user) {
          console.error('WebSocket auth failed: User not found for ID:', decoded.userId);
          return next(new Error('Authentication error: User not found'));
        }

        console.log('WebSocket authentication successful for user:', user.email);
        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error.message);
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('🔌 AI WebSocket connected:', {
        userId: socket.userId,
        userEmail: socket.user?.email,
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });
      
      // Join user-specific room
      socket.join(`user_${socket.userId}`);

      // Handle AI chat messages
      socket.on('ai:chat', async (data) => {
        try {
          console.log('🔥 AI CHAT MESSAGE RECEIVED:', { 
            userId: socket.userId, 
            data,
            timestamp: new Date().toISOString()
          });
          
          const { message, sessionId } = data;
          
          if (!message || message.trim().length === 0) {
            console.log('❌ Empty message received');
            socket.emit('ai:error', { message: 'Message cannot be empty' });
            return;
          }

          console.log('⏳ Processing AI request for message:', message.substring(0, 50));
          
          // Emit typing indicator
          socket.emit('ai:typing', { isTyping: true });

          // Get AI response
          const response = await aiService.getAIResponse(socket.userId, message, sessionId);
          
          console.log('✅ AI response generated:', typeof response, response ? response.substring(0, 100) : 'No response');
          
          // Stop typing indicator
          socket.emit('ai:typing', { isTyping: false });

          // Send response
          socket.emit('ai:response', {
            message,
            response,
            timestamp: new Date().toISOString(),
            sessionId
          });

          console.log('📤 Response sent to client');

          // If response contains an action, emit action event
          if (typeof response === 'object' && response.action) {
            socket.emit('ai:action_suggestion', {
              action: response,
              timestamp: new Date().toISOString()
            });
          }

        } catch (error) {
          console.error('AI chat error:', error);
          socket.emit('ai:typing', { isTyping: false });
          socket.emit('ai:error', { 
            message: 'Failed to get AI response',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
          });
        }
      });

      // Handle action execution
      socket.on('ai:execute_action', async (data) => {
        try {
          const { action, chatId } = data;
          
          // Execute the action
          const result = await aiService.executeAction(socket.userId, action);
          
          // Mark chat history as action executed if chatId provided
          if (chatId) {
            const chat = await ChatHistory.findById(chatId);
            if (chat && chat.userId.toString() === socket.userId) {
              await chat.markActionExecuted(result);
            }
          }

          // Emit success
          socket.emit('ai:action_executed', {
            action,
            result,
            timestamp: new Date().toISOString()
          });

          // Optionally emit updated financial data
          this.emitFinancialUpdate(socket.userId);

        } catch (error) {
          console.error('Action execution error:', error);
          socket.emit('ai:action_error', {
            action: data.action,
            message: 'Failed to execute action',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
          });
        }
      });

      // Handle insights request
      socket.on('ai:get_insights', async () => {
        try {
          socket.emit('ai:insights_loading', { loading: true });
          
          const insights = await aiService.getInsights(socket.userId);
          
          socket.emit('ai:insights_loading', { loading: false });
          socket.emit('ai:insights', {
            insights,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          console.error('Insights error:', error);
          socket.emit('ai:insights_loading', { loading: false });
          socket.emit('ai:error', {
            message: 'Failed to generate insights',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
          });
        }
      });

      // Handle chat history request
      socket.on('ai:get_history', async (data) => {
        try {
          const { page = 1, limit = 20 } = data;
          const history = await aiService.getChatHistory(socket.userId, page, limit);
          
          socket.emit('ai:history', {
            history,
            pagination: { page, limit }
          });

        } catch (error) {
          console.error('Chat history error:', error);
          socket.emit('ai:error', {
            message: 'Failed to get chat history',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(`AI WebSocket disconnected: ${socket.userId}, reason: ${reason}`);
      });
    });
  }

  // Emit financial data updates to user
  async emitFinancialUpdate(userId) {
    try {
      const context = await aiService.getFinancialContext(userId);
      this.io.to(`user_${userId}`).emit('financial:update', {
        context,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error emitting financial update:', error);
    }
  }

  // Send notification to user
  sendNotification(userId, notification) {
    this.io.to(`user_${userId}`).emit('ai:notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });
  }

  // Broadcast insights to all connected users (for scheduled insights)
  async broadcastInsights() {
    const connectedSockets = await this.io.fetchSockets();
    
    for (const socket of connectedSockets) {
      if (socket.userId) {
        try {
          const insights = await aiService.getInsights(socket.userId);
          socket.emit('ai:scheduled_insights', {
            insights,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error(`Error broadcasting insights to user ${socket.userId}:`, error);
        }
      }
    }
  }
}

module.exports = AIWebSocketService;
