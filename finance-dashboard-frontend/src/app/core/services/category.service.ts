import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService, PaginationParams, FilterParams } from './api.service';
import { 
  Category, 
  CreateCategoryRequest, 
  UpdateCategoryRequest,
  CategoryHierarchy,
  CategoryStats,
  CategoryAnalytics,
  BulkCategoryOperation,
  CategorySuggestion,
  ValidationRules
} from '../../shared/models';

// Extended interfaces for comprehensive category management
export interface CategoryInsights {
  unusedCategories: Category[];
  mostUsedCategories: {
    category: Category;
    usageCount: number;
    totalAmount: number;
  }[];
  suggestedCategories: {
    name: string;
    type: 'income' | 'expense';
    reason: string;
    basedOnTransactions: string[];
  }[];
  duplicateCategories: {
    categories: Category[];
    similarity: number;
    suggestedMerge: boolean;
  }[];
  categoryHealth: {
    totalCategories: number;
    activeCategories: number;
    inactiveCategories: number;
    orphanedCategories: number;
    redundantCategories: number;
    healthScore: number; // 0-100
  };
}

export interface ExtendedBulkCategoryOperation {
  operation: 'create' | 'update' | 'delete' | 'merge' | 'activate' | 'deactivate';
  categories: string[] | CreateCategoryRequest[] | UpdateCategoryRequest[];
  options?: {
    mergeTarget?: string;
    preserveTransactions?: boolean;
    updateTransactions?: boolean;
  };
}

export interface BulkOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: {
    categoryId?: string;
    error: string;
  }[];
  results: {
    categoryId: string;
    status: 'success' | 'failed';
    data?: Category;
  }[];
}

export interface CategoryTemplate {
  id: string;
  name: string;
  description: string;
  categories: CreateCategoryRequest[];
  tags: string[];
  isPublic: boolean;
  usage: number;
  createdBy: string;
  createdAt: string;
}

export interface CategoryImportRequest {
  format: 'csv' | 'json' | 'xlsx';
  data: string | File;
  options: {
    skipDuplicates: boolean;
    mergeStrategy: 'skip' | 'overwrite' | 'merge';
    validateNames: boolean;
    createHierarchy: boolean;
  };
}

export interface CategoryExportRequest {
  format: 'csv' | 'json' | 'xlsx';
  includeInactive: boolean;
  includeHierarchy: boolean;
  includeAnalytics: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export interface CategoryValidation {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
  }[];
  warnings: {
    field: string;
    message: string;
  }[];
  suggestions: {
    field: string;
    suggestion: string;
    reason: string;
  }[];
}

/**
 * Comprehensive Category Service
 * Provides advanced category management including:
 * - Hierarchical category structure
 * - Category analytics and insights
 * - Bulk operations and templates
 * - Import/export functionality
 * - Category validation and suggestions
 */
@Injectable({
  providedIn: 'root'
})
export class CategoryService extends ApiService {
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  public categories$ = this.categoriesSubject.asObservable();

  private categoryHierarchySubject = new BehaviorSubject<CategoryHierarchy[]>([]);
  public categoryHierarchy$ = this.categoryHierarchySubject.asObservable();

  private isDirtySubject = new BehaviorSubject<boolean>(false);
  public isDirty$ = this.isDirtySubject.asObservable();

  // ===== BASIC CATEGORY OPERATIONS =====

  /**
   * Get all categories with optional filtering
   */
  getCategories(params?: FilterParams & PaginationParams): Observable<Category[]> {
    return this.extractData(
      this.get<{ categories: Category[] }>('/categories', params)
    ).pipe(
      map(res => Array.isArray(res) ? res : res.categories),
      tap(categories => {
        this.categoriesSubject.next(categories);
        this.isDirtySubject.next(false);
      })
    );
  }

  /**
   * Get category by ID
   */
  getCategory(id: string): Observable<Category> {
    return this.extractData(
      this.get<Category>(`/categories/${id}`)
    );
  }

  /**
   * Create new category
   */
  createCategory(category: CreateCategoryRequest): Observable<Category> {
    return this.extractData(
      this.post<Category>('/categories', category)
    ).pipe(      tap(newCategory => {
        const currentCategories = this.categoriesSubject.value;
        this.categoriesSubject.next([...currentCategories, newCategory]);
        this.isDirtySubject.next(true);
      })
    );
  }

  /**
   * Update existing category
   */
  updateCategory(id: string, updates: UpdateCategoryRequest): Observable<Category> {
    return this.extractData(
      this.put<Category>(`/categories/${id}`, updates)
    ).pipe(      tap(updatedCategory => {
        const currentCategories = this.categoriesSubject.value;
        const index = currentCategories.findIndex(c => c._id === id);
        if (index !== -1) {
          currentCategories[index] = updatedCategory;
          this.categoriesSubject.next([...currentCategories]);
        }
        this.isDirtySubject.next(true);
      })
    );
  }

  /**
   * Delete category
   */
  deleteCategory(id: string, options?: { preserveTransactions?: boolean; moveToCategory?: string }): Observable<any> {
    return this.extractData(
      this.delete<any>(`/categories/${id}`, { params: options })
    ).pipe(      tap(() => {
        const currentCategories = this.categoriesSubject.value;
        this.categoriesSubject.next(currentCategories.filter(c => c._id !== id));
        this.isDirtySubject.next(true);
      })
    );
  }

  // ===== HIERARCHICAL OPERATIONS =====

  /**
   * Get category hierarchy
   */
  getCategoryHierarchy(): Observable<CategoryHierarchy[]> {
    return this.extractData(
      this.get<CategoryHierarchy[]>('/categories/hierarchy')
    ).pipe(
      tap(hierarchy => {
        this.categoryHierarchySubject.next(hierarchy);
      })
    );
  }

  /**
   * Get category tree for specific type
   */
  getCategoryTree(type: 'income' | 'expense'): Observable<CategoryHierarchy[]> {
    return this.extractData(
      this.get<CategoryHierarchy[]>(`/categories/tree/${type}`)
    );
  }

  /**
   * Get category children
   */
  getCategoryChildren(parentId: string): Observable<Category[]> {
    return this.extractData(
      this.get<Category[]>(`/categories/${parentId}/children`)
    );
  }

  /**
   * Move category to different parent
   */
  moveCategory(categoryId: string, newParentId: string | null): Observable<Category> {
    return this.extractData(
      this.put<Category>(`/categories/${categoryId}/move`, { parentId: newParentId })
    ).pipe(
      tap(() => {
        this.isDirtySubject.next(true);
      })
    );
  }

  /**
   * Reorder categories within parent
   */
  reorderCategories(parentId: string | null, categoryIds: string[]): Observable<any> {
    return this.extractData(
      this.put<any>('/categories/reorder', { parentId, categoryIds })
    ).pipe(
      tap(() => {
        this.isDirtySubject.next(true);
      })
    );
  }

  // ===== ANALYTICS AND INSIGHTS =====

  /**
   * Get category analytics
   */
  getCategoryAnalytics(
    categoryId: string, 
    dateRange?: { startDate: string; endDate: string }
  ): Observable<CategoryAnalytics> {
    return this.extractData(
      this.get<CategoryAnalytics>(`/categories/${categoryId}/analytics`, dateRange)
    );
  }

  /**
   * Get analytics for multiple categories
   */
  getMultipleCategoryAnalytics(
    categoryIds: string[],
    dateRange?: { startDate: string; endDate: string }
  ): Observable<CategoryAnalytics[]> {
    return this.extractData(
      this.post<CategoryAnalytics[]>('/categories/analytics/batch', {
        categoryIds,
        ...dateRange
      })
    );
  }

  /**
   * Get category insights and recommendations
   */
  getCategoryInsights(): Observable<CategoryInsights> {
    return this.extractData(
      this.get<CategoryInsights>('/categories/insights')
    );
  }

  /**
   * Get spending patterns by category
   */
  getSpendingPatterns(
    type: 'income' | 'expense',
    period: 'week' | 'month' | 'quarter' | 'year'
  ): Observable<any> {
    return this.extractData(
      this.get<any>('/categories/patterns', { type, period })
    );
  }

  // ===== BULK OPERATIONS =====
  /**
   * Perform bulk category operations
   */
  performBulkOperation(operation: ExtendedBulkCategoryOperation): Observable<BulkOperationResult> {
    return this.extractData(
      this.post<BulkOperationResult>('/categories/bulk', operation)
    ).pipe(
      tap(() => {
        this.isDirtySubject.next(true);
      })
    );
  }

  /**
   * Bulk create categories
   */
  bulkCreateCategories(categories: CreateCategoryRequest[]): Observable<BulkOperationResult> {
    return this.performBulkOperation({
      operation: 'create',
      categories
    });
  }

  /**
   * Bulk update categories
   */
  bulkUpdateCategories(updates: UpdateCategoryRequest[]): Observable<BulkOperationResult> {
    return this.performBulkOperation({
      operation: 'update',
      categories: updates
    });
  }

  /**
   * Bulk delete categories
   */
  bulkDeleteCategories(categoryIds: string[], options?: { preserveTransactions?: boolean }): Observable<BulkOperationResult> {
    return this.performBulkOperation({
      operation: 'delete',
      categories: categoryIds,
      options
    });
  }

  /**
   * Merge categories
   */
  mergeCategories(sourceCategoryIds: string[], targetCategoryId: string): Observable<BulkOperationResult> {
    return this.performBulkOperation({
      operation: 'merge',
      categories: sourceCategoryIds,
      options: { mergeTarget: targetCategoryId, updateTransactions: true }
    });
  }

  // ===== TEMPLATES =====

  /**
   * Get category templates
   */
  getCategoryTemplates(): Observable<CategoryTemplate[]> {
    return this.extractData(
      this.get<CategoryTemplate[]>('/categories/templates')
    );
  }

  /**
   * Get template by ID
   */
  getCategoryTemplate(id: string): Observable<CategoryTemplate> {
    return this.extractData(
      this.get<CategoryTemplate>(`/categories/templates/${id}`)
    );
  }

  /**
   * Create category template
   */
  createCategoryTemplate(template: Omit<CategoryTemplate, 'id' | 'usage' | 'createdAt'>): Observable<CategoryTemplate> {
    return this.extractData(
      this.post<CategoryTemplate>('/categories/templates', template)
    );
  }

  /**
   * Apply category template
   */
  applyCategoryTemplate(templateId: string, options?: { skipDuplicates?: boolean }): Observable<BulkOperationResult> {
    return this.extractData(
      this.post<BulkOperationResult>(`/categories/templates/${templateId}/apply`, options)
    ).pipe(
      tap(() => {
        this.isDirtySubject.next(true);
      })
    );
  }

  // ===== IMPORT/EXPORT =====

  /**
   * Import categories from file/data
   */
  importCategories(request: CategoryImportRequest): Observable<BulkOperationResult> {
    const formData = new FormData();
    
    if (request.data instanceof File) {
      formData.append('file', request.data);
    } else {
      formData.append('data', request.data);
    }
    
    formData.append('format', request.format);
    formData.append('options', JSON.stringify(request.options));

    return this.extractData(
      this.upload<BulkOperationResult>('/categories/import', formData)
    ).pipe(
      tap(() => {
        this.isDirtySubject.next(true);
      })
    );
  }

  /**
   * Export categories
   */
  exportCategories(request: CategoryExportRequest): Observable<{ downloadUrl: string; fileName: string }> {
    return this.extractData(
      this.post<{ downloadUrl: string; fileName: string }>('/categories/export', request)
    );
  }

  /**
   * Get import/export templates
   */
  getImportExportTemplates(): Observable<{ csv: string; json: string; xlsx: string }> {
    return this.extractData(
      this.get<{ csv: string; json: string; xlsx: string }>('/categories/templates/import-export')
    );
  }

  // ===== VALIDATION AND SUGGESTIONS =====

  /**
   * Validate category data
   */
  validateCategory(category: CreateCategoryRequest | UpdateCategoryRequest): Observable<CategoryValidation> {
    return this.extractData(
      this.post<CategoryValidation>('/categories/validate', category)
    );
  }

  /**
   * Get category suggestions based on transaction description
   */
  getCategorySuggestions(description: string, amount?: number): Observable<Category[]> {
    return this.extractData(
      this.get<Category[]>('/categories/suggestions', { description, amount })
    );
  }

  /**
   * Train category suggestion model
   */
  trainCategorySuggestions(): Observable<{ success: boolean; trainingData: number }> {
    return this.extractData(
      this.post<{ success: boolean; trainingData: number }>('/categories/suggestions/train', {})
    );
  }

  /**
   * Get category usage statistics
   */
  getCategoryUsageStats(period: 'month' | 'quarter' | 'year' = 'month'): Observable<any> {
    return this.extractData(
      this.get<any>('/categories/usage-stats', { period })
    );
  }

  // ===== UTILITY METHODS =====

  /**
   * Refresh categories data
   */
  refreshCategories(): Observable<Category[]> {
    return this.getCategories();
  }

  /**
   * Search categories
   */
  searchCategories(query: string, type?: 'income' | 'expense'): Observable<Category[]> {
    return this.extractData(
      this.get<Category[]>('/categories/search', { q: query, type })
    );
  }

  /**
   * Get default categories
   */
  getDefaultCategories(): Observable<Category[]> {
    return this.extractData(
      this.get<Category[]>('/categories/defaults')
    );
  }

  /**
   * Reset to default categories
   */
  resetToDefaults(preserveCustom = true): Observable<BulkOperationResult> {
    return this.extractData(
      this.post<BulkOperationResult>('/categories/reset-defaults', { preserveCustom })
    ).pipe(
      tap(() => {
        this.isDirtySubject.next(true);
      })
    );
  }

  /**
   * Get categories by type
   */
  getCategoriesByType(type: 'income' | 'expense'): Observable<Category[]> {
    const categories = this.categoriesSubject.value;
    if (categories.length === 0) {
      return this.getCategories({ type });
    }
    
    return this.categories$.pipe(
      map(cats => cats.filter(category => category.type === type))
    );
  }

  /**
   * Get active categories
   */
  getActiveCategories(): Observable<Category[]> {
    return this.categories$.pipe(
      map(categories => categories.filter(category => category.isActive))
    );
  }

  /**
   * Check if categories need refresh
   */
  needsRefresh(): boolean {
    return this.isDirtySubject.value;
  }
}