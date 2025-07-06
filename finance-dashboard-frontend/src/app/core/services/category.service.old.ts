import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Category, CreateCategoryRequest, UpdateCategoryRequest } from '../../shared/models/category.model';

export interface CategoryFilters {
  type?: 'income' | 'expense';
  isActive?: boolean;
  isDefault?: boolean;
  parentId?: string;
  searchTerm?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface CategoryTree {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  icon?: string;
  isDefault: boolean;
  isActive: boolean;
  parentId?: string;
  children: CategoryTree[];
  subcategoryCount: number;
  transactionCount: number;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryAnalytics {
  categoryId: string;
  categoryName: string;
  type: 'income' | 'expense';
  totalTransactions: number;
  totalAmount: number;
  averageAmount: number;
  monthlyTrend: {
    month: string;
    amount: number;
    transactionCount: number;
  }[];
  percentageOfTotal: number;
  comparisonToPreviousPeriod: {
    amount: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  };
  topSubcategories?: CategoryAnalytics[];
}

export interface CategorySpendingInsights {
  categoryId: string;
  categoryName: string;
  insights: {
    averageMonthlySpending: number;
    highestSpendingMonth: {
      month: string;
      amount: number;
    };
    lowestSpendingMonth: {
      month: string;
      amount: number;
    };
    spendingPattern: 'consistent' | 'seasonal' | 'irregular';
    recommendations: string[];
  };
  budgetComparison?: {
    budgetedAmount: number;
    actualAmount: number;
    variance: number;
    status: 'under' | 'over' | 'on-track';
  };
}

export interface CategoryBulkOperation {
  categoryIds: string[];
  operation: 'activate' | 'deactivate' | 'delete' | 'merge';
  targetCategoryId?: string; // For merge operation
}

export interface CategoryImportData {
  categories: {
    name: string;
    type: 'income' | 'expense';
    color?: string;
    icon?: string;
    parentName?: string;
    description?: string;
  }[];
}

export interface CategoryExportOptions {
  format: 'csv' | 'excel' | 'json';
  includeSubcategories: boolean;
  includeAnalytics: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Category Service
 * Comprehensive category management with hierarchical support and analytics
 */
@Injectable({
  providedIn: 'root'
})
export class CategoryService extends ApiService {

  constructor() {
    super();
  }

  /**
   * Get all categories with optional filtering
   */
  getCategories(filters?: CategoryFilters): Observable<Category[]> {
    const params = this.buildQueryParams(filters);
    return this.get<Category[]>(`/categories${params}`).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Get category by ID
   */
  getCategory(id: string): Observable<Category> {
    return this.get<Category>(`/categories/${id}`).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Get categories as hierarchical tree structure
   */
  getCategoryTree(type?: 'income' | 'expense'): Observable<CategoryTree[]> {
    const params = type ? `?type=${type}` : '';
    return this.get<CategoryTree[]>(`/categories/tree${params}`).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Create new category
   */
  createCategory(categoryData: CreateCategoryRequest): Observable<Category> {
    return this.post<Category>('/categories', categoryData).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Update existing category
   */
  updateCategory(id: string, categoryData: UpdateCategoryRequest): Observable<Category> {
    return this.put<Category>(`/categories/${id}`, categoryData).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Delete category
   */
  deleteCategory(id: string, reassignToId?: string): Observable<boolean> {
    const body = reassignToId ? { reassignToId } : {};
    return this.delete<{ success: boolean }>(`/categories/${id}`, body).pipe(
      map(response => response.success),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Get default categories for user setup
   */
  getDefaultCategories(type?: 'income' | 'expense'): Observable<Category[]> {
    const params = type ? `?type=${type}` : '';
    return this.get<Category[]>(`/categories/defaults${params}`).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Create default categories for new user
   */
  createDefaultCategories(): Observable<Category[]> {
    return this.post<Category[]>('/categories/setup-defaults', {}).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Get category analytics
   */
  getCategoryAnalytics(
    categoryId: string,
    dateRange?: { startDate: string; endDate: string }
  ): Observable<CategoryAnalytics> {
    const params = dateRange 
      ? `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      : '';
    return this.get<CategoryAnalytics>(`/categories/${categoryId}/analytics${params}`).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Get spending insights for all categories
   */
  getCategorySpendingInsights(
    type?: 'income' | 'expense',
    dateRange?: { startDate: string; endDate: string }
  ): Observable<CategorySpendingInsights[]> {
    let params = '';
    if (type || dateRange) {
      const queryParams = [];
      if (type) queryParams.push(`type=${type}`);
      if (dateRange) {
        queryParams.push(`startDate=${dateRange.startDate}`);
        queryParams.push(`endDate=${dateRange.endDate}`);
      }
      params = `?${queryParams.join('&')}`;
    }
    
    return this.get<CategorySpendingInsights[]>(`/categories/insights${params}`).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Get category usage statistics
   */
  getCategoryUsageStats(): Observable<any[]> {
    return this.get<any[]>('/categories/usage-stats').pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Search categories
   */
  searchCategories(query: string, type?: 'income' | 'expense'): Observable<Category[]> {
    const params = type 
      ? `?query=${encodeURIComponent(query)}&type=${type}`
      : `?query=${encodeURIComponent(query)}`;
    return this.get<Category[]>(`/categories/search${params}`).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Get subcategories for a parent category
   */
  getSubcategories(parentId: string): Observable<Category[]> {
    return this.get<Category[]>(`/categories/${parentId}/subcategories`).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Move category to different parent
   */
  moveCategory(categoryId: string, newParentId?: string): Observable<Category> {
    return this.put<Category>(`/categories/${categoryId}/move`, {
      newParentId
    }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Duplicate category with optional modifications
   */
  duplicateCategory(
    categoryId: string, 
    modifications?: Partial<CreateCategoryRequest>
  ): Observable<Category> {
    return this.post<Category>(`/categories/${categoryId}/duplicate`, modifications || {}).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Bulk operations on categories
   */
  bulkCategoryOperation(operation: CategoryBulkOperation): Observable<{ success: boolean; affectedCount: number }> {
    return this.post<{ success: boolean; affectedCount: number }>('/categories/bulk', operation).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Merge categories
   */
  mergeCategories(sourceCategoryIds: string[], targetCategoryId: string): Observable<{
    success: boolean;
    mergedTransactions: number;
    deletedCategories: number;
  }> {
    return this.post<any>('/categories/merge', {
      sourceCategoryIds,
      targetCategoryId
    }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Get category color palette
   */
  getCategoryColors(): Observable<{ name: string; value: string; textColor: string }[]> {
    return this.get<any[]>('/categories/colors').pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Get category icons
   */
  getCategoryIcons(): Observable<{ name: string; icon: string; category: string }[]> {
    return this.get<any[]>('/categories/icons').pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Validate category name uniqueness
   */
  validateCategoryName(name: string, type: 'income' | 'expense', parentId?: string): Observable<{
    isValid: boolean;
    message?: string;
    suggestions?: string[];
  }> {
    const params = parentId 
      ? `?name=${encodeURIComponent(name)}&type=${type}&parentId=${parentId}`
      : `?name=${encodeURIComponent(name)}&type=${type}`;
    return this.get<any>(`/categories/validate-name${params}`).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Import categories from file
   */
  importCategories(file: File): Observable<{
    success: boolean;
    imported: number;
    errors: string[];
    preview?: Category[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.postFormData<any>('/categories/import', formData).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Preview category import
   */
  previewCategoryImport(file: File): Observable<{
    preview: Category[];
    conflicts: string[];
    recommendations: string[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.postFormData<any>('/categories/import/preview', formData).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Export categories
   */
  exportCategories(options: CategoryExportOptions): Observable<Blob> {
    return this.post<Blob>('/categories/export', options, { responseType: 'blob' }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Get category templates
   */
  getCategoryTemplates(): Observable<{
    name: string;
    description: string;
    categories: Category[];
  }[]> {
    return this.get<any[]>('/categories/templates').pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Apply category template
   */
  applyCategoryTemplate(templateName: string): Observable<{
    success: boolean;
    createdCategories: Category[];
  }> {
    return this.post<any>('/categories/templates/apply', { templateName }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Get category spending comparison
   */
  getCategoryComparison(
    categoryIds: string[],
    dateRange: { startDate: string; endDate: string }
  ): Observable<{
    categories: {
      id: string;
      name: string;
      currentPeriod: number;
      previousPeriod: number;
      change: number;
      changePercentage: number;
    }[];
    summary: {
      totalCurrent: number;
      totalPrevious: number;
      totalChange: number;
      totalChangePercentage: number;
    };
  }> {
    return this.post<any>('/categories/compare', {
      categoryIds,
      dateRange
    }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Get category transaction count
   */
  getCategoryTransactionCount(categoryId: string, dateRange?: {
    startDate: string;
    endDate: string;
  }): Observable<{ count: number; amount: number }> {
    const params = dateRange 
      ? `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      : '';
    return this.get<any>(`/categories/${categoryId}/transaction-count${params}`).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Archive old categories
   */
  archiveUnusedCategories(olderThanMonths: number): Observable<{
    success: boolean;
    archivedCount: number;
    archivedCategories: string[];
  }> {
    return this.post<any>('/categories/archive-unused', {
      olderThanMonths
    }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Restore archived categories
   */
  restoreArchivedCategories(categoryIds: string[]): Observable<{
    success: boolean;
    restoredCount: number;
  }> {
    return this.post<any>('/categories/restore', {
      categoryIds
    }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Build query parameters from filters
   */
  private buildQueryParams(filters?: CategoryFilters): string {
    if (!filters) return '';
    
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });
    
    return params.toString() ? `?${params.toString()}` : '';
  }
}
