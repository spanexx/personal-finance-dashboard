/**
 * Middleware Index
 * Exports all middleware modules for easy importing
 */

const auth = require('./auth.middleware');
const validation = require('./validation.middleware');
const error = require('./error.middleware');
const logger = require('./logger.middleware');
const rateLimit = require('./rateLimit.middleware');
const security = require('./security.middleware');
const sanitization = require('./sanitization.middleware');
const password = require('./password.middleware');
const socket = require('./socket.middleware');

module.exports = {
  auth,
  validation,
  error,
  logger,
  rateLimit,
  security,
  sanitization,
  password,
  socket
};
