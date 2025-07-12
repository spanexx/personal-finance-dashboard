interface ChartData {
  labels: string[];
  datasets: any[];
}

interface AnalysisData {
  categoryAnalysis: CategoryAnalysis[];
  trendAnalysis: TrendAnalysis;
  performanceMetrics: PerformanceMetrics;
}

interface CategoryAnalysis {
  categoryName: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'good' | 'warning' | 'over';
  color: string;
}

interface TrendAnalysis {
  totalBudget: number;
  totalSpent: number;
  projectedSpending: number;
  savingsRate: number;
  daysRemaining: number;
  averageDailySpending: number;
}

interface PerformanceMetrics {
  onTrackCategories: number;
  warningCategories: number;
  overBudgetCategories: number;
  totalCategories: number;
  budgetUtilization: number;
}

export {
  ChartData,
  AnalysisData,
  CategoryAnalysis,
  TrendAnalysis,
  PerformanceMetrics
};
