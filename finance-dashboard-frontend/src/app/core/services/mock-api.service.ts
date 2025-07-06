import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

// Import mock data
import usersData from '../../data/users.json';
import categoriesData from '../../data/categories.json';
import transactionsData from '../../data/transactions.json';
import budgetsData from '../../data/budgets.json';
import goalsData from '../../data/goals.json';
import reportsData from '../../data/reports.json';

/**
 * Mock API service to simulate backend API calls
 * This will be replaced with real HTTP calls when the backend is ready
 */
@Injectable({
  providedIn: 'root'
})
export class MockApiService {
  // Simulate network delay
  private delay = 500;

  constructor() { }
  // User related methods
  getCurrentUser(): Observable<any> {
    return of(usersData.data[0]).pipe(delay(this.delay));
  }

  login(email: string, password: string): Observable<any> {
    const validCredentials = usersData.auth.validCredentials;
    const user = validCredentials.find(cred => cred.email === email && cred.password === password);

    if (user) {
      const userData = usersData.data.find(u => u.email === email);
      if (!userData) { // Handle case where user data is not found (shouldn't happen with validCredentials check, but good practice)
        return new Observable(observer => {
          setTimeout(() => {
            observer.error({ message: 'User data not found' });
          }, this.delay);
        });
      }
      const tokens = (usersData.auth.tokens as any)[userData.id]; // Cast to any to allow string indexing
      return of({ user: userData, tokens }).pipe(delay(this.delay));
    }

    // Simulate login failure
    return new Observable(observer => {
      setTimeout(() => {
        observer.error({ message: 'Invalid email or password' });
      }, this.delay);
    });
  }
  register(userData: Partial<any>, password: string): Observable<any> {
    // Simulate user registration
    // First check if email already exists
    const existingUser = usersData.data.find(u => u.email === userData['email']);
    if (existingUser) {
      return new Observable(observer => {
        setTimeout(() => {
          observer.error({ message: 'Email is already registered' });
        }, this.delay);
      });
    }

    // Create new user
    const newUser = {
      id: `user${usersData.data.length + 1}`,
      email: userData['email'],
      firstName: userData['firstName'] || '',
      lastName: userData['lastName'] || '',
      profileImage: userData['profileImage'] || 'https://randomuser.me/api/portraits/lego/1.jpg',
      settings: {
        currency: userData['settings']?.currency || 'USD',
        language: userData['settings']?.language || 'en',
        theme: userData['settings']?.theme || 'light',
        notificationPreferences: {
          email: true,
          push: true,
          budgetAlerts: true,
          goalReminders: true
        }
      },
      isVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Create auth tokens for the new user
    const tokens = {
      accessToken: `mock-access-token-${newUser.id}`,
      refreshToken: `mock-refresh-token-${newUser.id}`
    };

    // Return new user and tokens
    return of({ user: newUser, tokens }).pipe(delay(this.delay));
  }

  requestPasswordReset(email: string): Observable<any> {
    // Check if email exists
    const user = usersData.data.find(u => u.email === email);
    if (!user) {
      return new Observable(observer => {
        setTimeout(() => {
          observer.error({ message: 'Email not found' });
        }, this.delay);
      });
    }

    // Simulate sending reset email
    return of({ success: true }).pipe(delay(this.delay));
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    // Validate token (in a real app, would verify token against stored token)
    if (!token || token.length < 10) {
      return new Observable(observer => {
        setTimeout(() => {
          observer.error({ message: 'Invalid or expired token' });
        }, this.delay);
      });
    }

    // Simulate password reset
    return of({ success: true }).pipe(delay(this.delay));
  }

  updateUserProfile(userData: Partial<any>): Observable<any> {
    // In a real app, would update user in database
    // Here we just return the updated user data
    const currentUser = usersData.data[0];
    const updatedUser = { ...currentUser, ...userData, updatedAt: new Date().toISOString() };
    
    return of(updatedUser).pipe(delay(this.delay));
  }
  
  // Category related methods
  getCategories(type?: string): Observable<any[]> {
    let categories = categoriesData.data;
    
    if (type) {
      categories = categories.filter(cat => cat.type === type);
    }
    
    return of(categories).pipe(delay(this.delay));
  }
  // Transaction related methods
  getTransactions(filters?: any): Observable<any> {
    let transactions = transactionsData.data;
    
    // Apply filters if provided
    if (filters) {
      if (filters.type) {
        transactions = transactions.filter(tx => tx.type === filters.type);
      }
      
      if (filters.category) {
        transactions = transactions.filter(tx => tx.category === filters.category);
      }
      
      if (filters.startDate && filters.endDate) {
        transactions = transactions.filter(tx => {
          const txDate = new Date(tx.date);
          const start = new Date(filters.startDate);
          const end = new Date(filters.endDate);
          return txDate >= start && txDate <= end;
        });
      }

      if (filters.search) {
        const search = filters.search.toLowerCase();
        transactions = transactions.filter(tx => 
          tx.description.toLowerCase().includes(search) || 
          tx.payee?.toLowerCase().includes(search) ||
          tx.notes?.toLowerCase().includes(search)
        );
      }
    }
    
    // Sort by date descending by default
    transactions = [...transactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return of({
      data: transactions,
      pagination: {
        total: transactions.length,
        page: 1,
        limit: 10,
        pages: Math.ceil(transactions.length / 10)
      }
    }).pipe(delay(this.delay));
  }

  getTransaction(id: string): Observable<any> {
    const transaction = transactionsData.data.find(tx => tx.id === id);
    
    if (transaction) {
      return of(transaction).pipe(delay(this.delay));
    }
    
    return new Observable(observer => {
      setTimeout(() => {
        observer.error({ message: 'Transaction not found' });
      }, this.delay);
    });
  }
  // Budget related methods
  getBudgets(filters?: any): Observable<any> {
    let budgets = budgetsData.data;
    
    // Apply filters if provided
    if (filters) {
      if (filters.isActive !== undefined) {
        budgets = budgets.filter(budget => budget.isActive === filters.isActive);
      }
      
      if (filters.startDate) {
        budgets = budgets.filter(budget => {
          const budgetStart = new Date(budget.startDate);
          const filterStart = new Date(filters.startDate);
          return budgetStart >= filterStart;
        });
      }
    }
    
    return of({ data: budgets }).pipe(delay(this.delay));
  }

  getBudget(id: string): Observable<any> {
    const budget = budgetsData.data.find(b => b.id === id);
    
    if (budget) {
      return of(budget).pipe(delay(this.delay));
    }
    
    return new Observable(observer => {
      setTimeout(() => {
        observer.error({ message: 'Budget not found' });
      }, this.delay);
    });
  }
  // Goal related methods
  getGoals(filters?: any): Observable<any> {
    let goals = goalsData.data;
    
    // Apply filters if provided
    if (filters) {
      if (filters.status) {
        goals = goals.filter(goal => goal.status === filters.status);
      }
      
      if (filters.priority) {
        goals = goals.filter(goal => goal.priority === filters.priority);
      }
    }
    
    return of({ data: goals }).pipe(delay(this.delay));
  }

  getGoal(id: string): Observable<any> {
    const goal = goalsData.data.find(g => g.id === id);
    
    if (goal) {
      return of(goal).pipe(delay(this.delay));
    }
    
    return new Observable(observer => {
      setTimeout(() => {
        observer.error({ message: 'Goal not found' });
      }, this.delay);
    });
  }

  // Report related methods
  getReports(): Observable<any[]> {
    return of(reportsData.data).pipe(delay(this.delay));
  }

  getReportResults(reportId: string): Observable<any> {
    const report = reportsData.data.find(r => r.id === reportId);
    
    if (report) {
      const reportType = report.type;
      const results = (reportsData.reportResults as any)[reportType]; // Cast to any to allow string indexing

      return of({
        report,
        results
      }).pipe(delay(this.delay));
    }
    
    return new Observable(observer => {
      setTimeout(() => {
        observer.error({ message: 'Report not found' });
      }, this.delay);
    });
  }

  // Dashboard data
  getDashboardData(): Observable<any> {
    // Construct dashboard data from various sources
    const currentMonthBudget = budgetsData.data.find(b => b.isActive);
    const recentTransactions = [...transactionsData.data]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    const goals = goalsData.data.filter(g => g.status === 'active');
    
    // Calculate monthly income and expenses
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const transactions = transactionsData.data.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    });
    
    const income = transactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const expenses = transactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    // Get spending by category for pie chart
    const spendingByCategory = reportsData.reportResults.spending.spendingByCategory;
    
    // Get income vs expenses for bar chart
    const incomeVsExpenses = reportsData.reportResults.cashflow.cashflowByPeriod.slice(-3);
    
    return of({
      financialSummary: {
        totalIncome: income,
        totalExpenses: expenses,
        netSavings: income - expenses,
        savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0
      },
      recentTransactions,
      budgetProgress: currentMonthBudget ? {
        total: currentMonthBudget.amount,
        spent: currentMonthBudget.totalSpent,
        remaining: currentMonthBudget.totalRemaining,
        categories: currentMonthBudget.categories
      } : null,
      goals,
      spendingByCategory,
      incomeVsExpenses
    }).pipe(delay(this.delay));
  }
}
