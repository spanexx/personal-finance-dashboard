export interface CategoryAllocation {
  category: string;
  allocated: number;
  spent: number;
  remaining: number;
  rollover: number;
  utilizationPercentage: number;
  transactionCount: number;
  lastTransactionDate?: Date;
  alerts: {
    enabled: boolean;
    threshold: number;
    triggered: boolean;
    lastTriggered?: Date;
  };
}

export interface AlertSettings {
  enabled: boolean;
  thresholds: {
    warning: number; // percentage
    critical: number; // percentage
  };
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  frequency: 'immediate' | 'daily' | 'weekly';
}

export interface RolloverSettings {
  enabled: boolean;
  maxRolloverPercentage: number;
  resetOnNewPeriod: boolean;
}

export interface Budget {
  _id: string;
  user: string;
  name: string;
  description?: string;
  totalAmount: number;
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  categories: CategoryAllocation[];
  alertSettings: AlertSettings;
  rolloverSettings: RolloverSettings;
  isActive: boolean;
  isTemplate: boolean;
  templateName?: string;
  color?: string;
  icon?: string;
  totalSpent: number;
  totalRemaining: number;
  utilizationPercentage: number;
  status: 'on_track' | 'warning' | 'over_budget' | 'completed';
  lastCalculated: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBudgetRequest {
  name: string;
  description?: string;
  totalAmount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date | string;
  endDate: Date | string;
  categoryAllocations: Array<{
    category: string;
    allocatedAmount: number;
    notes?: string;
  }>;
  alertSettings?: Partial<AlertSettings>;
  rolloverSettings?: Partial<RolloverSettings>;
  color?: string;
  icon?: string;
  isTemplate?: boolean;
  templateName?: string;
}

export interface UpdateBudgetRequest {
  _id: string;
  name?: string;
  description?: string;
  totalAmount?: number;
  period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate?: Date | string;
  endDate?: Date | string;
  categoryAllocations?: Array<{
    category: string;
    allocatedAmount: number;
    notes?: string;
  }>;
  alertSettings?: Partial<AlertSettings>;
  rolloverSettings?: Partial<RolloverSettings>;
  isActive?: boolean;
  color?: string;
  icon?: string;
}

export interface BudgetTemplate {
  _id: string;
  user: string;
  name: string;
  description?: string;
  categories: Array<{
    category: string;
    percentage: number;
    allocated: number;
  }>;
  totalAmount: number;
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  alertSettings: AlertSettings;
  rolloverSettings: RolloverSettings;
  color?: string;
  icon?: string;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetAnalysis {
  budgetId: string;
  period: string;
  performance: {
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    utilizationPercentage: number;
    status: 'on_track' | 'warning' | 'over_budget' | 'completed';
  };
  categoryAnalysis: Array<{
    category: string;
    allocated: number;
    spent: number;
    remaining: number;
    utilizationPercentage: number;
    variance: number;
    status: 'under' | 'on_track' | 'over';
    trend: 'improving' | 'stable' | 'declining';
  }>;
  recommendations: string[];
  alerts: Array<{
    type: 'warning' | 'critical';
    category?: string;
    message: string;
    triggeredAt: Date;
  }>;
}

export interface BudgetComparison {
  current: Budget;
  previous: Budget;
  comparison: {
    totalBudgetChange: number;
    totalSpentChange: number;
    utilizationChange: number;
    categoryChanges: Array<{
      category: string;
      budgetChange: number;
      spentChange: number;
      utilizationChange: number;
    }>;
  };
}

// Budget Optimization and Recommendation Interfaces

export interface BudgetRecommendation {
  type: 'warning' | 'action' | 'opportunity' | 'insight' | 'suggestion';
  category: 'overspending' | 'burn_rate' | 'category_overspend' | 'underutilization' | 'pattern_analysis' | 'budget_structure';
  budgetId?: string;
  budgetName?: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  impact: 'financial_health' | 'budget_adherence' | 'category_balance' | 'optimization' | 'budget_accuracy' | 'budget_control';
  potentialSavings?: number;
  implementationEffort?: 'low' | 'medium' | 'high';
  metadata?: {
    [key: string]: any;
    overageAmount?: number;
    utilizationRate?: number;
    currentBurnRate?: number;
    idealBurnRate?: number;
    projectedOverrun?: number;
    categoryId?: string;
    categoryName?: string;
    overage?: number;
    remainingAmount?: number;
    timeProgress?: number;
    avgUtilizationRate?: number;
    budgetsAffected?: number;
    avgDurationDays?: number;
  };
}

export interface OptimizationRecommendations {
  recommendations: BudgetRecommendation[];
  summary: string;
  analysisDate: Date;
  budgetsAnalyzed: number;
}

export interface BudgetPerformanceMetrics {
  utilizationRate: number;
  timeProgress: number;
  dailySpendingRate: number;
  projectedEndSpending: number;
  burnRate: number;
  idealBurnRate: number;
  burnRateVariance: number;
  isOnTrack: boolean;
  daysRemaining: number;
  projectedOverrun: number;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  status: 'on_track' | 'warning' | 'over_budget' | 'completed';
}

export interface BudgetHealthScore {
  score: number;
  overallScore: number;
  healthLevel: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
  factors: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
  // Individual score components
  spendingControlScore: number;
  savingsRateScore: number;
  goalProgressScore: number;
  emergencyFundScore: number;
  // Improvement areas and recommendations
  improvementAreas: string[];
  recommendations: string[];
  lastCalculated: Date;
}

export interface CategoryOptimization {
  categoryId: string;
  categoryName: string;
  currentAllocation: number;
  suggestedAllocation: number;
  allocationChange: number;
  changePercentage: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  impact: number;
}

export interface SpendingPattern {
  period: string;
  category: string;
  avgSpending: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  variance: number;
  predictedSpending: number;
  anomalies: Array<{
    date: Date;
    amount: number;
    deviation: number;
    description: string;
  }>;
}

export interface AnomalyDetection {
  budgetId: string;
  period: string;
  anomalies: Array<{
    type: 'spending_spike' | 'unusual_category' | 'timing_anomaly' | 'amount_anomaly';
    date: Date;
    category?: string;
    amount: number;
    expectedAmount: number;
    deviation: number;
    severity: 'low' | 'medium' | 'high';
    description: string;
    confidence: number;
  }>;
  totalAnomalies: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SavingsOpportunity {
  category: string;
  title: string;
  description: string;
  currentSpending: number;
  benchmarkSpending: number;
  potentialSavings: number;
  potentialMonthlySavings: number;
  potentialAnnualSavings: number;
  savingsPercentage: number;
  difficulty: 'easy' | 'moderate' | 'challenging';
  timeline: 'immediate' | 'short_term' | 'long_term';
  suggestions: string[];
  impact: 'low' | 'medium' | 'high';
}

export interface ScenarioAnalysis {
  scenarioName: string;
  description: string;
  projectedSavings: number;
  healthScoreChange: number;
  riskLevel: 'low' | 'medium' | 'high';
  assumptions: Array<{
    category: string;
    changeType: 'percentage' | 'amount';
    changeValue: number;
    reason: string;
  }>;
  projectedOutcome: {
    totalBudget: number;
    categoryBreakdown: Array<{
      category: string;
      originalAmount: number;
      projectedAmount: number;
      change: number;
    }>;
    riskAssessment: {
      level: 'low' | 'medium' | 'high';
      factors: string[];
    };
    feasibilityScore: number;
  };
}

export interface EducationalContent {
  id: string;
  title: string;
  summary: string;
  type: 'tip' | 'article' | 'tutorial' | 'insight';
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  content: string;
  tags: string[];
  relevanceScore: number;
  isPersonalized: boolean;
  readingTime: number;
  actionItems?: string[];
}

export interface PersonalizedInsight {
  id: string;
  type: 'spending_behavior' | 'budget_pattern' | 'goal_progress' | 'trend_analysis';
  title: string;
  description: string;
  insight: string;
  confidence: number;
  category?: string;
  timeframe: string;
  actionable: boolean;
  recommendations: string[];
  impact: 'low' | 'medium' | 'high';
  dataPoints: Array<{
    metric: string;
    value: number;
    comparison?: number;
    trend: 'up' | 'down' | 'stable';
  }>;
}

export interface BudgetOptimizationAnalysis {
  budgetId: string;
  analysisDate: Date;
  performanceMetrics: BudgetPerformanceMetrics;
  healthScore: BudgetHealthScore;
  categoryOptimizations: CategoryOptimization[];
  spendingPatterns: SpendingPattern[];
  anomalyDetection: AnomalyDetection;
  savingsOpportunities: SavingsOpportunity[];
  recommendations: BudgetRecommendation[];
  educationalContent: EducationalContent[];
  personalizedInsights: PersonalizedInsight[];
}

// Scenario Planning Interfaces
export interface ScenarioInput {
  name: string;
  description: string;
  changes: Array<{
    categoryId: string;
    changeType: 'increase' | 'decrease' | 'set_amount' | 'set_percentage';
    value: number;
    reason?: string;
  }>;
  timeframe: 'current' | 'next_month' | 'next_quarter' | 'next_year';
}

export interface ScenarioResult {
  scenario: ScenarioInput;
  projectedBudget: {
    totalAmount: number;
    categories: Array<{
      categoryId: string;
      categoryName: string;
      originalAmount: number;
      newAmount: number;
      change: number;
      changePercentage: number;
    }>;
  };
  impact: {
    financialImpact: number;
    riskLevel: 'low' | 'medium' | 'high';
    feasibility: number;
    recommendations: string[];
  };
  comparison: {
    vsCurrentBudget: {
      totalChange: number;
      categoryChanges: number;
      riskChange: number;
    };
    vsHistoricalData?: {
      similarity: number;
      performance: string;
      lessons: string[];
    };
  };
}

// Goal-based Budget Interfaces
export interface FinancialGoal {
  id: string;
  name: string;
  type: 'savings' | 'debt_reduction' | 'investment' | 'emergency_fund' | 'major_purchase';
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  priority: 'high' | 'medium' | 'low';
  monthlyContribution: number;
  progress: number;
  isOnTrack: boolean;
  projectedCompletion: Date;
}

export interface GoalBasedBudgetSuggestion {
  goalId: string;
  goalName: string;
  suggestedAllocation: number;
  sourceCategories: Array<{
    categoryId: string;
    categoryName: string;
    suggestedReduction: number;
    impact: string;
  }>;
  timeline: string;
  feasibility: number;
  tradeoffs: string[];
  benefits: string[];
}

// Machine Learning Insights
export interface MLInsight {
  id: string;
  type: 'prediction' | 'pattern' | 'anomaly' | 'recommendation';
  confidence: number;
  model: string;
  dataSource: string;
  generatedAt: Date;
  title: string;
  description: string;
  insight: string;
  actionable: boolean;
  category?: string;
  timeframe: string;
  accuracy?: number;
  supportingData: Array<{
    metric: string;
    value: any;
    significance: number;
  }>;
}
