# Express.js Middleware Guidelines

## Purpose

This `Gemini.md` provides specific guidelines for creating and managing
Express.js middleware functions within this directory. Middleware functions are
essential for handling cross-cutting concerns such as authentication,
authorization, logging, validation, and error handling.

## Industry Standards & Best Practices

- **Single Responsibility:** Each middleware function should ideally have a
  single, well-defined responsibility (e.g., `authenticateUser`, `validateInput`,
  `logRequest`).
- **Order of Execution:** Be mindful of the order in which middleware
  functions are applied. Authentication and validation typically come before
  route handlers.
- **`next()` Function:** Always call `next()` to pass control to the next
  middleware function in the stack, or `next(error)` to pass an error to the
  error-handling middleware.
- **Error Handling Middleware:** Dedicated error-handling middleware
  functions should have four arguments: `(err, req, res, next)`. These should be
  placed at the end of the middleware stack.
- **Reusability:** Design middleware to be reusable across different routes
  or applications.
- **Security:** Implement security-related middleware (e.g., CORS, helmet,
  rate limiting) to protect your API.

### Relevant Industry Resources:

- **Express.js Middleware:** [https://expressjs.com/en/guide/using
  middleware.html](https://expressjs.com/en/guide/using-middleware.html)
- **Security Best Practices for Express:**
  [https://expressjs.com/en/advanced/best-practice-security.html]
  (https://expressjs.com/en/advanced/best-practice-security.html)
- **CORS:** [https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS]
  (https://developer.mozilla.com/en-US/docs/Web/HTTP/CORS)

### Example Middleware Structure:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CustomError } from '../utils/CustomError'; // Assuming a custom error
class
// Custom Request interface to add user property
declare global {
 namespace Express {
   interface Request {
     user?: any; // Or a more specific user type
   }
 }
}
// Authentication Middleware
export const authenticateUser = (req: Request, res: Response, next:
NextFunction) => {
 const authHeader = req.headers.authorization;
 if (!authHeader || !authHeader.startsWith('Bearer ')) {
   return next(new CustomError('Authentication token missing or invalid',
401));
 }
const token = authHeader.split(' ')[1];
try {
const decoded = jwt.verify(token, process.env.JWT_SECRET ||
'your_jwt_secret');
req.user = decoded; // Attach user payload to request
next();
} catch (error) {
next(new CustomError('Invalid or expired token', 401));
}
};
// Error Handling Middleware
export const errorHandler = (err: any, req: Request, res: Response, next:
NextFunction) => {
console.error(err.stack); // Log the error stack for debugging
const statusCode = err.statusCode || 500;
const message = err.message || 'Internal Server Error';
res.status(statusCode).json({
success: false,
message: message,
error: {
code: err.errorCode || 'SERVER_ERROR',
details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
// Only send stack in dev
},
});
};
// Example: Validation Middleware (simplified)
export const validateUserCreation = (req: Request, res: Response, next:
NextFunction) => {
const { username, email, password } = req.body;
if (!username || !email || !password) {
return next(new CustomError('Missing required fields for user creation',
400));
}
// More complex validation logic would go here, possibly using a library
next();
};
Task List Management
When working on a middleware-related task, I expect you to maintain a task list within
our conversation. Update the status of each item as you progress.
Task Status Definitions:
[ ] Pending: Task not yet started.
[x] Complete : Task successfully finished.
[>] In Progress : Task currently being worked on.
[!] Blocked : Task cannot proceed due to an external dependency or issue.
Example Task List Usage:
When I give you a task like "Create a rate limiting middleware for the API," your
response should include a task list like this:
**Task List for Rate Limiting Middleware:**- [ ] Pending: Install `express-rate-limit` package- [>] In Progress: Implement `rateLimit` configuration- [ ] Pending: Apply middleware to relevant routes- [ ] Pending: Test rate limiting functionality
And then you would update it in subsequent interactions:
**Task List for Rate Limiting Middleware:**- [x] Complete: Install `express-rate-limit` package- [>] In Progress: Implement `rateLimit` configuration (currently setting
window and max requests)- [ ] Pending: Apply middleware to relevant routes- [ ] Pending: Test rate limiting functionalit
```
