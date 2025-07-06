import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpClientService } from '../../core/services/http-client.service';
import { ApiResponse, PaginatedResponse } from '../../core/models/api-response.models';

// Models
import { Budget, CreateBudgetRequest, UpdateBudgetRequest, BudgetTemplate, CategoryAllocation } from '../../shared/models/budget.model';
import { Category } from '../../shared/models/category.model';
import { BudgetCategory } from './budget-templates/budget-templates.component';

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  constructor(private httpClient: HttpClientService) { }
  // Get all budgets
  getBudgets(): Observable<Budget[]> {
    return this.httpClient.get<ApiResponse<Budget[]>>('budgets').pipe(
      map(response => response.data)
    );
  }

  // Get budget by ID
  getBudget(id: string): Observable<Budget> {
    return this.httpClient.get<ApiResponse<Budget>>(`budgets/${id}`).pipe(
      map(response => response.data)
    );
  }

  // Get current active budget
  getCurrentBudget(): Observable<Budget> {
    return this.httpClient.get<ApiResponse<Budget>>('budgets/current').pipe(
      map(response => response.data)
    );
  }

  // Get all categories
  getCategories(): Observable<Category[]> {
    return this.httpClient.get<ApiResponse<Category[]>>('categories').pipe(
      map(response => response.data)
    );
  }

  // Get expense categories only
  getExpenseCategories(): Observable<Category[]> {
    return this.httpClient.get<ApiResponse<any>>('categories', {
      params: { type: 'expense', isActive: 'true' }
    }).pipe(
      map(response => {
        // Defensive: handle both array and paginated object
        if (Array.isArray(response.data)) {
          return response.data;
        } else if (response.data && Array.isArray(response.data.data)) {
          return response.data.data;
        } else if (response.data && Array.isArray(response.data.categories)) {
          return response.data.categories;
        }
        return [];
      })
    );
  }

  // Create new budget
  createBudget(budgetData: CreateBudgetRequest): Observable<Budget> {
    return this.httpClient.post<ApiResponse<Budget>>('budgets', budgetData).pipe(
      map(response => response.data)
    );
  }
  // Update budget
  updateBudget(id: string, budgetData: UpdateBudgetRequest): Observable<Budget> {
    return this.httpClient.put<ApiResponse<Budget>>(`budgets/${id}`, budgetData).pipe(
      map(response => response.data)
    );
  }

  // Delete budget
  deleteBudget(id: string): Observable<void> {
    return this.httpClient.delete<ApiResponse<void>>(`budgets/${id}`).pipe(
      map(() => void 0)
    );
  }

  // Calculate budget progress
  calculateBudgetProgress(budget: Budget): {
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    percentageSpent: number;
    percentageRemaining: number;
  } {
    const totalBudget = budget.totalAmount;
    // Use categories if defined, else fallback to categoryAllocations, else empty array
    const categories = Array.isArray(budget.categories) && budget.categories.length > 0
      ? budget.categories
      : (Array.isArray((budget as any).categoryAllocations) ? (budget as any).categoryAllocations : []);
    const totalSpent = categories.reduce((sum: number, cat: any) => sum + (cat.spent || cat.spentAmount || 0), 0);
    const totalRemaining = totalBudget - totalSpent;
    const percentageSpent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const percentageRemaining = 100 - percentageSpent;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      percentageSpent: Math.round(percentageSpent * 100) / 100,
      percentageRemaining: Math.round(percentageRemaining * 100) / 100
    };
  }  // Get budget status for category
  getCategoryStatus(category: CategoryAllocation): 'good' | 'warning' | 'over' {
    const percentageSpent = category.allocated > 0 ? ((category.spent || 0) / category.allocated) * 100 : 0;
    
    if (percentageSpent > 100) return 'over';
    if (percentageSpent > 80) return 'warning';
    return 'good';
  }

  // Budget Template Management Methods
  
  // Get all budget templates
  getBudgetTemplates(): Observable<BudgetTemplate[]> {
    return this.httpClient.get<ApiResponse<BudgetTemplate[]>>('budgets/templates').pipe(
      map(response => response.data)
    );
  }

  // Create new budget template
  createBudgetTemplate(templateData: Partial<BudgetTemplate>): Observable<BudgetTemplate> {
    return this.httpClient.post<ApiResponse<BudgetTemplate>>('budgets/templates', templateData).pipe(
      map(response => response.data)
    );
  }

  // Update budget template
  updateBudgetTemplate(templateId: string, templateData: Partial<BudgetTemplate>): Observable<BudgetTemplate> {
    return this.httpClient.put<ApiResponse<BudgetTemplate>>(`budgets/templates/${templateId}`, templateData).pipe(
      map(response => response.data)
    );
  }

  // Delete budget template
  deleteBudgetTemplate(templateId: string): Observable<void> {
    return this.httpClient.delete<ApiResponse<void>>(`budgets/templates/${templateId}`).pipe(
      map(() => void 0)
    );
  }

  // Set selected template for wizard
  private selectedTemplate: BudgetTemplate | null = null;

  setSelectedTemplate(template: BudgetTemplate | null): void {
    this.selectedTemplate = template;
  }

  getSelectedTemplate(): BudgetTemplate | null {
    return this.selectedTemplate;
  }

  // Create budget from template
  createBudgetFromTemplate(templateId: string, budgetData: {
    name: string;
    totalAmount: number;
    period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    startDate: Date;
    endDate: Date;
  }): Observable<Budget> {
    return this.httpClient.post<ApiResponse<Budget>>(`budgets/templates/${templateId}/create`, budgetData).pipe(
      map(response => response.data)
    );
  }
}
export { Budget, Category };

