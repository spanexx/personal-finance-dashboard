# Personal Finance Dashboard API Documentation

## Base URL

```http://localhost:5000/api
```

## Authentication

Most endpoints require authentication using Bearer tokens in the Authorization header:

```Authorization: Bearer <access_token>
```

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "message": "Success message",
  "data": {}, // Response data
  "timestamp": "2025-06-02T10:00:00.000Z",
  "statusCode": 200,
  "meta": {} // Optional metadata (pagination, etc.)
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "timestamp": "2025-06-02T10:00:00.000Z",
  "statusCode": 400,
  "errors": {}, // Optional validation errors
  "code": "ERROR_CODE" // Optional error code
}
```

---

## Authentication Endpoints

### Register User

**POST** `/auth/register`

**Access:** Public

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isVerified": false,
      "isEmailVerified": false,
      "createdAt": "2025-06-02T10:00:00.000Z"
    },
    "accessToken": "jwt_access_token",
    "expiresIn": "15m",
    "emailVerificationSent": true
  },
  "message": "User registered successfully"
}
```

### Login

**POST** `/auth/login`

**Access:** Public

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isVerified": true,
      "isEmailVerified": true,
      "lastLoginAt": "2025-06-02T10:00:00.000Z"
    },
    "accessToken": "jwt_access_token",
    "expiresIn": "15m"
  },
  "message": "Login successful"
}
```

### Refresh Token

**POST** `/auth/refresh`

**Access:** Public (requires refresh token in cookie or body)

**Request Body:**

```json
{
  "refreshToken": "refresh_token" // Optional if provided via HTTP-only cookie
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_access_token",
    "expiresIn": "15m"
  },
  "message": "Token refreshed successfully"
}
```

### Logout

**POST** `/auth/logout`

**Access:** Private

**Response:**

```json
{
  "success": true,
  "data": null,
  "message": "Logout successful"
}
```

### Logout All Devices

**POST** `/auth/logout-all`

**Access:** Private

**Response:**

```json
{
  "success": true,
  "data": null,
  "message": "Logged out from all devices successfully"
}
```

### Get Profile

**GET** `/auth/profile`

**Access:** Private

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1234567890",
      "dateOfBirth": "1990-01-01",
      "address": {
        "street": "123 Main St",
        "city": "New York",
        "state": "NY",
        "postalCode": "10001",
        "country": "USA"
      },
      "preferences": {
        "currency": "USD",
        "dateFormat": "MM/DD/YYYY",
        "language": "en",
        "theme": "light"
      },
      "isVerified": true,
      "isEmailVerified": true,
      "createdAt": "2025-06-02T10:00:00.000Z"
    }
  },
  "message": "Profile retrieved successfully"
}
```

### Update Profile

**PUT** `/auth/profile`

**Access:** Private

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "preferences": {
    "currency": "USD",
    "dateFormat": "MM/DD/YYYY",
    "language": "en",
    "theme": "dark"
  }
}
```

### Get Active Sessions

**GET** `/auth/sessions`

**Access:** Private

**Response:**

```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": 0,
        "createdAt": "2025-06-02T10:00:00.000Z",
        "expiresAt": "2025-06-09T10:00:00.000Z",
        "isCurrentSession": true
      }
    ],
    "count": 1
  },
  "message": "Sessions retrieved successfully"
}
```

### Revoke Session

**DELETE** `/auth/sessions/:sessionId`

**Access:** Private

**Parameters:**

- `sessionId` (path): Session ID to revoke

### Verify Token

**GET** `/auth/verify`

**Access:** Private

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "tokenInfo": {
      "type": "access",
      "issuedAt": "2025-06-02T10:00:00.000Z",
      "expiresAt": "2025-06-02T10:15:00.000Z"
    }
  },
  "message": "Token is valid"
}
```

### Check Password Strength

**POST** `/auth/password/check-strength`

**Access:** Public

**Request Body:**

```json
{
  "password": "TestPassword123!"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "score": 4,
    "feedback": {
      "warning": "",
      "suggestions": []
    },
    "crack_times_seconds": {
      "online_throttling_100_per_hour": 1000000,
      "online_no_throttling_10_per_second": 100000,
      "offline_slow_hashing_1e4_per_second": 10000,
      "offline_fast_hashing_1e10_per_second": 10
    },
    "crack_times_display": {
      "online_throttling_100_per_hour": "11 days",
      "online_no_throttling_10_per_second": "1 day",
      "offline_slow_hashing_1e4_per_second": "3 hours",
      "offline_fast_hashing_1e10_per_second": "instant"
    }
  }
}
```

### Forgot Password

**POST** `/auth/password/forgot`

**Access:** Public

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "data": null,
  "message": "If an account with that email exists, a password reset link has been sent"
}
```

### Reset Password

**POST** `/auth/password/reset`

**Access:** Public

**Request Body:**

```json
{
  "token": "reset_token",
  "password": "NewSecurePass123!"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  },
  "message": "Password reset successfully"
}
```

### Change Password

**POST** `/auth/password/change`

**Access:** Private

**Request Body:**

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePass123!"
}
```

### Generate Password

**POST** `/auth/password/generate`

**Access:** Public

**Request Body:**

```json
{
  "length": 16,
  "options": {
    "includeUppercase": true,
    "includeLowercase": true,
    "includeNumbers": true,
    "includeSymbols": true
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "password": "GeneratedSecurePass123!",
    "strength": {
      "score": 4,
      "feedback": {
        "warning": "",
        "suggestions": []
      }
    }
  }
}
```

---

## User Management Endpoints

### Get User Profile

**GET** `/users/profile`

**Access:** Private

**Response:** Same as auth profile endpoint

### Update User Profile

**PUT** `/users/profile`

**Access:** Private

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "USA"
  },
  "preferences": {
    "currency": "USD",
    "dateFormat": "MM/DD/YYYY",
    "language": "en",
    "theme": "dark"
  }
}
```

### Upload Profile Image

**POST** `/users/upload-profile-image`

**Access:** Private

**Content-Type:** `multipart/form-data`

**Request Body:**

- `profileImage` (file): Image file (max 5MB, formats: jpg, jpeg, png, gif)

### Change Passwords

**PUT** `/users/change-password`

**Access:** Private

**Request Body:**

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePass123!"
}
```

### Deactivate Account

**POST** `/users/deactivate`

**Access:** Private

**Request Body:**

```json
{
  "reason": "Optional reason for deactivation"
}
```

### Export User Data

**GET** `/users/export-data`

**Access:** Private

**Response:** Returns JSON file with all user data

### Delete Account

**DELETE** `/users/account`

**Access:** Private

**Request Body:**

```json
{
  "confirmationText": "DELETE MY ACCOUNT"
}
```

### Get User Preferences

**GET** `/users/preferences`

**Access:** Private

**Response:**

```json
{
  "success": true,
  "data": {
    "currency": "USD",
    "dateFormat": "MM/DD/YYYY",
    "language": "en",
    "theme": "light",
    "notifications": {
      "email": true,
      "push": false,
      "sms": false
    },
    "privacy": {
      "profileVisibility": "private",
      "dataSharing": false
    }
  }
}
```

### Update User Preferences

**PUT** `/users/preferences`

**Access:** Private

**Request Body:**

```json
{
  "currency": "EUR",
  "dateFormat": "DD/MM/YYYY",
  "language": "en",
  "theme": "dark",
  "notifications": {
    "email": true,
    "push": true,
    "sms": false
  }
}
```

---

## Transaction Endpoints

### Get Transactions

**GET** `/transactions`

**Access:** Private

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `startDate` (date): Filter by start date (ISO 8601)
- `endDate` (date): Filter by end date (ISO 8601)
- `type` (string): Transaction type (`income`, `expense`)
- `categoryId` (string): Category ID filter
- `search` (string): Search in description, merchant, notes
- `minAmount` (number): Minimum amount filter
- `maxAmount` (number): Maximum amount filter
- `sortBy` (string): Sort field (`date`, `amount`, `description`)
- `sortOrder` (string): Sort order (`asc`, `desc`)
- `isRecurring` (boolean): Filter recurring transactions
- `status` (string): Transaction status

**Response:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "transaction_id",
        "type": "expense",
        "amount": 50.00,
        "description": "Grocery shopping",
        "category": {
          "id": "category_id",
          "name": "Food & Dining",
          "color": "#4CAF50"
        },
        "date": "2025-06-02T10:00:00.000Z",
        "merchant": "Supermarket XYZ",
        "location": "New York, NY",
        "notes": "Weekly groceries",
        "tags": ["groceries", "food"],
        "attachments": [],
        "isRecurring": false,
        "recurringDetails": null,
        "createdAt": "2025-06-02T10:00:00.000Z",
        "updatedAt": "2025-06-02T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalItems": 200,
      "hasNext": true,
      "hasPrev": false
    },
    "summary": {
      "totalIncome": 5000.00,
      "totalExpenses": 3000.00,
      "netAmount": 2000.00,
      "transactionCount": 200
    }
  },
  "message": "Transactions retrieved successfully"
}
```

### Get Transaction Statistics

**GET** `/transactions/stats`

**Access:** Private

**Query Parameters:**

- `startDate` (date): Start date for statistics
- `endDate` (date): End date for statistics
- `groupBy` (string): Grouping (`day`, `week`, `month`, `year`)

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalIncome": 5000.00,
      "totalExpenses": 3000.00,
      "netAmount": 2000.00,
      "transactionCount": 200,
      "averageExpense": 15.00,
      "averageIncome": 250.00
    },
    "categoryBreakdown": [
      {
        "category": "Food & Dining",
        "amount": 800.00,
        "percentage": 26.67,
        "count": 25
      }
    ],
    "timeSeriesData": [
      {
        "period": "2025-06",
        "income": 5000.00,
        "expenses": 3000.00,
        "net": 2000.00
      }
    ],
    "trends": {
      "expenseGrowth": 5.2,
      "incomeGrowth": 3.1,
      "savingsRate": 40.0
    }
  }
}
```

### Get Transaction Analytics

**GET** `/transactions/analytics`

**Access:** Private

**Query Parameters:**

- `startDate` (date): Start date for analytics
- `endDate` (date): End date for analytics
- `compareWith` (string): Comparison period (`previous`, `lastYear`)

**Response:**

```json
{
  "success": true,
  "data": {
    "insights": [
      {
        "type": "spending_pattern",
        "title": "Increased Restaurant Spending",
        "description": "Your restaurant spending increased by 25% this month",
        "impact": "high",
        "suggestion": "Consider cooking more meals at home to reduce expenses"
      }
    ],
    "patterns": {
      "topMerchants": [
        {
          "merchant": "Supermarket XYZ",
          "amount": 500.00,
          "frequency": 12
        }
      ],
      "spendingByDay": [
        {
          "day": "Monday",
          "amount": 150.00
        }
      ],
      "categoricalTrends": [
        {
          "category": "Food & Dining",
          "currentPeriod": 800.00,
          "previousPeriod": 640.00,
          "change": 25.0
        }
      ]
    }
  }
}
```

### Get Single Transaction

**GET** `/transactions/:id`

**Access:** Private

**Parameters:**

- `id` (path): Transaction ID

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "transaction_id",
    "type": "expense",
    "amount": 50.00,
    "description": "Grocery shopping",
    "category": {
      "id": "category_id",
      "name": "Food & Dining",
      "color": "#4CAF50"
    },
    "date": "2025-06-02T10:00:00.000Z",
    "merchant": "Supermarket XYZ",
    "location": "New York, NY",
    "notes": "Weekly groceries",
    "tags": ["groceries", "food"],
    "attachments": [
      {
        "id": "attachment_id",
        "filename": "receipt.jpg",
        "url": "/api/transactions/transaction_id/attachments/attachment_id",
        "uploadedAt": "2025-06-02T10:00:00.000Z"
      }
    ],
    "isRecurring": false,
    "recurringDetails": null,
    "createdAt": "2025-06-02T10:00:00.000Z",
    "updatedAt": "2025-06-02T10:00:00.000Z"
  }
}
```

### Create Transaction

**POST** `/transactions`

**Access:** Private

**Request Body:**

```json
{
  "type": "expense",
  "amount": 50.00,
  "description": "Grocery shopping",
  "categoryId": "category_id",
  "date": "2025-06-02T10:00:00.000Z",
  "merchant": "Supermarket XYZ",
  "location": "New York, NY",
  "notes": "Weekly groceries",
  "tags": ["groceries", "food"],
  "isRecurring": false,
  "recurringDetails": {
    "frequency": "monthly",
    "interval": 1,
    "endDate": "2025-12-31T23:59:59.999Z",
    "maxOccurrences": 12
  }
}
```

### Update Transaction

**PUT** `/transactions/:id`

**Access:** Private

**Parameters:**

- `id` (path): Transaction ID

**Request Body:** Same as create transaction

### Delete Transaction

**DELETE** `/transactions/:id`

**Access:** Private

**Parameters:**

- `id` (path): Transaction ID

**Query Parameters:**

- `permanent` (boolean): Permanently delete (default: false for soft delete)

### Restore Transaction

**POST** `/transactions/:id/restore`

**Access:** Private

**Parameters:**

- `id` (path): Transaction ID

### Bulk Operations

**POST** `/transactions/bulk`

**Access:** Private

**Request Body:**

```json
{
  "operation": "delete",
  "transactionIds": ["id1", "id2", "id3"],
  "filters": {
    "categoryId": "category_id",
    "startDate": "2025-06-01",
    "endDate": "2025-06-30"
  },
  "updateData": {
    "categoryId": "new_category_id"
  }
}
```

### Import Transactions

**POST** `/transactions/import`

**Access:** Private

**Content-Type:** `multipart/form-data`

**Request Body:**

- `file` (file): CSV or Excel file with transaction data
- `mapping` (string): JSON string mapping CSV columns to transaction fields

### Upload Attachment

**POST** `/transactions/:id/attachments`

**Access:** Private

**Content-Type:** `multipart/form-data`

**Parameters:**

- `id` (path): Transaction ID

**Request Body:**

- `attachments` (files): Up to 5 files (max 10MB each)

### Download Attachment

**GET** `/transactions/:id/attachments/:attachmentId`

**Access:** Private

**Parameters:**

- `id` (path): Transaction ID
- `attachmentId` (path): Attachment ID

### Delete Attachment

**DELETE** `/transactions/:id/attachments/:attachmentId`

**Access:** Private

**Parameters:**

- `id` (path): Transaction ID
- `attachmentId` (path): Attachment ID

### Search Autocomplete

**GET** `/transactions/search/autocomplete`

**Access:** Private

**Query Parameters:**

- `q` (string): Search query
- `field` (string): Field to search (`description`, `merchant`, `notes`)
- `limit` (number): Number of suggestions (default: 10)

**Response:**

```json
{
  "success": true,
  "data": {
    "suggestions": [
      "Grocery shopping",
      "Gas station",
      "Restaurant dinner"
    ]
  }
}
```

### Get Recurring Transactions Due

**GET** `/transactions/recurring/due`

**Access:** Private

**Query Parameters:**

- `date` (date): Date to check for due transactions (default: today)
- `days` (number): Number of days ahead to check (default: 7)

### Process Recurring Transactions

**POST** `/transactions/recurring/process`

**Access:** Private

**Request Body:**

```json
{
  "date": "2025-06-02",
  "recurringTransactionIds": ["id1", "id2"],
  "autoProcess": true
}
```

---

## Budget Endpoints

### Get Budgets

**GET** `/budgets`

**Access:** Private

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `period` (string): Budget period (`monthly`, `weekly`, `yearly`)
- `status` (string): Budget status (`active`, `inactive`, `expired`)
- `includeExpired` (boolean): Include expired budgets
- `includeInactive` (boolean): Include inactive budgets
- `search` (string): Search in budget names
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort order

**Response:**

```json
{
  "success": true,
  "data": {
    "budgets": [
      {
        "id": "budget_id",
        "name": "Monthly Budget",
        "period": "monthly",
        "startDate": "2025-06-01T00:00:00.000Z",
        "endDate": "2025-06-30T23:59:59.999Z",
        "totalBudget": 3000.00,
        "totalSpent": 2500.00,
        "remainingBudget": 500.00,
        "status": "active",
        "categories": [
          {
            "categoryId": "category_id",
            "categoryName": "Food & Dining",
            "budgetAmount": 800.00,
            "spentAmount": 650.00,
            "remainingAmount": 150.00,
            "percentageUsed": 81.25,
            "status": "on_track"
          }
        ],
        "performance": {
          "overallPerformance": 83.33,
          "categoriesOnTrack": 3,
          "categoriesOverBudget": 1,
          "totalVariance": -50.00
        },
        "alerts": [
          {
            "type": "overspend",
            "category": "Entertainment",
            "message": "You've exceeded your entertainment budget by $50"
          }
        ],
        "createdAt": "2025-06-01T00:00:00.000Z",
        "updatedAt": "2025-06-02T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalItems": 5,
      "hasNext": true,
      "hasPrev": false
    },
    "summary": {
      "totalBudgets": 5,
      "activeBudgets": 3,
      "totalBudgetAmount": 15000.00,
      "totalSpentAmount": 12000.00,
      "overallPerformance": 80.0
    }
  }
}
```

### Get Budget Details

**GET** `/budgets/:id`

**Access:** Private

**Parameters:**

- `id` (path): Budget ID

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "budget_id",
    "name": "Monthly Budget",
    "description": "My monthly spending budget",
    "period": "monthly",
    "startDate": "2025-06-01T00:00:00.000Z",
    "endDate": "2025-06-30T23:59:59.999Z",
    "totalBudget": 3000.00,
    "categories": [
      {
        "categoryId": "category_id",
        "categoryName": "Food & Dining",
        "budgetAmount": 800.00,
        "spentAmount": 650.00,
        "transactions": [
          {
            "id": "transaction_id",
            "amount": 50.00,
            "description": "Grocery shopping",
            "date": "2025-06-02T10:00:00.000Z"
          }
        ]
      }
    ],
    "analysis": {
      "dailyAverageSpending": 83.33,
      "projectedMonthlySpending": 2500.00,
      "recommendedDailySpending": 100.00,
      "daysRemaining": 28,
      "trends": [
        {
          "date": "2025-06-01",
          "cumulativeSpent": 150.00,
          "budgetProgress": 5.0
        }
      ]
    }
  }
}
```

### Create Budget

**POST** `/budgets`

**Access:** Private

**Request Body:**

```json
{
  "name": "Monthly Budget",
  "description": "My monthly spending budget",
  "period": "monthly",
  "startDate": "2025-06-01T00:00:00.000Z",
  "endDate": "2025-06-30T23:59:59.999Z",
  "categories": [
    {
      "categoryId": "category_id",
      "budgetAmount": 800.00
    }
  ],
  "totalBudget": 3000.00,
  "alertSettings": {
    "enableAlerts": true,
    "thresholds": {
      "warning": 80,
      "critical": 100
    },
    "notificationMethods": ["email", "push"]
  }
}
```

### Update Budget

**PUT** `/budgets/:id`

**Access:** Private

**Parameters:**

- `id` (path): Budget ID

**Request Body:** Same as create budget

### Delete Budget

**DELETE** `/budgets/:id`

**Access:** Private

**Parameters:**

- `id` (path): Budget ID

**Query Parameters:**

- `reason` (string): Reason for deletion

### Get Budget Analysis

**GET** `/budgets/:id/analysis`

**Access:** Private

**Parameters:**

- `id` (path): Budget ID

**Query Parameters:**

- `compareWith` (string): Comparison period (`previous`, `lastYear`)
- `includeProjections` (boolean): Include spending projections

**Response:**

```json
{
  "success": true,
  "data": {
    "performance": {
      "overallPerformance": 83.33,
      "categoriesOnTrack": 3,
      "categoriesOverBudget": 1,
      "totalVariance": -50.00
    },
    "insights": [
      {
        "type": "overspend_warning",
        "category": "Entertainment",
        "message": "Entertainment spending is 120% of budget",
        "suggestion": "Consider reducing entertainment expenses"
      }
    ],
    "projections": {
      "estimatedMonthEnd": 2800.00,
      "projectedOverage": -200.00,
      "recommendedAdjustments": [
        {
          "category": "Food & Dining",
          "currentBudget": 800.00,
          "recommendedBudget": 750.00,
          "reason": "Based on current spending patterns"
        }
      ]
    },
    "comparison": {
      "previousPeriod": {
        "totalSpent": 2200.00,
        "change": 13.64
      }
    }
  }
}
```

### Get Optimization Recommendations

**GET** `/budgets/recommendations/optimization`

**Access:** Private

**Query Parameters:**

- `period` (string): Analysis period
- `categories` (array): Specific categories to analyze

**Response:**

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "type": "budget_increase",
        "category": "Food & Dining",
        "currentAmount": 800.00,
        "recommendedAmount": 900.00,
        "reason": "Consistently overspending by 12% in this category",
        "impact": "Will reduce budget stress and improve tracking accuracy"
      }
    ],
    "optimizationScore": 75,
    "potentialSavings": 200.00
  }
}
```

### Bulk Update Budgets

**POST** `/budgets/bulk-update`

**Access:** Private

**Request Body:**

```json
{
  "operation": "update_amounts",
  "budgetIds": ["id1", "id2"],
  "adjustmentType": "percentage",
  "adjustmentValue": 10,
  "categories": ["category_id1", "category_id2"]
}
```

### Toggle Budget Status

**PUT** `/budgets/:id/toggle-status`

**Access:** Private

**Parameters:**

- `id` (path): Budget ID

---

## Goal Endpoints

### Get Goals

**GET** `/goals`

**Access:** Private

**Query Parameters:**

- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Goal status (`active`, `completed`, `paused`)
- `type` (string): Goal type (`savings`, `debt_payoff`, `investment`)
- `priority` (string): Goal priority (`high`, `medium`, `low`)
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort order

**Response:**

```json
{
  "success": true,
  "data": {
    "goals": [
      {
        "id": "goal_id",
        "name": "Emergency Fund",
        "description": "Build emergency fund for 6 months expenses",
        "type": "savings",
        "targetAmount": 10000.00,
        "currentAmount": 5000.00,
        "targetDate": "2025-12-31T23:59:59.999Z",
        "priority": "high",
        "status": "active",
        "progress": {
          "percentage": 50.0,
          "amountRemaining": 5000.00,
          "daysRemaining": 213,
          "isOnTrack": true,
          "requiredMonthlyContribution": 781.25
        },
        "milestones": [
          {
            "id": "milestone_id",
            "name": "First $2,500",
            "targetAmount": 2500.00,
            "achievedDate": "2025-03-15T00:00:00.000Z",
            "isAchieved": true
          }
        ],
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-06-02T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalItems": 5,
      "hasNext": true,
      "hasPrev": false
    },
    "summary": {
      "totalGoals": 5,
      "activeGoals": 3,
      "completedGoals": 1,
      "totalTargetAmount": 50000.00,
      "totalCurrentAmount": 25000.00,
      "overallProgress": 50.0
    }
  }
}
```

### Get Goal Details

**GET** `/goals/:id`

**Access:** Private

**Parameters:**

- `id` (path): Goal ID

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "goal_id",
    "name": "Emergency Fund",
    "description": "Build emergency fund for 6 months expenses",
    "type": "savings",
    "targetAmount": 10000.00,
    "currentAmount": 5000.00,
    "targetDate": "2025-12-31T23:59:59.999Z",
    "priority": "high",
    "status": "active",
    "contributions": [
      {
        "id": "contribution_id",
        "amount": 500.00,
        "date": "2025-06-01T00:00:00.000Z",
        "method": "manual",
        "source": "Salary",
        "notes": "Monthly contribution",
        "createdAt": "2025-06-01T10:00:00.000Z"
      }
    ],
    "analysis": {
      "averageMonthlyContribution": 625.00,
      "projectedCompletionDate": "2025-12-15T00:00:00.000Z",
      "contributionTrend": "steady",
      "recommendedMonthlyContribution": 781.25
    },
    "milestones": [
      {
        "id": "milestone_id",
        "name": "First $2,500",
        "targetAmount": 2500.00,
        "achievedDate": "2025-03-15T00:00:00.000Z",
        "isAchieved": true
      }
    ]
  }
}
```

### Create Goal

**POST** `/goals`

**Access:** Private

**Request Body:**

```json
{
  "name": "Emergency Fund",
  "description": "Build emergency fund for 6 months expenses",
  "type": "savings",
  "targetAmount": 10000.00,
  "targetDate": "2025-12-31T23:59:59.999Z",
  "priority": "high",
  "initialAmount": 1000.00,
  "milestones": [
    {
      "name": "First $2,500",
      "targetAmount": 2500.00
    },
    {
      "name": "Halfway Point",
      "targetAmount": 5000.00
    }
  ],
  "reminderSettings": {
    "enabled": true,
    "frequency": "weekly",
    "amount": 500.00
  }
}
```

### Update Goal

**PUT** `/goals/:id`

**Access:** Private

**Parameters:**

- `id` (path): Goal ID

**Request Body:** Same as create goal

### Delete Goal

**DELETE** `/goals/:id`

**Access:** Private

**Parameters:**

- `id` (path): Goal ID

### Add Contribution

**POST** `/goals/:id/contributions`

**Access:** Private

**Parameters:**

- `id` (path): Goal ID

**Request Body:**

```json
{
  "amount": 500.00,
  "date": "2025-06-02T00:00:00.000Z",
  "method": "manual",
  "source": "Salary",
  "notes": "Monthly contribution"
}
```

### Update Contribution

**PUT** `/goals/:id/contributions/:contributionId`

**Access:** Private

**Parameters:**

- `id` (path): Goal ID
- `contributionId` (path): Contribution ID

**Request Body:** Same as add contribution

### Delete Contribution

**DELETE** `/goals/:id/contributions/:contributionId`

**Access:** Private

**Parameters:**

- `id` (path): Goal ID
- `contributionId` (path): Contribution ID

### Get Contributions

**GET** `/goals/:id/contributions`

**Access:** Private

**Parameters:**

- `id` (path): Goal ID

**Query Parameters:**

- `page` (number): Page number
- `limit` (number): Items per page
- `startDate` (date): Filter by start date
- `endDate` (date): Filter by end date
- `sortBy` (string): Sort field
- `sortOrder` (string): Sort order

---

## Report Endpoints

### Get Spending Report

**GET** `/reports/spending`

**Access:** Private

**Query Parameters:**

- `startDate` (date): Start date for report
- `endDate` (date): End date for report
- `categoryId` (string): Filter by category
- `timeGroupBy` (string): Group by time period (`day`, `week`, `month`)
- `limit` (number): Limit results

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalSpent": 3000.00,
      "averageDaily": 100.00,
      "transactionCount": 150,
      "period": {
        "startDate": "2025-05-01T00:00:00.000Z",
        "endDate": "2025-05-31T23:59:59.999Z"
      }
    },
    "categoryAnalysis": [
      {
        "category": "Food & Dining",
        "amount": 800.00,
        "percentage": 26.67,
        "transactionCount": 25,
        "averageTransaction": 32.00
      }
    ],
    "trends": [
      {
        "period": "2025-05-01",
        "amount": 800.00,
        "change": 5.2
      }
    ],
    "patterns": {
      "topMerchants": [
        {
          "merchant": "Supermarket XYZ",
          "amount": 500.00,
          "frequency": 12
        }
      ],
      "spendingByDay": [
        {
          "dayOfWeek": "Monday",
          "amount": 150.00
        }
      ]
    }
  }
}
```

### Get Income Report

**GET** `/reports/income`

**Access:** Private

**Query Parameters:**

- `startDate` (date): Start date for report
- `endDate` (date): End date for report
- `timeGroupBy` (string): Group by time period

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalIncome": 5000.00,
      "averageMonthly": 5000.00,
      "transactionCount": 20,
      "period": {
        "startDate": "2025-05-01T00:00:00.000Z",
        "endDate": "2025-05-31T23:59:59.999Z"
      }
    },
    "sourceAnalysis": [
      {
        "source": "Salary",
        "amount": 4000.00,
        "percentage": 80.0,
        "frequency": 2
      }
    ],
    "trends": [
      {
        "period": "2025-05",
        "amount": 5000.00,
        "change": 3.1
      }
    ],
    "analysis": {
      "growthRate": 3.1,
      "diversificationScore": 0.6,
      "reliability": "high"
    }
  }
}
```

### Get Cash Flow Report

**GET** `/reports/cashflow`

**Access:** Private

**Query Parameters:**

- `startDate` (date): Start date for report
- `endDate` (date): End date for report
- `projectionMonths` (number): Number of months to project

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalIncome": 5000.00,
      "totalExpenses": 3000.00,
      "netCashFlow": 2000.00,
      "averageNetCashFlow": 2000.00,
      "averageSavingsRate": 40.0
    },
    "monthlyCashFlow": [
      {
        "month": "2025-05",
        "income": 5000.00,
        "expenses": 3000.00,
        "netCashFlow": 2000.00,
        "savingsRate": 40.0
      }
    ],
    "projections": [
      {
        "month": "2025-07",
        "projectedIncome": 5100.00,
        "projectedExpenses": 3100.00,
        "projectedNetCashFlow": 2000.00
      }
    ],
    "patterns": {
      "trend": "positive",
      "seasonality": "low",
      "volatility": "low"
    }
  }
}
```

### Get Budget Performance Report

**GET** `/reports/budget-performance`

**Access:** Private

**Query Parameters:**

- `startDate` (date): Start date for report
- `endDate` (date): End date for report
- `budgetId` (string): Specific budget ID

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalBudget": 3000.00,
      "totalSpent": 2500.00,
      "overallPerformance": 83.33,
      "categoriesOnTrack": 3,
      "categoriesOverBudget": 1,
      "totalVariance": -500.00
    },
    "categoryPerformance": [
      {
        "category": "Food & Dining",
        "budgetAmount": 800.00,
        "spentAmount": 650.00,
        "variance": 150.00,
        "performance": 81.25,
        "status": "on_track"
      }
    ],
    "trends": [
      {
        "period": "2025-05",
        "budgetUtilization": 83.33,
        "variance": -500.00
      }
    ]
  }
}
```

### Get Goal Progress Report

**GET** `/reports/goal-progress`

**Access:** Private

**Query Parameters:**

- `goalId` (string): Specific goal ID (optional)

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalGoals": 5,
      "activeGoals": 3,
      "completedGoals": 1,
      "onTrackGoals": 2,
      "averageProgress": 65.0
    },
    "goals": [
      {
        "id": "goal_id",
        "name": "Emergency Fund",
        "targetAmount": 10000.00,
        "currentAmount": 5000.00,
        "progress": 50.0,
        "daysRemaining": 213,
        "isOnTrack": true,
        "projectedCompletionDate": "2025-12-15T00:00:00.000Z"
      }
    ],
    "insights": [
      {
        "type": "on_track",
        "message": "Emergency Fund is on track for completion",
        "goalId": "goal_id"
      }
    ]
  }
}
```

### Get Net Worth Report

**GET** `/reports/net-worth`

**Access:** Private

**Query Parameters:**

- `startDate` (date): Start date for report
- `endDate` (date): End date for report
- `projectionMonths` (number): Number of months to project

**Response:**

```json
{
  "success": true,
  "data": {
    "current": 25000.00,
    "assets": {
      "cash": 10000.00,
      "investments": 15000.00,
      "property": 0.00,
      "other": 0.00
    },
    "liabilities": {
      "creditCards": 0.00,
      "loans": 0.00,
      "mortgage": 0.00,
      "other": 0.00
    },
    "trends": [
      {
        "date": "2025-05-01",
        "netWorth": 23000.00,
        "assets": 23000.00,
        "liabilities": 0.00
      }
    ],
    "projections": [
      {
        "date": "2025-07-01",
        "projected": 29000.00,
        "confidence": 0.85
      }
    ],
    "analysis": {
      "monthlyChange": 2000.00,
      "annualizedGrowth": 15.2,
      "assetAllocation": {
        "cash": 40.0,
        "investments": 60.0
      }
    }
  }
}
```

### Get Dashboard Summary

**GET** `/reports/dashboard`

**Access:** Private

**Query Parameters:**

- `period` (string): Period for summary (`month`, `quarter`, `year`)

**Response:**

```json
{
  "success": true,
  "data": {
    "period": "month",
    "dateRange": {
      "startDate": "2025-05-01T00:00:00.000Z",
      "endDate": "2025-05-31T23:59:59.999Z"
    },
    "spending": {
      "totalAmount": 3000.00,
      "topCategories": [
        {
          "category": "Food & Dining",
          "amount": 800.00,
          "percentage": 26.67
        }
      ],
      "trend": {
        "direction": "up",
        "percentage": 5.2
      }
    },
    "income": {
      "totalAmount": 5000.00,
      "growthRate": 3.1,
      "diversificationScore": 0.6
    },
    "cashFlow": {
      "netCashFlow": 2000.00,
      "savingsRate": 40.0,
      "trend": "positive"
    },
    "budget": {
      "overallPerformance": 83.33,
      "categoriesOverBudget": 1,
      "totalVariance": -500.00
    },
    "goals": {
      "totalGoals": 5,
      "onTrackGoals": 2,
      "averageProgress": 65.0
    },
    "netWorth": {
      "current": 25000.00,
      "change": 2000.00,
      "projectedGrowth": 4000.00
    }
  }
}
```

### Get Financial Insights

**GET** `/reports/insights`

**Access:** Private

**Response:**

```json
{
  "success": true,
  "data": {
    "insights": {
      "spending": [
        {
          "type": "warning",
          "title": "Spending Increase Alert",
          "message": "Your spending has increased by 25.0% compared to last period.",
          "action": "Review your recent transactions and identify unnecessary expenses."
        }
      ],
      "income": [
        {
          "type": "positive",
          "title": "Income Growth",
          "message": "Your income has grown by 3.1% over the period.",
          "action": "Consider increasing your savings rate to match your income growth."
        }
      ],
      "savings": [
        {
          "type": "positive",
          "title": "Excellent Savings Rate",
          "message": "You're saving 40.0% of your income.",
          "action": "Great job! Consider investing your savings for long-term growth."
        }
      ],
      "budget": [
        {
          "type": "warning",
          "title": "Budget Overruns",
          "message": "1 categories are over budget.",
          "action": "Review and adjust your budget or spending in these categories."
        }
      ],
      "goals": [
        {
          "type": "positive",
          "title": "Goals Within Reach",
          "message": "2 goals are close to completion.",
          "action": "You're almost there! Keep up the momentum."
        }
      ]
    },
    "summary": {
      "totalInsights": 5,
      "positiveInsights": 3,
      "warningInsights": 2,
      "infoInsights": 0
    }
  }
}
```

### Export Report

**GET** `/reports/export`

**Access:** Private

**Query Parameters:**

- `reportType` (string): Type of report (`spending`, `income`, `cashflow`, `budget`, `goals`, `networth`)
- `format` (string): Export format (`json`, `csv`)
- `startDate` (date): Start date for report
- `endDate` (date): End date for report

**Response:** Returns file download with appropriate content-type

---

## Email Verification Endpoints

### Send Email Verification

**POST** `/email-verification/send`

**Access:** Public

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

### Verify Email

**POST** `/email-verification/verify`

**Access:** Public

**Request Body:**

```json
{
  "token": "verification_token",
  "email": "user@example.com"
}
```

### Resend Email Verification

**POST** `/email-verification/resend`

**Access:** Public

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

### Get Verification Status

**GET** `/email-verification/status/:email`

**Access:** Public

**Parameters:**

- `email` (path): Email address

### Get Verification Analytics

**GET** `/email-verification/analytics`

**Access:** Private (Admin)

---

## Email Preferences Endpoints

### Get Email Preferences

**GET** `/email-preferences`

**Access:** Private

**Response:**

```json
{
  "success": true,
  "data": {
    "transactionAlerts": true,
    "budgetAlerts": true,
    "goalReminders": true,
    "weeklyReports": false,
    "monthlyReports": true,
    "marketingEmails": false,
    "securityAlerts": true,
    "frequency": "daily",
    "lastUpdated": "2025-06-02T10:00:00.000Z"
  }
}
```

### Update Email Preferences

**PUT** `/email-preferences`

**Access:** Private

**Request Body:**

```json
{
  "transactionAlerts": true,
  "budgetAlerts": true,
  "goalReminders": false,
  "weeklyReports": true,
  "monthlyReports": true,
  "marketingEmails": false,
  "frequency": "weekly"
}
```

### Unsubscribe from All Emails

**POST** `/email-preferences/unsubscribe`

**Access:** Private

**Request Body:**

```json
{
  "reason": "Too many emails"
}
```

### Resubscribe to Emails

**POST** `/email-preferences/resubscribe`

**Access:** Private

### Unsubscribe from Email Type

**POST** `/email-preferences/unsubscribe/:type`

**Access:** Public (with token)

**Parameters:**

- `type` (path): Email type to unsubscribe from

### Get Bulk Email Settings

**GET** `/email-preferences/bulk-settings`

**Access:** Private (Admin)

### Update Bulk Email Settings

**PUT** `/email-preferences/bulk-settings`

**Access:** Private (Admin)

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| AUTHENTICATION_ERROR | 401 | Authentication required or failed |
| AUTHORIZATION_ERROR | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT_ERROR | 409 | Resource already exists |
| RATE_LIMIT_ERROR | 429 | Too many requests |
| DATABASE_ERROR | 500 | Database operation failed |
| INTERNAL_ERROR | 500 | Internal server error |

---

## Rate Limiting

- Global rate limit: 1000 requests per 15 minutes per IP
- Auth endpoints: 100 requests per 15 minutes per IP
- Password reset: 5 attempts per hour per IP

---

## Data Types

### Currency

All monetary values are represented as numbers with 2 decimal places (e.g., 123.45).

### Dates

All dates are in ISO 8601 format (e.g., "2025-06-02T10:00:00.000Z").

### ObjectIds

MongoDB ObjectIds are 24-character hexadecimal strings.

### Pagination

Standard pagination format:

```json
{
  "currentPage": 1,
  "totalPages": 10,
  "totalItems": 200,
  "hasNext": true,
  "hasPrev": false
}
```

---

## File Uploads

### Supported Formats

- **Profile Images:** JPG, JPEG, PNG, GIF (max 5MB)
- **Transaction Attachments:** JPG, JPEG, PNG, PDF, TXT (max 10MB each, max 5 files)
- **Import Files:** CSV, Excel (max 10MB)

### Upload Response

```json
{
  "success": true,
  "data": {
    "filename": "uploaded_file.jpg",
    "originalName": "original_file.jpg",
    "size": 1024000,
    "mimetype": "image/jpeg",
    "url": "/uploads/filename.jpg"
  }
}
```
