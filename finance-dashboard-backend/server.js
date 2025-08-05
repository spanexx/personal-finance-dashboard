
const mongoose = require('mongoose');
const http = require('http');
require('dotenv').config();

const path = require('path');
const express = require('express');

const app = require('./app');
const logger = require('./utils/logger');
const PORT = process.env.PORT || 5000;



// Only connect to MongoDB and start services if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // MongoDB Connection
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/finance-dashboard')
  .then(() => {
    logger.info('MongoDB connected successfully');
    console.log('MongoDB connected successfully');
    
    // Initialize scheduler service after database connection
    const { schedulerService, cleanupService } = require('./services');
    schedulerService.initialize();
    
    // Initialize cleanup service for export files
    cleanupService.start();
    logger.info('Cleanup service initialized');
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
}

// Create HTTP server (necessary for Socket.IO)
const server = http.createServer(app);

// Initialize Socket.IO after server creation (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  const { socketService, socketEventsService } = require('./services');
  const AIWebSocketService = require('./services/aiWebSocket.service');
  
  const io = socketService.initialize(server);
  socketEventsService.registerEventHandlers();
  
  // Initialize AI WebSocket service with the Socket.IO instance
  new AIWebSocketService(io);
  logger.info('AI WebSocket service initialized');
}

// Graceful shutdown handling (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    
    // Cleanup services
    const { cleanupService } = require('./services');
    cleanupService.shutdown();
    
    // Cleanup Socket.IO resources
    const { socketService } = require('./services');
    socketService.cleanup();
    
    // Cleanup Redis connections
    const AuthService = require('./services/auth.service');
    await AuthService.shutdown();
    
    // Close database connections
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    }
    
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    
    // Cleanup services
    const { cleanupService } = require('./services');
    cleanupService.shutdown();
    
    // Cleanup Socket.IO resources
    const { socketService } = require('./services');
    socketService.cleanup();
    
    // Cleanup Redis connections
    const AuthService = require('./services/auth.service');
    await AuthService.shutdown();
    
    // Close database connections
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    }
    
    process.exit(0);
  });

  // Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Server will keep running. Investigate and fix the root cause.
});

  // Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Server will keep running. Investigate and fix the root cause.
});
}

// Start server (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    const startupMessage = [
      `🚀 Personal Finance Dashboard API`,
      `📡 Server running on port ${PORT}`,
      `🌍 Environment: ${process.env.NODE_ENV || 'development'}`,
      `🔒 Security middleware enabled`,
      `📊 Rate limiting active`,
      `🛡️  Input sanitization enabled`,
      `📝 Request logging active`,
      `🔌 WebSocket server enabled`
    ].join('\n   ');
    
    console.log(startupMessage);
    logger.info('Server started successfully', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  });
}

module.exports = app;
