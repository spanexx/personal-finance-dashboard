// Request validation schemas
const Joi = require('joi');

// Socket notification validation schemas
const socketSchemas = {
  socketNotification: Joi.object({
    event: Joi.string().required().min(3).max(50),
    message: Joi.string().required().min(1).max(500),
    severity: Joi.string().valid('info', 'warning', 'error', 'critical').default('info')
  }),
  
  userNotification: Joi.object({
    event: Joi.string().required().min(3).max(50),
    message: Joi.string().required().min(1).max(500),
    data: Joi.object().default({})
  })
};

module.exports = {
  socketSchemas
};
