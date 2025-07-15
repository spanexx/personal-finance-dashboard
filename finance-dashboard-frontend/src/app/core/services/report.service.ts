import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PaginationParams, FilterParams, PaginatedResponse } from './api.service';
import { ApiResponse } from './http-client.service';

export interface FinancialReport {
  id: string;
  userId: string;
  name: string;
  type: 'income' | 'expense' | 'budget' | 'goal' | 'net_worth' | 'cash_flow' | 'tax' | 'investment';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  startDate: string;
  endDate: string;
  status: 'generating' | 'completed' | 'failed';
  format: 'pdf' | 'excel' | 'csv' | 'json';
  fileUrl?: string;
  data: any;
  metadata: {
    totalRecords: number;
    generationTime: number;
    fileSize?: number;
    categories?: string[];
    accounts?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ReportFilters extends FilterParams {
  type?: 'income' | 'expense' | 'budget' | 'goal' | 'net_worth' | 'cash_flow' | 'tax' | 'investment';
  period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  status?: 'generating' | 'completed' | 'failed';
  format?: 'pdf' | 'excel' | 'csv' | 'json';
}

export interface GenerateReportRequest {
  name: string;
  type: 'income' | 'expense' | 'budget' | 'goal' | 'net_worth' | 'cash_flow' | 'tax' | 'investment';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  startDate: string;
  endDate: string;
  format: 'pdf' | 'excel' | 'csv' | 'json';
  options?: {
    includeCharts?: boolean;
    includeTransactionDetails?: boolean;
    includeBudgetComparisons?: boolean;
    includeGoalProgress?: boolean;
    groupBy?: 'category' | 'account' | 'date' | 'merchant';
    categories?: string[];
    accounts?: string[];
    currency?: string;
  };
}

export interface SpendingAnalysis {
  period: string;
  totalSpending: number;
  averageDaily: number;
  averageMonthly: number;
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
    transactionCount: number;
    averageTransaction: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    monthlyData: { month: string; amount: number }[];
  }[];
  merchantAnalysis: {
    merchant: string;
    amount: number;
    transactionCount: number;
    percentage: number;
    firstTransaction: string;
    lastTransaction: string;
  }[];
  spendingPatterns: {
    dayOfWeek: { day: string; amount: number; count: number }[];
    timeOfDay: { hour: number; amount: number; count: number }[];
    monthlyTrends: { month: string; amount: number; change: number }[];
  };
  insights: {
    highestSpendingDay: { date: string; amount: number };
    mostFrequentCategory: { name: string; count: number };
    largestTransaction: { amount: number; description: string; date: string };
    unusualSpending: {
      date: string;
      amount: number;
      category: string;
      reason: string;
    }[];
  };
}

export interface IncomeAnalysis {
  period: string;
  totalIncome: number;
  averageMonthly: number;
  sourceBreakdown: {
    source: string;
    amount: number;
    percentage: number;
    frequency: string;
    reliability: 'stable' | 'variable' | 'irregular';
    monthlyData: { month: string; amount: number }[];
  }[];
  incomeStability: {
    coefficient: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    trend: 'increasing' | 'decreasing' | 'stable';
    predictability: number;
  };
  growthAnalysis: {
    yearOverYear: number;
    monthOverMonth: number;
    projection: {
      nextMonth: number;
      nextQuarter: number;
      nextYear: number;
      confidence: number;
    };
  };
  insights: {
    highestIncomeMonth: { month: string; amount: number };
    mostReliableSource: { name: string; reliability: number };
    seasonalPatterns: {
      season: string;
      averageIncome: number;
      change: number;
    }[];
  };
}

/**
 * Report Service
 * Handles all reporting and analytics API operations
 */
@Injectable({
  providedIn: 'root'
})
export class ReportService extends ApiService {
  private readonly endpoint = 'reports';

  /**
   * Get all reports with filtering and pagination
   */
  getReports(
    filters?: ReportFilters,
    pagination?: PaginationParams
  ): Observable<PaginatedResponse<FinancialReport>> {
    const params = { ...filters, ...pagination };
    return this.get<FinancialReport[]>(this.endpoint, params) as Observable<PaginatedResponse<FinancialReport>>;
  }

  /**
   * Get a single report by ID
   */
  getReport(id: string): Observable<FinancialReport> {
    return this.extractData(
      this.get<FinancialReport>(`${this.endpoint}/${id}`)
    );
  }

  /**
   * Generate a new report
   */
  generateReport(data: GenerateReportRequest): Observable<FinancialReport> {
    return this.extractData(
      this.post<FinancialReport>(`${this.endpoint}/generate`, data)
    );
  }

  /**
   * Delete a report
   */
  deleteReport(id: string): Observable<void> {
    return this.extractData(
      this.delete<void>(`${this.endpoint}/${id}`)
    );
  }

  /**
   * Download file helper (copied from ApiService for Blob downloads)
   */
  private download(endpoint: string, filename?: string, options: any = {}): Observable<Blob> {
    // @ts-ignore
    return (this['httpClient'].download(endpoint, filename, options) as Observable<Blob>);
  }

  /**
   * Export report in specified format
   */
  exportReport(reportId: string, format: 'pdf' | 'excel' | 'csv'): Observable<Blob> {
    return this.download(`${this.endpoint}/${reportId}/export/${format}`);
  }

  /**
   * Export analytics data
   */
  exportAnalyticsData(type: string, params: any): Observable<Blob> {
    return this.extractData(
      this.post<Blob>(`${this.endpoint}/export`, { type, ...params }, {
        responseType: 'blob'
      })
    );
  }

  /**
   * Get spending analysis
   */
  getSpendingAnalysis(params: {
    startDate: string;
    endDate: string;
    categories?: string[];
    accounts?: string[];
    groupBy?: 'category' | 'merchant' | 'date';
  }): Observable<SpendingAnalysis> {
    console.log('🔍 [FRONTEND-REPORT] ReportService.getSpendingAnalysis called:', {
      params,
      endpoint: `${this.endpoint}/spending-analysis`,
      paramsType: typeof params,
      paramsKeys: params ? Object.keys(params) : 'no params'
    });
    
    return this.extractData(
      this.get<SpendingAnalysis>(`${this.endpoint}/spending-analysis`, params)
    );
  }

  /**
   * Get income analysis
   */
  getIncomeAnalysis(params: {
    startDate: string;
    endDate: string;
    sources?: string[];
    accounts?: string[];
    includeProjections?: boolean;
  }): Observable<IncomeAnalysis> {
    console.log('🔍 [FRONTEND-REPORT] ReportService.getIncomeAnalysis called:', {
      params,
      endpoint: `${this.endpoint}/income`,
      paramsType: typeof params,
      paramsKeys: params ? Object.keys(params) : 'no params'
    });
    
    return this.extractData(
      this.get<IncomeAnalysis>(`${this.endpoint}/income`, params)
    );
  }

  /**
   * Get financial dashboard summary
   */
  getDashboardSummary(period?: 'week' | 'monthly' | 'quarterly' | 'yearly' | 'all'): Observable<{
    monthlyIncome: number;
    monthlyExpenses: number;
    netWorth: number;
    savingsRate: number;
    budgetUtilization: number;
    goalProgress: number;
    topExpenseCategories: {
      categoryName: string;
      totalAmount: number;
      percentage: number;
    }[];
    recentTrends: any[];
  }> {
    // Note: Using the endpoint name that matches the backend controller method name
    return this.extractData(
      this.get<any>(`${this.endpoint}/dashboard-summary`, { period })
    );
  }

  /**
   * Get recent reports for the current user
   * @param limit Number of reports to fetch (default 5)
   */
  getRecentReports(limit: number = 5): Observable<FinancialReport[]> {
    return this.extractData(
      this.get<FinancialReport[]>(`${this.endpoint}/recent`, { limit })
    );
  }

  /**
   * Get cashflow chart data
   */
  getCashflowChartData(): Observable<any> {
    return this.extractData(
      this.get<any>('/cashflow/chart')
    );
  }
}
