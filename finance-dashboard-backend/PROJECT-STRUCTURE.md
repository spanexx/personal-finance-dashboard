# Personal Finance Dashboard - Project Structure Documentation

This document provides a comprehensive overview of the backend project structure, explaining the purpose and organization of each directory and file.

## 📁 Root Directory Structure

```
finance-dashboard-backend/
├── 📄 .env                    # Environment variables (local, not in version control)
├── 📄 .env.example           # Environment variables template
├── 📄 .eslintrc.json         # ESLint configuration for code linting
├── 📄 .gitignore             # Git ignore rules
├── 📄 .prettierrc            # Prettier configuration for code formatting
├── 📄 ecosystem.config.js    # PM2 process manager configuration
├── 📄 ENVIRONMENT-CONFIG.md  # Environment setup documentation
├── 📄 jest.config.js         # Jest testing framework configuration
├── 📄 package.json           # Node.js dependencies and scripts
├── 📄 package-lock.json      # Locked dependency versions
├── 📄 README.md              # Project documentation
├── 📄 server.js              # Application entry point
└── 📁 [directories...]       # See detailed structure below
```

## 🗂️ Directory Structure Details

### 📁 `config/` - Configuration Management

```
config/
├── 📄 db.js               # Database connection configuration
├── 📄 development.js      # Development environment settings
├── 📄 environment.js      # Environment configuration manager
├── 📄 passport.js         # Passport.js authentication strategy
├── 📄 production.js       # Production environment settings
├── 📄 staging.js          # Staging environment settings
└── 📄 validation.js       # Global validation schemas
```

**Purpose**: Centralized configuration management for different environments and application components.

### 📁 `controllers/` - Request Handlers

```
controllers/
├── 📄 auth.controller.js        # Authentication endpoints
├── 📄 budget.controller.js      # Budget management endpoints
├── 📄 goal.controller.js        # Financial goals endpoints
├── 📄 index.js                  # Controller exports
├── 📄 report.controller.js      # Analytics and reporting endpoints
├── 📄 transaction.controller.js # Transaction management endpoints
└── 📄 user.controller.js        # User management endpoints
```

**Purpose**: Handle HTTP requests, coordinate between middleware, services, and models. Each controller focuses on a specific business domain.

### 📁 `middleware/` - Request Processing

```
middleware/
├── 📄 auth.middleware.js        # Authentication verification
├── 📄 error.middleware.js       # Global error handling
├── 📄 index.js                  # Middleware exports
├── 📄 logger.middleware.js      # Request logging
└── 📄 validation.middleware.js  # Request validation
```

**Purpose**: Process requests before they reach controllers. Handles cross-cutting concerns like authentication, logging, and validation.

### 📁 `models/` - Data Models

```models/
├── 📄 Budget.js          # Budget data model and schema
├── 📄 Category.js        # Category data model and schema
├── 📄 Goal.js            # Financial goal data model and schema
├── 📄 index.js           # Model exports
├── 📄 Transaction.js     # Transaction data model and schema
└── 📄 User.js            # User data model and schema
```

**Purpose**: Define database schemas, relationships, and data validation rules using Mongoose ODM.

### 📁 `routes/` - API Endpoints

```
routes/
├── 📄 auth.routes.js        # Authentication routes (/api/auth/*)
├── 📄 budget.routes.js      # Budget routes (/api/budgets/*)
├── 📄 goal.routes.js        # Goal routes (/api/goals/*)
├── 📄 index.js              # Route exports
├── 📄 report.routes.js      # Report routes (/api/reports/*)
├── 📄 transaction.routes.js # Transaction routes (/api/transactions/*)
└── 📄 user.routes.js        # User routes (/api/users/*)
```

**Purpose**: Define API endpoints and their HTTP methods, connect routes to appropriate controllers and middleware.

### 📁 `services/` - Business Logic

```
services/
├── 📄 auth.service.js        # Authentication business logic
├── 📄 budget.service.js      # Budget management business logic
├── 📄 goal.service.js        # Goal management business logic
├── 📄 index.js               # Service exports
├── 📄 report.service.js      # Analytics and reporting logic
├── 📄 transaction.service.js # Transaction processing logic
└── 📄 user.service.js        # User management business logic
```

**Purpose**: Contain complex business logic, data processing, and coordination between multiple models. Services are reusable and testable.

### 📁 `utils/` - Utility Functions

```
utils/
├── 📄 apiResponse.js     # Standardized API response formatting
├── 📄 errorHandler.js    # Custom error classes and handlers
├── 📄 index.js           # Utility exports
├── 📄 logger.js          # Winston logger configuration
└── 📄 validators.js      # Custom validation functions
```

**Purpose**: Provide reusable utility functions, helpers, and common functionality used across the application.

### 📁 `tests/` - Test Suite

```
tests/
├── 📁 integration/       # Integration tests
│   └── 📄 .gitkeep       # Keeps directory in version control
└── 📁 unit/              # Unit tests
    └── 📄 .gitkeep       # Keeps directory in version control
```

**Purpose**: Organize test files for comprehensive testing coverage. Separates unit tests (individual functions) from integration tests (full workflows).

### 📁 `logs/` - Application Logs

```
logs/
└── 📄 .gitkeep           # Keeps directory in version control
```

**Purpose**: Store application logs. Actual log files are excluded from version control via `.gitignore` for security and storage efficiency.

### 📁 `uploads/` - File Storage

```
uploads/
└── 📄 .gitkeep           # Keeps directory in version control
```

**Purpose**: Store user-uploaded files like receipts and documents. Actual files are excluded from version control via `.gitignore`.

## 🔄 Application Flow

### 1. Request Processing Flow

```
HTTP Request → Routes → Middleware → Controllers → Services → Models → Database
                ↓
HTTP Response ← Routes ← Middleware ← Controllers ← Services ← Models ← Database
```

### 2. Layer Responsibilities

1. **Routes**: Define endpoints and HTTP methods
2. **Middleware**: Handle authentication, validation, logging
3. **Controllers**: Process requests, coordinate responses
4. **Services**: Implement business logic
5. **Models**: Define data structure and database operations
6. **Utils**: Provide common functionality

## 📋 File Naming Conventions

### Controllers

- **Pattern**: `{domain}.controller.js`
- **Examples**: `auth.controller.js`, `budget.controller.js`

### Models

- **Pattern**: `{Entity}.js` (PascalCase)
- **Examples**: `User.js`, `Transaction.js`

### Routes

- **Pattern**: `{domain}.routes.js`
- **Examples**: `auth.routes.js`, `budget.routes.js`

### Services

- **Pattern**: `{domain}.service.js`
- **Examples**: `auth.service.js`, `budget.service.js`

### Middleware

- **Pattern**: `{purpose}.middleware.js`
- **Examples**: `auth.middleware.js`, `validation.middleware.js`

### Utils

- **Pattern**: `{purpose}.js`
- **Examples**: `logger.js`, `validators.js`

## 🔧 Configuration Files

### Environment Configuration

- **`.env`**: Local environment variables (not in version control)
- **`.env.example`**: Template for environment setup
- **`config/environment.js`**: Environment configuration manager
- **`config/{env}.js`**: Environment-specific settings

### Development Tools

- **`.eslintrc.json`**: Code linting rules
- **`.prettierrc`**: Code formatting rules
- **`jest.config.js`**: Test configuration
- **`ecosystem.config.js`**: Production deployment configuration

## 🎯 Best Practices

### 1. Separation of Concerns

- Each layer has a specific responsibility
- Business logic is contained in services
- Controllers are thin and focus on request/response handling

### 2. Modularity

- Each file has a single responsibility
- Code is organized into logical modules
- Dependencies are clearly defined

### 3. Testability

- Business logic is separated from framework code
- Services are easily testable in isolation
- Clear interfaces between layers

### 4. Maintainability

- Consistent naming conventions
- Clear directory structure
- Comprehensive documentation

### 5. Scalability

- Modular architecture supports growth
- Clear separation allows for easy refactoring
- Configuration management supports multiple environments

## 🚀 Getting Started

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Set up environment**: Copy `.env.example` to `.env` and configure
4. **Start development**: `npm run dev`
5. **Run tests**: `npm test`

## 📚 Additional Resources

- [Environment Configuration Guide](ENVIRONMENT-CONFIG.md)
- [API Documentation](README.md#api-documentation)
- [Deployment Guide](README.md#deployment)

---

This structure provides a solid foundation for a scalable, maintainable Node.js backend application following industry best practices and clean architecture principles.
