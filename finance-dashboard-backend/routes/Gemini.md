# Express.js Routes Guidelines

## Purpose

This `Gemini.md` provides specific guidelines for defining API routes using
Express.js within this directory. Routes are responsible for mapping incoming
HTTP requests to the appropriate controller functions.

## Industry Standards & Best Practices

- **Modularity:** Organize routes into logical modules (e.g.,
  `userRoutes.ts`, `productRoutes.ts`). Avoid having all routes in a single file.
- **Prefixing:** Use route prefixes (e.g., `/api/v1/users`) to organize API
  versions and resource groups.
- **HTTP Methods:** Use appropriate HTTP methods (GET, POST, PUT, DELETE,
  PATCH) for CRUD operations.
- **Middleware Chain:** Routes should clearly define the middleware chain,
  including authentication, validation, and authorization middleware, before
  reaching the controller function.
- **Error Handling:** Routes should not contain `try-catch` blocks for
  business logic errors; these should be handled by controllers or global error
  middleware. Routes are primarily for routing and middleware application.
- **Controller Delegation:** Routes should delegate all request handling
  logic to controller functions. They should not contain business logic
  themselves.

### Relevant Industry Resources:

- **Express.js Routing:** [https://expressjs.com/en/guide/routing.html]
  (https://expressjs.com/en/guide/routing.html)
- **RESTful API Naming Conventions:** [https://restfulapi.net/resource
  naming/](https://restfulapi.net/resource-naming/)
- **Express.js Middleware:** [https://expressjs.com/en/guide/using
  middleware.html](https://expressjs.com/en/guide/using-middleware.html)

### Example Route Structure:

```typescript
import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticateUser } from '../middleware/authMiddleware';
import { validateUserCreation, validateUserUpdate } from
'../middleware/validationMiddleware';
const router = Router();
// Get all users
router.get('/', userController.getAllUsers);
// Get user by ID
router.get('/:id', userController.getUserById);
// Create a new user (requires authentication and validation)
router.post('/', authenticateUser, validateUserCreation,
userController.createUser);
// Update a user by ID (requires authentication and validation)
router.put('/:id', authenticateUser, validateUserUpdate,
userController.updateUser);
// Delete a user by ID (requires authentication)
router.delete('/:id', authenticateUser, userController.deleteUser);
export default router;
Task List Management
When working on a route-related task, I expect you to maintain a task list within our
conversation. Update the status of each item as you progress.
Task Status Definitions:
[ ] Pending: Task not yet started.
[x] Complete : Task successfully finished.
[>] In Progress : Task currently being worked on.
[!] Blocked : Task cannot proceed due to an external dependency or issue.
Example Task List Usage:
When I give you a task like "Define routes for product management (GET all, GET by ID,
POST, PUT, DELETE)," your response should include a task list like this:
**Task List for Product Routes:**- [ ] Pending: Create `productRoutes.ts` file- [>] In Progress: Define GET all products route- [ ] Pending: Define GET product by ID route- [ ] Pending: Define POST create product route with authentication and
validation- [ ] Pending: Define PUT update product route with authentication and
validation- [ ] Pending: Define DELETE product route with authentication
And then you would update it in subsequent interactions:
**Task List for Product Routes:**- [x] Complete: Create `productRoutes.ts` file- [>] In Progress: Define GET all products route (currently adding pagination
support)- [ ] Pending: Define GET product by ID route- [ ] Pending: Define POST create product route with authentication and
validation- [ ] Pending: Define PUT update product route with authentication and
validation- [ ] Pending: Define DELETE product route with authentication
```
