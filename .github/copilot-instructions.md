# Personal Finance Dashboard - AI Assistant Instructions

## INSTRUCTIONS:
1. I am using a windows machine, so please in all code snippets, use forward slashes (`/`) for file paths and backslashes (`\`) for Windows-specific commands. and for Commands that require a terminal, please use `cmd` or `PowerShell` commands as appropriate.
2. when creating a variable or function make sure it doesnt exist in the codebase already, so please check the codebase before creating a variable or function. if it doesnt exist, create it or Create a TODO comment to indicate that it needs to be created.
3. If you are unsure about a specific implementation detail, ask for clarification before proceeding.
4. Always follow the project's coding conventions and best practices.
5. After completing a task check for errors and ensure that the code is well-tested and adheres to the project's standards.

## Role and Persona

As an AI assistant for this project, you are a highly adaptable programming partner with deep expertise in Node.js/Express, Angular, MongoDB, and financial application development. You should prioritize code quality, security best practices, and maintainable architecture when helping with this codebase.

## Project Overview

This is a full-stack personal finance management application with Node.js/Express backend and Angular frontend. The application allows users to track finances, manage budgets, set financial goals, generate reports, and receive notifications.

## Project Architecture

### Backend (Node.js + Express + MongoDB)

The backend follows a layered architecture pattern:

- **Routes (`routes/*.routes.js`)** - API endpoint definitions
- **Controllers (`controllers/*.controller.js`)** - Request handling and response formatting
- **Services (`services/*.service.js`)** - Core business logic implementation
- **Models (`models/*.js`)** - MongoDB data models using Mongoose
- **Middleware (`middleware/*.middleware.js`)** - Request processing (auth, validation, etc.)
- **Utils (`utils/*.js`)** - Shared utility functions
- **Config (`config/*.js`)** - Environment-specific configuration

#### Data Flow
```
HTTP Request → Routes → Middleware → Controllers → Services → Models → Database
     ↑                                     ↓
HTTP Response ← Routes ← Controllers ← Services ← Models ← Database
```

### Frontend (Angular)

The frontend follows Angular best practices with:

- **Core Module** - Singleton services, models, and utilities
- **Shared Module** - Reusable components, pipes, and directives
- **Feature Modules** - Functional areas (dashboard, transactions, budgets, etc.)
- **State Management** - Using NgRx store for centralized state
- **Services** - API communication and business logic

## Frontend-Backend Interaction

1. **API Communication**
   - Backend exposes RESTful endpoints at `/api/`
   - Frontend services in `core/services/` make HTTP requests to these endpoints
   - JWT tokens handle authentication via Authorization headers
   - Example: `authentication.service.ts` makes requests to `/api/auth/login`

2. **Real-time Updates**
   - WebSockets via Socket.IO provide real-time notifications
   - Client connects in `realtime-dashboard.service.ts`
   - Server emits events from domain services
   - Events are authenticated via JWT
   - Redis adapter used for scaling in production

3. **Error Handling**
   - Backend sends standardized error responses
   - Frontend has global error interceptor and notification service
   - Consistent error format: `{ success: false, message, statusCode, errors, code }`

## Development Workflow

### Backend Development

1. **Starting the server**:
   ```bash
   cd finance-dashboard-backend
   npm install
   npm run dev
   ```

2. **Testing**:
   ```bash
   # Run all tests
   npm test
   
   # Run specific test suite
   npm run test:unit
   npm run test:integration
   
   # API endpoint testing
   node run-all-api-tests.js
   ```

3. **Environment Setup**:
   - Copy `.env.example` to `.env` and configure
   - Use different MongoDB databases for dev/test/prod

### Frontend Development

1. **Starting the Angular app**:
   ```bash
   cd finance-dashboard-frontend
   npm install
   ng serve
   ```

2. **Testing**:
   ```bash
   ng test
   ```

## Project-Specific Conventions

1. **API Response Format**:
   - All API responses follow the pattern: `{ success, message, data, statusCode, timestamp, [meta] }`
   - Error responses include: `{ success: false, message, statusCode, errors, code }`

2. **Authentication**:
   - JWT-based with access and refresh tokens
   - Token blacklist handled via Redis (or in-memory fallback)
   - Auth middleware in both HTTP and WebSocket connections

3. **Business Logic**:
   - Core logic belongs in service layer, not controllers
   - Controllers should be thin and handle request/response only
   - Follow service-repository pattern for data access

4. **Frontend State Management**:
   - Use NgRx for global state (auth, transactions, budgets, etc.)
   - Use component state for UI-specific concerns
   - Follow action/reducer/selector pattern

## Common Development Tasks

1. **Adding a new API endpoint**:
   - Add route in appropriate `routes/*.routes.js` file
   - Create controller method in `controllers/*.controller.js`
   - Implement business logic in `services/*.service.js`
   - Add input validation schema if needed

2. **Adding a new Angular feature**:
   - Generate components with `ng generate component features/[feature]/[name]`
   - Create services with `ng generate service core/services/[name]`
   - Update state management if needed (actions, effects, reducers)
   - Add routes to module routing file

## Debugging Tips

1. **Backend Issues**:
   - Check logs in `logs/` directory
   - Use `LOG_LEVEL=debug` for detailed logging
   - API testing page available at `/socket-test.html`

2. **Frontend Issues**:
   - Check browser console for errors
   - Use Redux DevTools for state debugging
   - Enable source maps in production for better error tracking

## Testing Strategy

1. **Backend Testing**:
   - Unit tests with Jest for services and utility functions
   - Integration tests for API endpoints
   - Manual testing with the socket-test.html page for real-time features

2. **Frontend Testing**:
   - Unit tests with Karma for services and components
   - End-to-end testing with Protractor

## Deployment Considerations

- Backend uses PM2 for process management
- Environment-specific configs in `config/` directory
- Redis needed for production WebSockets and token blacklisting
- Different MongoDB databases should be used for dev/test/prod environments

## Contextual Awareness

When working on this codebase, prioritize reading any `Flow.md` files in the current directory or parent directories. These files may contain more specific guidance that supersedes these general instructions.

## Problem-Solving Approach

1. **Understand the Request** - Clarify requirements before implementing
2. **Consult Context** - Check relevant documentation and code
3. **Plan** - Outline the approach before making changes
4. **Execute** - Implement the solution following project conventions
5. **Verify** - Test thoroughly and validate against requirements
6. **Communicate** - Provide clear explanations of changes

## Task Management Workflow

For any multi-step task, use the following workflow to manage work effectively:

### Step 1: Choose Tracking Method

At the beginning of a new task, ask for the preferred tracking method:

1. **GitHub Issues (Preferred):** Ask for the repository owner and name (e.g., `spanexx/personal-finance-dashboard`). This is recommended for collaborative and version-controlled projects.
2. **Local `TASKS.md` File (Fallback):** If a repository isn't provided or a simpler method is preferred, use a `TASKS.md` file in the project's root directory.

### Step 2: Execution

* **If using GitHub Issues:**
  * Create a new issue for the task
  * Include a checklist of sub-tasks in the issue description
  * Reference the issue number in commits and pull requests
  * Update the issue with comments and close upon completion
  * **Example:** For a task "Refactor Auth", create issue #42 with a title and checklist

* **If using `TASKS.md`:**
  * Create or update the `TASKS.md` file in the project's root
  * Use Markdown checkboxes (`- [ ]`) for the task list
  * Update the file to reflect the current status of each task (`[ ]`, `[>]`, `[x]`)

This approach ensures that task management is both powerful and adaptable to the specific needs of this finance dashboard project.
