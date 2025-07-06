/**
 * Simple test setup without MongoDB Memory Server
 * Just for testing background services cleanup
 */

// Set NODE_ENV to test to disable background services
process.env.NODE_ENV = 'test';

// Set required environment variables for tests
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.BCRYPT_SALT_ROUNDS = '10';
process.env.REDIS_ENABLED = 'false';
process.env.PORT = '0';

let backgroundIntervals = [];
let backgroundTimeouts = [];

// Track and clear intervals/timeouts to prevent hanging
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

// Create a simple interval tracker for services
global.testIntervalTracker = {
  intervals: [],
  addInterval: function(id) {
    this.intervals.push(id);
    backgroundIntervals.push(id);
  },
  clearAll: function() {
    const count = this.intervals.length;
    this.intervals.forEach(id => originalClearInterval(id));
    this.intervals = [];
    return count;
  }
};

beforeAll(async () => {
  console.log('Simple test setup - no MongoDB Memory Server');
}, 30000);

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
    
    // Clear all tracked intervals
    if (global.testIntervalTracker) {
      const cleanedCount = global.testIntervalTracker.clearAll();
      console.log(`Cleaned up ${cleanedCount} intervals/timeouts`);
    }
    
    console.log('Simple test cleanup completed');
  } catch (error) {
    console.error('Error in test cleanup:', error);
  }
}, 10000);
