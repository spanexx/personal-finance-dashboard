/**
 * Socket Routes
 * API routes for WebSocket status and management
 */

const express = require('express');
const router = express.Router();
const { socketService } = require('../services');
const { auth } = require('../middleware');
const validate = require('../middleware/socket.validation');
const logger = require('../utils/logger');

/**
 * @route GET /api/socket/status
 * @desc Get Socket.IO server status and statistics
 * @access Public
 */
router.get('/status', (req, res) => {
  try {
    const stats = socketService.getStats();
    
    res.json({
      status: 'success',
      data: {
        ...stats,
        websocketEnabled: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching Socket.IO status', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      message: 'Could not retrieve WebSocket server status',
      error: error.message
    });
  }
});

/**
 * @route POST /api/socket/notify/system
 * @desc Send a system-wide notification to admin users
 * @access Admin only
 */
router.post('/notify/system', [auth.verifyToken, auth.authorize(['admin']), validate('socketNotification')], (req, res) => {
  try {
    const { event, message, severity } = req.body;
    
    socketService.emitSystemNotification('system:notification', {
      message,
      severity: severity || 'info',
      event: event || 'SYSTEM_NOTIFICATION',
      timestamp: new Date().toISOString()
    });
    
    logger.info('System notification sent', { 
      adminId: req.user.id,
      event,
      severity
    });
    
    res.json({
      status: 'success',
      message: 'System notification sent successfully'
    });
  } catch (error) {
    logger.error('Error sending system notification', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      message: 'Could not send system notification',
      error: error.message
    });
  }
});

/**
 * @route POST /api/socket/notify/user/:userId
 * @desc Send notification to a specific user
 * @access Admin only
 */
router.post('/notify/user/:userId', [auth.verifyToken, auth.authorize(['admin']), validate('userNotification')], (req, res) => {
  try {
    const { userId } = req.params;
    const { event, message, data } = req.body;
    
    socketService.emitToUser(userId, event, {
      message,
      ...data,
      timestamp: new Date().toISOString()
    });
    
    logger.info('User notification sent', { 
      adminId: req.user.id,
      userId,
      event
    });
    
    res.json({
      status: 'success',
      message: 'User notification sent successfully'
    });
  } catch (error) {
    logger.error('Error sending user notification', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      message: 'Could not send user notification',
      error: error.message
    });
  }
});

module.exports = router;
