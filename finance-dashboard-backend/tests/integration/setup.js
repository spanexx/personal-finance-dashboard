/**
 * Integration Test Setup
 * Configures test environment for integration testing with MongoDB Memory Server
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../server');

let mongod;

/**
 * Setup test database before all tests
 */
beforeAll(async () => {
  // Start MongoDB Memory Server
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  // Connect mongoose to test database
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  
  console.log('Integration test database connected');
});

/**
 * Cleanup after each test
 */
afterEach(async () => {
  const collections = mongoose.connection.collections;
  
  // Clear all collections after each test
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

/**
 * Cleanup after all tests
 */
afterAll(async () => {
  // Close mongoose connection
  await mongoose.connection.close();
  
  // Stop MongoDB Memory Server
  if (mongod) {
    await mongod.stop();
  }
  
  console.log('Integration test database disconnected');
});

// Export app for testing
module.exports = { app };
