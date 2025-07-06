/**
 * Development Environment Configuration
 * Optimized for local development and debugging
 */

module.exports = {
  // Application Settings
  app: {
    name: 'Finance Dashboard API (Development)',
    env: 'development',
    port: 5000,
    debug: true
  },

  // Database Configuration
  database: {
    uri: 'mongodb://localhost:27017/finance_dashboard_dev',
    options: {
      maxPoolSize: 5, // Smaller pool for development
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 30000,
      bufferCommands: false,
      bufferMaxEntries: 0,
    }
  },

  // Security Settings (Relaxed for Development)
  security: {
    bcryptSaltRounds: 10, // Lower for faster development
    enableHelmet: false, // Disabled for easier debugging
    enableRateLimiting: false, // Disabled for development
    trustProxy: false,
    cors: {
      origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
      credentials: true
    }
  },

  // JWT Configuration
  jwt: {
    accessExpiresIn: '1h', // Longer for development convenience
    refreshExpiresIn: '30d'
  },

  // Logging Configuration
  logging: {
    level: 'debug', // Verbose logging for development
    enableConsole: true,
    enableFile: false, // File logging disabled for development
    enableRequestLogging: true,
    format: 'dev' // Morgan dev format
  },

  // Email Configuration (Mock in Development)
  email: {
    enabled: false, // Disabled for development
    mockService: true,
    logEmails: true // Log email content to console
  },

  // File Upload Settings
  upload: {
    storageType: 'local',
    uploadPath: './uploads/dev',
    maxFileSize: 10485760, // 10MB for development
    enableCleanup: true
  },

  // API Configuration
  api: {
    enableSwagger: true,
    swaggerPath: '/api-docs',
    enableCors: true,
    requestSizeLimit: '50mb' // Higher limit for development
  },

  // Monitoring
  monitoring: {
    enableHealthCheck: true,
    enableMetrics: true,
    enableProfiling: true // Enable profiling in development
  },

  // Development Tools
  devTools: {
    enableHotReload: true,
    enableSourceMaps: true,
    enableDebugger: true,
    mockExternalAPIs: true
  },

  // Testing Configuration
  testing: {
    enabled: true,
    mockData: true,
    seedDatabase: true
  }
};
