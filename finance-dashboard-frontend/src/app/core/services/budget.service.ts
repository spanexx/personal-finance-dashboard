import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService, PaginationParams, FilterParams, PaginatedResponse } from './api.service';
import { ApiResponse } from './http-client.service';
import {
  Budget,
  CreateBudgetRequest,
  UpdateBudgetRequest,
  BudgetTemplate,
  BudgetAnalysis,
  BudgetComparison,
  CategoryAllocation,
  AlertSettings,
  RolloverSettings,
  BudgetRecommendation,
  OptimizationRecommendations,
  BudgetPerformanceMetrics,
  BudgetHealthScore,
  CategoryOptimization,
  SpendingPattern,
  AnomalyDetection,
  SavingsOpportunity,
  ScenarioAnalysis,
  EducationalContent,
  PersonalizedInsight,
  BudgetOptimizationAnalysis,
  ScenarioInput,
  ScenarioResult,
  FinancialGoal,
  GoalBasedBudgetSuggestion,
  MLInsight
} from '../../shared/models';

// Re-export interfaces for easier component imports
export type {
  BudgetHealthScore,
  OptimizationRecommendations,
  BudgetPerformanceMetrics,
  CategoryOptimization,
  SpendingPattern,
  AnomalyDetection,
  SavingsOpportunity,
  ScenarioAnalysis,
  EducationalContent,
  PersonalizedInsight,
  BudgetOptimizationAnalysis,
  ScenarioInput,
  ScenarioResult,
  FinancialGoal,
  GoalBasedBudgetSuggestion,
  MLInsight
};

export interface BudgetFilters extends FilterParams {
  period?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  status?: 'active' | 'inactive' | 'exceeded' | 'completed';
  isRecurring?: boolean;
  tags?: string[];
  categoryId?: string;
  isOverBudget?: boolean;
}



export interface BudgetAlert {
  id: string;
  budgetId: string;
  type: 'threshold_exceeded' | 'overspending' | 'underspending' | 'category_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  threshold?: number;
  actualAmount?: number;
  categoryId?: string;
  isRead: boolean;
  createdAt: string;
}



/**
 * Budget Service
 * Handles all budget-related API operations
 */
@Injectable({
  providedIn: 'root'
})
export class BudgetService extends ApiService {
  private readonly endpoint = 'budgets';

  /**
   * Get all budgets with filtering and pagination
   */  getBudgets(
    filters?: BudgetFilters,
    pagination?: PaginationParams
  ): Observable<PaginatedResponse<Budget>> {
    const params = { ...filters, ...pagination };
    return this.get<Budget[]>(this.endpoint, params) as Observable<PaginatedResponse<Budget>>;
  }

  /**
   * Get a single budget by ID
   */
  getBudget(id: string): Observable<Budget> {
    return this.extractData(
      this.get<Budget>(`${this.endpoint}/${id}`)
    );
  }

  /**
   * Create a new budget
   */
  createBudget(data: CreateBudgetRequest): Observable<Budget> {
    return this.extractData(
      this.post<Budget>(this.endpoint, data)
    );
  }

  /**
   * Update an existing budget
   */
  updateBudget(budgetId: string, budgetData: UpdateBudgetRequest): Observable<Budget> {
    return this.extractData(
      this.put<any>(`${this.endpoint}/${budgetId}`, budgetData)
    ).pipe(
      map((res: any) => res.budget)
    );
  }

  /**
   * Delete a budget
   */
  deleteBudget(id: string): Observable<void> {
    return this.extractData(
      this.delete<void>(`${this.endpoint}/${id}`)
    );
  }

  /**
   * Get budget analysis with spending insights
   */
  getBudgetAnalysis(id: string, options?: {
    includeProjections?: boolean;
    includeTrends?: boolean;
    includeComparisons?: boolean;
  }): Observable<BudgetAnalysis> {
    return this.extractData(
      this.get<BudgetAnalysis>(`${this.endpoint}/${id}/analysis`, options)
    );
  }

  /**
   * Get budget health score
   */
  getBudgetHealthScore(id: string): Observable<BudgetHealthScore> {
    return this.extractData(
      this.get<BudgetHealthScore>(`${this.endpoint}/${id}/health-score`)
    );
  }

  /**
   * Get all budget alerts
   */
  getBudgetAlerts(filters?: {
    budgetId?: string;
    type?: string;
    severity?: string;
    isRead?: boolean;
  }): Observable<BudgetAlert[]> {
    return this.extractData(
      this.get<BudgetAlert[]>(`${this.endpoint}/alerts`, filters)
    );
  }

  /**
   * Mark budget alert as read
   */
  markAlertAsRead(alertId: string): Observable<void> {
    return this.extractData(
      this.patch<void>(`${this.endpoint}/alerts/${alertId}/read`, {})
    );
  }

  /**
   * Mark all alerts as read for a budget
   */
  markAllAlertsAsRead(budgetId?: string): Observable<void> {
    const params = budgetId ? { budgetId } : {};
    return this.extractData(
      this.patch<void>(`${this.endpoint}/alerts/read-all`, params)
    );
  }

  /**
   * Compare budget with previous period
   */
  compareBudget(id: string, comparisonPeriod?: string): Observable<BudgetComparison> {
    const params = comparisonPeriod ? { comparisonPeriod } : {};
    return this.extractData(
      this.get<BudgetComparison>(`${this.endpoint}/${id}/compare`, params)
    );
  }

  /**
   * Get budget templates
   */
  getBudgetTemplates(): Observable<{
    id: string;
    name: string;
    description: string;
    categories: { categoryId: string; percentage: number }[];
  }[]> {
    return this.extractData(
      this.get<any[]>(`${this.endpoint}/templates`)
    );
  }

  /**
   * Create budget from template
   */
  createBudgetFromTemplate(templateId: string, data: {
    name: string;
    amount: number;
    period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    startDate: string;
  }): Observable<Budget> {
    return this.extractData(
      this.post<Budget>(`${this.endpoint}/templates/${templateId}/create`, data)
    );
  }

  /**
   * Reset budget (set spent amounts to zero)
   */
  resetBudget(id: string): Observable<Budget> {
    return this.extractData(
      this.post<Budget>(`${this.endpoint}/${id}/reset`, {})
    );
  }

  /**
   * Duplicate budget
   */
  duplicateBudget(id: string, data: {
    name: string;
    startDate: string;
    endDate?: string;
  }): Observable<Budget> {
    return this.extractData(
      this.post<Budget>(`${this.endpoint}/${id}/duplicate`, data)
    );
  }

  /**
   * Get budget summary for dashboard
   */
  getBudgetSummary(): Observable<{
    totalBudgets: number;
    activeBudgets: number;
    totalBudgeted: number;
    totalSpent: number;
    totalRemaining: number;
    overBudgetCount: number;
    averageUtilization: number;
    alertsCount: number;
    topCategories: {
      categoryId: string;
      categoryName: string;
      budgeted: number;
      spent: number;
      percentage: number;
    }[];
  }> {
    return this.extractData(
      this.get<any>(`${this.endpoint}/summary`)
    );
  }

  /**
   * Export budget data
   */  exportBudget(
    id: string,
    format: 'csv' | 'pdf' | 'excel',
    options?: {
      includeTransactions?: boolean;
      includeTrends?: boolean;
      dateRange?: { startDate: string; endDate: string };
    }
  ): Observable<Blob> {
    return this.extractData(
      this.get<Blob>(`${this.endpoint}/${id}/export/${format}`, options, {
        responseType: 'blob'
      })
    );
  }

  /**
   * Import budget data
   */
  importBudget(file: File, options?: {
    overwriteExisting?: boolean;
    createCategories?: boolean;
  }): Observable<{
    imported: number;
    updated: number;
    errors: any[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options) {
      Object.keys(options).forEach(key => {
        formData.append(key, (options as any)[key].toString());
      });
    }
    
    return this.extractData(
      this.upload<{
        imported: number;
        updated: number;
        errors: any[];
      }>(`${this.endpoint}/import`, formData)
    );
  }

  /**
   * Get budget optimization recommendations
   */
  getBudgetOptimizationRecommendations(budgetIds?: string[]): Observable<OptimizationRecommendations> {
    const params = budgetIds ? { budgetIds: budgetIds.join(',') } : {};
    return this.extractData(
      this.get<OptimizationRecommendations>(`${this.endpoint}/recommendations/optimization`, params)
    );
  }

  /**
   * Get comprehensive budget analysis with optimization insights
   */
  getBudgetOptimizationAnalysis(id: string): Observable<BudgetOptimizationAnalysis> {
    return this.extractData(
      this.get<BudgetOptimizationAnalysis>(`${this.endpoint}/${id}/optimization-analysis`)
    );
  }

  /**
   * Get spending pattern analysis
   */
  getSpendingPatterns(budgetId: string, options?: {
    period?: 'last_month' | 'last_quarter' | 'last_year';
    includeAnomalies?: boolean;
    includePredictions?: boolean;
  }): Observable<SpendingPattern[]> {
    return this.extractData(
      this.get<SpendingPattern[]>(`${this.endpoint}/${budgetId}/spending-patterns`, options)
    );
  }

  /**
   * Get anomaly detection results
   */
  getAnomalyDetection(budgetId: string, options?: {
    sensitivity?: 'low' | 'medium' | 'high';
    timeframe?: 'last_week' | 'last_month' | 'last_quarter';
  }): Observable<AnomalyDetection> {
    return this.extractData(
      this.get<AnomalyDetection>(`${this.endpoint}/${budgetId}/anomaly-detection`, options)
    );
  }

  /**
   * Get savings opportunities
   */
  getSavingsOpportunities(budgetId?: string): Observable<SavingsOpportunity[]> {
    const endpoint = budgetId 
      ? `${this.endpoint}/${budgetId}/savings-opportunities`
      : `${this.endpoint}/savings-opportunities`;
    return this.extractData(
      this.get<SavingsOpportunity[]>(endpoint)
    );
  }

  /**
   * Get category reallocation recommendations
   */
  getCategoryReallocationRecommendations(budgetId: string): Observable<CategoryOptimization[]> {
    return this.extractData(
      this.get<CategoryOptimization[]>(`${this.endpoint}/${budgetId}/category-optimizations`)
    );
  }

  /**
   * Perform scenario analysis
   */
  performScenarioAnalysis(budgetId: string, scenario: ScenarioInput): Observable<ScenarioResult> {
    return this.extractData(
      this.post<ScenarioResult>(`${this.endpoint}/${budgetId}/scenario-analysis`, scenario)
    );
  }

  /**
   * Get multiple scenario comparisons
   */
  compareScenarios(budgetId: string, scenarios: ScenarioInput[]): Observable<{
    scenarios: ScenarioResult[];
    comparison: {
      bestScenario: string;
      worstScenario: string;
      recommendations: string[];
    };
  }> {
    return this.extractData(
      this.post<any>(`${this.endpoint}/${budgetId}/scenario-comparison`, { scenarios })
    );
  }

  /**
   * Get goal-based budget suggestions
   */
  getGoalBasedBudgetSuggestions(goals: FinancialGoal[]): Observable<GoalBasedBudgetSuggestion[]> {
    return this.extractData(
      this.post<GoalBasedBudgetSuggestion[]>(`${this.endpoint}/goal-based-suggestions`, { goals })
    );
  }

  /**
   * Get machine learning insights
   */
  getMLInsights(budgetId?: string, options?: {
    insightTypes?: string[];
    minConfidence?: number;
    timeframe?: string;
  }): Observable<MLInsight[]> {
    const endpoint = budgetId 
      ? `${this.endpoint}/${budgetId}/ml-insights`
      : `${this.endpoint}/ml-insights`;
    return this.extractData(
      this.get<MLInsight[]>(endpoint, options)
    );
  }

  /**
   * Get personalized insights
   */
  getPersonalizedInsights(options?: {
    categories?: string[];
    timeframe?: string;
    limit?: number;
  }): Observable<PersonalizedInsight[]> {
    return this.extractData(
      this.get<PersonalizedInsight[]>(`${this.endpoint}/personalized-insights`, options)
    );
  }

  /**
   * Get educational content recommendations
   */
  getEducationalContent(options?: {
    categories?: string[];
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    personalizedOnly?: boolean;
    limit?: number;
  }): Observable<EducationalContent[]> {
    return this.extractData(
      this.get<EducationalContent[]>(`${this.endpoint}/educational-content`, options)
    );
  }

  /**
   * Apply optimization recommendations
   */
  applyOptimizationRecommendations(budgetId: string, recommendationIds: string[]): Observable<Budget> {
    return this.extractData(
      this.post<Budget>(`${this.endpoint}/${budgetId}/apply-optimizations`, { recommendationIds })
    );
  }

  /**
   * Generate optimized budget based on historical data
   */
  generateOptimizedBudget(options: {
    baseAmount: number;
    period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    goals?: FinancialGoal[];
    preferences?: {
      conservativeApproach?: boolean;
      prioritizeCategories?: string[];
      constraints?: Array<{
        categoryId: string;
        minAmount?: number;
        maxAmount?: number;
      }>;
    };
  }): Observable<{
    optimizedBudget: CreateBudgetRequest;
    recommendations: BudgetRecommendation[];
    confidence: number;
  }> {
    return this.extractData(
      this.post<any>(`${this.endpoint}/generate-optimized`, options)
    );
  }

  /**
   * Get budget health trends
   */
  getBudgetHealthTrends(budgetId: string, timeframe?: string): Observable<{
    current: BudgetHealthScore;
    trends: Array<{
      date: Date;
      score: number;
      factors: Array<{
        factor: string;
        impact: number;
      }>;
    }>;
    projections: Array<{
      date: Date;
      projectedScore: number;
      confidence: number;
    }>;
  }> {
    const params = timeframe ? { timeframe } : {};
    return this.extractData(
      this.get<any>(`${this.endpoint}/${budgetId}/health-trends`, params)
    );
  }

  /**
   * Get the current budget
   */
  getCurrentBudget(): Observable<Budget | null> {
    return this.get<Budget>('budgets/current').pipe(
      this.extractData,
      catchError(() => of(null)) // Handle errors gracefully, e.g., if no current budget exists
    );
  }
}
