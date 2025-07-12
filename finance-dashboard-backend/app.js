const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import middleware components
const { globalRateLimit, authRateLimit } = require('./middleware/rateLimit.middleware');
const { sanitizeInput } = require('./middleware/sanitization.middleware');
const { globalErrorHandler, notFoundHandler } = require('./middleware/error.middleware');
const { loggingMiddleware, requestIdMiddleware } = require('./middleware/logger.middleware');
const logger = require('./utils/logger');

const app = express();

// Trust proxy if behind reverse proxy (for rate limiting)
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// Request ID middleware (first middleware for tracking)
app.use(requestIdMiddleware);

// Logging middleware for request/response tracking
app.use(loggingMiddleware);

// Enhanced Security Middleware
app.use(helmet());

// Enhanced rate limiting
app.use(globalRateLimit);

// Apply auth-specific rate limiting to auth routes
app.use('/api/auth', authRateLimit);

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:4200'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
};
app.use(cors(corsOptions));

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Body parsing with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static('public'));

// Enhanced input sanitization
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());
app.use(sanitizeInput());

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Personal Finance Dashboard API',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Import and use API routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/email-verification', require('./routes/emailVerification.routes'));
app.use('/api/email-preferences', require('./routes/emailPreferences.routes'));
app.use('/api/categories', require('./routes/category.routes'));
app.use('/api/transactions', require('./routes/transaction.routes'));
app.use('/api/goals', require('./routes/goal.routes'));
app.use('/api/budgets', require('./routes/budget.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/uploads', require('./routes/upload.routes'));
app.use('/api/export-import', require('./routes/exportImport.routes'));
app.use('/api/socket', require('./routes/socket.routes'));
app.use('/api/cashflow', require('./routes/cashflow'));

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Global error handling middleware (must be last)
app.use(globalErrorHandler);

module.exports = app;
