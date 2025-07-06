/**
 * Logger utility - Enhanced logger with Winston support
 * Provides comprehensive logging with multiple levels and transports
 */

const winston = require('winston');
const path = require('path');

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  security: 3,
  debug: 4
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  security: 'magenta',
  debug: 'blue'
};

winston.addColors(logColors);

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure Winston logger
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
      
      if (Object.keys(meta).length > 0) {
        logMessage += `\n${JSON.stringify(meta, null, 2)}`;
      }
      
      return logMessage;
    })
  ),
  defaultMeta: { service: 'finance-dashboard-backend' },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Security log file
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'security',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let logMessage = `${timestamp} [${level}]: ${message}`;
        
        // Only show meta data for errors and security events in console
        if ((level === 'error' || level === 'security') && Object.keys(meta).length > 0) {
          logMessage += `\n${JSON.stringify(meta, null, 2)}`;
        }
        
        return logMessage;
      })
    )
  }));
}

// Enhanced logger interface
const enhancedLogger = {
  info: (message, meta = {}) => {
    logger.info(message, meta);
  },
  
  error: (message, meta = {}) => {
    logger.error(message, meta);
  },
  
  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },
  
  debug: (message, meta = {}) => {
    logger.debug(message, meta);
  },
  
  security: (message, meta = {}) => {
    logger.log('security', message, meta);
  },
  
  // Backward compatibility methods
  log: (level, message, meta = {}) => {
    logger.log(level, message, meta);
  },
  
  // Stream interface for Morgan HTTP logging
  stream: {
    write: (message) => {
      logger.info(message.trim());
    }
  }
};

module.exports = enhancedLogger;
