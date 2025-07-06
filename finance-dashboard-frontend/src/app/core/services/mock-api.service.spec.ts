import { TestBed } from '@angular/core/testing';
import { MockApiService } from './mock-api.service';

describe('MockApiService', () => {
  let service: MockApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MockApiService]
    });
    service = TestBed.inject(MockApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('User Authentication', () => {
    it('should login with valid credentials', (done) => {
      service.login('john.doe@example.com', 'password123').subscribe({
        next: (response) => {
          expect(response.user).toBeDefined();
          expect(response.tokens).toBeDefined();
          expect(response.user.email).toBe('john.doe@example.com');
          expect(response.tokens.accessToken).toContain('mock-access-token');
          done();
        }
      });
    });

    it('should reject login with invalid credentials', (done) => {
      service.login('invalid@example.com', 'wrongpassword').subscribe({
        error: (error) => {
          expect(error.message).toBe('Invalid email or password');
          done();
        }
      });
    });

    it('should register new user successfully', (done) => {
      const userData = {
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User'
      };

      service.register(userData, 'password123').subscribe({
        next: (response) => {
          expect(response.user).toBeDefined();
          expect(response.tokens).toBeDefined();
          expect(response.user.email).toBe(userData.email);
          expect(response.user.firstName).toBe(userData.firstName);
          done();
        }
      });
    });

    it('should reject registration with existing email', (done) => {
      const userData = {
        email: 'john.doe@example.com', // Existing user
        firstName: 'Test',
        lastName: 'User'
      };

      service.register(userData, 'password123').subscribe({
        error: (error) => {
          expect(error.message).toBe('Email is already registered');
          done();
        }
      });
    });

    it('should request password reset for existing email', (done) => {
      service.requestPasswordReset('john.doe@example.com').subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          done();
        }
      });
    });

    it('should reject password reset for non-existing email', (done) => {
      service.requestPasswordReset('nonexistent@example.com').subscribe({
        error: (error) => {
          expect(error.message).toBe('Email not found');
          done();
        }
      });
    });

    it('should reset password with valid token', (done) => {
      service.resetPassword('valid-reset-token-123', 'newpassword123').subscribe({
        next: (response) => {
          expect(response.success).toBeTrue();
          done();
        }
      });
    });

    it('should reject password reset with invalid token', (done) => {
      service.resetPassword('invalid', 'newpassword123').subscribe({
        error: (error) => {
          expect(error.message).toBe('Invalid or expired token');
          done();
        }
      });
    });
  });

  describe('User Profile', () => {
    it('should get current user', (done) => {
      service.getCurrentUser().subscribe({
        next: (user) => {
          expect(user).toBeDefined();
          expect(user.email).toBeDefined();
          expect(user.firstName).toBeDefined();
          done();
        }
      });
    });

    it('should update user profile', (done) => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      service.updateUserProfile(updateData).subscribe({
        next: (user) => {
          expect(user.firstName).toBe('Updated');
          expect(user.lastName).toBe('Name');
          expect(user.updatedAt).toBeDefined();
          done();
        }
      });
    });
  });

  describe('Categories', () => {
    it('should get all categories', (done) => {
      service.getCategories().subscribe({        next: (categories) => {
          expect(categories).toBeInstanceOf(Array);
          expect(categories.length).toBeGreaterThan(0);
          expect(categories[0].id).toBeDefined();
          expect(categories[0].name).toBeDefined();
          expect(categories[0].type).toBeDefined();
          done();
        }
      });
    });

    it('should filter categories by type', (done) => {
      service.getCategories('expense').subscribe({
        next: (categories) => {
          expect(categories).toBeInstanceOf(Array);
          categories.forEach(category => {
            expect(category.type).toBe('expense');
          });
          done();
        }
      });
    });
  });

  describe('Transactions', () => {
    it('should get all transactions', (done) => {
      service.getTransactions().subscribe({
        next: (response) => {
          expect(response.data).toBeInstanceOf(Array);
          expect(response.pagination).toBeDefined();
          expect(response.data.length).toBeGreaterThan(0);
          done();
        }
      });
    });

    it('should filter transactions by type', (done) => {
      service.getTransactions({ type: 'expense' }).subscribe({
        next: (response) => {
          expect(response.data).toBeInstanceOf(Array);
          response.data.forEach((transaction: any) => {
            expect(transaction.type).toBe('expense');
          });
          done();
        }
      });
    });

    it('should filter transactions by date range', (done) => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      service.getTransactions({ startDate, endDate }).subscribe({
        next: (response) => {
          expect(response.data).toBeInstanceOf(Array);
          response.data.forEach((transaction: any) => {
            const txDate = new Date(transaction.date);
            expect(txDate >= new Date(startDate)).toBeTrue();
            expect(txDate <= new Date(endDate)).toBeTrue();
          });
          done();
        }
      });
    });

    it('should search transactions by description', (done) => {
      service.getTransactions({ search: 'Grocery' }).subscribe({
        next: (response) => {
          expect(response.data).toBeInstanceOf(Array);
          response.data.forEach((transaction: any) => {
            const searchTermFound = 
              transaction.description.toLowerCase().includes('grocery') ||
              (transaction.payee && transaction.payee.toLowerCase().includes('grocery')) ||
              (transaction.notes && transaction.notes.toLowerCase().includes('grocery'));
            expect(searchTermFound).toBeTrue();
          });
          done();
        }
      });
    });

    it('should get specific transaction by id', (done) => {
      service.getTransaction('tx1').subscribe({
        next: (transaction) => {
          expect(transaction).toBeDefined();
          expect(transaction.id).toBe('tx1');
          done();
        }
      });
    });

    it('should handle non-existent transaction', (done) => {
      service.getTransaction('nonexistent').subscribe({
        error: (error) => {
          expect(error.message).toBe('Transaction not found');
          done();
        }
      });
    });
  });

  describe('Budgets', () => {
    it('should get all budgets', (done) => {
      service.getBudgets().subscribe({
        next: (response) => {
          expect(response.data).toBeInstanceOf(Array);
          expect(response.data.length).toBeGreaterThan(0);
          done();
        }
      });
    });

    it('should filter budgets by active status', (done) => {
      service.getBudgets({ isActive: true }).subscribe({
        next: (response) => {
          expect(response.data).toBeInstanceOf(Array);
          response.data.forEach((budget: any) => {
            expect(budget.isActive).toBeTrue();
          });
          done();
        }
      });
    });

    it('should get specific budget by id', (done) => {
      service.getBudget('budget1').subscribe({
        next: (budget) => {
          expect(budget).toBeDefined();
          expect(budget.id).toBe('budget1');
          done();
        }
      });
    });
  });

  describe('Goals', () => {
    it('should get all goals', (done) => {
      service.getGoals().subscribe({
        next: (response) => {
          expect(response.data).toBeInstanceOf(Array);
          expect(response.data.length).toBeGreaterThan(0);
          done();
        }
      });
    });

    it('should filter goals by status', (done) => {
      service.getGoals({ status: 'active' }).subscribe({
        next: (response) => {
          expect(response.data).toBeInstanceOf(Array);
          response.data.forEach((goal: any) => {
            expect(goal.status).toBe('active');
          });
          done();
        }
      });
    });

    it('should filter goals by priority', (done) => {
      service.getGoals({ priority: 'high' }).subscribe({
        next: (response) => {
          expect(response.data).toBeInstanceOf(Array);
          response.data.forEach((goal: any) => {
            expect(goal.priority).toBe('high');
          });
          done();
        }
      });
    });

    it('should get specific goal by id', (done) => {
      service.getGoal('goal1').subscribe({
        next: (goal) => {
          expect(goal).toBeDefined();
          expect(goal.id).toBe('goal1');
          done();
        }
      });
    });
  });

  describe('Reports', () => {
    it('should get all reports', (done) => {
      service.getReports().subscribe({
        next: (reports) => {
          expect(reports).toBeInstanceOf(Array);
          expect(reports.length).toBeGreaterThan(0);
          done();
        }
      });
    });

    it('should get report results by id', (done) => {
      service.getReportResults('report1').subscribe({
        next: (response) => {
          expect(response.report).toBeDefined();
          expect(response.results).toBeDefined();
          done();
        }
      });
    });

    it('should handle non-existent report', (done) => {
      service.getReportResults('nonexistent').subscribe({
        error: (error) => {
          expect(error.message).toBe('Report not found');
          done();
        }
      });
    });
  });

  describe('Dashboard Data', () => {
    it('should get comprehensive dashboard data', (done) => {
      service.getDashboardData().subscribe({
        next: (data) => {
          expect(data.financialSummary).toBeDefined();
          expect(data.recentTransactions).toBeDefined();
          expect(data.goals).toBeDefined();
          expect(data.spendingByCategory).toBeDefined();
          expect(data.incomeVsExpenses).toBeDefined();
          
          // Check financial summary structure
          expect(data.financialSummary.totalIncome).toBeInstanceOf(Number);
          expect(data.financialSummary.totalExpenses).toBeInstanceOf(Number);
          expect(data.financialSummary.netSavings).toBeInstanceOf(Number);
          expect(data.financialSummary.savingsRate).toBeInstanceOf(Number);
          
          // Check recent transactions
          expect(data.recentTransactions).toBeInstanceOf(Array);
          expect(data.recentTransactions.length).toBeLessThanOrEqual(5);
          
          // Check goals
          expect(data.goals).toBeInstanceOf(Array);
          
          done();
        }
      });
    });

    it('should calculate financial metrics correctly', (done) => {
      service.getDashboardData().subscribe({
        next: (data) => {
          const { totalIncome, totalExpenses, netSavings, savingsRate } = data.financialSummary;
          
          // Net savings should equal income minus expenses
          expect(netSavings).toBe(totalIncome - totalExpenses);
          
          // Savings rate should be calculated correctly
          if (totalIncome > 0) {
            expect(savingsRate).toBe((netSavings / totalIncome) * 100);
          } else {
            expect(savingsRate).toBe(0);
          }
          
          done();
        }
      });
    });
  });

  describe('Response Timing', () => {
    it('should simulate network delay', (done) => {
      const startTime = Date.now();
      
      service.getCurrentUser().subscribe({
        next: () => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Should take at least the simulated delay (500ms)
          expect(duration).toBeGreaterThanOrEqual(490); // Allow for small timing variations
          done();
        }
      });
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent data across multiple calls', (done) => {
      let firstResponse: any;
      
      service.getCurrentUser().subscribe({
        next: (user) => {
          firstResponse = user;
          
          service.getCurrentUser().subscribe({
            next: (secondUser) => {
              expect(secondUser).toEqual(firstResponse);
              done();
            }
          });
        }
      });
    });

    it('should maintain data relationships', (done) => {
      service.getDashboardData().subscribe({
        next: (data) => {
          // Check that recent transactions are sorted by date (descending)
          const transactions = data.recentTransactions;
          for (let i = 1; i < transactions.length; i++) {
            const currentDate = new Date(transactions[i].date);
            const previousDate = new Date(transactions[i - 1].date);
            expect(currentDate <= previousDate).toBeTrue();
          }
          
          // Check that active goals are included
          data.goals.forEach((goal: any) => {
            expect(goal.status).toBe('active');
          });
          
          done();
        }
      });
    });
  });
});
