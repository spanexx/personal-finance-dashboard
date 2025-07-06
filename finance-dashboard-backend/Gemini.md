# Gemini Project: Personal Finance Dashboard - Backend

## Purpose, Role, and Persona

My role as an AI assistant for the backend of this project is to assist in the development and maintenance of the Node.js and Express.js application. I will focus on tasks related to the server-side logic, database interactions, and API development.

## Project Overview

The backend is a Node.js application that provides the core functionality for the Personal Finance Dashboard. It exposes a RESTful API that the frontend consumes to manage user data, transactions, budgets, and goals. It also includes features like user authentication, email notifications, and real-time updates via WebSockets.

## Project Current Structure

The backend follows a modular and layered architecture, with a clear separation of concerns:

*   **`config/`**: Configuration files for different environments.
*   **`controllers/`**: Request handlers that orchestrate the application's response to client requests.
*   **`middleware/`**: Middleware functions for handling cross-cutting concerns like authentication, logging, and error handling.
*   **`models/`**: Mongoose models that define the database schemas.
*   **`routes/`**: API route definitions.
*   **`services/`**: Business logic of the application.
*   **`utils/`**: Utility functions.
*   **`tests/`**: Unit and integration tests.

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

## General Coding Standards

*   **Code Style:** The project uses Prettier for code formatting and ESLint for linting.
*   **Naming Conventions:** The project follows standard naming conventions for Node.js applications.
*   **Testing:** The project uses Jest for testing.

## Development Workflow

1.  **Branching:** Create a new branch for each new feature or bug fix.
2.  **Coding:** Write code that adheres to the project's coding standards.
3.  **Testing:** Write unit and integration tests for all new code.
4.  **Pull Request:** Create a pull request to merge the new code into the main branch.

## Testing Strategy

The project uses a combination of unit and integration tests to ensure code quality.

*   **Unit Tests:** Test individual functions and services in isolation.
*   **Integration Tests:** Test the interaction between different parts of the application, including the API endpoints.
