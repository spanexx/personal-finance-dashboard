/**
 * Production Environment Configuration
 * Optimized for performance, security, and reliability
 */

module.exports = {
  // Application Settings
  app: {
    name: 'Finance Dashboard API',
    env: 'production',
    port: process.env.PORT || 5000,
    debug: false
  },

  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI,
    options: {
      maxPoolSize: 20, // Higher pool for production
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0,
      retryWrites: true,
      w: 'majority',
      readPreference: 'primary',
      readConcern: { level: 'majority' }
    }
  },

  // Security Settings (Maximum Security)
  security: {
    bcryptSaltRounds: 12,
    enableHelmet: true,
    enableRateLimiting: true,
    trustProxy: true, // Behind load balancer/CDN
    cors: {
      origin: [
        'https://financedashboard.com',
        'https://www.financedashboard.com',
        'https://admin.financedashboard.com'
      ],
      credentials: true,
      optionsSuccessStatus: 200
    },
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Strict limit for production
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }
  },

  // JWT Configuration
  jwt: {
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
    issuer: 'finance-dashboard-api',
    audience: 'finance-dashboard-app'
  },

  // Logging Configuration
  logging: {
    level: 'warn', // Only warnings and errors in production
    enableConsole: false,
    enableFile: true,
    enableRequestLogging: true,
    format: 'combined',
    rotation: {
      enabled: true,
      maxSize: '100m',
      maxFiles: '30d',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true
    },
    errorTracking: {
      enabled: true,
      service: 'sentry', // Error tracking service
      dsn: process.env.SENTRY_DSN
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
      },
      pool: true, // Use connection pooling
      maxConnections: 5,
      maxMessages: 100
    },
    from: {
      email: process.env.FROM_EMAIL,
      name: process.env.FROM_NAME
    },
    templates: {
      path: './templates/production',
      cache: true
    },
    queue: {
      enabled: true,
      concurrency: 5,
      retryAttempts: 3,
      retryDelay: 5000
    }
  },

  // File Upload Settings
  upload: {
    storageType: 'aws', // AWS S3 for production
    maxFileSize: 5242880, // 5MB
    enableVirusScan: true,
    enableCompression: true,
    aws: {
      bucketName: process.env.AWS_BUCKET_NAME,
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      signedUrlExpires: 3600 // 1 hour
    },
    enableCleanup: true,
    cleanupInterval: '24h',
    cdn: {
      enabled: true,
      baseUrl: process.env.CDN_BASE_URL
    }
  },

  // API Configuration
  api: {
    enableSwagger: false, // Disabled in production
    enableCors: true,
    requestSizeLimit: '5mb', // Stricter limit
    timeout: 30000,
    compression: {
      enabled: true,
      level: 6,
      threshold: 1024
    }
  },

  // Monitoring
  monitoring: {
    enableHealthCheck: true,
    enableMetrics: true,
    enableAPM: true,
    enableErrorTracking: true,
    healthCheck: {
      path: '/health',
      interval: 30000, // 30 seconds
      timeout: 5000
    },
    metrics: {
      path: '/metrics',
      enabled: true,
      collectDefaultMetrics: true
    }
  },

  // Caching Configuration
  cache: {
    enabled: true,
    type: 'redis',
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      db: 0,
      connectTimeout: 10000,
      lazyConnect: true,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3
    },
    ttl: 3600, // 1 hour default TTL
    compression: true
  },

  // Session Configuration
  session: {
    enabled: true,
    store: 'redis',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true, // HTTPS only
      httpOnly: true,
      maxAge: 86400000, // 24 hours
      sameSite: 'strict'
    }
  },

  // Notification Configuration
  notifications: {
    email: {
      enabled: true,
      throttle: true,
      maxPerHour: 10
    },
    push: {
      enabled: true,
      provider: 'fcm',
      batchSize: 100
    },
    sms: {
      enabled: false
    },
    slack: {
      enabled: true,
      webhook: process.env.SLACK_WEBHOOK_PROD,
      channels: {
        errors: '#alerts',
        security: '#security'
      }
    }
  },

  // Feature Flags
  features: {
    enableNewFeatures: false, // Conservative in production
    enableBetaFeatures: false,
    enableAnalytics: true,
    enableMaintenanceMode: false
  },

  // Performance Configuration
  performance: {
    clustering: {
      enabled: true,
      workers: 'auto' // Use all CPU cores
    },
    compression: {
      enabled: true,
      level: 6
    },
    keepAlive: {
      enabled: true,
      timeout: 5000
    }
  },

  // Backup Configuration
  backup: {
    enabled: true,
    database: {
      schedule: '0 2 * * *', // Daily at 2 AM
      retention: '30d',
      compression: true
    },
    files: {
      schedule: '0 3 * * *', // Daily at 3 AM
      retention: '7d'
    }
  },

  // External Services
  external: {
    bankAPI: {
      enabled: true,
      timeout: 10000,
      retryAttempts: 3
    },
    emailService: {
      enabled: true,
      provider: 'production'
    },
    paymentGateway: {
      enabled: true,
      timeout: 15000
    },
    analytics: {
      enabled: true,
      provider: 'google-analytics'
    }
  },

  // SSL/TLS Configuration
  ssl: {
    enabled: true,
    cert: process.env.SSL_CERT_PATH,
    key: process.env.SSL_KEY_PATH,
    ca: process.env.SSL_CA_PATH
  },

  // Graceful Shutdown
  shutdown: {
    timeout: 10000, // 10 seconds
    signals: ['SIGTERM', 'SIGINT'],
    cleanup: {
      database: true,
      cache: true,
      sessions: true
    }
  }
};
