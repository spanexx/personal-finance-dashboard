# Personal Finance Dashboard - Frontend-Backend Integration Implementation Plan

## 🚀 REFINED IMPLEMENTATION PROMPTS WITH ACTUAL API SPECIFICATIONS

### **PHASE 1: CORE INFRASTRUCTURE SETUP**

#### **PROMPT 1.1: HTTP Client Service Configuration**

```Create a comprehensive HTTP client service for Angular to connect with the Personal Finance Dashboard backend API.

REQUIREMENTS:
- Create an injectable Angular service for API communication
- Configure base URL from environment variables:
  - Development: http://localhost:5000/api
  - Production: https://your-api-domain.com/api
- Implement request/response interceptors for:
  - Automatic JWT token attachment to Authorization header
  - Error handling with specific backend error formats
  - Loading state management with global loading indicator
  - Request/response logging in development mode
- Set up HTTP error handling with retry logic for network failures
- Configure CORS handling (backend allows http://localhost:4200)
- Implement request timeout configuration (30s default)
- Add request caching for GET requests where appropriate

BACKEND API RESPONSE FORMAT:
- Success: ApiResponse.success(res, data, message)
- Error: ApiResponse.error(res, message, statusCode, details)
- Created: ApiResponse.created(res, data, message)
- Format: { success: boolean, data: any, message: string, pagination?: object }

AUTHENTICATION TOKEN HANDLING:
- Access Token: JWT with 1h expiry (dev) / 15min (prod), stored in memory
- Refresh Token: 30 days (dev) / 7 days (prod), stored in httpOnly cookie
- Auto-refresh on 401 responses using /api/auth/refresh endpoint

EXPECTED OUTPUT:
- HttpClientService with full configuration
- AuthInterceptor for token management
- ErrorInterceptor for global error handling
- LoadingInterceptor for UI state management
- Environment configuration files
- TypeScript interfaces for ApiResponse<T>

PROJECT CONTEXT:
Backend uses express-validator for input validation
CORS configured for localhost:4200 in development
Security headers applied via Helmet middleware
Rate limiting disabled in development, enabled in production
```

#### **PROMPT 1.2: Authentication State Management Setup**

```Create NgRx store setup for authentication state management in the Personal Finance Dashboard.

REQUIREMENTS:
- Define AuthState interface with user, tokens, loading states
- Create authentication actions for all backend endpoints:
  - Login: POST /api/auth/login
  - Register: POST /api/auth/register  
  - Logout: POST /api/auth/logout
  - Refresh Token: POST /api/auth/refresh
  - Password Reset: POST /api/auth/forgot-password
  - Reset Password: POST /api/auth/reset-password
  - Email Verification: POST /api/auth/verify-email
  - Resend Verification: POST /api/auth/resend-verification
  - Profile Update: PUT /api/auth/profile
  - Password Change: PUT /api/auth/change-password
  - Session Management: GET/DELETE /api/auth/sessions
- Implement authentication effects for API calls:
  - Handle login/register with automatic token storage
  - Automatic token refresh on expiration (401 responses)
  - Logout with token cleanup and session revocation
  - Error handling for specific auth failures

BACKEND USER MODEL:
```typescript
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  isEmailVerified: boolean;
  profileImage?: string;
  settings: {
    currency: string;
    language: string;
    theme: string;
    notificationPreferences: {
      email: boolean;
      push: boolean;
      budgetAlerts: boolean;
      goalReminders: boolean;
    };
  };
  createdAt: string;
  updatedAt: string;
}
```

PASSWORD SECURITY REQUIREMENTS:

- Minimum 8 characters
- Must contain uppercase, lowercase, number, special character
- Password strength validation on frontend and backend
- Password history checking (last 5 passwords)
- Automatic account lockout after 5 failed attempts

EXPECTED OUTPUT:

- Complete NgRx authentication module
- AuthState interface and User model
- All authentication actions, effects, reducers, selectors
- AuthGuard and NonAuthGuard route guards
- Token management service with automatic refresh
- Error handling for all authentication scenarios

PROJECT CONTEXT:
Backend validates all inputs with express-validator
JWT tokens include user ID and email claims
Session tracking includes IP address and user agent
Email verification required for account activation
Password reset tokens expire in 1 hour

- Create authentication selectors for:
  - Current user information
  - Authentication status
  - Loading states
  - Error states
- Implement AuthGuard and NonAuthGuard route guards
- Create authentication reducer with proper state updates

EXPECTED OUTPUT:

- Complete NgRx authentication module
- AuthState interface and models
- All authentication actions, effects, reducers, selectors
- Route guards implementation
- Token management service

PROJECT CONTEXT:
Backend endpoints: /api/auth/* (login, register, refresh, logout, profile, sessions)
JWT access token (15min expiry) and refresh token (7 days)
User model: { id, email, firstName, lastName, isEmailVerified, preferences }

```#### **PROMPT 1.3: Core Services Integration
```Create core Angular services to handle API integration with the Personal Finance Dashboard backend.

REQUIREMENTS:
- Create ApiService base class for common API operations with error handling
- Implement services for each backend module with specific endpoints:

AUTHENTICATION SERVICE (/api/auth/*):
- login(email, password) -> POST /api/auth/login
- register(userData) -> POST /api/auth/register  
- logout() -> POST /api/auth/logout
- refreshToken() -> POST /api/auth/refresh
- forgotPassword(email) -> POST /api/auth/forgot-password
- resetPassword(token, password) -> POST /api/auth/reset-password
- verifyEmail(token) -> POST /api/auth/verify-email
- changePassword(currentPassword, newPassword) -> PUT /api/auth/change-password

TRANSACTION SERVICE (/api/transactions/*):
- getTransactions(filters) -> GET /api/transactions (pagination, filtering)
- getTransaction(id) -> GET /api/transactions/:id
- createTransaction(data) -> POST /api/transactions
- updateTransaction(id, data) -> PUT /api/transactions/:id
- deleteTransaction(id) -> DELETE /api/transactions/:id
- getTransactionAnalytics(filters) -> GET /api/transactions/analytics
- uploadReceipt(transactionId, file) -> POST /api/transactions/:id/receipt
- getRecurringTransactions() -> GET /api/transactions/recurring
- createRecurringTransaction(data) -> POST /api/transactions/recurring

BUDGET SERVICE (/api/budgets/*):
- getBudgets() -> GET /api/budgets
- getBudget(id) -> GET /api/budgets/:id
- createBudget(data) -> POST /api/budgets
- updateBudget(id, data) -> PUT /api/budgets/:id
- deleteBudget(id) -> DELETE /api/budgets/:id
- getBudgetAnalysis(id) -> GET /api/budgets/:id/analysis
- getBudgetAlerts() -> GET /api/budgets/alerts
- getBudgetHealthScore(id) -> GET /api/budgets/:id/health-score

GOAL SERVICE (/api/goals/*):
- getGoals() -> GET /api/goals
- getGoal(id) -> GET /api/goals/:id
- createGoal(data) -> POST /api/goals
- updateGoal(id, data) -> PUT /api/goals/:id
- deleteGoal(id) -> DELETE /api/goals/:id
- addContribution(goalId, amount) -> POST /api/goals/:id/contributions
- getGoalProgress(id) -> GET /api/goals/:id/progress
- getGoalPredictions(id) -> GET /api/goals/:id/predictions

REPORT SERVICE (/api/reports/*):
- getFinancialReports(params) -> GET /api/reports
- generateReport(type, params) -> POST /api/reports/generate
- exportReport(reportId, format) -> GET /api/reports/:id/export
- getSpendingAnalysis(params) -> GET /api/reports/spending-analysis
- getIncomeAnalysis(params) -> GET /api/reports/income-analysis
- getCashFlowAnalysis(params) -> GET /api/reports/cash-flow

BACKEND FILTERING AND PAGINATION:
- Pagination: ?page=1&limit=10 (max limit: 100)
- Date filtering: ?startDate=2024-01-01&endDate=2024-12-31
- Amount filtering: ?minAmount=0&maxAmount=1000
- Category filtering: ?category=categoryId
- Search: ?searchTerm=coffee
- Sorting: ?sortBy=date&sortOrder=desc

TYPESCRIPT INTERFACES:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Transaction {
  _id: string;
  userId: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  subcategory?: string;
  description: string;
  date: string;
  paymentMethod: string;
  tags: string[];
  isRecurring: boolean;
  recurringDetails?: RecurringDetails;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

interface Budget {
  _id: string;
  userId: string;
  name: string;
  categories: BudgetCategory[];
  period: 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  totalBudget: number;
  spent: number;
  remaining: number;
  status: 'active' | 'completed' | 'exceeded';
  alerts: BudgetAlert[];
  createdAt: string;
  updatedAt: string;
}

interface Goal {
  _id: string;
  userId: string;
  name: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'paused';
  contributions: Contribution[];
  createdAt: string;
  updatedAt: string;
}
```

EXPECTED OUTPUT:

- Complete service layer with all backend API integrations
- TypeScript interfaces matching backend models
- Error handling for all API responses
- Loading state management for all operations
- Caching implementation for GET requests
- Utility functions for data transformation

PROJECT CONTEXT:
Backend includes comprehensive validation with express-validator
File uploads supported for transaction receipts (10MB max, 5 files)
All endpoints require authentication except auth routes
Rate limiting applied in production environment

---

### **PHASE 2: AUTHENTICATION & USER MANAGEMENT**

#### **PROMPT 2.1: Login and Registration Components**

```Create comprehensive login and registration components for the Personal Finance Dashboard by integrating with the actual backend authentication service.

REQUIREMENTS:
- Design responsive login component with Material Design:
  - Email/password fields with real-time validation
  - Login with loading states and comprehensive error handling
  - Password visibility toggle with eye icon
  - Links to registration and password reset
  - Client info tracking (IP address, user agent)
- Create multi-step registration component:
  - Step 1: Personal info (firstName, lastName, email, username)
  - Step 2: Password setup with real-time strength indicator
  - Step 3: Email verification prompt with resend functionality
  - Progress indicator and navigation between steps
  - Form validation with backend-specific error handling
- Implement password reset flow:
  - Forgot password form with email input and validation
  - Reset password form with token validation
  - Success/error states with appropriate messaging
- Add comprehensive error handling for specific backend errors:
  - Rate limiting (429): "Too many failed login attempts"
  - Account inactive (401): "Account is inactive"
  - Account locked (401): "Account is temporarily locked"
  - Email not verified (401): "Email verification required"
  - Conflict (409): "User with this email already exists"

BACKEND INTEGRATION:
```typescript
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    isVerified: boolean;
    isEmailVerified: boolean;
    lastLoginAt: string;
  };
  accessToken: string;
  expiresIn: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username?: string;
}

interface RegisterResponse {
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    isVerified: boolean;
    isEmailVerified: boolean;
    createdAt: string;
  };
  accessToken: string;
  expiresIn: string;
  emailVerificationSent: boolean;
}
```

API ENDPOINTS:

- POST /api/auth/login - Login with email/password
- POST /api/auth/register - Create new user account
- POST /api/auth/logout - Logout and revoke tokens
- POST /api/auth/refresh - Refresh access token (automatic)
- POST /api/auth/forgot-password - Request password reset
- POST /api/auth/reset-password - Reset password with token

SECURITY FEATURES:

- Refresh tokens stored in httpOnly cookies (secure, sameSite: strict)
- Access tokens with 15min expiry in production, 1h in development
- Account lockout after 5 failed login attempts
- IP-based rate limiting and security monitoring
- Password strength validation (8+ chars, mixed case, numbers, special characters)
- Client fingerprinting (IP address, user agent) for session tracking

VALIDATION REQUIREMENTS:

- Email: Valid format, backend checks for existing users
- Password: Minimum 8 characters with complexity requirements
- Names: 2-50 characters, sanitized for XSS protection
- Username: 3-20 characters, alphanumeric + underscore only

ERROR HANDLING CODES:

- 401 MISSING_TOKEN: No authorization header
- 401 TOKEN_EXPIRED: Access token has expired
- 401 USER_NOT_FOUND: User doesn't exist
- 401 ACCOUNT_INACTIVE: User account deactivated
- 401 ACCOUNT_LOCKED: Too many failed attempts
- 409 ConflictError: Email/username already exists
- 429 RateLimitError: Too many login attempts

EXPECTED OUTPUT:

- Login component with comprehensive error handling
- Multi-step registration wizard with validation
- Password reset flow with token verification
- Form validation matching backend requirements
- Mobile-responsive Material Design interface
- Accessibility compliance (ARIA, keyboard navigation)
- Integration with Angular reactive forms

PROJECT CONTEXT:
Backend uses bcryptjs for password hashing with salt rounds
JWT tokens include userId, email, role, and token type
Security monitoring logs all authentication events
Email verification required before full account access
Session tracking includes device and location information

#### **PROMPT 2.2: User Profile and Settings Management**

```Create user profile and settings management components for the Personal Finance Dashboard by integrating with the actual backend user service.

REQUIREMENTS:
- Design user profile component with Material Design:
  - Profile information display and editing (firstName, lastName, email)
  - Profile image upload with preview and crop functionality (5MB max, jpg/png)
  - Account statistics (member since, last login, profile completion)
  - Account verification status and email verification actions
  - Account security overview with recent activity
- Create comprehensive settings management with tabs:
  - Security settings (password change, session management, 2FA)
  - Preferences (currency, date format, language, theme)
  - Privacy settings (data export, marketing preferences, analytics)
  - Notification preferences (email, push, budgetAlerts, goalReminders)
- Implement session management interface:
  - Active sessions display with creation date and expiry
  - Device fingerprinting information (limited due to privacy)
  - Ability to revoke individual sessions by sessionId
  - "Logout from all devices" functionality
  - Current session highlighting and protection
- Add password change with security validation:
  - Current password verification required
  - New password strength indicator and validation
  - Password history checking (prevents reuse of last 5 passwords)
  - Real-time password strength feedback
- Implement GDPR compliance features:
  - Complete data export functionality
  - Account deletion with password confirmation
  - Privacy policy acceptance tracking
  - Data processing consent management

BACKEND INTEGRATION:
```typescript
interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
  isVerified: boolean;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLoginAt: string;
  createdAt: string;
  updatedAt: string;
  profileCompleteness: {
    percentage: number;
    missingFields: string[];
    suggestions: string[];
  };
  settings: UserSettings;
}

interface UserSettings {
  currency: string;
  dateFormat: string;
  language: string;
  theme: 'light' | 'dark' | 'auto';
  notificationPreferences: {
    email: boolean;
    push: boolean;
    budgetAlerts: boolean;
    goalReminders: boolean;
    weeklyReports: boolean;
    monthlyReports: boolean;
  };
  privacy: {
    marketingEmails: boolean;
    analyticsTracking: boolean;
    dataExportRequested: boolean;
  };
}

interface UserSession {
  id: number; // Array index used as session ID
  createdAt: string;
  expiresAt: string;
  isCurrentSession: boolean;
}

interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}
```

API ENDPOINTS:

- GET /api/auth/profile - Get user profile with completeness data
- PUT /api/auth/profile - Update profile information
- POST /api/users/upload-profile-image - Upload profile image (multipart/form-data)
- PUT /api/auth/change-password - Change password with validation
- GET /api/auth/sessions - Get active sessions
- DELETE /api/auth/sessions/:sessionId - Revoke specific session
- POST /api/auth/logout-all - Logout from all devices
- GET /api/export-import/export - Export complete user data (GDPR)
- DELETE /api/auth/delete-account - Delete account with confirmation

SECURITY FEATURES:

- Profile image validation (max 5MB, jpg/png only, virus scanning)
- Password change requires current password verification
- Session management with refresh token rotation
- Account deletion requires password confirmation
- All profile changes logged for security monitoring
- Email verification required for email changes
- Two-factor authentication setup available

VALIDATION REQUIREMENTS:

- Profile images: max 5MB, jpg/png formats only
- Names: 2-50 characters, XSS sanitization applied
- Email: valid format, uniqueness check across system
- Password: 8+ characters with complexity requirements
- Settings: validated against predefined options

FILE UPLOAD HANDLING:

- Profile images stored in /uploads/profiles/
- Unique filename generation with UUID
- Automatic thumbnail generation
- Old profile images cleaned up on update
- Content-Type validation and virus scanning

EXPECTED OUTPUT:

- User profile component with image upload
- Tabbed settings interface with all preferences
- Session management with security features
- Password change with strength validation
- GDPR compliance components (export/delete)
- Mobile-responsive Material Design interface
- Real-time validation and error handling

PROJECT CONTEXT:
Backend tracks profile completeness percentage and suggestions
Security monitoring logs all profile and password changes
Session tokens stored with creation/expiry dates
Profile images undergo virus scanning before storage
Email changes trigger verification process
Account deletion has 30-day recovery period

- Password change requires current password verification
- Email changes require verification of new email
- Account deletion requires password confirmation
- Session revocation immediate with token invalidation
- Data export includes rate limiting (1 per day)

EXPECTED OUTPUT:

- Complete profile management component
- Tabbed settings interface with all preferences
- Session management with security features
- Password change with validation
- GDPR compliance components
- Responsive design for all screen sizes
- Error handling for all backend operations

PROJECT CONTEXT:
Backend tracks all user sessions with device fingerprinting
Profile images stored in uploads directory with proper validation
Password history prevents reuse of last 5 passwords
Account deletion has 30-day recovery period
File upload: /api/users/upload-profile-image (max 5MB, jpg/png)
Sessions: device info, IP address, creation date, current session indicator

#### **PROMPT 2.3: Password Security and Email Verification**

Implement password security features and email verification flow for the Personal Finance Dashboard.

REQUIREMENTS:

- Create password strength meter component:
  - Real-time strength calculation as user types
  - Visual strength indicator (weak/fair/good/strong)
  - Specific feedback on password requirements
  - Suggestions for improvement
- Implement secure password generation:
  - Configurable length and character sets
  - Copy to clipboard functionality
  - Strength testing of generated passwords
- Create email verification flow:
  - Email verification status display
  - Resend verification email functionality
  - Verification success/failure pages
  - Integration with registration flow
- Add password history prevention
- Implement forgot password flow:
  - Email input with validation
  - Reset token validation
  - New password setup with confirmation
  - Success confirmation page

EXPECTED OUTPUT:

- Password strength meter component
- Password generator with customization
- Complete email verification system
- Forgot password flow implementation
- Password history and security features

PROJECT CONTEXT:
Password API: /api/auth/password/check-strength, /api/auth/password/generate
Email verification: /api/email-verification/send, /api/email-verification/verify
Password reset: /api/auth/forgot-password, /api/auth/reset-password
Security requirements: 8+ chars, mixed case, numbers, special characters

---

### **PHASE 3: TRANSACTION MANAGEMENT**

#### **PROMPT 3.1: Transaction List and Filtering**

Create a comprehensive transaction management interface for the Personal Finance Dashboard.

REQUIREMENTS:

- Design transaction list component with:
  - Paginated table with sorting (date, amount, category, type)
  - Advanced filtering sidebar (date range, amount range, categories, payment methods)
  - Search functionality with autocomplete
  - Bulk selection and operations (delete, categorize, export)
  - Import transactions from CSV/Excel files
- Implement transaction filtering:
  - Date range picker with presets (this month, last 3 months, etc.)
  - Amount range sliders
  - Category multi-select with hierarchy
  - Transaction type filters (income/expense)
  - Payment method filters
- Add real-time search with debouncing
- Create export functionality (CSV, Excel, PDF)
- Implement infinite scroll or pagination
- Add transaction statistics summary

EXPECTED OUTPUT:

- Transaction list with advanced filtering
- Search and autocomplete functionality
- Bulk operations interface
- Import/export capabilities
- Responsive table design

PROJECT CONTEXT:
Transaction API: /api/transactions (GET with query params)
Filtering: startDate, endDate, minAmount, maxAmount, category, type, paymentMethod, searchTerm
Pagination: page, limit (default 10, max 100)
Sorting: sortBy, sortOrder (asc/desc)
Transaction model: id, amount, description, date, category, type, paymentMethod, attachments

#### **PROMPT 3.2: Transaction Creation and Editing**

Create transaction creation and editing forms for the Personal Finance Dashboard.

REQUIREMENTS:

- Design transaction form component with:
  - Amount input with currency formatting
  - Description field with autocomplete from previous transactions
  - Category selection with search and creation capability
  - Date picker with keyboard input support
  - Transaction type toggle (income/expense)
  - Payment method selection
  - Recurring transaction setup
  - Receipt/attachment upload functionality
  - Tags input with autocomplete and chip display
  - Notes section with character counter
- Implement form validation:
  - Required field validation
  - Amount validation (positive numbers, decimal precision)
  - Date validation (not future dates for completed transactions)
  - File upload validation (size, type restrictions)
  - Accessibility compliance (ARIA labels, keyboard navigation)
  - Error messaging with clear user feedback
- Add smart features:
  - Duplicate transaction detection
  - Category suggestions based on description
  - Merchant name recognition and autocomplete
  - Split transaction functionality for multi-category expenses
  - Automatic tax deduction flagging
  - Recurring transaction template suggestions
- Create quick-add transaction modal for fast entry
- Implement recurring transaction management:
  - Frequency selection (daily, weekly, monthly, yearly)
  - End date or occurrence count options
  - Preview of upcoming transaction instances
  - Edit individual or all future instances options

BACKEND INTEGRATION:

```typescript
interface CreateTransactionRequest {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string; // Category ID
  date: string; // ISO format
  description: string;
  payee: string;
  paymentMethod?: string;
  notes?: string;
  tags?: string[];
  isRecurring: boolean;
  recurringDetails?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number; // e.g., every 2 weeks
    endDate?: string; // ISO format
    occurrences?: number; // alternative to endDate
  };
  splitTransactions?: {
    amount: number;
    category: string;
    description?: string;
  }[];
}

interface UpdateTransactionRequest extends Partial<CreateTransactionRequest> {
  id: string;
  updateFutureRecurring?: boolean; // For recurring transactions
}

interface TransactionResponse {
  id: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  categoryDetails: {
    name: string;
    color: string;
    icon: string;
  };
  date: string;
  description: string;
  payee: string;
  paymentMethod?: string;
  notes?: string;
  tags: string[];
  isRecurring: boolean;
  recurringDetails?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: string;
    occurrences?: number;
    parentId?: string; // For recurring instances
  };
  attachments: {
    id: string;
    filename: string;
    url: string;
    contentType: string;
    size: number;
    uploadDate: string;
  }[];
  splitTransactions?: {
    id: string;
    amount: number;
    category: string;
    categoryDetails: {
      name: string;
      color: string;
      icon: string;
    };
    description?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}
```

API ENDPOINTS:

- POST /api/transactions - Create new transaction
- PUT /api/transactions/:id - Update existing transaction
- POST /api/transactions/:id/attachments - Upload attachments (multipart/form-data)
- DELETE /api/transactions/:id/attachments/:attachmentId - Delete attachment
- GET /api/transactions/suggestions - Get autocomplete suggestions for descriptions/payees
- GET /api/transactions/categories - Get available categories
- POST /api/categories - Create new category (for inline creation)
- GET /api/transactions/duplicate-check - Check for potential duplicate transactions

VALIDATION REQUIREMENTS:

- Amount: Required, positive number, max 2 decimal places, max value 999,999,999.99
- Type: Required, must be one of: 'income', 'expense', 'transfer'
- Category: Required, must be valid category ID
- Date: Required, valid ISO date string, not in future for completed transactions
- Description: Required, min 3 chars, max 100 chars, sanitized for XSS
- Payee: Required for expenses, optional for income, max 50 chars
- Payment Method: Optional, must be valid payment method ID
- Tags: Optional, max 10 tags, each max 20 chars
- Files: Optional, max 5 files, max 10MB each, allowed types: jpg, png, pdf

FILE UPLOAD HANDLING:

- Transaction receipts stored in /uploads/receipts/
- Supported formats: image/jpeg, image/png, application/pdf
- Size limit: 10MB per file, 5 files per transaction
- Automatic thumbnail generation for images
- Virus scanning for all uploads
- Deletion of associated files when transaction is deleted

EXPECTED OUTPUT:

- Comprehensive transaction form component with all fields
- Modal dialog for quick transaction entry
- Split transaction interface with dynamic form fields
- File upload component with drag-and-drop support
- Category creation modal for inline category creation
- Recurring transaction configuration interface
- Smart suggestion system for categories and merchants
- Form validation with accessibility support
- Responsive design for mobile and desktop

PROJECT CONTEXT:
Transaction API supports create, update, and attachment operations
Categories are hierarchical with type (income/expense) and color/icon
Validation matches backend requirements with client-side pre-validation
Split transactions allow dividing an expense across multiple categories
Recurring transactions generate instances based on frequency settings
File attachments undergo security scanning before storage

#### **PROMPT 3.3: Transaction Analytics and Insights**

Create transaction analytics and insights dashboard for the Personal Finance Dashboard.

REQUIREMENTS:

- Design analytics overview with:
  - Spending trends charts (line, bar, pie charts)
  - Category breakdown with drill-down capability
  - Monthly/quarterly/yearly comparisons
  - Income vs expense analysis
  - Cash flow visualization
- Implement interactive charts using Chart.js or similar:
  - Responsive charts that work on mobile
  - Hover tooltips with detailed information
  - Click interactions for drill-down analysis
  - Export chart functionality (PNG, PDF)
- Create insights widgets:
  - Spending pattern analysis
  - Unusual transaction detection
  - Budget variance notifications
  - Savings opportunities identification
- Add custom date range selection
- Implement real-time updates when transactions change
- Create printable reports functionality

EXPECTED OUTPUT:

- Interactive analytics dashboard
- Multiple chart types for different insights
- Custom date range analysis
- Automated insights and recommendations
- Export and print capabilities

PROJECT CONTEXT:
Analytics API: /api/transactions/analytics, /api/reports/*
Chart data: time-series data, category aggregations, trend analysis
Date ranges: custom picker, preset ranges (last 30 days, this year, etc.)
Export formats: PNG, PDF, CSV for underlying data
Real-time updates: WebSocket or polling for live data

### **PHASE 4: BUDGET MANAGEMENT**

#### **PROMPT 4.1: Budget Creation and Configuration**

Create comprehensive budget creation and management interface for the Personal Finance Dashboard.

REQUIREMENTS:

- Design budget creation wizard with:
  - Budget template selection (zero-based, 50/30/20 rule, custom)
  - Budget period configuration (monthly, quarterly, yearly)
  - Category allocation with spending limits
  - Income estimation and source tracking
  - Emergency fund and savings allocation
- Implement budget category management:
  - Visual category allocation with drag-and-drop
  - Percentage and fixed amount budget allocation
  - Category hierarchy with sub-budget allocation
  - Quick budget templates and presets
  - Budget copying from previous periods
- Add budget validation:
  - Total allocation vs income validation
  - Minimum savings requirement warnings
  - Category limit recommendations based on history
- Create budget calendar view:
  - Monthly budget overview
  - Bill due dates integration
  - Recurring expense scheduling
- Implement budget sharing and collaboration features

EXPECTED OUTPUT:

- Budget creation wizard with templates
- Category allocation interface
- Budget validation and recommendations
- Calendar view for budget planning
- Template and preset management

PROJECT CONTEXT:
Budget API: /api/budgets (CRUD operations)
Budget model: name, period, categories[{categoryId, budgetAmount}], totalBudget, alertSettings
Templates: common budget allocation patterns (housing 30%, food 15%, etc.)
Calendar integration: recurring transactions, bill reminders
Validation: income vs allocation, savings recommendations

#### **PROMPT 4.2: Budget Tracking and Monitoring**

Create budget tracking and monitoring dashboard for the Personal Finance Dashboard.

REQUIREMENTS:

- Design budget overview dashboard with:
  - Budget vs actual spending comparison
  - Real-time progress bars for each category
  - Spending velocity indicators
  - Projected month-end spending
  - Budget health score visualization
- Implement alert system:
  - Configurable spending threshold alerts
  - Visual warnings when approaching limits
  - Email/push notification settings
  - Smart recommendations for overspending
- Create budget performance analytics:
  - Historical budget performance
  - Variance analysis with explanations
  - Seasonal spending pattern recognition
  - Budget optimization suggestions
- Add mobile-friendly widgets:
  - Quick spending entry
  - Daily/weekly spending summaries
  - Remaining budget notifications
- Implement budget adjustment features:
  - Mid-period budget modifications
  - Category reallocation tools
  - Emergency budget overrides

EXPECTED OUTPUT:

- Real-time budget tracking dashboard
- Alert and notification system
- Budget performance analytics
- Mobile-optimized widgets
- Budget adjustment capabilities

PROJECT CONTEXT:
Budget tracking API: /api/budgets/:id/analysis, /api/budgets/:id/alerts
Real-time data: WebSocket updates for spending changes
Alert settings: thresholds (80%, 90%, 100%), notification methods
Analytics: variance calculation, trend analysis, recommendations
Mobile widgets: Progressive Web App features for quick access

#### **PROMPT 4.3: Budget Optimization and Recommendations**

Create AI-driven budget optimization and recommendation system for the Personal Finance Dashboard.

REQUIREMENTS:

- Design optimization analysis with:
  - Spending pattern analysis and anomaly detection
  - Category reallocation recommendations
  - Savings opportunity identification
  - Goal-based budget suggestions
- Implement recommendation engine:
  - Machine learning insights based on spending history
  - Peer comparison analysis (anonymized benchmarking)
  - Seasonal adjustment recommendations
  - Life event budget planning (vacation, emergency, etc.)
- Create scenario planning tools:
  - "What-if" budget analysis
  - Income change impact assessment
  - Expense reduction simulation
  - Savings goal achievement planning
- Add budget health scoring:
  - Overall budget health assessment
  - Category-specific health scores
  - Improvement action items
  - Progress tracking over time
- Implement educational content:
  - Budget tips and best practices
  - Financial literacy resources
  - Personalized advice based on user data

EXPECTED OUTPUT:

- AI-powered optimization recommendations
- Scenario planning and simulation tools
- Budget health scoring system
- Educational content integration
- Personalized financial insights

PROJECT CONTEXT:
Optimization API: /api/budgets/recommendations/optimization
AI insights: spending patterns, anomaly detection, goal alignment
Scenarios: income changes, expense adjustments, savings targets
Health scoring: debt-to-income ratio, savings rate, emergency fund
Educational content: contextual tips, articles, calculators

### **PHASE 5: FINANCIAL GOALS & REPORTING**

#### **PROMPT 5.1: Goal Setting and Tracking**

Create comprehensive financial goal management system for the Personal Finance Dashboard by integrating with the backend goal service.

REQUIREMENTS:

- Design goal creation interface with:
  - Goal form component using backend POST /api/goals
  - Goal type selection (savings, debt, investment, purchase, emergency_fund, vacation, house_down_payment)
  - Target amount validation (minimum $1, maximum $1,000,000)
  - Date range picker for startDate and targetDate
  - Priority selection (low, medium, high, critical)
  - Description field with 500 character limit
  - Auto-save draft functionality
- Implement real-time feasibility analysis:
  - Calculate required monthly contribution based on timeline
  - Display achievement probability from backend response
  - Show days remaining and months to target
  - Visual indicators for realistic vs ambitious goals
- Create goal tracking dashboard:
  - Progress bars with percentage completion
  - Current amount vs target amount display
  - Milestone markers at 25%, 50%, 75%, 100%
  - Visual timeline with key dates
  - Contribution history chart
- Add contribution management:
  - Quick-add contribution modal
  - Manual contribution form with date picker
  - Contribution type (manual, automatic, one-time, recurring)
  - Upload receipt functionality for contributions
  - Bulk contribution import

BACKEND INTEGRATION:

```typescript
interface Goal {
  _id: string;
  name: string;
  description: string;
  type: 'savings' | 'debt' | 'investment' | 'purchase' | 'emergency_fund' | 'vacation' | 'house_down_payment';
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  targetDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'completed' | 'paused' | 'archived';
  progressPercentage: number;
  achievementProbability: number;
  contributions: Contribution[];
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

interface Contribution {
  _id: string;
  amount: number;
  date: string;
  type: 'manual' | 'automatic' | 'one_time' | 'recurring';
  description?: string;
  attachments?: string[];
}

interface FeasibilityAnalysis {
  totalDays: number;
  monthsToTarget: number;
  requiredMonthlyContribution: number;
  achievementProbability: number;
}
```

API ENDPOINTS:

- GET /api/goals - List goals with filtering (status, type, priority)
- POST /api/goals - Create goal with feasibility analysis
- GET /api/goals/:id - Get goal details with progress metrics
- PUT /api/goals/:id - Update goal with impact analysis
- DELETE /api/goals/:id - Soft delete goal
- POST /api/goals/:id/contributions - Add contribution
- GET /api/goals/:id/contributions - List contributions with pagination
- PUT /api/goals/:id/contributions/:contributionId - Update contribution

EXPECTED OUTPUT:

- Goal creation wizard with real-time validation
- Goal dashboard with progress tracking
- Contribution management interface
- Feasibility analysis and recommendations
- Mobile-responsive goal widgets

PROJECT CONTEXT:
Backend provides feasibility analysis on goal creation/update
Achievement probability calculated using spending patterns
Contributions support file attachments (receipts)
Goals can be paused/resumed with status updates
Progress metrics calculated server-side for accuracy

- Home purchase planning
- Implement goal-based budgeting:
- Automatic budget allocation for goals
- Priority-based contribution distribution
- Goal impact on budget recommendations

EXPECTED OUTPUT:

- Goal creation and management interface
- Progress tracking and visualization
- Goal analytics and projections
- Template library for common goals
- Budget integration for goal funding

PROJECT CONTEXT:
Goal API: /api/goals (CRUD), /api/goals/:id/contributions
Goal model: name, targetAmount, currentAmount, targetDate, priority, status
Contribution tracking: amount, date, method (manual/automatic)
Analytics: progress rate, achievement probability, timeline adjustments
Templates: common goal calculations and recommendations

## **PROMPT 5.2: Financial Reports and Insights**

Create comprehensive financial reporting and insights system for the Personal Finance Dashboard by integrating with the backend report service.

REQUIREMENTS:

- Design report dashboard with:
  - Net worth calculation and trending using GET /api/reports/dashboard
  - Cash flow analysis with GET /api/reports/cashflow (monthly, quarterly, yearly)
  - Income vs expense breakdown via GET /api/reports/spending and GET /api/reports/income
  - Investment performance tracking if applicable
  - Debt-to-income ratio monitoring from user profile data
- Implement interactive reports:
  - Date range selection with startDate/endDate query parameters
  - Time grouping options (day, week, month, quarter, year) via timeGroupBy parameter
  - Category filtering with categoryId parameter
  - Drill-down capability for detailed transaction analysis
  - Export functionality to PDF and CSV formats
- Create financial insights dashboard:
  - Spending pattern analysis with trend detection
  - Saving rate calculations and recommendations
  - Budget variance analysis and alerts
  - Goal progress assessment with timeline projections
  - Financial health scoring and improvement suggestions
- Add comparative analysis:
  - Month-over-month and year-over-year comparisons
  - Category spending trends with percentage changes
  - Budget vs actual performance metrics
  - Goal achievement rate tracking
- Implement report customization:
  - Custom date range selection
  - Category and subcategory filtering
  - Report template saving and reuse
  - Scheduled report generation

BACKEND INTEGRATION:

```typescript
interface SpendingReport {
  summary: {
    totalSpent: number;
    totalTransactions: number;
    averageTransaction: number;
    largestTransaction: number;
    categoryCount: number;
  };
  trends: {
    period: string;
    amount: number;
    change: number;
    changePercentage: number;
  }[];
  categories: {
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
    transactionCount: number;
    subcategories?: CategoryBreakdown[];
  }[];
  insights: {
    topCategories: string[];
    spendingPatterns: string[];
    recommendations: string[];
    alerts: string[];
  };
}

interface IncomeReport {
  summary: {
    totalIncome: number;
    averageMonthlyIncome: number;
    incomeStreams: number;
    growthRate: number;
  };
  trends: TimeSeries[];
  sources: IncomeSource[];
  forecasts: {
    nextMonth: number;
    nextQuarter: number;
    confidence: number;
  };
}

interface CashflowReport {
  summary: {
    netCashflow: number;
    totalIncome: number;
    totalExpenses: number;
    savingsRate: number;
  };
  monthly: MonthlyFlow[];
  trends: {
    incomeGrowth: number;
    expenseGrowth: number;
    savingsGrowth: number;
  };
  projections: {
    nextMonthFlow: number;
    quarterlyForecast: number;
  };
}

interface DashboardReport {
  overview: {
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    netWorth: number;
    savingsRate: number;
  };
  recentTransactions: Transaction[];
  budgetStatus: BudgetStatus[];
  goalProgress: GoalProgress[];
  insights: Insight[];
  alerts: Alert[];
}
```

API ENDPOINTS:

- GET /api/reports/spending - Spending analysis with filtering and grouping
- GET /api/reports/income - Income analysis and forecasting  
- GET /api/reports/cashflow - Cash flow analysis and projections
- GET /api/reports/dashboard - Overview dashboard with key metrics
- GET /api/reports/insights - AI-generated insights and recommendations
- GET /api/reports/export - Export reports in various formats

QUERY PARAMETERS:

- startDate, endDate: Date range filtering
- timeGroupBy: day, week, month, quarter, year
- categoryId: Filter by specific category
- limit: Number of results to return
- format: Export format (json, csv, pdf)

EXPECTED OUTPUT:

- Interactive dashboard with real-time metrics
- Comprehensive spending and income analysis
- Cash flow visualization with projections
- Export functionality for all reports
- AI-powered insights and recommendations

PROJECT CONTEXT:
Backend provides pre-calculated analytics for performance
All reports support date range filtering and category breakdown
Insights include spending patterns, anomaly detection, and recommendations
Export functionality generates PDF reports and CSV data
Real-time dashboard updates when transactions are added/modified

## **PROMPT 5.3: Data Import/Export and Integration**

```Create data import/export and third-party integration features for the Personal Finance Dashboard by integrating with the backend import/export service.

REQUIREMENTS:
- Design import system with:
  - CSV/Excel file upload using POST /api/transactions/import
  - File validation with preview before import
  - Duplicate transaction detection and handling
  - Category mapping for imported transactions
  - Import progress tracking with real-time updates
- Implement export functionality:
  - Complete data export via GET /api/export-import/export for GDPR compliance
  - Selective export by date range and categories
  - Multiple format support (JSON, CSV, Excel, PDF)
  - Bulk transaction export with GET /api/transactions/export
  - Goal and budget data export capabilities
- Add file management features:
  - Receipt and attachment upload with POST /api/transactions/:id/attachments
  - File validation (max 10MB, supported formats: jpg, png, pdf)
  - Attachment preview and download functionality
  - Bulk file operations and organization
  - File compression for large exports
- Create data validation system:
  - Import file format validation
  - Transaction data integrity checks
  - Category mapping validation
  - Error reporting and correction guidance
  - Import rollback functionality for failed imports
- Implement backup features:
  - Manual data backup creation
  - Scheduled export configuration
  - Data encryption for sensitive exports
  - Export history and download tracking
  - Import audit trail for security

BACKEND INTEGRATION:
```typescript
interface ImportRequest {
  file: File;
  format: 'csv' | 'excel' | 'ofx';
  categoryMappings?: CategoryMapping[];
  duplicateHandling: 'skip' | 'merge' | 'create';
  dateFormat?: string;
}

interface ImportResponse {
  importId: string;
  status: 'processing' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  importedTransactions: number;
  skippedTransactions: number;
  errors: ImportError[];
  warnings: ImportWarning[];
}

interface ExportRequest {
  type: 'transactions' | 'budgets' | 'goals' | 'complete';
  format: 'json' | 'csv' | 'excel' | 'pdf';
  startDate?: string;
  endDate?: string;
  categories?: string[];
  includeAttachments?: boolean;
}

interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
}
```

API ENDPOINTS:

- POST /api/transactions/import - Import transactions from file
- GET /api/transactions/import/:importId - Check import status
- GET /api/transactions/export - Export transactions to file
- POST /api/transactions/:id/attachments - Upload receipt/attachment
- GET /api/transactions/:id/attachments - List transaction attachments
- DELETE /api/transactions/:id/attachments/:attachmentId - Delete attachment
- POST /api/export-import/export - Full data export
- GET /api/export-import/export/:exportId - Download export file

FILE CONSTRAINTS:

- Maximum file size: 10MB for attachments, 50MB for imports
- Supported formats: CSV, Excel (.xlsx), PDF, JPG, PNG
- Import validation: required fields (date, amount, description)
- Attachment types: receipts, invoices, statements, documents

EXPECTED OUTPUT:

- File upload component with drag-and-drop
- Import wizard with validation and preview
- Export interface with format selection
- Progress tracking for large operations
- Error handling and user feedback

PROJECT CONTEXT:
Backend handles file validation and virus scanning
Import operations are asynchronous with status tracking
Attachments stored securely with access control
Export includes data encryption for sensitive information
GDPR compliance with complete user data export capability

### **PHASE 6: ADVANCED FEATURES & OPTIMIZATION**

#### **PROMPT 6.1: Real-time Features and Notifications**

Implement real-time features and notification system for the Personal Finance Dashboard by integrating with the backend Socket.IO WebSocket service.

REQUIREMENTS:

- Set up Socket.IO WebSocket connection with JWT authentication:
  - Real-time transaction notifications (created, updated, deleted, bulk import)
  - Budget alert broadcasts (threshold exceeded, warnings, period transitions)
  - Goal milestone celebrations (progress updates, completions, deadline alerts)
  - Balance updates and reconciliation notifications
  - Multi-device synchronization with user-specific rooms
- Implement comprehensive notification system:
  - In-app notifications with action buttons and dismissal
  - Email notification preferences with budget alert settings
  - Toast notifications for immediate feedback
  - Notification history and management interface
  - Real-time delivery status tracking
- Create user-specific room management:
  - Automatic user room joining on authentication
  - Private notifications for sensitive financial data
  - Admin room for system-wide announcements
  - Resource-specific rooms (budget:id, goal:id, transaction:id)
- Add live dashboard features:
  - Real-time balance updates on transaction changes
  - Live spending tracking with budget utilization
  - Dynamic chart updates without page refresh
  - Instant search results with debounced queries
- Implement notification preferences with granular controls:
  - Budget alert thresholds (80%, 90%, 100% utilization)
  - Goal reminder settings (weekly, monthly, deadline approaching)
  - Transaction notification filtering by amount or category
  - System notification preferences

BACKEND INTEGRATION:

```typescript
interface SocketEvents {
  // Connection events
  connect: () => void;
  disconnect: () => void;
  authenticate: (token: string) => void;
  authentication_success: (data: { userId: string }) => void;
  authentication_error: (error: string) => void;
  
  // Transaction events
  'transaction:created': (transaction: Transaction) => void;
  'transaction:updated': (transaction: Transaction) => void;
  'transaction:deleted': (transactionId: string) => void;
  'transaction:bulk_import': (importData: ImportResult) => void;
  
  // Budget events
  'budget:alert': (alert: BudgetAlert) => void;
  'budget:threshold_exceeded': (budget: Budget, data: ThresholdData) => void;
  'budget:updated': (budget: Budget) => void;
  'budget:period_transition': (budget: Budget, newPeriod: string) => void;
  
  // Goal events
  'goal:progress_updated': (goal: Goal, progress: ProgressData) => void;
  'goal:milestone_reached': (goal: Goal, milestone: Milestone) => void;
  'goal:completed': (goal: Goal) => void;
  'goal:deadline_approaching': (goal: Goal, daysRemaining: number) => void;
  
  // Balance events
  'balance:updated': (balanceData: BalanceUpdate) => void;
  'balance:reconciled': (reconciliation: ReconciliationData) => void;
  
  // System events
  'system:notification': (notification: SystemNotification) => void;
}

interface BudgetAlert {
  type: 'budget-exceeded' | 'budget-warning' | 'category-overspend';
  user: User;
  budget: Budget;
  category?: Category;
  data: {
    utilizationPercentage: number;
    overAmount?: number;
    remainingAmount?: number;
    daysRemaining: number;
    categoryBreakdown: CategoryBreakdown[];
  };
}

interface NotificationPreferences {
  budgetAlerts: {
    enabled: boolean;
    thresholds: number[]; // [80, 90, 100]
    frequency: 'immediate' | 'daily' | 'weekly';
    channels: ('email' | 'push' | 'in-app')[];
  };
  goalReminders: {
    enabled: boolean;
    frequency: 'weekly' | 'monthly' | 'deadline-only';
    daysBefore: number;
  };
  transactionNotifications: {
    enabled: boolean;
    minimumAmount: number;
    categories: string[];
  };
}
```

WEBSOCKET CONNECTION SETUP:

- Socket.IO client with automatic reconnection
- JWT token authentication on connection
- CORS configured for <http://localhost:4200> and production domains
- Rate limiting: 100 events/min default, 20 messages/10sec, 5 joins/10sec
- Redis adapter for horizontal scaling and session persistence
- Ping timeout: 60 seconds with automatic reconnection

REAL-TIME EVENT HANDLING:

- Automatic room management (user:userId, budget:budgetId, goal:goalId)
- Event-driven architecture with service integration
- Notification deduplication to prevent spam
- Recent alert tracking (24h for exceeded, 12h for warnings)
- Graceful degradation if WebSocket connection fails

SECURITY FEATURES:

- JWT authentication required for all socket connections
- User-specific room isolation for data privacy
- Rate limiting per connection to prevent abuse
- CORS protection and origin validation
- Secure cookie handling for authentication state

EXPECTED OUTPUT:

- Angular Socket.IO service with authentication
- Real-time notification components
- WebSocket connection management
- Event-driven UI updates
- Notification preference management
- Toast notification system
- Connection status indicators

PROJECT CONTEXT:
Backend uses Socket.IO 4.x with Redis adapter for scaling
Budget alerts integrate with email queue service
Real-time events triggered by service layer changes
Notifications respect user preferences and quiet hours
WebSocket rooms provide secure, user-specific communication channels

- Real-time collaboration features
- Live dashboard functionality
- Notification preference management

PROJECT CONTEXT:
WebSocket API: Socket.IO integration, /api/socket endpoints
Notification types: budget alerts, goal milestones, transaction confirmations
Real-time events: balance changes, budget updates, goal contributions
Collaboration: shared accounts, family financial planning
Push notifications: Service Worker for web push, mobile app notifications

```#### **PROMPT 6.2: Mobile Optimization and PWA Features**

```Create mobile-optimized experience and Progressive Web App features for the Personal Finance Dashboard with backend integration.

REQUIREMENTS:
- Implement Progressive Web App features:
  - Service Worker for offline functionality with caching strategy
  - App manifest for home screen installation
  - Background sync for transaction uploads to /api/transactions/sync
  - Push notification support using backend notification service
  - Offline data caching with IndexedDB for transactions, budgets, goals
- Design mobile-first responsive interface:
  - Touch-friendly navigation and interactions (44px+ touch targets)
  - Mobile-optimized forms and inputs with proper input types
  - Swipe gestures for transaction deletion and category assignment
  - Bottom navigation for key features (Dashboard, Transactions, Budget, Goals)
  - Thumb-friendly button placement in bottom 25% of screen
- Create mobile-specific features:
  - Quick transaction entry with voice input using Web Speech API
  - Photo capture for receipts integrating with /api/upload/receipt endpoint
  - Camera integration using backend image processing (Sharp optimization)
  - Location-based spending tracking with geolocation API
  - Mobile-optimized charts using Chart.js responsive design
  - Simplified mobile dashboard with key metrics only
- Implement offline capabilities:
  - Offline transaction entry with queue in IndexedDB
  - Background sync when connection restored via /api/transactions/bulk
  - Cached data for essential features (last 30 days transactions)
  - Sync conflict resolution using backend timestamps
  - Offline report generation using cached data
- Add mobile performance optimizations:
  - Lazy loading for images via Intersection Observer API
  - Virtual scrolling for transaction lists (CDK Virtual Scrolling)
  - Image compression before upload (integrate with backend Sharp processing)
  - Bundle splitting with Angular lazy-loaded modules
  - Service Worker caching for static assets and API responses

BACKEND INTEGRATION:
- File Upload API: /api/upload/receipt with image optimization
- Bulk Transaction API: /api/transactions/bulk for offline sync
- Push Notification Service: WebSocket events for real-time updates
- Image Processing: Backend Sharp integration for receipt processing
- Sync Queue: Backend handles duplicate detection and conflict resolution

TECHNICAL IMPLEMENTATION:
```typescript
// PWA Service Worker Registration
export class PwaService {
  installPwa(): void {
    this.swUpdate.available.subscribe(() => {
      if (confirm('New version available. Load?')) {
        window.location.reload();
      }
    });
  }
}

// Mobile Receipt Capture
export class ReceiptCaptureService {
  async captureReceipt(): Promise<void> {
    const imageCapture = new ImageCapture(stream.getVideoTracks()[0]);
    const blob = await imageCapture.takePhoto();
    
    // Upload to backend with optimization
    const formData = new FormData();
    formData.append('receipt', blob);
    return this.http.post('/api/upload/receipt', formData).toPromise();
  }
}

// Offline Transaction Queue
export class OfflineService {
  queueTransaction(transaction: Partial<Transaction>): void {
    const offlineTransactions = this.getOfflineTransactions();
    offlineTransactions.push({ ...transaction, offlineId: uuid() });
    localStorage.setItem('offlineTransactions', JSON.stringify(offlineTransactions));
  }
  
  async syncOfflineTransactions(): Promise<void> {
    const offlineTransactions = this.getOfflineTransactions();
    if (offlineTransactions.length > 0) {
      await this.http.post('/api/transactions/bulk', offlineTransactions).toPromise();
      localStorage.removeItem('offlineTransactions');
    }
  }
}
```

APP MANIFEST CONFIGURATION:

```json
{
  "name": "Personal Finance Dashboard",
  "short_name": "FinanceDash",
  "description": "Manage your personal finances",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1976d2",
  "theme_color": "#1976d2",
  "icons": [
    {
      "src": "assets/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "assets/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "categories": ["finance", "productivity"],
  "screenshots": []
}
```

MOBILE RESPONSIVE BREAKPOINTS:

- Mobile: 320px - 767px (single column layout)
- Tablet: 768px - 1023px (two column layout)
- Desktop: 1024px+ (full dashboard layout)

EXPECTED OUTPUT:

- Progressive Web App with offline capabilities
- Mobile-optimized responsive design with touch gestures
- Camera integration for receipt capture
- Offline transaction queue with background sync
- Performance-optimized mobile experience
- Voice input for quick transaction entry

PROJECT CONTEXT:
Backend API: /api/upload/receipt, /api/transactions/bulk, /api/transactions/sync
Image Processing: Sharp optimization, WebP conversion, thumbnail generation
Push Notifications: WebSocket integration, Service Worker push events
Offline Storage: IndexedDB for transactions, LocalStorage for preferences
Performance: Lazy loading, virtual scrolling, bundle optimization
Mobile UX: Bottom navigation, swipe gestures, thumb-friendly design

```#### **PROMPT 6.3: Security, Performance, and Accessibility**

```Implement security hardening, performance optimization, and accessibility features for the Personal Finance Dashboard with backend security integration.

REQUIREMENTS:
- Implement frontend security features with backend integration:
  - Content Security Policy (CSP) headers from backend security middleware
  - XSS protection using DOMPurify and backend sanitization
  - CSRF token validation with backend-generated tokens
  - Secure JWT token storage and rotation
  - Two-factor authentication with backend TOTP verification
  - Rate limiting compliance (1000 req/15min authenticated, 100 req/15min unauthenticated)
- Add comprehensive performance optimizations:
  - Code splitting with Angular lazy-loaded modules
  - Image optimization using backend Sharp processing
  - API response caching with Redis integration
  - Virtual scrolling for large transaction datasets
  - Bundle size optimization with Webpack Bundle Analyzer
  - Service Worker caching for static assets and API responses
- Create full accessibility compliance:
  - WCAG 2.1 AA compliance with automated testing
  - Screen reader compatibility using existing AccessibilityService
  - Keyboard navigation for all interactive elements
  - High contrast mode support with CSS custom properties
  - Focus management with proper tab order and focus indicators
  - ARIA live regions for dynamic content updates
- Implement comprehensive monitoring and analytics:
  - Error tracking integration with backend error logging
  - Performance monitoring with Core Web Vitals
  - User behavior analytics with privacy compliance
  - Security incident logging and alerting
  - API performance monitoring and alerting
- Add complete testing infrastructure:
  - Unit tests using Jest (matching backend 120s timeout)
  - Integration tests for authentication and API flows
  - End-to-end testing with Cypress
  - Accessibility testing with axe-core
  - Performance testing with Lighthouse CI

BACKEND SECURITY INTEGRATION:
```typescript
// CSP Configuration (from backend security middleware)
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'", "ws://localhost:3000", "wss://api.financedash.com"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"]
};

// Security Headers Service
@Injectable()
export class SecurityService {
  private cspViolationReporter = '/api/security/csp-violation';
  
  reportSecurityViolation(violation: SecurityPolicyViolationEvent): void {
    this.http.post(this.cspViolationReporter, {
      documentURI: violation.documentURI,
      referrer: violation.referrer,
      blockedURI: violation.blockedURI,
      violatedDirective: violation.violatedDirective,
      originalPolicy: violation.originalPolicy
    }).subscribe();
  }
}
```

AUTHENTICATION SECURITY:

```typescript
// JWT Token Management with Backend Integration
@Injectable()
export class TokenService {
  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  
  // Secure token storage with httpOnly cookie fallback
  storeTokens(accessToken: string, refreshToken: string): void {
    // Store in memory for XSS protection
    this.memoryStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    
    // Refresh token in httpOnly cookie (handled by backend)
    this.http.post('/api/auth/store-refresh-token', { refreshToken }).subscribe();
  }
  
  // Automatic token refresh with backend rotation
  refreshToken(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/refresh', {})
      .pipe(
        tap(response => this.storeTokens(response.accessToken, response.refreshToken)),
        catchError(error => {
          this.logout();
          return throwError(error);
        })
      );
  }
}
```

PERFORMANCE OPTIMIZATION:

```typescript
// Image Optimization Service
@Injectable()
export class ImageOptimizationService {
  // Integration with backend Sharp processing
  async optimizeImage(file: File): Promise<Blob> {
    // Client-side compression before upload
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Resize maintaining aspect ratio
        const { width, height } = this.calculateDimensions(img);
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(resolve, 'image/webp', 0.85);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }
}

// Virtual Scrolling Implementation
@Component({
  template: `
    <cdk-virtual-scroll-viewport itemSize="72" class="transaction-viewport">
      <div *cdkVirtualFor="let transaction of transactions; trackBy: trackByFn">
        <app-transaction-item [transaction]="transaction"></app-transaction-item>
      </div>
    </cdk-virtual-scroll-viewport>
  `
})
export class TransactionListComponent {
  trackByFn(index: number, transaction: Transaction): string {
    return transaction.id;
  }
}
```

ACCESSIBILITY IMPLEMENTATION:

```typescript
// Enhanced Accessibility Service (extending existing)
@Injectable()
export class AccessibilityService {
  private announcer = inject(LiveAnnouncer);
  private focusTrap = inject(FocusTrap);
  
  // ARIA live region announcements
  announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    this.announcer.announce(message, priority);
  }
  
  // Keyboard navigation management
  manageFocus(element: HTMLElement): void {
    element.focus();
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  
  // High contrast mode detection
  detectHighContrastMode(): boolean {
    return window.matchMedia('(prefers-contrast: high)').matches;
  }
  
  // Reduced motion preference
  detectReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

// WCAG 2.1 AA Compliance Component
@Component({
  template: `
    <button
      [attr.aria-label]="buttonLabel"
      [attr.aria-describedby]="descriptionId"
      [class.high-contrast]="isHighContrast"
      (click)="handleClick()"
      (keydown.enter)="handleClick()"
      (keydown.space)="handleClick()"
    >
      <span [id]="descriptionId" class="sr-only">{{ description }}</span>
      {{ label }}
    </button>
  `
})
export class AccessibleButtonComponent {
  @Input() label: string;
  @Input() description: string;
  @Input() buttonLabel: string;
  
  descriptionId = `desc-${Math.random().toString(36).substr(2, 9)}`;
  isHighContrast = this.accessibilityService.detectHighContrastMode();
}
```

TESTING INFRASTRUCTURE:

```typescript
// Jest Configuration (jest.config.js)
export default {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
  testTimeout: 120000, // Match backend timeout
  testEnvironment: 'jsdom',
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/polyfills.ts',
    '!src/**/*.stories.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'text', 'lcov', 'clover'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/src/app/shared/$1',
    '^@core/(.*)$': '<rootDir>/src/app/core/$1'
  }
};

// Angular Testing Utilities
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';

// Test Setup (setup-jest.ts)
import 'jest-preset-angular/setup-jest';
import { ngMocks } from 'ng-mocks';

// Configure ng-mocks
ngMocks.autoSpy('jest');

// Mock environment
Object.defineProperty(window, 'environment', {
  value: {
    production: false,
    apiUrl: 'http://localhost:3000/api'
  }
});
```

UNIT TESTING EXAMPLES:

```typescript
// Service Testing with HTTP Mocking
describe('TransactionService', () => {
  let service: TransactionService;
  let httpMock: HttpTestingController;
  let store: MockStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TransactionService,
        provideMockStore({ initialState: { auth: { user: mockUser } } })
      ]
    });

    service = TestBed.inject(TransactionService);
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(MockStore);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create transaction with proper authentication', () => {
    const mockTransaction = { amount: 100, description: 'Test' };
    const expectedTransaction = { id: '1', ...mockTransaction };

    service.createTransaction(mockTransaction).subscribe(transaction => {
      expect(transaction).toEqual(expectedTransaction);
    });

    const req = httpMock.expectOne('/api/transactions');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('Authorization')).toBeTruthy();
    expect(req.request.body).toEqual(mockTransaction);
    req.flush(expectedTransaction);
  });

  it('should handle rate limiting errors', () => {
    const mockTransaction = { amount: 100, description: 'Test' };

    service.createTransaction(mockTransaction).subscribe({
      error: (error) => {
        expect(error.status).toBe(429);
        expect(error.error.message).toBe('Rate limit exceeded');
      }
    });

    const req = httpMock.expectOne('/api/transactions');
    req.flush({ message: 'Rate limit exceeded' }, { status: 429, statusText: 'Too Many Requests' });
  });
});

// Component Testing with Angular Testing Library
import { render, screen, fireEvent, waitFor } from '@testing-library/angular';
import { TransactionFormComponent } from './transaction-form.component';

describe('TransactionFormComponent', () => {
  it('should submit transaction form with validation', async () => {
    const mockSubmit = jest.fn();
    
    await render(TransactionFormComponent, {
      componentProperties: {
        onSubmit: mockSubmit
      },
      imports: [ReactiveFormsModule, HttpClientTestingModule]
    });

    // Fill form
    fireEvent.input(screen.getByLabelText(/amount/i), { target: { value: '100.50' } });
    fireEvent.input(screen.getByLabelText(/description/i), { target: { value: 'Grocery shopping' } });
    
    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        amount: 100.50,
        description: 'Grocery shopping'
      });
    });
  });

  it('should display validation errors', async () => {
    await render(TransactionFormComponent);

    // Submit empty form
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }));

    await waitFor(() => {
      expect(screen.getByText(/amount is required/i)).toBeInTheDocument();
      expect(screen.getByText(/description is required/i)).toBeInTheDocument();
    });
  });
});

// NgRx Store Testing
describe('AuthEffects', () => {
  let effects: AuthEffects;
  let actions$: Observable<any>;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('AuthService', ['login', 'logout']);

    TestBed.configureTestingModule({
      providers: [
        AuthEffects,
        provideMockActions(() => actions$),
        { provide: AuthService, useValue: spy }
      ]
    });

    effects = TestBed.inject(AuthEffects);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  });

  it('should handle login success', () => {
    const credentials = { email: 'test@example.com', password: 'password' };
    const user = { id: '1', email: 'test@example.com' };
    const action = AuthActions.login({ credentials });
    const outcome = AuthActions.loginSuccess({ user, token: 'token' });

    actions$ = hot('-a', { a: action });
    const response = cold('-a|', { a: { user, token: 'token' } });
    authService.login.and.returnValue(response);

    const expected = cold('--b', { b: outcome });
    expect(effects.login$).toBeObservable(expected);
  });
});
```

INTEGRATION TESTING:

```typescript
// API Integration Tests
describe('API Integration', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  it('should handle file upload with progress', () => {
    const file = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('receipt', file);

    let progressEvents: number[] = [];
    let finalResponse: any;

    httpClient.post('/api/upload/receipt', formData, {
      reportProgress: true,
      observe: 'events'
    }).subscribe(event => {
      if (event.type === HttpEventType.UploadProgress) {
        progressEvents.push(Math.round(100 * event.loaded / event.total!));
      } else if (event.type === HttpEventType.Response) {
        finalResponse = event.body;
      }
    });

    const req = httpTestingController.expectOne('/api/upload/receipt');
    
    // Simulate progress events
    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    req.event({ type: HttpEventType.UploadProgress, loaded: 100, total: 100 });
    req.flush({ id: 'upload-123', url: '/uploads/receipt.jpg' });

    expect(progressEvents).toEqual([50, 100]);
    expect(finalResponse).toEqual({ id: 'upload-123', url: '/uploads/receipt.jpg' });
  });

  it('should handle WebSocket authentication', (done) => {
    const mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn()
    };

    // Mock Socket.IO
    (window as any).io = jest.fn().mockReturnValue(mockSocket);

    const socketService = new SocketService();
    
    // Test authentication flow
    socketService.connect('test-token');
    
    expect(mockSocket.emit).toHaveBeenCalledWith('authenticate', 'test-token');
    
    // Simulate authentication success
    const authSuccessCallback = mockSocket.on.mock.calls
      .find(call => call[0] === 'authentication_success')[1];
    
    authSuccessCallback({ userId: 'user-123' });
    
    socketService.isAuthenticated$.subscribe(isAuth => {
      expect(isAuth).toBe(true);
      done();
    });
  });
});
```

END-TO-END TESTING:

```typescript
// Cypress Configuration (cypress.config.ts)
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    chromeWebSecurity: false,
    setupNodeEvents(on, config) {
      // Implement accessibility testing
      require('@cypress/code-coverage/task')(on, config);
      return config;
    }
  },
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
    specPattern: '**/*.cy.ts'
  }
});

// E2E Test Examples
describe('Transaction Management Flow', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password');
    cy.visit('/transactions');
  });

  it('should create, edit, and delete transaction', () => {
    // Create transaction
    cy.get('[data-cy=add-transaction-btn]').click();
    cy.get('[data-cy=amount-input]').type('50.00');
    cy.get('[data-cy=description-input]').type('Lunch expense');
    cy.get('[data-cy=category-select]').select('Food & Dining');
    cy.get('[data-cy=submit-btn]').click();

    // Verify creation
    cy.contains('Transaction added successfully').should('be.visible');
    cy.get('[data-cy=transaction-list]').should('contain', 'Lunch expense');

    // Edit transaction
    cy.get('[data-cy=transaction-item]').first().find('[data-cy=edit-btn]').click();
    cy.get('[data-cy=amount-input]').clear().type('45.00');
    cy.get('[data-cy=submit-btn]').click();

    // Verify edit
    cy.contains('Transaction updated successfully').should('be.visible');
    cy.get('[data-cy=transaction-list]').should('contain', '$45.00');

    // Delete transaction
    cy.get('[data-cy=transaction-item]').first().find('[data-cy=delete-btn]').click();
    cy.get('[data-cy=confirm-delete-btn]').click();

    // Verify deletion
    cy.contains('Transaction deleted successfully').should('be.visible');
    cy.get('[data-cy=transaction-list]').should('not.contain', 'Lunch expense');
  });

  it('should handle file upload for receipts', () => {
    cy.get('[data-cy=add-transaction-btn]').click();
    
    // Upload receipt
    cy.get('[data-cy=receipt-upload]').selectFile('cypress/fixtures/receipt.jpg');
    
    // Verify upload progress
    cy.get('[data-cy=upload-progress]').should('be.visible');
    cy.get('[data-cy=upload-success]').should('be.visible');
    
    // Complete transaction with receipt
    cy.get('[data-cy=amount-input]').type('25.99');
    cy.get('[data-cy=description-input]').type('Coffee shop');
    cy.get('[data-cy=submit-btn]').click();
    
    // Verify transaction with receipt
    cy.get('[data-cy=transaction-item]').first().should('contain', 'Coffee shop');
    cy.get('[data-cy=receipt-thumbnail]').should('be.visible');
  });
});

// Performance Testing
describe('Performance Tests', () => {
  it('should meet Core Web Vitals standards', () => {
    cy.visit('/dashboard');
    
    // Measure LCP (Largest Contentful Paint)
    cy.window().then((win) => {
      cy.wrap(null).should(() => {
        const observer = new win.PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') {
              expect(entry.startTime).to.be.lessThan(2500); // Good LCP < 2.5s
            }
          }
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
      });
    });
  });

  it('should load dashboard within acceptable time', () => {
    const startTime = Date.now();
    
    cy.visit('/dashboard');
    cy.get('[data-cy=dashboard-content]').should('be.visible');
    
    cy.then(() => {
      const loadTime = Date.now() - startTime;
      expect(loadTime).to.be.lessThan(3000); // Load within 3 seconds
    });
  });
});
```

ACCESSIBILITY TESTING:

```typescript
// Accessibility Test Suite
describe('Accessibility Compliance', () => {
  beforeEach(() => {
    cy.injectAxe();
  });

  it('should pass WCAG 2.1 AA standards on dashboard', () => {
    cy.visit('/dashboard');
    cy.checkA11y(null, {
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'focus-management': { enabled: true }
      }
    });
  });

  it('should support keyboard navigation', () => {
    cy.visit('/transactions');
    
    // Test tab navigation
    cy.get('body').tab();
    cy.focused().should('have.attr', 'data-cy', 'main-nav');
    
    // Test form navigation
    cy.get('[data-cy=add-transaction-btn]').click();
    cy.get('[data-cy=amount-input]').focus().tab();
    cy.focused().should('have.attr', 'data-cy', 'description-input');
    
    // Test escape key
    cy.get('body').type('{esc}');
    cy.get('[data-cy=transaction-form]').should('not.exist');
  });

  it('should provide proper ARIA labels and descriptions', () => {
    cy.visit('/budget');
    
    // Check ARIA labels
    cy.get('[data-cy=budget-chart]').should('have.attr', 'aria-label');
    cy.get('[data-cy=budget-progress]').should('have.attr', 'aria-describedby');
    
    // Check live regions
    cy.get('[aria-live="polite"]').should('exist');
    cy.get('[aria-live="assertive"]').should('exist');
  });

  it('should support screen reader announcements', () => {
    cy.visit('/transactions');
    
    // Add transaction and verify announcement
    cy.get('[data-cy=add-transaction-btn]').click();
    cy.get('[data-cy=amount-input]').type('100');
    cy.get('[data-cy=description-input]').type('Test transaction');
    cy.get('[data-cy=submit-btn]').click();
    
    // Check for announcement
    cy.get('[aria-live="polite"]').should('contain', 'Transaction added successfully');
  });
});
```

SECURITY TESTING:

```typescript
// Security Test Suite
describe('Security Tests', () => {
  it('should prevent XSS attacks', () => {
    const maliciousScript = '<script>alert("XSS")</script>';
    
    cy.visit('/transactions');
    cy.get('[data-cy=add-transaction-btn]').click();
    cy.get('[data-cy=description-input]').type(maliciousScript);
    cy.get('[data-cy=submit-btn]').click();
    
    // Verify script is not executed
    cy.get('[data-cy=transaction-list]').should('contain', maliciousScript);
    cy.get('[data-cy=transaction-list] script').should('not.exist');
  });

  it('should enforce CSP policies', () => {
    cy.visit('/dashboard');
    
    // Check CSP headers
    cy.window().then((win) => {
      const metaCSP = win.document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      expect(metaCSP).to.exist;
      expect(metaCSP.getAttribute('content')).to.include("default-src 'self'");
    });
  });

  it('should handle JWT token expiration', () => {
    // Set expired token
    cy.window().then((win) => {
      win.localStorage.setItem('access_token', 'expired.token.here');
    });
    
    cy.visit('/dashboard');
    
    // Should redirect to login
    cy.url().should('include', '/login');
    cy.contains('Session expired. Please log in again.').should('be.visible');
  });

  it('should respect rate limiting', () => {
    cy.visit('/transactions');
    
    // Attempt rapid requests
    for (let i = 0; i < 10; i++) {
      cy.get('[data-cy=refresh-btn]').click();
    }
    
    // Should show rate limit warning
    cy.contains('Too many requests. Please slow down.').should('be.visible');
  });
});
```

CONTINUOUS INTEGRATION:

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:ci
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run accessibility tests
      run: npm run test:a11y
    
    - name: Run E2E tests
      run: npm run test:e2e:ci
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
    
    - name: Run Lighthouse CI
      run: npm run lighthouse:ci
```

EXPECTED OUTPUT:

- Complete Jest unit testing setup with 80%+ coverage
- Integration tests for all API endpoints and WebSocket connections
- Comprehensive E2E testing with Cypress
- Automated accessibility testing with axe-core
- Security testing for XSS, CSP, and authentication
- Performance testing with Core Web Vitals monitoring
- Continuous integration pipeline with automated testing

PROJECT CONTEXT:
Testing Framework: Jest with Angular Testing Library, Cypress for E2E
Backend Integration: API testing, WebSocket testing, file upload testing
Security Testing: XSS prevention, CSP compliance, JWT security
Accessibility: WCAG 2.1 AA compliance, screen reader testing
Performance: Core Web Vitals, bundle size monitoring, Lighthouse CI
CI/CD: GitHub Actions workflow with comprehensive test suite

```#### **PROMPT 6.4: Testing Infrastructure**

OBJECTIVE: Implement comprehensive testing infrastructure including unit, integration, E2E, accessibility, security, and performance testing with CI/CD pipeline integration.

IMPLEMENTATION REQUIREMENTS:

JEST UNIT TESTING SETUP:
```typescript
// jest.config.js
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
  testTimeout: 120000, // Match backend timeout
  collectCoverage: true,
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.spec.ts',
    '!src/app/**/*.module.ts',
    '!src/app/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapping: {
    '@app/(.*)': '<rootDir>/src/app/$1',
    '@shared/(.*)': '<rootDir>/src/app/shared/$1',
    '@core/(.*)': '<rootDir>/src/app/core/$1'
  }
};

// src/setup-jest.ts
import 'jest-preset-angular/setup-jest';
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

// Initialize Angular testing environment
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

// Global test utilities
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
```

INTEGRATION TESTING FOR API ENDPOINTS:

```typescript
// src/app/core/services/api.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { environment } from '@environments/environment';

describe('ApiService Integration Tests', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Authentication Integration', () => {
    it('should handle JWT authentication flow', () => {
      const mockCredentials = { email: 'test@example.com', password: 'password123' };
      const mockResponse = { 
        token: 'jwt.token.here',
        refreshToken: 'refresh.token.here',
        user: { id: 1, email: 'test@example.com' }
      };

      service.login(mockCredentials).subscribe(response => {
        expect(response.token).toBeTruthy();
        expect(response.user.email).toBe(mockCredentials.email);
      });

      const req = httpMock.expectOne(`${baseUrl}/api/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockCredentials);
      req.flush(mockResponse);
    });

    it('should handle token refresh', () => {
      const mockRefreshToken = 'refresh.token.here';
      const mockResponse = { token: 'new.jwt.token' };

      service.refreshToken(mockRefreshToken).subscribe(response => {
        expect(response.token).toBeTruthy();
      });

      const req = httpMock.expectOne(`${baseUrl}/api/auth/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refreshToken: mockRefreshToken });
      req.flush(mockResponse);
    });
  });

  describe('File Upload Integration', () => {
    it('should upload receipt with Sharp processing', () => {
      const mockFile = new File(['test'], 'receipt.jpg', { type: 'image/jpeg' });
      const mockResponse = { 
        id: 'upload-123',
        url: '/api/uploads/receipt.jpg',
        processedUrl: '/api/uploads/receipt-optimized.jpg',
        ocrData: { amount: 25.99, merchant: 'Test Store' }
      };

      service.uploadReceipt(mockFile).subscribe(response => {
        expect(response.processedUrl).toContain('optimized');
        expect(response.ocrData.amount).toBe(25.99);
      });

      const req = httpMock.expectOne(`${baseUrl}/api/upload/receipt`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeInstanceOf(FormData);
      req.flush(mockResponse);
    });
  });

  describe('Transaction Management Integration', () => {
    it('should handle bulk transaction import', () => {
      const mockTransactions = [
        { amount: 100, description: 'Transaction 1', category: 'Food' },
        { amount: 200, description: 'Transaction 2', category: 'Transport' }
      ];
      const mockResponse = { 
        imported: 2, 
        failed: 0, 
        duplicates: 0,
        transactions: mockTransactions.map((t, i) => ({ ...t, id: i + 1 }))
      };

      service.bulkImportTransactions(mockTransactions).subscribe(response => {
        expect(response.imported).toBe(2);
        expect(response.failed).toBe(0);
      });

      const req = httpMock.expectOne(`${baseUrl}/api/transactions/bulk`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ transactions: mockTransactions });
      req.flush(mockResponse);
    });
  });

  describe('WebSocket Integration', () => {
    it('should establish WebSocket connection', (done) => {
      const mockMessage = { type: 'TRANSACTION_UPDATED', data: { id: 1, amount: 150 } };
      
      service.connectWebSocket().subscribe(message => {
        expect(message.type).toBe('TRANSACTION_UPDATED');
        expect(message.data.amount).toBe(150);
        done();
      });

      // Simulate WebSocket message
      service['webSocketSubject'].next(mockMessage);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should handle rate limit responses', () => {
      const mockTransactions = Array(10).fill(null).map((_, i) => ({ id: i }));

      // Make multiple rapid requests
      mockTransactions.forEach((_, index) => {
        service.getTransactions().subscribe({
          error: (error) => {
            if (index >= 5) { // Expect rate limiting after 5 requests
              expect(error.status).toBe(429);
              expect(error.error.message).toContain('rate limit');
            }
          }
        });

        if (index < 5) {
          const req = httpMock.expectOne(`${baseUrl}/api/transactions`);
          req.flush({ transactions: [] });
        } else {
          const req = httpMock.expectOne(`${baseUrl}/api/transactions`);
          req.flush(
            { message: 'Rate limit exceeded' }, 
            { status: 429, statusText: 'Too Many Requests' }
          );
        }
      });
    });
  });
});
```

END-TO-END TESTING WITH CYPRESS:

```typescript
// cypress/e2e/user-journeys.cy.ts
describe('Critical User Journeys', () => {
  beforeEach(() => {
    // Setup test user and data
    cy.task('db:seed');
    cy.login('test@example.com', 'password123');
  });

  it('should complete full transaction management flow', () => {
    // Navigate to transactions
    cy.visit('/transactions');
    cy.get('[data-cy=transactions-list]').should('be.visible');

    // Add new transaction
    cy.get('[data-cy=add-transaction-btn]').click();
    cy.get('[data-cy=amount-input]').type('25.99');
    cy.get('[data-cy=description-input]').type('Grocery shopping');
    cy.get('[data-cy=category-select]').select('Food');
    cy.get('[data-cy=submit-btn]').click();

    // Verify transaction appears
    cy.get('[data-cy=transaction-item]').should('contain', '25.99');
    cy.get('[data-cy=transaction-item]').should('contain', 'Grocery shopping');

    // Upload receipt
    cy.get('[data-cy=upload-receipt-btn]').click();
    cy.get('[data-cy=file-input]').attachFile('receipts/grocery-receipt.jpg');
    cy.get('[data-cy=upload-submit]').click();

    // Verify OCR processing
    cy.get('[data-cy=ocr-results]', { timeout: 10000 }).should('be.visible');
    cy.get('[data-cy=ocr-amount]').should('contain', '25.99');

    // Edit transaction
    cy.get('[data-cy=edit-transaction-btn]').first().click();
    cy.get('[data-cy=description-input]').clear().type('Updated grocery shopping');
    cy.get('[data-cy=submit-btn]').click();

    // Verify update
    cy.get('[data-cy=transaction-item]').should('contain', 'Updated grocery shopping');

    // Delete transaction
    cy.get('[data-cy=delete-transaction-btn]').first().click();
    cy.get('[data-cy=confirm-delete-btn]').click();
    
    // Verify deletion
    cy.get('[data-cy=transaction-item]').should('not.exist');
  });

  it('should handle offline functionality', () => {
    // Go offline
    cy.goOffline();
    
    // Attempt to add transaction
    cy.visit('/transactions');
    cy.get('[data-cy=add-transaction-btn]').click();
    cy.get('[data-cy=amount-input]').type('15.50');
    cy.get('[data-cy=description-input]').type('Coffee shop');
    cy.get('[data-cy=submit-btn]').click();

    // Verify offline storage
    cy.get('[data-cy=offline-indicator]').should('be.visible');
    cy.get('[data-cy=pending-sync-count]').should('contain', '1');

    // Go back online
    cy.goOnline();
    
    // Verify sync
    cy.get('[data-cy=sync-complete]', { timeout: 5000 }).should('be.visible');
    cy.get('[data-cy=pending-sync-count]').should('contain', '0');
  });
});

// cypress/e2e/accessibility.cy.ts
describe('Accessibility Testing', () => {
  beforeEach(() => {
    cy.injectAxe();
    cy.login('test@example.com', 'password123');
  });

  it('should pass WCAG 2.1 AA compliance on all pages', () => {
    const pages = ['/dashboard', '/transactions', '/budget', '/goals', '/reports', '/settings'];
    
    pages.forEach(page => {
      cy.visit(page);
      cy.checkA11y(null, {
        rules: {
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true },
          'focus-management': { enabled: true },
          'aria-labels': { enabled: true }
        }
      });
    });
  });

  it('should support full keyboard navigation', () => {
    cy.visit('/transactions');
    
    // Test tab navigation through interface
    cy.get('body').tab();
    cy.focused().should('have.attr', 'data-cy', 'skip-link');
    
    cy.tab();
    cy.focused().should('have.attr', 'data-cy', 'main-nav');
    
    // Test form keyboard navigation
    cy.get('[data-cy=add-transaction-btn]').focus().type('{enter}');
    cy.get('[data-cy=transaction-form]').should('be.visible');
    
    cy.get('[data-cy=amount-input]').should('be.focused');
    cy.tab();
    cy.focused().should('have.attr', 'data-cy', 'description-input');
    
    // Test escape key functionality
    cy.get('body').type('{esc}');
    cy.get('[data-cy=transaction-form]').should('not.exist');
  });

  it('should provide proper screen reader support', () => {
    cy.visit('/dashboard');
    
    // Check ARIA landmarks
    cy.get('[role="main"]').should('exist');
    cy.get('[role="navigation"]').should('exist');
    cy.get('[role="banner"]').should('exist');
    
    // Check live regions
    cy.get('[aria-live="polite"]').should('exist');
    cy.get('[aria-live="assertive"]').should('exist');
    
    // Check heading hierarchy
    cy.get('h1').should('have.length', 1);
    cy.get('h2').should('exist');
    
    // Test dynamic content announcements
    cy.get('[data-cy=add-transaction-btn]').click();
    cy.get('[aria-describedby]').should('exist');
  });
});
```

SECURITY TESTING:

```typescript
// cypress/e2e/security.cy.ts
describe('Security Testing', () => {
  describe('XSS Prevention', () => {
    it('should sanitize user input', () => {
      cy.login('test@example.com', 'password123');
      cy.visit('/transactions');
      
      // Attempt XSS injection
      const xssPayload = '<script>alert("XSS")</script>';
      cy.get('[data-cy=add-transaction-btn]').click();
      cy.get('[data-cy=description-input]').type(xssPayload);
      cy.get('[data-cy=submit-btn]').click();
      
      // Verify script is not executed
      cy.get('[data-cy=transaction-item]').should('contain', xssPayload);
      cy.window().its('alert').should('not.have.been.called');
    });
  });

  describe('CSP Compliance', () => {
    it('should enforce Content Security Policy', () => {
      cy.visit('/dashboard');
      
      // Check CSP headers
      cy.request('/dashboard').then((response) => {
        expect(response.headers).to.have.property('content-security-policy');
        expect(response.headers['content-security-policy']).to.include("default-src 'self'");
      });
    });
  });

  describe('Authentication Security', () => {
    it('should handle JWT expiration properly', () => {
      // Login with short-lived token
      cy.loginWithShortToken('test@example.com', 'password123');
      cy.visit('/transactions');
      
      // Wait for token expiration
      cy.wait(5000);
      
      // Attempt API call
      cy.get('[data-cy=refresh-btn]').click();
      
      // Should redirect to login
      cy.url().should('include', '/login');
      cy.get('[data-cy=session-expired-message]').should('be.visible');
    });

    it('should prevent CSRF attacks', () => {
      cy.login('test@example.com', 'password123');
      
      // Attempt CSRF attack simulation
      cy.request({
        method: 'POST',
        url: '/api/transactions',
        body: { amount: 1000000, description: 'CSRF Attack' },
        failOnStatusCode: false,
        headers: {
          'Origin': 'http://malicious-site.com'
        }
      }).then((response) => {
        expect(response.status).to.equal(403);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', () => {
      cy.login('test@example.com', 'password123');
      cy.visit('/transactions');
      
      // Make rapid requests
      for (let i = 0; i < 10; i++) {
        cy.get('[data-cy=refresh-btn]').click();
      }
      
      // Should show rate limit warning
      cy.get('[data-cy=rate-limit-warning]').should('be.visible');
      cy.contains('Too many requests. Please slow down.').should('be.visible');
    });
  });
});
```

PERFORMANCE TESTING:

```typescript
// cypress/e2e/performance.cy.ts
describe('Performance Testing', () => {
  it('should load dashboard within performance budget', () => {
    cy.visit('/dashboard');
    
    // Measure Core Web Vitals
    cy.window().then((win) => {
      // Largest Contentful Paint (LCP)
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        expect(lastEntry.startTime).to.be.below(2500); // 2.5s threshold
      }).observe({ entryTypes: ['largest-contentful-paint'] });
      
      // Cumulative Layout Shift (CLS)
      new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        expect(clsValue).to.be.below(0.1); // 0.1 threshold
      }).observe({ entryTypes: ['layout-shift'] });
    });
  });

  it('should handle large datasets efficiently', () => {
    // Seed database with large dataset
    cy.task('db:seedLargeDataset', { transactions: 10000 });
    
    cy.login('test@example.com', 'password123');
    cy.visit('/transactions');
    
    // Measure rendering time
    const startTime = performance.now();
    cy.get('[data-cy=transactions-list]').should('be.visible');
    
    cy.window().then(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      expect(renderTime).to.be.below(1000); // 1s threshold
    });
    
    // Test virtual scrolling performance
    cy.get('[data-cy=virtual-scroll-container]').scrollTo('bottom');
    cy.get('[data-cy=transaction-item]').should('have.length.at.most', 50); // Virtual scrolling limit
  });

  it('should optimize image loading and processing', () => {
    cy.login('test@example.com', 'password123');
    cy.visit('/transactions');
    
    // Upload image and measure processing time
    const startTime = performance.now();
    cy.get('[data-cy=upload-receipt-btn]').click();
    cy.get('[data-cy=file-input]').attachFile('receipts/large-receipt.jpg');
    cy.get('[data-cy=upload-submit]').click();
    
    // Verify Sharp optimization
    cy.get('[data-cy=optimized-image]', { timeout: 5000 }).should('be.visible');
    cy.window().then(() => {
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      expect(processingTime).to.be.below(3000); // 3s threshold for image processing
    });
    
    // Verify image compression
    cy.get('[data-cy=optimized-image]').should('have.attr', 'src').and('include', 'optimized');
  });
});
```

CONTINUOUS INTEGRATION PIPELINE:

```yaml
# .github/workflows/frontend-ci.yml
name: Frontend CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run unit tests
      run: npm run test:ci
      env:
        NODE_ENV: test
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        API_URL: http://localhost:3000
    
    - name: Start backend server
      run: |
        cd ../finance-dashboard-backend
        npm start &
        sleep 10
      
    - name: Run E2E tests
      run: npm run test:e2e:ci
      env:
        CYPRESS_baseUrl: http://localhost:4200
    
    - name: Run accessibility tests
      run: npm run test:a11y
    
    - name: Run security tests
      run: npm run test:security
    
    - name: Run performance tests
      run: npm run lighthouse:ci
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: frontend
        name: frontend-coverage
    
    - name: Upload Lighthouse results
      uses: actions/upload-artifact@v3
      with:
        name: lighthouse-results
        path: ./lighthouse-results
  
  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build for production
      run: npm run build:prod
    
    - name: Analyze bundle size
      run: npm run analyze
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: dist-files
        path: ./dist
  
  deploy:
    needs: [test, build]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Download build artifacts
      uses: actions/download-artifact@v3
      with:
        name: dist-files
        path: ./dist
    
    - name: Deploy to production
      run: |
        # Add deployment script here
        echo "Deploying to production..."
```

PACKAGE.JSON TEST SCRIPTS:

```json
{
  "scripts": {
    "test": "jest",
    "test:ci": "jest --ci --coverage --maxWorkers=2 --testTimeout=120000",
    "test:watch": "jest --watch",
    "test:integration": "jest --testNamePattern='Integration' --testTimeout=120000",
    "test:e2e": "cypress open",
    "test:e2e:ci": "cypress run --headless --browser chrome",
    "test:a11y": "cypress run --spec 'cypress/e2e/accessibility.cy.ts'",
    "test:security": "cypress run --spec 'cypress/e2e/security.cy.ts'",
    "test:performance": "cypress run --spec 'cypress/e2e/performance.cy.ts'",
    "lighthouse:ci": "lhci autorun",
    "analyze": "ng build --stats-json && npx webpack-bundle-analyzer dist/stats.json"
  }
}
```

EXPECTED OUTPUT:

- Complete Jest unit testing setup with 80%+ coverage matching backend timeout (120s)
- Integration tests for all API endpoints including file upload and WebSocket connections
- Comprehensive E2E testing with Cypress for critical user journeys
- Automated accessibility testing with axe-core and WCAG 2.1 AA compliance
- Security testing for XSS prevention, CSP compliance, and JWT authentication
- Performance testing with Core Web Vitals monitoring and Sharp image optimization
- Continuous integration pipeline with GitHub Actions workflow
- Bundle size analysis and optimization monitoring
- Automated deployment with build artifact management

PROJECT CONTEXT:
Testing Framework: Jest with Angular Testing Library, Cypress for E2E, matching backend configurations
Backend Integration: Complete API testing including /api/upload/receipt, /api/transactions/bulk, WebSocket
Security Testing: XSS prevention, CSP compliance, JWT security, rate limiting validation
Accessibility: Full WCAG 2.1 AA compliance testing with existing AccessibilityService integration
Performance: Core Web Vitals monitoring, Sharp image processing optimization, virtual scrolling
CI/CD: GitHub Actions workflow with comprehensive test suite and automated deployment
Monitoring: Coverage reporting, Lighthouse CI, bundle analysis, and performance budgets

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Core Infrastructure ✅

- [x] Project structure setup with Angular CLI
- [x] Backend API integration with comprehensive error handling
- [x] Environment configuration for all deployment stages
- [x] Basic routing and navigation implementation
- [x] Authentication system with JWT and refresh tokens
- [x] State management with NgRx Store
- [x] HTTP interceptors for authentication and error handling

### Phase 2: User Interface ✅

- [x] Responsive layout with Angular Material and Tailwind CSS
- [x] Dashboard components with real-time data visualization
- [x] Form components with reactive forms and validation
- [x] Navigation and sidebar with role-based access
- [x] Modal and notification systems
- [x] Theme system with dark/light mode support
- [x] Loading states and skeleton screens

### Phase 3: Transaction Management ✅

- [x] Transaction CRUD operations with backend integration
- [x] File upload system with Sharp image processing
- [x] Bulk import functionality with validation
- [x] Advanced filtering and search capabilities
- [x] Category management with hierarchical structure
- [x] Receipt scanning and OCR integration
- [x] Transaction reconciliation features

### Phase 4: Analytics & Reporting ✅

- [x] Interactive charts with Chart.js and D3.js
- [x] Financial reports with export functionality
- [x] Budget tracking with progress indicators
- [x] Spending insights and analytics
- [x] Goal setting and monitoring
- [x] Comparative analysis tools
- [x] Real-time dashboard updates

### Phase 5: Data Management ✅

- [x] Data export/import with multiple formats
- [x] Backup and restore functionality
- [x] Data synchronization between devices
- [x] Offline capability with IndexedDB
- [x] Data validation and integrity checks
- [x] Archive and cleanup management
- [x] Performance optimization for large datasets

### Phase 6: Advanced Features ✅

- [x] **PROMPT 6.1**: Real-time Features and WebSocket Integration
  - [x] WebSocket connection management with Socket.IO
  - [x] Real-time notifications and updates
  - [x] Live data synchronization across clients
  - [x] Connection state management and error handling
  
- [x] **PROMPT 6.2**: Mobile Optimization and PWA Features
  - [x] Progressive Web App implementation
  - [x] Service Worker for offline capabilities
  - [x] Camera integration for receipt capture
  - [x] Mobile-specific UI optimizations
  - [x] Background sync and push notifications
  
- [x] **PROMPT 6.3**: Security, Performance, and Accessibility
  - [x] CSP configuration and XSS protection
  - [x] JWT token management with secure storage
  - [x] Performance optimization with lazy loading
  - [x] WCAG 2.1 AA accessibility compliance
  - [x] Image optimization with Sharp processing
  
- [x] **PROMPT 6.4**: Testing Infrastructure
  - [x] Jest unit testing with 80%+ coverage
  - [x] Integration testing for all API endpoints
  - [x] End-to-end testing with Cypress
  - [x] Accessibility testing with axe-core
  - [x] Security and performance testing
  - [x] CI/CD pipeline with GitHub Actions

---

## 🎯 FINAL VALIDATION & NEXT STEPS

### Integration Completeness

This frontend-backend integration plan now provides comprehensive coverage of:

1. **Complete Feature Set**: All 6 phases with detailed implementation prompts
2. **Backend Alignment**: Specific integration with actual backend APIs and configurations
3. **Security Integration**: CSP, JWT, rate limiting, and XSS protection aligned with backend
4. **Performance Optimization**: Image processing, caching, and optimization strategies
5. **Testing Coverage**: Comprehensive testing infrastructure matching backend standards
6. **Accessibility Compliance**: Full WCAG 2.1 AA implementation with existing services
7. **PWA Features**: Complete mobile optimization and offline capabilities

### Key Backend Integrations Verified

- **Authentication**: JWT with refresh token rotation (`/api/auth/*`)
- **File Upload**: Receipt processing with Sharp optimization (`/api/upload/receipt`)
- **Transactions**: CRUD operations with bulk import (`/api/transactions/*`)
- **WebSocket**: Real-time updates with Socket.IO (`/api/websocket`)
- **Security**: CSP headers, rate limiting, and sanitization middleware
- **Performance**: Image processing, compression, and caching strategies

### Implementation Priority

1. **Start with Phase 1-2**: Core infrastructure and UI foundation
2. **Implement Phase 3-4**: Core functionality and analytics
3. **Add Phase 5**: Data management and optimization
4. **Complete Phase 6**: Advanced features, security, and testing

### Deployment Readiness

The plan includes:

- Production-ready security configurations
- Performance optimization strategies
- Comprehensive testing infrastructure
- CI/CD pipeline with automated deployment
- Monitoring and error tracking setup

### Development Timeline Estimate

- **Phase 1-2**: 3-4 weeks (Foundation)
- **Phase 3-4**: 4-5 weeks (Core Features)
- **Phase 5**: 2-3 weeks (Data Management)
- **Phase 6**: 3-4 weeks (Advanced Features)
- **Total**: 12-16 weeks for complete implementation

---

## 📞 SUPPORT & MAINTENANCE

### Documentation

- All prompts include specific implementation details
- Backend API endpoints and configurations documented
- Testing strategies and examples provided
- Performance optimization guidelines included

### Troubleshooting

- Common integration issues addressed in each prompt
- Error handling strategies documented
- Debugging guidelines and tools specified
- Performance bottleneck identification included

### Future Enhancements

- Modular architecture supports easy feature additions
- Scalable security and performance frameworks
- Extensible testing infrastructure
- Maintainable code organization and documentation

---

## INTEGRATION PLAN COMPLETION STATUS: ✅ COMPLETE**

This comprehensive frontend-backend integration plan is now ready for implementation with all 6 phases fully detailed, 24 specific prompts, and complete alignment with the existing backend infrastructure.
