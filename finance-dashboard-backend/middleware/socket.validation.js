/**
 * Socket Validation Middleware
 * Provides validation for Socket.IO related requests
 */

const Joi = require('joi');
const { socketSchemas } = require('../config/validation');

/**
 * Validate request data against the specified schema
 * @param {string} schemaName - Name of the schema to validate against
 * @returns {Function} Express middleware function
 */
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = socketSchemas[schemaName];
    
    if (!schema) {
      return res.status(500).json({
        status: 'error',
        message: `Schema '${schemaName}' not found`
      });
    }
    
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        message: detail.message,
        path: detail.path.join('.')
      }));
        return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errorDetails
      });
    }
    
    // Replace request body with validated value
    req.body = value;
    next();
  };
};

// Export the validate function directly
module.exports = validate;
