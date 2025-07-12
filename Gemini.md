# Gemini Project: Personal Finance Dashboard

## Purpose, Role, and Persona

My role as an AI assistant for this project is to assist in the development and maintenance of the Personal Finance Dashboard. I will help with tasks such as:

*   Implementing new features
*   Fixing bugs
*   Refactoring code
*   Writing tests
*   Improving documentation

I will act as a collaborative partner, leveraging my understanding of the project's architecture and technologies to provide effective and efficient support.

## Project Overview

The Personal Finance Dashboard is a full-stack web application designed to help users manage their finances. It provides a user-friendly interface to track income, expenses, budgets, and financial goals.

*   **Backend:** Node.js with Express.js, MongoDB, and Mongoose.
*   **Frontend:** Angular with NgRx for state management and Angular Material for UI components.
*   **Real-time Features:** WebSockets (Socket.io) are used for real-time updates.

## Project Current Structure

The project is divided into two main parts:

*   `finance-dashboard-backend`: The Node.js backend application.
*   `finance-dashboard-frontend`: The Angular frontend application.

Both the frontend and backend have a well-defined and modular project structure. The backend follows a layered architecture with a clear separation of concerns (controllers, services, models, etc.). The frontend uses a component-based architecture with NgRx for state management.

## Frontend-Backend Interaction

The frontend and backend communicate via a RESTful API. The backend exposes a set of API endpoints that the frontend consumes to perform CRUD operations and other actions. Real-time communication is handled using WebSockets (Socket.io).

## Backend Structure

The backend follows a layered architecture:

*   **`config/`**: Configuration files for different environments.
*   **`controllers/`**: Request handlers that orchestrate the application's response to client requests.
*   **`middleware/`**: Middleware functions for handling cross-cutting concerns like authentication, logging, and error handling.
*   **`models/`**: Mongoose models that define the database schemas.
*   **`routes/`**: API route definitions.
*   **`services/`**: Business logic of the application.
*   **`utils/`**: Utility functions.
*   **`tests/`**: Unit and integration tests.

## Frontend Structure

The frontend is an Angular application with the following structure:

*   **`src/app/`**: The main application module and components.
*   **`src/app/core/`**: Core services and models.
*   **`src/app/features/`**: Feature modules, each containing its own components, services, and state management logic.
*   **`src/app/shared/`**: Shared components, directives, and pipes.
*   **`src/environments/`**: Environment-specific configuration.

## General Coding Standards

*   **Code Style:** The project uses Prettier for code formatting and ESLint for linting.
*   **Naming Conventions:** The project follows standard naming conventions for both the frontend and backend.
*   **Testing:** The project uses Jest for testing.

## Development Workflow

1.  **Branching:** Create a new branch for each new feature or bug fix.
2.  **Coding:** Write code that adheres to the project's coding standards.
3.  **Testing:** Write unit and integration tests for all new code.
4.  **Pull Request:** Create a pull request to merge the new code into the main branch.

## Testing Strategy

The project uses a combination of unit and integration tests to ensure code quality.

*   **Unit Tests:** Test individual functions and components in isolation.
*   **Integration Tests:** Test the interaction between different parts of the application.

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

### Task List for Flexible Report Generation Options

*   [ ] Pending: Review frontend report generation options (`includeCharts`, `includeTransactionDetails`, `groupBy`, `startDate`, `endDate`, `type`, etc.) and document all possible options sent to the backend.
*   [ ] Pending: Update backend controller (`report.controller.js`) to correctly parse and pass all options from the request to the service layer.
*   [ ] Pending: Refactor backend service (`report.service.js`) to:
    *   [ ] Pending: Only include charts if `includeCharts` is true.
    *   [ ] Pending: Only include transaction details if `includeTransactionDetails` is true.
    *   [ ] Pending: Use the provided `startDate`, `endDate`, and `groupBy` for all queries and aggregations.
    *   [ ] Pending: Ensure the report type (`type`) is respected and the correct report is generated.
*   [ ] Pending: Add/Update unit tests to verify that each option is respected and the response matches the requested configuration.
*   [ ] Pending: Test end-to-end from frontend to backend to confirm that only the requested data is included in the report.
