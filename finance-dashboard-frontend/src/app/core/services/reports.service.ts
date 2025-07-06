import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface ReportConfig {
  reportType: 'income' | 'expense' | 'savings' | 'networth' | 'comprehensive' | 'spending' | 'budget' | 'goals';
  startDate: Date;
  endDate: Date;
  categories?: string[];
  includeCharts: boolean;
  includeTransactions: boolean;
  groupBy: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface ReportData {
  id: string;
  title: string;
  type: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    transactionCount: number;
  };  chartData: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string;
    }[];
  };
  categoryBreakdown: {
    category: string;
    amount: number;
    percentage: number;
    color: string;
  }[];
  transactions?: {
    id: string;
    date: string;
    description: string;
    category: string;
    amount: number;
    type: 'income' | 'expense';
  }[];
  generatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {

  constructor() { }
  generateReport(config: ReportConfig): Observable<ReportData> {
    // Mock data generation based on report type
    const dateRange = {
      startDate: config.startDate.toISOString(),
      endDate: config.endDate.toISOString()
    };

    const reportData: ReportData = {
      id: `report_${Date.now()}`,
      title: this.getReportTitle(config.reportType, dateRange),
      type: config.reportType,
      dateRange: dateRange,
      summary: this.generateSummary(config),
      chartData: this.generateChartData(config),
      categoryBreakdown: this.generateCategoryBreakdown(config),
      transactions: config.includeTransactions ? this.generateTransactionsList(config) : undefined,
      generatedAt: new Date().toISOString()
    };

    return of(reportData).pipe(delay(1000));
  }

  getAvailableReportTypes(): Observable<{ value: string; label: string; description: string }[]> {
    const reportTypes = [
      {
        value: 'income',
        label: 'Income Report',
        description: 'Detailed breakdown of income sources and trends'
      },
      {
        value: 'expense',
        label: 'Expense Report',
        description: 'Analysis of spending patterns and categories'
      },
      {
        value: 'savings',
        label: 'Savings Report',
        description: 'Savings rate and goal progress tracking'
      },
      {
        value: 'networth',
        label: 'Net Worth Report',
        description: 'Assets, liabilities, and net worth trends'
      },
      {
        value: 'comprehensive',
        label: 'Comprehensive Report',
        description: 'Complete financial overview with all metrics'
      }
    ];

    return of(reportTypes).pipe(delay(200));
  }
  exportReport(reportData: ReportData, format: 'pdf' | 'csv' | 'excel'): Observable<Blob> {
    // Mock export functionality
    const mockData = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json'
    });
    
    return of(mockData).pipe(delay(500));
  }

  getRecentReports(): Observable<ReportData[]> {
    // Mock recent reports data
    const recentReports: ReportData[] = [
      {
        id: 'report_1',
        title: 'Monthly Spending Analysis',
        type: 'expense',
        dateRange: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        },
        summary: {
          totalIncome: 5000,
          totalExpenses: 3250,
          netSavings: 1750,
          transactionCount: 45
        },
        chartData: { labels: [], datasets: [] },
        categoryBreakdown: [],
        generatedAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      },
      {
        id: 'report_2',
        title: 'Income vs Expenses',
        type: 'comprehensive',
        dateRange: {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        },
        summary: {
          totalIncome: 1250,
          totalExpenses: 800,
          netSavings: 450,
          transactionCount: 12
        },
        chartData: { labels: [], datasets: [] },
        categoryBreakdown: [],
        generatedAt: new Date(Date.now() - 172800000).toISOString() // 2 days ago
      }
    ];

    return of(recentReports).pipe(delay(300));
  }

  private getReportTitle(type: string, dateRange: { startDate: string; endDate: string }): string {
    const startDate = new Date(dateRange.startDate).toLocaleDateString();
    const endDate = new Date(dateRange.endDate).toLocaleDateString();
    
    const typeLabels: { [key: string]: string } = {
      'income': 'Income Report',
      'expense': 'Expense Report',
      'savings': 'Savings Report',
      'networth': 'Net Worth Report',
      'comprehensive': 'Comprehensive Financial Report'
    };

    return `${typeLabels[type]} (${startDate} - ${endDate})`;
  }

  private generateSummary(config: ReportConfig): ReportData['summary'] {
    // Mock summary data
    return {
      totalIncome: Math.floor(Math.random() * 10000) + 5000,
      totalExpenses: Math.floor(Math.random() * 8000) + 3000,
      netSavings: 2000,
      transactionCount: Math.floor(Math.random() * 100) + 50
    };
  }
  private generateChartData(config: ReportConfig): ReportData['chartData'] {
    const dateRange = {
      startDate: config.startDate.toISOString(),
      endDate: config.endDate.toISOString()
    };
    const labels = this.generateDateLabels(dateRange, config.groupBy);
    
    if (config.reportType === 'income') {
      return {
        labels,
        datasets: [{
          label: 'Income',
          data: labels.map(() => Math.floor(Math.random() * 3000) + 2000),
          borderColor: '#4caf50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)'
        }]
      };
    } else if (config.reportType === 'expense' || config.reportType === 'spending') {
      return {
        labels: ['Food', 'Transportation', 'Entertainment', 'Bills', 'Shopping', 'Other'],
        datasets: [{
          label: 'Expenses by Category',
          data: [800, 400, 300, 1200, 600, 200],
          backgroundColor: [
            '#ff6384',
            '#36a2eb',
            '#ffce56',
            '#4bc0c0',
            '#9966ff',
            '#ff9f40'
          ]
        }]
      };
    } else {
      return {
        labels,
        datasets: [
          {
            label: 'Income',
            data: labels.map(() => Math.floor(Math.random() * 3000) + 2000),
            borderColor: '#4caf50'
          },
          {
            label: 'Expenses',
            data: labels.map(() => Math.floor(Math.random() * 2500) + 1500),
            borderColor: '#f44336'
          }
        ]
      };
    }
  }

  private generateCategoryBreakdown(config: ReportConfig): ReportData['categoryBreakdown'] {
    const categories = [
      { category: 'Food & Dining', amount: 800, color: '#ff6384' },
      { category: 'Transportation', amount: 400, color: '#36a2eb' },
      { category: 'Bills & Utilities', amount: 1200, color: '#ffce56' },
      { category: 'Entertainment', amount: 300, color: '#4bc0c0' },
      { category: 'Shopping', amount: 600, color: '#9966ff' },
      { category: 'Other', amount: 200, color: '#ff9f40' }
    ];

    const total = categories.reduce((sum, cat) => sum + cat.amount, 0);

    return categories.map(cat => ({
      ...cat,
      percentage: Math.round((cat.amount / total) * 100)
    }));
  }
  private generateTransactionsList(config: ReportConfig): ReportData['transactions'] {
    const transactions = [];
    const categories = ['Food', 'Transportation', 'Bills', 'Entertainment', 'Shopping', 'Salary', 'Freelance'];
    
    const startDate = config.startDate.toISOString();
    const endDate = config.endDate.toISOString();
    
    for (let i = 0; i < 20; i++) {
      const isIncome = Math.random() > 0.7;
      const category = categories[Math.floor(Math.random() * categories.length)];
      
      transactions.push({
        id: `txn_${i + 1}`,
        date: this.getRandomDateInRange(startDate, endDate),
        description: `${category} ${isIncome ? 'Payment' : 'Purchase'}`,
        category,
        amount: Math.floor(Math.random() * 500) + 50,
        type: isIncome ? 'income' as const : 'expense' as const
      });
    }

    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private generateDateLabels(dateRange: { startDate: string; endDate: string }, groupBy: string): string[] {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const labels = [];

    const current = new Date(start);
    
    while (current <= end) {
      if (groupBy === 'daily') {
        labels.push(current.toLocaleDateString());
        current.setDate(current.getDate() + 1);
      } else if (groupBy === 'weekly') {
        labels.push(`Week of ${current.toLocaleDateString()}`);
        current.setDate(current.getDate() + 7);
      } else if (groupBy === 'monthly') {
        labels.push(current.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }));
        current.setMonth(current.getMonth() + 1);
      } else if (groupBy === 'yearly') {
        labels.push(current.getFullYear().toString());
        current.setFullYear(current.getFullYear() + 1);
      }

      if (labels.length > 12) break; // Limit to reasonable number of labels
    }

    return labels;
  }

  private getRandomDateInRange(startDate: string, endDate: string): string {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const randomTime = start + Math.random() * (end - start);
    return new Date(randomTime).toISOString();
  }
}
