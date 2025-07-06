# Based on the above investigation, here's a summary of the current state

Budget Controller: The controller imports the BudgetService but still uses direct model access for most operations.
Goal Controller: The controller doesn't import the GoalService and uses direct model access.
User Controller: The controller imports multiple services (PasswordService, EmailService, SecurityMonitorService, AuthService) but not UserService. The UserService appears to be an empty file.
Email Verification Controller: Uses emailQueue service but has no dedicated email verification service.
Email Preferences Controller: Direct model access with no corresponding service.
Now, let's create a plan for refactoring each controller to use its proper service layer:

Refactoring Plan

1. Budget Controller Refactoring ✅
The BudgetService is already well-implemented with comprehensive functionality but not fully utilized by the controller. The refactoring will involve:

Removing direct model imports (Budget, Transaction, Category) from the controller
Replacing direct model operations with BudgetService method calls
Ensuring all controller methods use the BudgetService for business logic
2. Goal Controller Refactoring⏲️
The GoalService exists but doesn't provide comprehensive functionality for all controller operations. The refactoring will involve:

Enhancing the GoalService with additional methods matching controller requirements
Importing and using GoalService in the controller
Removing direct model operations from the controller
3. User Controller Refactoring
The UserService is essentially empty. The refactoring will involve:

Implementing a comprehensive UserService with methods for all operations in the controller
Moving business logic from the controller to the service
Updating the controller to use the UserService
4. Email Verification Controller Refactoring
There's no dedicated email verification service. The refactoring will involve:

Creating an EmailVerificationService that handles the verification logic
Moving business logic from the controller to the service
Updating the controller to use the EmailVerificationService
5. Email Preferences Controller Refactoring
There's no dedicated email preferences service. The refactoring will involve:

Creating an EmailPreferencesService that handles preferences management
Moving business logic from the controller to the service
Updating the controller to use the EmailPreferencesService
Let me create a detailed implementation plan for each controller refactoring.

Detailed Implementation Plan

1. Budget Controller Refactoring
Enhance BudgetService:

Ensure all methods from controller are available in service
Add missing methods if necessary (getBudgets, getBudgetById, createBudget, updateBudget, deleteBudget, etc.)
Refactor BudgetController:

Remove direct model imports
Replace direct model operations with BudgetService calls
Maintain only HTTP request/response handling in controller
2. Goal Controller Refactoring
Enhance GoalService:

Add comprehensive methods for all controller operations
Move business logic from controller to service
Ensure proper error handling
Refactor GoalController:

Import and use GoalService
Remove direct model operations
Maintain only HTTP request/response handling in controller
3. User Controller Refactoring
Implement comprehensive UserService:

Add methods for profile management
Add methods for account settings
Add methods for security features
Add methods for user data operations
Refactor UserController:

Import and use UserService
Replace direct model operations with service calls
Maintain only HTTP request/response handling in controller
4. Email Verification Controller Refactoring
Create EmailVerificationService:

Add methods for token generation
Add methods for verification logic
Add methods for rate limiting and attempt tracking
Refactor EmailVerificationController:

Import and use EmailVerificationService
Replace direct model operations with service calls
Maintain only HTTP request/response handling in controller
5. Email Preferences Controller Refactoring
Create EmailPreferencesService:

Add methods for preferences management
Add methods for notification settings
Add methods for preference validation
Refactor EmailPreferencesController:

Import and use EmailPreferencesService
Replace direct model operations with service calls
Maintain only HTTP request/response handling in controller
Next Steps
To implement this plan, we should:

Start with the controller that already has a mostly complete service (Budget Controller)
Then implement the missing services for the other controllers
Finally, refactor each controller to use its corresponding service
