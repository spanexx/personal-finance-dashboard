export interface ValidationRules {
  minAmount?: number;
  maxAmount?: number;
  requiredFields?: string[];
  allowedPaymentMethods?: string[];
  requireDescription?: boolean;
  requireMerchant?: boolean;
  autoTagging?: boolean;
}

export interface Category {
  _id: string;
  user: string;
  name: string;
  description?: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  isActive: boolean;
  parent?: string | null; // ObjectId or null
  level: number;
  sortOrder: number;
  budgetAllocation: number;
  transactionCount: number;
  totalAmount: number;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Optionally, you can add children for hierarchy display, but not for API
  children?: Category[];
}

export interface CreateCategoryRequest {
  name: string;
  type: 'income' | 'expense';
  description?: string;
  color: string;
  icon: string;
  parent?: string | null;
  sortOrder?: number;
  budgetAllocation?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  type?: 'income' | 'expense';
  description?: string;
  color?: string;
  icon?: string;
  parent?: string | null;
  sortOrder?: number;
  budgetAllocation?: number;
  isActive?: boolean;
}

export interface CategoryHierarchy {
  category: Category;
  children: CategoryHierarchy[];
  totalTransactions: number;
  totalAmount: number;
  depth: number;
}

export interface CategoryStats {
  categoryId: string;
  categoryName: string;
  type: 'income' | 'expense';
  transactionCount: number;
  totalAmount: number;
  averageAmount: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  monthlyBreakdown: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
  lastTransaction?: Date;
}

export interface CategoryAnalytics {
  totalCategories: number;
  activeCategories: number;
  inactiveCategories: number;
  incomeCategories: number;
  expenseCategories: number;
  mostUsedCategories: Array<{
    categoryId: string;
    categoryName: string;
    usageCount: number;
    totalAmount: number;
  }>;
  categoryPerformance: Array<{
    categoryId: string;
    categoryName: string;
    budgetAmount?: number;
    actualAmount: number;
    variance: number;
    utilizationPercentage: number;
  }>;
}

export interface BulkCategoryOperation {
  operation: 'activate' | 'deactivate' | 'delete' | 'update';
  categoryIds: string[];
  updateData?: Partial<UpdateCategoryRequest>;
}

export interface CategorySuggestion {
  name: string;
  type: 'income' | 'expense';
  confidence: number;
  color?: string;
  icon?: string;
  parentSuggestion?: string;
}

// Legacy interface for backward compatibility
export interface CategoryDetails {
  id: string;
  name: string;
  type: string;
  color: string;
  icon: string;
  isActive: boolean;
}