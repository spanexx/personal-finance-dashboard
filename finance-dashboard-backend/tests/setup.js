const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Set NODE_ENV to test to disable background services
process.env.NODE_ENV = 'test';

// Set required environment variables for tests
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.BCRYPT_SALT_ROUNDS = '10'; // Lower for faster tests
process.env.REDIS_ENABLED = 'false'; // Disable Redis for tests
process.env.PORT = '0'; // Use random port to avoid conflicts

let mongoServer;
// Track and clear intervals/timeouts to prevent hanging
const backgroundIntervals = [];
const backgroundTimeouts = [];
const originalSetInterval = global.setInterval;
const originalSetTimeout = global.setTimeout;
const originalClearInterval = global.clearInterval;
const originalClearTimeout = global.clearTimeout;

global.setInterval = function(callback, delay, ...args) {
  const id = originalSetInterval.call(this, callback, delay, ...args);
  backgroundIntervals.push(id);
  return id;
};

global.setTimeout = function(callback, delay, ...args) {
  const id = originalSetTimeout.call(this, callback, delay, ...args);
  backgroundTimeouts.push(id);
  return id;
};

global.clearInterval = function(id) {
  const index = backgroundIntervals.indexOf(id);
  if (index > -1) {
    backgroundIntervals.splice(index, 1);
  }
  return originalClearInterval.call(this, id);
};

global.clearTimeout = function(id) {
  const index = backgroundTimeouts.indexOf(id);
  if (index > -1) {
    backgroundTimeouts.splice(index, 1);
  }
  return originalClearTimeout.call(this, id);
};

beforeAll(async () => {
  try {
    // Create MongoDB Memory Server with simplified configuration to avoid disk space issues
    mongoServer = await MongoMemoryServer.create({
      instance: {
        port: 0, // Use random port
        dbName: 'test_finance_dashboard'
      },
      binary: {
        version: '5.0.10', // Use smaller/older version to reduce download size
        skipMD5: true
      }
    });
    
    const mongoUri = mongoServer.getUri();
    console.log('MongoDB Memory Server started at:', mongoUri);
    
    // Set MongoDB URI for tests
    process.env.MONGODB_URI = mongoUri;
    
    // Connect to MongoDB with proper configuration
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 5,
      minPoolSize: 1,
      connectTimeoutMS: 10000
    });
    
    console.log('Connected to MongoDB Memory Server successfully');
  } catch (error) {
    console.error('Failed to start MongoDB Memory Server:', error);
    throw error;
  }
}, 120000); // 2 minutes timeout for setup

beforeEach(async () => {
  try {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    const promises = [];
    
    for (const key in collections) {
      const collection = collections[key];
      promises.push(collection.deleteMany({}));
    }
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error clearing collections:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    // Clear all background intervals and timeouts
    backgroundIntervals.forEach(id => originalClearInterval(id));
    backgroundTimeouts.forEach(id => originalClearTimeout(id));
    backgroundIntervals.length = 0;
    backgroundTimeouts.length = 0;
    
    // Restore original functions
    global.setInterval = originalSetInterval;
    global.setTimeout = originalSetTimeout;
    global.clearInterval = originalClearInterval;
    global.clearTimeout = originalClearTimeout;
    
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
      // Stop MongoDB Memory Server
    if (mongoServer) {
      await mongoServer.stop();
      console.log('MongoDB Memory Server stopped');
    }
    
    // Clear all tracked intervals
    if (global.testIntervalTracker) {
      const cleanedCount = global.testIntervalTracker.clearAll();
      console.log(`Cleaned up ${cleanedCount} intervals/timeouts`);
    }
    
  } catch (error) {
    console.error('Error in test cleanup:', error);
  }
}, 30000);
