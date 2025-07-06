# Business Services Guidelines

## Purpose

This `Gemini.md` provides specific guidelines for creating and managing
business service functions within this directory. Services encapsulate the core
business logic of the application, orchestrating interactions between
controllers, models, and external resources.

## Industry Standards & Best Practices

- **Encapsulation of Business Logic:** Services are the primary location for
  all business rules, calculations, and complex workflows. Controllers should be
  thin and delegate to services.
- **Interaction with Models:** Services interact directly with Mongoose
  models to perform database operations (CRUD).
- **Error Handling:** Services should handle specific business errors (e.g.,
  "user not found," "insufficient funds") and throw custom errors that can be
  caught and handled by controllers or global error middleware. Avoid returning
  raw database errors.
- **Dependency Injection:** Services should ideally be designed to accept
  their dependencies (e.g., models, other services) through constructor injection
  or function arguments, promoting testability and modularity.
- **Asynchronous Operations:** All service functions that involve I/O
  operations (database calls, external API calls) must be `async` and use
  `await`.
- **Reusability:** Design service functions to be reusable across different
  controllers or even other services.
- **Transaction Management:** For complex operations involving multiple
  database writes, consider implementing transactions to ensure data consistency
  (MongoDB supports multi-document transactions in replica sets).

### Relevant Industry Resources:

- **Service Layer Pattern:**
  [https://martinfowler.com/eaaCatalog/serviceLayer.html]
  (https://martinfowler.com/eaaCatalog/serviceLayer.html)
- **Node.js Project Structure (Service Layer):**
  [https://www.freecodecamp.org/news/structuring-a-node-js-api-for-production
  e31556942674/](https://www.freecodecamp.org/news/structuring-a-node-js-api-for
  production-e31556942674/)
- **MongoDB Transactions:**
  [https://www.mongodb.com/docs/manual/core/transactions/]
  (https://www.mongodb.com/docs/manual/core/transactions/)

### Example Service Structure:

```typescript
import { User } from "../models/User"; // Assuming User model is defined
import { CustomError } from "../utils/CustomError";
// Service for user-related business logic
export const userService = {
 /**
  * Fetches a user by their ID.
  * @param userId The ID of the user to fetch.
  * @returns The user object.
  * @throws CustomError if user not found.
  */
 async getUserById(userId: string) {
   const user = await User.findById(userId);
   if (!user) {
     throw new CustomError("User not found", 404, "USER_NOT_FOUND");
   }
return user;
},
/**
* Creates a new user.
* @param userData The data for the new user.
* @returns The newly created user object.
* @throws CustomError if email already exists.
*/
async createUser(userData: any) {
const existingUser = await User.findOne({ email: userData.email });
if (existingUser) {
throw new CustomError("Email already registered", 409,
"EMAIL_ALREADY_EXISTS");
}
const newUser = new User(userData);
await newUser.save();
return newUser;
},
/**
* Updates an existing user.
* @param userId The ID of the user to update.
* @param updateData The data to update.
* @returns The updated user object.
* @throws CustomError if user not found.
*/
async updateUser(userId: string, updateData: any) {
const user = await User.findByIdAndUpdate(userId, updateData, { new: true,
runValidators: true });
if (!user) {
throw new CustomError("User not found", 404, "USER_NOT_FOUND");
}
return user;
},
/**
* Deletes a user.
* @param userId The ID of the user to delete.
* @returns True if deletion was successful.
* @throws CustomError if user not found.
*/
async deleteUser(userId: string) {
const result = await User.findByIdAndDelete(userId);
if (!result) {
throw new CustomError("User not found", 404, "USER_NOT_FOUND");
}
return true;
},
};
Task List Management
When working on a service-related task, I expect you to maintain a task list within our
conversation. Update the status of each item as you progress.
Task Status Definitions:
[ ] Pending: Task not yet started.
[x] Complete : Task successfully finished.
[>] In Progress : Task currently being worked on.
[!] Blocked : Task cannot proceed due to an external dependency or issue.
Example Task List Usage:
When I give you a task like "Implement a
productService to handle CRUD operations
for products," your response should include a task list like this:
**Task List for Product Service Implementation:**- [ ] Pending: Create `productService.ts` file- [>] In Progress: Implement `createProduct` function- [ ] Pending: Implement `getProductById` function- [ ] Pending: Implement `updateProduct` function- [ ] Pending: Implement `deleteProduct` function- [ ] Pending: Add error handling for all functions
And then you would update it in subsequent interactions:
**Task List for Product Service Implementation:**- [x] Complete: Create `productService.ts` file- [>] In Progress: Implement `createProduct` function (currently adding
validation and error handling)- [ ] Pending: Implement `getProductById` function- [ ] Pending: Implement `updateProduct` function- [ ] Pending: Implement `deleteProduct` function- [ ] Pending: Add error handling for all function
```
