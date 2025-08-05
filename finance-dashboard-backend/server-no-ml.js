/**
 * Minimal server that loads the full app but bypasses TensorFlow dependencies
 * Use this when you have issues with TensorFlow.js native bindings
 */

// Setup a global flag to indicate ML functionality is disabled
global.ML_DISABLED = true;

const mongoose = require('mongoose');
const http = require('http');
require('dotenv').config();

const app = require('./app');
const logger = require('./utils/logger');
const PORT = process.env.PORT || 5000;

console.log('Starting server in ML-disabled mode (TensorFlow features disabled)');
logger.info('Starting server in ML-disabled mode (TensorFlow features disabled)');

// Only connect to MongoDB and start services if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // MongoDB Connection
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/finance-dashboard')
  .then(() => {
    logger.info('MongoDB connected successfully');
    console.log('MongoDB connected successfully');
    
    try {
      // Initialize scheduler service after database connection
      const { schedulerService, cleanupService } = require('./services');
      schedulerService.initialize();
      
      // Initialize cleanup service for export files
      cleanupService.start();
      logger.info('Cleanup service initialized');
    } catch (error) {
      logger.error('Error initializing services:', error);
      console.error('Error initializing services:', error);
    }
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
  try {
    const { socketService, socketEventsService } = require('./services');
    
    // Skip loading AI WebSocket service which depends on TensorFlow
    console.log('AI WebSocket service disabled in ML-disabled mode');
    logger.info('AI WebSocket service disabled in ML-disabled mode');
    
    const io = socketService.initialize(server);
    socketEventsService.registerEventHandlers();
  } catch (error) {
    console.error('Error initializing Socket.IO:', error);
    logger.error('Error initializing Socket.IO:', error);
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (ML-disabled mode)`);
  logger.info(`Server running on port ${PORT} (ML-disabled mode)`);
});

// Export for testing
module.exports = server;
