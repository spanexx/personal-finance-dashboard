/**
 * Staging Environment Configuration
 * Production-like environment for testing and QA
 */

module.exports = {
  // Application Settings
  app: {
    name: 'Finance Dashboard API (Staging)',
    env: 'staging',
    port: 5001,
    debug: false
  },

  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/finance_dashboard_staging',
    options: {
      maxPoolSize: 8,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0,
      retryWrites: true,
      w: 'majority'
    }
  },

  // Security Settings (Production-like)
  security: {
    bcryptSaltRounds: 12,
    enableHelmet: true,
    enableRateLimiting: true,
    trustProxy: true, // Behind load balancer
    cors: {
      origin: [
        'https://staging.financedashboard.com',
        'https://staging-admin.financedashboard.com'
      ],
      credentials: true
    },
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 150, // Slightly higher limit for testing
      standardHeaders: true,
      legacyHeaders: false
    }
  },

  // JWT Configuration
  jwt: {
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d'
  },

  // Logging Configuration
  logging: {
    level: 'info',
    enableConsole: false,
    enableFile: true,
    enableRequestLogging: true,
    format: 'combined',
    rotation: {
      enabled: true,
      maxSize: '50m',
      maxFiles: '7d'
    }
  },

  // Email Configuration
  email: {
    enabled: true,
    smtp: {
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    from: {
      email: 'staging@financedashboard.com',
      name: 'Finance Dashboard Staging'
    },
    templates: {
      path: './templates/staging'
    }
  },

  // File Upload Settings
  upload: {
    storageType: 'local', // Could be S3 for staging
    uploadPath: './uploads/staging',
    maxFileSize: 5242880, // 5MB
    enableVirusScan: true,
    enableCleanup: true,
    cleanupInterval: '24h'
  },

  // API Configuration
  api: {
    enableSwagger: true, // Available for QA testing
    swaggerPath: '/api-docs',
    enableCors: true,
    requestSizeLimit: '10mb',
    timeout: 30000
  },

  // Monitoring
  monitoring: {
    enableHealthCheck: true,
    enableMetrics: true,
    enableAPM: true, // Application Performance Monitoring
    enableErrorTracking: true
  },

  // Caching Configuration
  cache: {
    enabled: true,
    type: 'redis',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: 1 // Different DB for staging
    },
    ttl: 300 // 5 minutes default TTL
  },

  // Notification Configuration
  notifications: {
    email: {
      enabled: true,
      throttle: true
    },
    push: {
      enabled: false // Disabled for staging
    },
    slack: {
      enabled: true,
      webhook: process.env.SLACK_WEBHOOK_STAGING
    }
  },

  // Feature Flags
  features: {
    enableNewFeatures: true, // Test new features in staging
    enableBetaFeatures: true,
    enableAnalytics: true
  },

  // Testing Configuration
  testing: {
    enabled: true,
    e2eTests: true,
    loadTesting: true,
    performanceTesting: true
  },

  // External Services
  external: {
    bankAPI: {
      enabled: false, // Use sandbox/mock for staging
      sandbox: true
    },
    emailService: {
      enabled: true,
      provider: 'staging'
    },
    paymentGateway: {
      enabled: false,
      sandbox: true
    }
  }
};
