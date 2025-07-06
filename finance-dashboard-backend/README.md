# Personal Finance Dashboard - Backend API

A comprehensive Node.js backend API for the Personal Finance Dashboard application. This API provides robust financial management capabilities including expense tracking, budget management, goal setting, and financial analytics.

## 🚀 Features

- **User Authentication & Authorization** - JWT-based secure authentication
- **Expense Management** - Create, read, update, and delete expenses with categories
- **Budget Management** - Set and track budgets with spending limits
- **Financial Goals** - Set and monitor financial goals with progress tracking
- **Category Management** - Custom expense and income categories
- **Dashboard Analytics** - Comprehensive financial insights and reporting
- **Data Export** - Export financial data to CSV and PDF formats
- **Real-time Notifications** - Socket.IO for real-time updates
- **Rate Limiting** - API protection with configurable rate limits
- **File Uploads** - Receipt and document upload support
- **Email Notifications** - Automated email alerts and reports

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Joi
- **File Uploads**: Multer
- **Email**: Nodemailer
- **Real-time**: Socket.IO
- **Logging**: Winston
- **Testing**: Jest & Supertest
- **Code Quality**: ESLint & Prettier
- **Process Management**: PM2

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v16.0.0 or higher)
- **npm** (v8.0.0 or higher)
- **MongoDB** (v5.0 or higher)
- **Git**

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd personal-finance-dashboard/finance-dashboard-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
HOST=localhost

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/finance_dashboard_dev
MONGODB_TEST_URI=mongodb://localhost:27017/finance_dashboard_test

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Other configurations...
```

### 4. Create Required Directories

The following directories will be created automatically if they don't exist:

```bash
mkdir -p logs uploads
```

### 5. Database Setup

Make sure MongoDB is running on your system. The application will automatically create the required collections on first run.

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

The server will start with hot-reloading enabled at `http://localhost:5000`

### Production Mode

```bash
npm start
```

### Using PM2 (Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
npm run pm2:start

# Monitor the application
npm run pm2:status

# View logs
npm run pm2:logs

# Stop the application
npm run pm2:stop
```

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Specific Test Suite

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

## 🔍 Code Quality

### Linting

```bash
# Check for linting errors
npm run lint

# Fix linting errors automatically
npm run lint:fix
```

### Code Formatting

```bash
# Check code formatting
npm run format:check

# Format code automatically
npm run format
```

## 📁 Project Structure

```finance-dashboard-backend/
├── config/                 # Configuration files
│   ├── environment.js      # Environment configuration manager
│   ├── development.js      # Development environment settings
│   ├── staging.js          # Staging environment settings
│   └── production.js       # Production environment settings
├── controllers/            # Route controllers
│   ├── authController.js   # Authentication logic
│   ├── userController.js   # User management
│   ├── expenseController.js# Expense management
│   ├── budgetController.js # Budget management
│   ├── goalController.js   # Financial goals
│   └── dashboardController.js # Dashboard analytics
├── middleware/             # Express middleware
│   ├── auth.js            # Authentication middleware
│   ├── validation.js      # Request validation
│   ├── errorHandler.js    # Error handling
│   └── rateLimiter.js     # Rate limiting
├── models/                 # Database models
│   ├── User.js            # User model
│   ├── Expense.js         # Expense model
│   ├── Budget.js          # Budget model
│   ├── Goal.js            # Goal model
│   └── Category.js        # Category model
├── routes/                 # API routes
│   ├── auth.js            # Authentication routes
│   ├── users.js           # User routes
│   ├── expenses.js        # Expense routes
│   ├── budgets.js         # Budget routes
│   ├── goals.js           # Goal routes
│   └── dashboard.js       # Dashboard routes
├── services/               # Business logic
│   ├── authService.js     # Authentication services
│   ├── emailService.js    # Email services
│   ├── exportService.js   # Data export services
│   └── analyticsService.js # Analytics services
├── utils/                  # Utility functions
│   ├── helpers.js         # General helpers
│   ├── validators.js      # Custom validators
│   └── constants.js       # Application constants
├── tests/                  # Test files
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── logs/                   # Application logs
├── uploads/                # File uploads
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
├── ecosystem.config.js    # PM2 configuration
├── jest.config.js         # Jest configuration
├── package.json           # Dependencies and scripts
└── server.js              # Application entry point
```

## 📚 API Documentation

### Base URL

```http://localhost:5000/api/v1
```

### Authentication Endpoints

- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password

### User Endpoints

- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update user profile
- `DELETE /users/account` - Delete user account

### Expense Endpoints

- `GET /expenses` - Get all expenses
- `POST /expenses` - Create new expense
- `GET /expenses/:id` - Get specific expense
- `PUT /expenses/:id` - Update expense
- `DELETE /expenses/:id` - Delete expense

### Budget Endpoints

- `GET /budgets` - Get all budgets
- `POST /budgets` - Create new budget
- `GET /budgets/:id` - Get specific budget
- `PUT /budgets/:id` - Update budget
- `DELETE /budgets/:id` - Delete budget

### Goal Endpoints

- `GET /goals` - Get all goals
- `POST /goals` - Create new goal
- `GET /goals/:id` - Get specific goal
- `PUT /goals/:id` - Update goal
- `DELETE /goals/:id` - Delete goal

### Dashboard Endpoints

- `GET /dashboard/overview` - Get dashboard overview
- `GET /dashboard/analytics` - Get financial analytics
- `GET /dashboard/export` - Export financial data

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcrypt for secure password storage
- **Rate Limiting** - Protection against brute force attacks
- **Input Validation** - Joi schema validation for all inputs
- **CORS Configuration** - Cross-origin request handling
- **Security Headers** - Helmet.js for security headers
- **File Upload Security** - Secure file handling with type validation

## 🚀 Deployment

### Environment Setup

1. Set `NODE_ENV=production` in your environment
2. Configure production database connection
3. Set secure JWT secrets
4. Configure email service
5. Set up SSL certificates

### Using PM2

```bash
# Production deployment
npm run pm2:prod

# Monitor application
pm2 status finance-dashboard

# View logs
pm2 logs finance-dashboard

# Restart application
pm2 restart finance-dashboard
```

### Docker (Optional)

```bash
# Build Docker image
docker build -t finance-dashboard-backend .

# Run container
docker run -p 5000:5000 finance-dashboard-backend
```

## 📊 Monitoring & Logging

- **Winston Logging** - Structured logging with multiple transports
- **PM2 Monitoring** - Process monitoring and management
- **Error Tracking** - Comprehensive error handling and logging
- **Performance Metrics** - Request timing and performance monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [documentation](ENVIRONMENT-CONFIG.md)
2. Search existing issues
3. Create a new issue with detailed information
4. Contact the development team

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
- **v1.1.0** - Added real-time notifications
- **v1.2.0** - Enhanced analytics and reporting

---

## Happy Coding! 🚀**
