# Real-time Features Implementation Guide

This document provides an overview of the real-time features implemented in the Personal Finance Dashboard using WebSocket technology via Socket.IO.

## Overview

The real-time system enables:

- Live notifications for budget alerts, goal progress, and transaction confirmations
- Instant data synchronization across multiple client sessions
- Real-time balance updates and financial metrics

## Architecture

The implementation follows a layered architecture:

1. **Socket Service (`services/socket.service.js`)**
   - Core Socket.IO server configuration
   - Connection management and authentication
   - Room management for user-specific updates
   - Event emission utilities
   - Rate limiting and security features

2. **Socket Middleware (`middleware/socket.middleware.js`)**
   - JWT-based authentication for socket connections
   - Rate limiting for connection requests
   - Resource access verification
   - Session management

3. **Socket Events Service (`services/socketEvents.service.js`)**
   - Integrates with existing services (transactions, budgets, goals)
   - Listens for domain events and converts them to socket events
   - Organizes event handlers by domain

4. **Socket Routes (`routes/socket.routes.js`)**
   - REST API endpoints for WebSocket status
   - Admin tools for sending notifications
   - Monitoring and diagnostics

## Key Features

### WebSocket Connection Setup

- **Socket.IO Configuration**
  - Express integration with HTTP server
  - Cross-origin (CORS) settings
  - Connection rate limiting
  - Connection pools and scaling with Redis
  - Timeout and reconnection handling

- **Socket Authentication**
  - JWT-based authentication
  - Token validation on connection
  - Token refresh for long-lived connections
  - User session management
  - Secure authentication handshake

- **Room Management**
  - User-specific rooms for private updates
  - Role-based access control
  - Dynamic room creation and cleanup
  - Subscription management
  - Admin system notification rooms

### Real-time Notification System

- **Budget Alert Notifications**
  - Threshold exceeded alerts
  - Severity level classification
  - Category-specific notifications
  - Milestone achievement updates
  - Proactive spending warnings

- **Goal Progress Updates**
  - Progress change broadcasts
  - Milestone celebration notifications
  - Deadline reminders
  - Completion notifications
  - Contribution acknowledgments

- **Transaction Confirmations**
  - Creation confirmations
  - Update broadcasts
  - Bulk import progress
  - Validation notifications
  - Conflict alerts

### Live Data Updates

- **Real-time Balance Updates**
  - Multi-session balance synchronization
  - Post-transaction balance updates
  - Concurrent transaction handling
  - Reconciliation notifications
  - Trend updates

- **Live Budget Performance**
  - Utilization percentage updates
  - Performance change broadcasts
  - Category spending updates
  - Period transition handling
  - Comparison notifications

- **Goal Progress Notifications**
  - Progress bar and percentage updates
  - Contribution confirmations
  - Timeline adjustment notifications
  - Target modification broadcasts
  - Achievement celebrations

## Testing Real-time Features

A test page is provided at `/socket-test.html` for verifying WebSocket functionality:

1. Enter a valid JWT token (can be obtained by logging in via the API)
2. Connect to the WebSocket server
3. Monitor real-time notifications
4. Test sending custom messages

## Implementation Details

### Redis Integration

Socket.IO is integrated with Redis for scaling across multiple server instances:

- Socket.IO-Redis adapter for message passing
- Connection pooling for performance
- Session state management
- Distributed rate limiting

### Security Considerations

- JWT authentication for all connections
- Rate limiting to prevent DoS attacks
- Room-based access control
- Token validation and refresh
- Connection monitoring and logging

### Performance Optimization

- Connection pooling
- Event batching for efficiency
- Redis-based scaling
- Proper connection cleanup
- Throttling for high-volume updates

## Client Integration

To integrate with client applications:

1. Install Socket.IO client:

   ```   npm install socket.io-client
   ```

2. Connect with authentication:

   ```javascript
   const socket = io('http://localhost:5000', {
     auth: { token: 'your-jwt-token' },
     transports: ['websocket', 'polling']
   });
   ```

3. Listen for events:

   ```javascript
   socket.on('transaction:created', (data) => {
     console.log('New transaction:', data);
     // Update UI
   });
   
   socket.on('budget:threshold_exceeded', (data) => {
     console.log('Budget alert:', data);
     // Show notification
   });
   ```

## API Reference

### Socket Events

| Event | Description | Payload |
|-------|-------------|---------|
| `transaction:created` | New transaction created | Transaction details |
| `transaction:updated` | Transaction updated | Updated transaction |
| `transaction:deleted` | Transaction deleted | Transaction ID |
| `budget:threshold_exceeded` | Budget limit exceeded | Budget details, threshold info |
| `budget:updated` | Budget performance changed | Budget details, performance metrics |
| `goal:progress_updated` | Goal progress changed | Goal details, progress percentage |
| `goal:milestone_reached` | Goal milestone achieved | Goal details, milestone info |
| `balance:updated` | Account balance changed | New balance, related transaction |

### REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/socket/status` | GET | Get WebSocket server status and statistics |
| `/api/socket/notify/system` | POST | Send system-wide notification (admin only) |
| `/api/socket/notify/user/:userId` | POST | Send notification to specific user (admin only) |
