# Express.js Controllers Guidelines
 ## Purpose
 This `Gemini.md` provides specific guidelines for creating and managing 
Express.js controller functions within this directory. Controllers are 
responsible for handling incoming requests, processing business logic (often by 
interacting with services/models), and sending responses back to the client.
 ## Industry Standards & Best Practices
 *   
**Single Responsibility Principle (SRP):** Each controller function should 
ideally handle one specific request (e.g., `getUserById`, `createUser`). Avoid 
monolithic controller functions.
 *   
**Asynchronous Operations:** All controller functions should be `async` and 
use `await` for operations that return Promises (e.g., database calls, external 
API calls).
 *   
**Error Handling:** Use `try-catch` blocks or an asynchronous error 
handling middleware (e.g., `express-async-handler`) to catch errors and pass 
them to the Express error handling middleware. **Do NOT send raw error messages 
to the client.**
 *   
**Input Validation:** Delegate complex input validation to middleware or 
dedicated validation services. Controllers should assume validated input.
 *   
**Separation of Concerns:** Controllers should be thin. Business logic 
should reside in services or models, not directly in the controller.
 *   
**HTTP Status Codes:** Always return appropriate HTTP status codes (e.g., 
200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not 
Found, 500 Internal Server Error).
 ### Relevant Industry Resources:
 *   
**Express.js Best Practices:** [https://expressjs.com/en/advanced/best
practice-performance.html](https://expressjs.com/en/advanced/best-practice
performance.html)
 *   
**Node.js Error Handling Best Practices:** [https://nodejs.dev/learn/error
handling-in-nodejs](https://nodejs.dev/learn/error-handling-in-nodejs)
 *   
**REST API Design Guidelines:** [https://restfulapi.net/rest-api-design
guidelines/](https://restfulapi.net/rest-api-design-guidelines/)
 *   
**HTTP Status Codes:** [https://developer.mozilla.org/en
US/docs/Web/HTTP/Status](https://developer.mozilla.org/en
US/docs/Web/HTTP/Status)
 ## Consistent API Response Pattern
 All successful API responses from controllers **MUST** adhere to the following 
JSON structure:
 ```json
 {
 "success": true,
 "message": "Optional success message (e.g., 'User created successfully')",
 "data": {
 // The actual response data (e.g., user object, list of items)
 }
 }
 All error API responses from controllers MUST adhere to the following JSON structure:
{
 "success": false,
 "message": "A user-friendly error message (e.g., 'Invalid input provided')",
 "error": {
 "code": "Optional application-specific error code (e.g., 
'VALIDATION_ERROR')",
 "details": "Optional detailed error information (e.g., validation errors 
array)"
 }
 }
Example Controller Structure:
 import { Request, Response, NextFunction } from 'express';
 import { someService } from '../services/someService'; // Assuming a service 
layer
 // Controller for fetching a single user by ID
 export const getUserById = async (req: Request, res: Response, next: 
NextFunction) => {
 try {
 const userId = req.params.id;
 const user = await someService.findUserById(userId);
 if (!user) {
 return res.status(404).json({
 success: false,
 message: 'User not found',
 error: { code: 'USER_NOT_FOUND' }
 });
 }
 res.status(200).json({
 success: true,
 message: 'User fetched successfully',
 data: user
 });
 } catch (error) {
 // Pass error to the Express error handling middleware
 next(error);
 }
 };
 // Controller for creating a new user
 export const createUser = async (req: Request, res: Response, next: 
NextFunction) => {
 try {
 const userData = req.body; // Assume validated by middleware
 const newUser = await someService.createUser(userData);
 res.status(201).json({
 success: true,
 message: 'User created successfully',
 data: newUser
 });
 } catch (error) {
 next(error);
 }
 };

## Task List Management

I will use task lists to manage my work on the project. Each task list will be specific to a particular feature or bug fix.

### Example Task List Usage:

**Task List for User Authentication Feature:**

*   [ ] Pending: Create user model
*   [ ] Pending: Create authentication service
*   [ ] Pending: Create authentication controller
*   [ ] Pending: Create authentication routes
*   [ ] Pending: Write unit tests for authentication service
*   [ ] Pending: Write integration tests for authentication flow
