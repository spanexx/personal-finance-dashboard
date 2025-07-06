# Personal Finance Dashboard

This project is a full-stack web application designed to help users manage their personal finances effectively. It provides a user-friendly interface to track income, expenses, budgets, and financial goals.

## Problem Solved

Managing personal finances can be a challenging and time-consuming task. Many individuals struggle to keep track of their income and expenses, set realistic budgets, and work towards their financial goals. 
This can lead to overspending, debt accumulation, and a lack of financial clarity.

This Personal Finance Dashboard aims to solve these problems by providing a centralized platform for users to:

*   Gain a clear overview of their financial health.
*   Track spending habits and identify areas for improvement.
*   Create and manage budgets to control expenses.
*   Set and monitor progress towards financial goals.
*   Make informed financial decisions.

## Features

This project offers a comprehensive suite of features to help users manage their finances:

### Backend (Node.js with Express.js and MongoDB)

*   **User Authentication:** Secure user registration and login with password hashing and JWT (JSON Web Tokens).
*   **Transaction Management:** CRUD operations for income and expense transactions.
*   **Budget Management:** Create, update, and track budgets for different spending categories.
*   **Category Management:** Organize transactions into customizable categories.
*   **Financial Goal Setting:** Define and monitor progress towards financial goals (e.g., saving for a vacation, paying off debt).
*   **Reporting and Analytics:** Generate reports on spending patterns, income vs. expenses, and budget adherence. (Details to be expanded based on specific report functionalities)
*   **Data Import/Export:** Functionality to import transaction data from common formats (e.g., CSV) and export user data.
*   **Email Notifications:** Automated email alerts for budget limits, goal reminders, etc. (Requires SendGrid or similar service integration).
*   **API Endpoints:** A well-defined RESTful API for communication with the frontend.
*   **Security:** Measures like input sanitization, rate limiting, and security headers.
*   **WebSockets:** Real-time updates for certain features (e.g., notifications, collaborative budgeting if applicable).

### Frontend (Angular)

*   **Interactive Dashboard:** A user-friendly dashboard displaying key financial information at a glance.
*   **Data Visualization:** Charts and graphs to visualize spending habits, budget progress, and goal attainment.
*   **Transaction Entry Form:** Easy-to-use form for adding and editing transactions.
*   **Budget Creation and Tracking Interface:** Intuitive interface for managing budgets.
*   **Goal Setting and Monitoring Views:** Clear visualization of financial goals and progress.
*   **User Profile Management:** Allow users to update their profile information and preferences.
*   **Responsive Design:** The application is designed to work seamlessly on various devices (desktops, tablets, and mobile phones).
*   **Real-time Updates:** Reflects changes made in the backend in real-time where WebSockets are used.

## Getting Started

This section will guide you through setting up and running the Personal Finance Dashboard application.

### Prerequisites

Before you begin, ensure you have the following installed on your system:

*   Node.js (which includes npm)
*   MongoDB
*   Angular CLI

### Backend Setup (finance-dashboard-backend)

1.  **Navigate to the backend directory:**
    ```bash
    cd finance-dashboard-backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    *   Create a `.env` file by copying the `.env.example` file:
        ```bash
        cp .env.example .env
        ```
    *   Open the `.env` file and configure the variables, especially:
        *   `MONGODB_URI`: Your MongoDB connection string.
        *   `JWT_SECRET`: A strong secret key for JWT signing.
        *   `SENDGRID_API_KEY`: Your SendGrid API key (if you want to use email notification features).
        *   `EMAIL_FROM`: The email address from which notifications will be sent.

4.  **Start the backend server:**
    *   For development with automatic restarts (using nodemon, if configured in `package.json` scripts):
        ```bash
        npm run dev
        ```
    *   To start the server normally:
        ```bash
        npm start
        ```
    The backend server will typically run on `http://localhost:3000` (or the port specified in your environment variables).

### Frontend Setup (finance-dashboard-frontend)

1.  **Navigate to the frontend directory:**
    ```bash
    cd finance-dashboard-frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure environment variables (if applicable):**
    *   The frontend will typically connect to the backend API. Check `src/environments/environment.ts` and `src/environments/environment.prod.ts` for API endpoint configurations. Ensure the `apiUrl` points to your running backend server (e.g., `http://localhost:3000/api`).

4.  **Start the frontend development server:**
    ```bash
    ng serve
    ```
    The frontend application will typically be accessible at `http://localhost:4200`.

### Using the Application

Once both the backend and frontend servers are running:

1.  **Open your web browser** and navigate to the frontend URL (usually `http://localhost:4200`).
2.  **Register a new account** or log in if you already have one.
3.  **Explore the dashboard:** Get an overview of your financial status.
4.  **Add Transactions:** Navigate to the transactions section to log your income and expenses. Categorize them appropriately.
5.  **Create Budgets:** Go to the budgeting section to set spending limits for different categories.
6.  **Set Financial Goals:** Define your financial objectives and track your progress.
7.  **View Reports:** Analyze your spending patterns and financial health through various reports.

Further details on specific features can be explored within the application's interface.
