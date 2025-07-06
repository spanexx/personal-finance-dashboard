import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Subject, Observable, combineLatest, timer, BehaviorSubject, of } from 'rxjs';
import { takeUntil, startWith, debounceTime, distinctUntilChanged, switchMap, catchError, take } from 'rxjs/operators';

import { MaterialModule } from '../../../shared/modules';
import { BudgetService, BudgetAlert, BudgetHealthScore } from '../../../core/services/budget.service';
import { Budget, BudgetAnalysis } from '../../../shared/models/budget.model';
import { NotificationService } from '../../../core/services/notification.service';
import { WebSocketService } from '../../../core/services/websocket.service';
// NgRx
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/state/app.state';
import * as BudgetActions from '../../../store/actions/budget.actions';
import { selectAllBudgets, selectBudgetLoading, selectBudgetError, selectSelectedBudget, selectBudgetPagination } from '../../../store/selectors/budget.selectors';
import { BudgetHealthScoreComponent } from '../budget-health-score/budget-health-score.component';

// Chart.js imports
import { ChartConfiguration, ChartOptions, ChartType } from 'chart.js';
import { NgChartsModule, BaseChartDirective } from 'ng2-charts';

interface BudgetTrackingData {
  budget: Budget;
  analysis: BudgetAnalysis;
  healthScore: BudgetHealthScore;
  alerts: BudgetAlert[];
  spendingVelocity: {
    daily: number;
    weekly: number;
    projectedMonthEnd: number;
    daysRemaining: number;
  };
  categories: {
    id: string;
    name: string;
    allocated: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: 'good' | 'warning' | 'over';
    projectedSpend: number;
    variance: number;
  }[];
  categoryPerformance: {
    categoryId: string;
    categoryName: string;
    budgeted: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: 'good' | 'warning' | 'over';
    projectedSpend: number;
    variance: number;
  }[];
}

interface BudgetRecommendation {
  id: string;
  type: 'overspending' | 'reallocation' | 'savings_opportunity' | 'goal_adjustment';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  icon: string;
  actionable?: boolean;
  actionIcon?: string;
  actionText?: string;
  actions?: RecommendationAction[];
  details?: { icon: string; text: string; }[];
  impact?: {
    savings?: number;
    category?: string;
    timeframe?: string;
  };
}

interface RecommendationAction {
  type: 'adjust_budget' | 'view_category' | 'create_goal' | 'reallocate';
  label: string;
  data: any;
}

interface AdjustmentPreview {
  current: { categoryName: string; amount: number; }[];
  new: { categoryName: string; amount: number; changeType: string; }[];
  totalBudget: number;
  remainingBudget?: number;
}

@Component({
  selector: 'app-budget-tracking-enhanced',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ReactiveFormsModule,
    MaterialModule,
    NgChartsModule,
    BudgetHealthScoreComponent
  ],
  templateUrl: './budget-tracking.component.html',
  styleUrls: ['./budget-tracking.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BudgetTrackingEnhancedComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(BaseChartDirective) spendingChart?: BaseChartDirective;

  // Component state
  loading = true;
  error: string | null = null;
  selectedBudgetId$ = new BehaviorSubject<string | null>(null);
  isRealtimeConnected$ = new BehaviorSubject<boolean>(false);

  // Data
  // budgets: Budget[] = []; // Will be driven by NgRx selector
  budgets$: Observable<Budget[]>;
  trackingData: BudgetTrackingData | null = null; // Details for selected budget
  alerts: BudgetAlert[] = []; // Keep local for now, or move to NgRx if managed globally

  // NEW: Enhanced features for PROMPT 4.2
  summaryPeriod: 'daily' | 'weekly' = 'daily';
  summaryData = {
    spent: 0,
    budget: 0,
    remaining: 0
  };
  recommendations: BudgetRecommendation[] = [];
  adjustmentPreview: AdjustmentPreview | null = null;

  // Mobile-specific properties
  isMobileView = false;
  mobileActionsExpanded = false;
  showMobileSummary = false;
  mobileSummaryPeriod: 'daily' | 'weekly' | 'monthly' = 'weekly';
  showAdjustmentPreview = false;

  // Forms
  alertSettingsForm!: FormGroup;
  budgetAdjustmentForm!: FormGroup;

  // Chart configurations
  spendingTrendChart: ChartConfiguration = {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Budgeted',
          data: [],
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          fill: true
        },
        {
          label: 'Actual Spending',
          data: [],
          borderColor: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          fill: true
        },
        {
          label: 'Projected',
          data: [],
          borderColor: '#FF9800',
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
          fill: false,
          borderDash: [5, 5]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Spending Trends vs Budget' }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (value) => `$${Number(value).toLocaleString()}` }
        }
      }
    }
  };

  categoryPerformanceChart: ChartConfiguration = {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [
          '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
          '#F44336', '#00BCD4', '#795548', '#607D8B'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' },
        title: { display: true, text: 'Budget Allocation vs Spending' }
      }
    }
  };

  // Utility properties
  Math = Math;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private budgetService: BudgetService, // Still used for analysis, health score, alerts etc.
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private webSocketService: WebSocketService,
    private router: Router,
    private store: Store<AppState> // Inject Store
  ) {
    this.initializeForms();
    this.budgets$ = this.store.select(selectAllBudgets);
  }

  ngOnInit(): void {
    // Subscribe to budgets from store
    this.budgets$.pipe(takeUntil(this.destroy$)).subscribe(budgets => {
      // this.budgets = budgets; // No longer needed if template uses async pipe
      if (budgets.length > 0 && !this.selectedBudgetId$.value) { // If no budget is selected yet, select the first one
        this.selectedBudgetId$.next(budgets[0]._id);
      } else if (budgets.length === 0 && !this.selectedBudgetId$.value) {
        this.loading = false; // Stop loading if there are no budgets
        this.error = 'No active budgets found. Create a budget to start tracking.';
      }
      this.cdr.detectChanges();
    });

    // Subscribe to loading and error states for the budget list
    this.store.select(selectBudgetLoading).pipe(takeUntil(this.destroy$)).subscribe(isLoading => {
      // This loading is for the list of budgets. Details loading is separate.
      if (this.selectedBudgetId$.value == null) { // only apply general loading if no budget is selected for detailed view
         this.loading = isLoading;
      }
      this.cdr.detectChanges();
    });

    this.store.select(selectBudgetError).pipe(takeUntil(this.destroy$)).subscribe(error => {
       if (this.selectedBudgetId$.value == null && error) { // only apply general error if no budget is selected
        this.error = error; // Assuming error is a string
        this.loading = false;
       }
      this.cdr.detectChanges();
    });

    this.dispatchLoadBudgets(); // Dispatch action to load initial list of budgets
    this.setupDataSubscriptions(); // Call to setup subscriptions for selected budget details
    this.setupWebSocketConnection();
    this.loadRecommendations(); // Remains, uses budgetService for now
    this.calculateSummaryData();
  }

  ngAfterViewInit(): void {
    this.updateCharts();
  }

  // ngOnDestroy(): void {
  //   this.destroy$.next();
  //   this.destroy$.complete();
  // }

  private initializeForms(): void {
    this.alertSettingsForm = this.fb.group({
      emailNotifications: [true],
      pushNotifications: [true],
      warningThreshold: [80],
      criticalThreshold: [95],
      overspendThreshold: [100],
      categoryAlerts: [true],
      weeklyReports: [true],
      monthlyReports: [true]
    });

    this.budgetAdjustmentForm = this.fb.group({
      categoryId: [''],
      adjustmentType: ['increase'],
      amount: [0],
      targetCategoryId: ['']
    });
  }

  // Renamed to reflect it's dispatching an action
  public dispatchLoadBudgets(): void {
    this.loading = true; // Set loading true for list loading
    this.error = null;
    this.store.dispatch(BudgetActions.loadBudgets({ filters: { status: 'active' }, page: 1, limit: 100 })); // Load active budgets, assuming limit for dropdown
  }

  // loadInitialData is now split: dispatchLoadBudgets for list, and selectedBudgetId$ subscription for details
  // public loadInitialData(): void { ... } // Original content moved/refactored

  // ngOnInit now handles subscription to selectedBudgetId$ for loading details
  // The detailed loading part needs to be refactored to use NgRx for the main Budget object
  // For now, keeping the existing service calls for analysis, health score, alerts to limit scope.
  // The goal is to get `trackingData.budget` from the store.

  private setupDataSubscriptions(): void {
     // Load tracking data when budget is selected
    this.selectedBudgetId$.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged(),
      filter(budgetId => !!budgetId), // Only proceed if budgetId is not null
      switchMap(budgetId => {
        // Dispatch action to load the specific budget details if not already loaded or needs refresh
        // For this integration, we assume loadBudget will fetch and update selectedBudget in store.
        this.store.dispatch(BudgetActions.loadBudget({ budgetId: budgetId! }));
        
        // Combine selectedBudget from store with other details from service
        return combineLatest([
          this.store.select(selectSelectedBudget).pipe(filter(b => !!b && b._id === budgetId)), // Ensure it's the correct loaded budget
          // These service calls remain for now as per scope.
          // They could be chained after selectedBudget emits, or handled by further NgRx effects if their data goes to store.
          this.budgetService.getBudgetAnalysis(budgetId!, { /* options */ }),
          this.budgetService.getBudgetHealthScore(budgetId!),
          this.budgetService.getBudgetAlerts({ budgetId: budgetId! })
        ]);
      }),
      catchError(error => {
        this.error = 'Failed to load detailed budget tracking data'; // Error for detail view
        this.loading = false; // Potentially set a different loading flag for details
        this.cdr.detectChanges();
        // Return of([]) or throwError to handle stream completion if needed
        return of([null, null, null, null] as [Budget | null, BudgetAnalysis | null, BudgetHealthScore | null, BudgetAlert[] | null]);
      })
    ).subscribe(([selectedBudgetFromStore, analysis, healthScore, alerts]) => {
      if (selectedBudgetFromStore) { // Budget object comes from store
        this.trackingData = this.processTrackingData(selectedBudgetFromStore, analysis!, healthScore!, alerts || []);
        this.alerts = alerts || [];
        // this.loading = false; // Loading for details, might need separate flag
        this.updateCharts();
        this.calculateSummaryData();
      } else {
        // Handle case where selected budget couldn't be loaded or found
        this.trackingData = null;
      }
      this.cdr.detectChanges();
    });
  }


  private setupWebSocketConnection(): void {
    // Monitor WebSocket connection status
    this.webSocketService.isConnected
      .pipe(takeUntil(this.destroy$))
      .subscribe(isConnected => {
        this.isRealtimeConnected$.next(isConnected);
        this.cdr.detectChanges();
      });

    // Listen for budget alerts
    this.webSocketService.budgetAlerts
      .pipe(takeUntil(this.destroy$))
      .subscribe(alert => {
        const currentBudgetId = this.selectedBudgetId$.value;
        if (alert.budgetId === currentBudgetId) {
          const budgetAlert: BudgetAlert = {
            id: `alert_${Date.now()}`,
            budgetId: alert.budgetId,
            type: alert.type,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            threshold: alert.threshold,
            actualAmount: alert.current,
            categoryId: alert.category,
            isRead: false,
            createdAt: alert.timestamp
          };
          this.alerts = [budgetAlert, ...this.alerts].slice(0, 10);
          this.cdr.detectChanges();
        }
      });

    // Listen for budget performance updates
    this.webSocketService.budgetPerformanceUpdates
      .pipe(takeUntil(this.destroy$))
      .subscribe(budgetData => {
        const currentBudgetId = this.selectedBudgetId$.value;
        if (currentBudgetId && budgetData.budgetId === currentBudgetId) {
          this.refreshTrackingData(currentBudgetId);
        }
      });
  }

  private processTrackingData(
    budget: Budget,
    analysis: BudgetAnalysis,
    healthScore: BudgetHealthScore,
    alerts: BudgetAlert[]
  ): BudgetTrackingData {
    const now = new Date();
    const budgetStart = new Date(budget.startDate);
    const budgetEnd = new Date(budget.endDate);
    const totalDays = Math.ceil((budgetEnd.getTime() - budgetStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysPassed = Math.ceil((now.getTime() - budgetStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysPassed);

    // Calculate spending velocity
    const dailySpend = budget.totalSpent / Math.max(1, daysPassed);
    const weeklySpend = dailySpend * 7;
    const projectedMonthEnd = dailySpend * totalDays;

    // Process category performance
    const categoryPerformance = budget.categories?.map((allocation: any) => {
      const spent = allocation.spent || 0;
      const budgeted = allocation.allocated;
      const remaining = budgeted - spent;
      const percentage = (spent / budgeted) * 100;
      
      let status: 'good' | 'warning' | 'over' = 'good';
      if (percentage > 100) status = 'over';
      else if (percentage > 80) status = 'warning';

      const categoryDailySpend = spent / Math.max(1, daysPassed);
      const projectedSpend = categoryDailySpend * totalDays;
      const variance = projectedSpend - budgeted;

      return {
        categoryId: allocation.category || allocation._id,
        categoryName: allocation.category || allocation.name,
        budgeted,
        spent,
        remaining,
        percentage,
        status,
        projectedSpend,
        variance
      };
    }) || [];    return {
      budget,
      analysis,
      healthScore,
      alerts,
      spendingVelocity: {
        daily: dailySpend,
        weekly: weeklySpend,
        projectedMonthEnd,
        daysRemaining
      },
      categories: budget.categories?.map((allocation: any) => ({
        id: allocation.category || allocation._id,
        name: allocation.category || allocation.name,
        allocated: allocation.allocated,
        spent: allocation.spent || 0,
        remaining: allocation.allocated - (allocation.spent || 0),
        percentage: ((allocation.spent || 0) / allocation.allocated) * 100,
        status: ((allocation.spent || 0) / allocation.allocated) > 1 ? 'over' : 
                ((allocation.spent || 0) / allocation.allocated) > 0.8 ? 'warning' : 'good',
        projectedSpend: (allocation.spent || 0) / Math.max(1, daysPassed) * totalDays,
        variance: ((allocation.spent || 0) / Math.max(1, daysPassed) * totalDays) - allocation.allocated
      })) || [],
      categoryPerformance
    };
  }

  private refreshTrackingData(budgetId: string): void {
    combineLatest([
      this.budgetService.getBudget(budgetId),
      this.budgetService.getBudgetAnalysis(budgetId, {
        includeProjections: true,
        includeTrends: true,
        includeComparisons: true
      }),
      this.budgetService.getBudgetHealthScore(budgetId),
      this.budgetService.getBudgetAlerts({ budgetId })
    ]).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.warn('Failed to refresh tracking data:', error);
        return of([]);
      })
    ).subscribe(result => {
      if (result.length > 0) {
        const [budget, analysis, healthScore, alerts] = result;
        this.trackingData = this.processTrackingData(budget, analysis, healthScore, alerts);
        this.alerts = alerts;
        this.updateCharts();
        this.calculateSummaryData();
        this.cdr.detectChanges();
      }
    });
  }

  private updateCharts(): void {
    if (!this.trackingData) return;
    this.updateSpendingTrendChart();
    this.updateCategoryPerformanceChart();
    
    setTimeout(() => {
      if (this.spendingChart) {
        this.spendingChart.update();
      }
    }, 100);
  }

  private updateSpendingTrendChart(): void {
    if (!this.trackingData?.analysis || !('trends' in this.trackingData.analysis)) return;

    const trends = (this.trackingData.analysis as any).trends || [];
    const labels = trends.map((t: any) => new Date(t.date).toLocaleDateString());
    const budgetedData = trends.map((t: any) => t.budgetedAmount);
    const actualData = trends.map((t: any) => t.actualSpent);
    const projectedData = trends.map((t: any) => t.projectedSpend);

    this.spendingTrendChart.data.labels = labels;
    this.spendingTrendChart.data.datasets[0].data = budgetedData;
    this.spendingTrendChart.data.datasets[1].data = actualData;
    this.spendingTrendChart.data.datasets[2].data = projectedData;
  }

  private updateCategoryPerformanceChart(): void {
    if (!this.trackingData?.categoryPerformance) return;

    const categories = this.trackingData.categoryPerformance;
    this.categoryPerformanceChart.data.labels = categories.map(c => c.categoryName);
    this.categoryPerformanceChart.data.datasets[0].data = categories.map(c => c.spent);
  }  // NEW: Enhanced methods for PROMPT 4.2 features
  private loadRecommendations(): void {
    this.selectedBudgetId$.pipe(
      take(1),
      takeUntil(this.destroy$)
    ).subscribe(selectedBudgetId => {
      if (selectedBudgetId) {
        this.loading = true;
        
        // Load optimization recommendations from backend
        this.budgetService.getBudgetOptimizationRecommendations([selectedBudgetId])
          .pipe(
            takeUntil(this.destroy$),
            catchError(error => {
              console.error('Error loading recommendations:', error);
              this.notificationService.error('Failed to load budget recommendations');
              // Fallback to mock recommendations
              this.generateMockRecommendations();
              return of(null);
            })
          )
          .subscribe(optimizationData => {
            if (optimizationData) {
              this.convertBackendRecommendations(optimizationData.recommendations);
            }
            this.loading = false;
            this.cdr.detectChanges();
          });      } else {
        // Fallback to mock if no budget selected
        this.generateMockRecommendations();
      }
    });
  }

  private convertBackendRecommendations(backendRecommendations: any[]): void {
    this.recommendations = backendRecommendations.map(rec => ({
      id: `${rec.type}_${rec.budgetId || 'global'}_${Date.now()}`,
      type: rec.category, // Map backend category to frontend type
      priority: rec.priority,
      title: rec.title,
      description: rec.description,
      icon: this.getRecommendationIcon(rec.type, rec.category),
      actionable: true,
      actionIcon: this.getActionIcon(rec.category),
      actionText: this.getActionText(rec.category),
      actions: this.generateActionsFromRecommendation(rec),
      impact: {
        savings: rec.metadata?.remainingAmount || rec.metadata?.overageAmount || 0,
        category: rec.metadata?.categoryName,
        timeframe: rec.metadata?.timeProgress ? `${(100 - rec.metadata.timeProgress).toFixed(0)}% time remaining` : undefined
      },
      details: this.generateDetailsFromRecommendation(rec)
    }));
  }

  private getRecommendationIcon(type: string, category: string): string {
    const iconMap: { [key: string]: string } = {
      'warning': 'warning',
      'action': 'build',
      'opportunity': 'lightbulb',
      'insight': 'insights',
      'suggestion': 'tips_and_updates',
      'overspending': 'warning',
      'burn_rate': 'speed',
      'category_overspend': 'category',
      'underutilization': 'trending_down',
      'pattern_analysis': 'analytics',
      'budget_structure': 'structure'
    };
    return iconMap[category] || iconMap[type] || 'info';
  }

  private getActionIcon(category: string): string {
    const actionIconMap: { [key: string]: string } = {
      'overspending': 'tune',
      'burn_rate': 'slow_motion_video',
      'category_overspend': 'swap_horiz',
      'underutilization': 'shuffle',
      'pattern_analysis': 'insights',
      'budget_structure': 'edit'
    };
    return actionIconMap[category] || 'build';
  }

  private getActionText(category: string): string {
    const actionTextMap: { [key: string]: string } = {
      'overspending': 'Adjust Budget',
      'burn_rate': 'Reduce Spending',
      'category_overspend': 'Reallocate',
      'underutilization': 'Optimize',
      'pattern_analysis': 'View Insights',
      'budget_structure': 'Restructure'
    };
    return actionTextMap[category] || 'Take Action';
  }

  private generateActionsFromRecommendation(recommendation: any): RecommendationAction[] {
    const actions: RecommendationAction[] = [];

    switch (recommendation.category) {
      case 'overspending':
        actions.push({
          type: 'adjust_budget',
          label: 'Increase Budget',
          data: { 
            budgetId: recommendation.budgetId,
            type: 'increase',
            amount: recommendation.metadata?.overageAmount || 0
          }
        });
        break;
      
      case 'category_overspend':
        if (recommendation.metadata?.categoryId) {
          actions.push({
            type: 'view_category',
            label: 'View Category',
            data: { categoryId: recommendation.metadata.categoryId }
          });
          actions.push({
            type: 'reallocate',
            label: 'Reallocate Funds',
            data: { 
              fromCategory: recommendation.metadata.categoryId,
              amount: recommendation.metadata.overage
            }
          });
        }
        break;
      
      case 'underutilization':
        actions.push({
          type: 'reallocate',
          label: 'Reallocate Surplus',
          data: { 
            budgetId: recommendation.budgetId,
            amount: recommendation.metadata?.remainingAmount || 0
          }
        });
        actions.push({
          type: 'create_goal',
          label: 'Create Savings Goal',
          data: { 
            amount: recommendation.metadata?.remainingAmount || 0,
            source: 'budget_surplus'
          }
        });
        break;
      
      case 'burn_rate':
        actions.push({
          type: 'adjust_budget',
          label: 'Reduce Spending Plan',
          data: { 
            budgetId: recommendation.budgetId,
            type: 'reduce_target',
            amount: recommendation.metadata?.projectedOverrun || 0
          }
        });
        break;
    }

    return actions;
  }

  private generateDetailsFromRecommendation(recommendation: any): { icon: string; text: string; }[] {
    const details: { icon: string; text: string; }[] = [];

    if (recommendation.metadata) {
      const metadata = recommendation.metadata;
      
      if (metadata.utilizationRate) {
        details.push({
          icon: 'percent',
          text: `Utilization: ${metadata.utilizationRate.toFixed(1)}%`
        });
      }
      
      if (metadata.timeProgress) {
        details.push({
          icon: 'schedule',
          text: `Time elapsed: ${metadata.timeProgress.toFixed(1)}%`
        });
      }
      
      if (metadata.budgetsAffected) {
        details.push({
          icon: 'account_balance_wallet',
          text: `Affects ${metadata.budgetsAffected} budgets`
        });
      }
      
      if (metadata.categoryName) {
        details.push({
          icon: 'category',
          text: `Category: ${metadata.categoryName}`
        });
      }
    }

    return details;
  }

  private generateMockRecommendations(): void {
    if (!this.trackingData) return;

    const recommendations: BudgetRecommendation[] = [];

    // Check for overspending categories
    this.trackingData.categoryPerformance.forEach(category => {
      if (category.status === 'over') {
        recommendations.push({
          id: `overspend_${category.categoryId}`,
          type: 'overspending',
          priority: 'high',
          title: `${category.categoryName} Over Budget`,
          description: `You've spent ${this.formatCurrency(category.spent)} out of ${this.formatCurrency(category.budgeted)}. Consider reallocating funds or reducing spending.`,
          icon: 'warning',
          actions: [
            {
              type: 'adjust_budget',
              label: 'Increase Budget',
              data: { categoryId: category.categoryId, type: 'increase', amount: category.spent - category.budgeted }
            },
            {
              type: 'reallocate',
              label: 'Reallocate Funds',
              data: { fromCategory: category.categoryId }
            }
          ]
        });
      }
    });

    // Check for underutilized categories
    this.trackingData.categoryPerformance.forEach(category => {
      if (category.percentage < 50) {
        recommendations.push({
          id: `underutilized_${category.categoryId}`,
          type: 'reallocation',
          priority: 'medium',
          title: `${category.categoryName} Underutilized`,
          description: `You've only used ${category.percentage.toFixed(1)}% of this budget. Consider reallocating surplus funds.`,
          icon: 'info',
          actions: [
            {
              type: 'reallocate',
              label: 'Reallocate Surplus',
              data: { fromCategory: category.categoryId, amount: category.remaining * 0.5 }
            }
          ]
        });
      }
    });

    // Check for overall spending velocity
    if (this.getSpendingVelocityStatus() === 'danger') {
      recommendations.push({
        id: 'velocity_warning',
        type: 'overspending',
        priority: 'high',
        title: 'High Spending Velocity',
        description: `At current pace, you'll exceed budget by ${this.formatCurrency(this.getProjectedOverage())}. Consider reducing spending.`,
        icon: 'speed',
        actions: [
          {
            type: 'adjust_budget',
            label: 'Increase Overall Budget',
            data: { type: 'increase', amount: this.getProjectedOverage() }
          }
        ]
      });
    }

    this.recommendations = recommendations.slice(0, 5); // Show top 5 recommendations
  }

  private calculateSummaryData(): void {
    if (!this.trackingData) return;

    const today = new Date();
    const startOfPeriod = this.summaryPeriod === 'daily' 
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
      : new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());

    const periodSpending = this.calculatePeriodSpending(startOfPeriod);
    const periodBudget = this.calculatePeriodBudget(startOfPeriod);

    this.summaryData = {
      spent: periodSpending,
      budget: periodBudget,
      remaining: periodBudget - periodSpending
    };
  }

  private calculatePeriodSpending(startDate: Date): number {
    if (!this.trackingData) return 0;
    const days = this.summaryPeriod === 'daily' ? 1 : 7;
    return this.trackingData.spendingVelocity.daily * days;
  }

  private calculatePeriodBudget(startDate: Date): number {
    if (!this.trackingData) return 0;
    
    const totalDays = Math.ceil(
      (new Date(this.trackingData.budget.endDate).getTime() - 
       new Date(this.trackingData.budget.startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const dailyBudget = this.trackingData.budget.totalAmount / totalDays;
    const days = this.summaryPeriod === 'daily' ? 1 : 7;
    
    return dailyBudget * days;
  }

  // Public methods for template
  onBudgetChange(budgetId: string): void {
    this.selectedBudgetId$.next(budgetId);
    
    if (this.isRealtimeConnected$.value) {
      this.webSocketService.joinRoom(`budget:${budgetId}`);
    }
  }

  reconnectWebSocket(): void {
    this.webSocketService.reconnect();
    this.notificationService.info('Attempting to reconnect real-time features...');
  }

  // Mobile widget methods
  toggleSummaryPeriod(): void {
    this.summaryPeriod = this.summaryPeriod === 'daily' ? 'weekly' : 'daily';
    this.calculateSummaryData();
  }

  openQuickExpenseEntry(): void {
    this.router.navigate(['/transactions/create'], {
      queryParams: { 
        type: 'expense',
        budget: this.selectedBudgetId$.value 
      }
    });
  }

  openBudgetAdjustment(): void {
    const adjustmentCard = document.querySelector('.budget-adjustment-card');
    if (adjustmentCard) {
      adjustmentCard.scrollIntoView({ behavior: 'smooth' });
    }
  }

  viewDailySummary(): void {
    this.summaryPeriod = 'daily';
    this.calculateSummaryData();
    this.notificationService.info('Daily summary updated');
  }
  viewWeeklySummary(): void {
    this.summaryPeriod = 'weekly';
    this.calculateSummaryData();
    this.notificationService.info('Weekly summary updated');
  }

  onBudgetAdjustment(): void {
    if (this.budgetAdjustmentForm.valid && this.trackingData) {
      const formData = this.budgetAdjustmentForm.value;
      console.log('Budget adjustment:', formData);
      
      const budgetId = this.selectedBudgetId$.value;
      if (budgetId) {
        this.refreshTrackingData(budgetId);
      }
      
      this.notificationService.success('Budget adjustment applied successfully');
      this.adjustmentPreview = null;
    }
  }

  executeRecommendationAction(recommendation: BudgetRecommendation, action: RecommendationAction): void {
    switch (action.type) {
      case 'adjust_budget':
        this.budgetAdjustmentForm.patchValue({
          categoryId: action.data.categoryId,
          adjustmentType: action.data.type,
          amount: action.data.amount
        });
        this.openBudgetAdjustment();
        break;
      
      case 'view_category':
        this.router.navigate(['/categories', action.data.categoryId]);
        break;
      
      case 'create_goal':
        this.router.navigate(['/goals/create'], {
          queryParams: action.data
        });
        break;
      
      default:
        console.log('Executing action:', action);
    }
  }

  // Helper methods
  getHealthScoreColor(score: number): string {
    if (score >= 80) return 'primary';
    if (score >= 60) return 'accent';
    return 'warn';
  }

  getHealthScoreIcon(grade: string): string {
    const icons: Record<string, string> = {
      'A': 'sentiment_very_satisfied',
      'B': 'sentiment_satisfied',
      'C': 'sentiment_neutral',
      'D': 'sentiment_dissatisfied',
      'F': 'sentiment_very_dissatisfied'
    };
    return icons[grade] || 'help';
  }

  getCategoryStatusColor(status: 'good' | 'warning' | 'over'): string {
    const colors = {
      good: 'primary',
      warning: 'accent',
      over: 'warn'
    };
    return colors[status];
  }

  getAlertSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      low: 'primary',
      medium: 'accent',
      high: 'warn',
      critical: 'warn'
    };
    return colors[severity] || 'primary';
  }

  getAlertIcon(type: string): string {
    const icons: Record<string, string> = {
      threshold_exceeded: 'warning',
      overspending: 'error',
      underspending: 'info',
      category_exceeded: 'category'
    };
    return icons[type] || 'notification_important';
  }

  getSpendingVelocityStatus(): 'good' | 'warning' | 'danger' {
    if (!this.trackingData) return 'good';
    
    const { projectedMonthEnd } = this.trackingData.spendingVelocity;
    const budget = this.trackingData.budget.totalAmount;
    const ratio = projectedMonthEnd / budget;
    
    if (ratio <= 0.9) return 'good';
    if (ratio <= 1.1) return 'warning';
    return 'danger';
  }

  getProjectedOverage(): number {
    if (!this.trackingData) return 0;
    
    const { projectedMonthEnd } = this.trackingData.spendingVelocity;
    const budget = this.trackingData.budget.totalAmount;
    
    return Math.max(0, projectedMonthEnd - budget);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }

  formatPercentage(value: number): string {
    return `${(value || 0).toFixed(1)}%`;
  }

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString();
  }

  markAlertAsRead(alert: BudgetAlert): void {
    this.budgetService.markAlertAsRead(alert.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        alert.isRead = true;
        this.cdr.detectChanges();
      });
  }

  markAllAlertsAsRead(): void {
    const budgetId = this.selectedBudgetId$.value;
    if (budgetId) {
      this.budgetService.markAllAlertsAsRead(budgetId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.alerts.forEach(alert => alert.isRead = true);
          this.cdr.detectChanges();
        });
    }
  }

  onAlertSettingsSubmit(): void {
    if (this.alertSettingsForm.valid) {
      const formData = this.alertSettingsForm.value;
      console.log('Alert settings updated:', formData);
      this.notificationService.success('Alert settings updated successfully');
    }
  }
  exportBudgetReport(): void {
    const budgetId = this.selectedBudgetId$.value;
    if (budgetId) {
      this.budgetService.exportBudget(budgetId, 'pdf', {
        includeTransactions: true,
        includeTrends: true
      }).pipe(takeUntil(this.destroy$))
      .subscribe(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `budget-report-${budgetId}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      });
    }
  }

  // Smart Recommendations Methods
  getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'high': return 'priority_high';
      case 'medium': return 'remove';
      case 'low': return 'low_priority';
      default: return 'info';
    }
  }

  getImpactClass(impact: any): string {
    if (!impact || !impact.savings) return '';
    if (impact.savings > 100) return 'high-impact';
    if (impact.savings > 50) return 'medium-impact';
    return 'low-impact';
  }

  executeRecommendation(recommendation: BudgetRecommendation): void {
    if (!recommendation.actionable) return;
    
    switch (recommendation.type) {
      case 'reallocation':
        this.openBudgetAdjustmentForRecommendation(recommendation);
        break;
      case 'savings_opportunity':
        this.applySavingsRecommendation(recommendation);
        break;
      default:
        this.notificationService.info('Recommendation action not implemented yet');
    }
  }

  dismissRecommendation(recommendationId: string): void {
    this.recommendations = this.recommendations.filter(r => r.id !== recommendationId);
    this.notificationService.success('Recommendation dismissed');
  }

  toggleRecommendationDetails(recommendation: BudgetRecommendation): void {
    // Toggle expanded state for recommendation details
    recommendation.details = recommendation.details || [];
    this.cdr.detectChanges();
  }

  // Budget Adjustment Methods
  getAmountPlaceholder(): string {
    const adjustmentType = this.budgetAdjustmentForm.get('adjustmentType')?.value;
    switch (adjustmentType) {
      case 'increase': return 'Enter amount to add';
      case 'decrease': return 'Enter amount to reduce';
      case 'reallocate': return 'Enter amount to move';
      default: return 'Enter amount';
    }
  }

  getAvailableTargetCategories(): any[] {
    const selectedCategoryId = this.budgetAdjustmentForm.get('selectedCategory')?.value;
    return this.trackingData?.categories?.filter(cat => cat.id !== selectedCategoryId) || [];
  }

  canPreviewAdjustment(): boolean {
    const form = this.budgetAdjustmentForm;
    const adjustmentType = form.get('adjustmentType')?.value;
    const selectedCategory = form.get('selectedCategory')?.value;
    const amount = form.get('amount')?.value;

    if (!adjustmentType || !selectedCategory || !amount || amount <= 0) {
      return false;
    }

    if (adjustmentType === 'reallocate') {
      const targetCategory = form.get('targetCategory')?.value;
      return !!targetCategory;
    }

    return true;
  }

  canApplyAdjustment(): boolean {
    return this.canPreviewAdjustment() && this.showAdjustmentPreview && this.adjustmentPreview !== null;
  }

  previewAdjustment(): void {
    if (!this.canPreviewAdjustment() || !this.trackingData) return;

    const form = this.budgetAdjustmentForm;
    const adjustmentType = form.get('adjustmentType')?.value;
    const selectedCategoryId = form.get('selectedCategory')?.value;
    const amount = form.get('amount')?.value;
    const targetCategoryId = form.get('targetCategory')?.value;

    const selectedCategory = this.trackingData.categories.find(c => c.id === selectedCategoryId);
    if (!selectedCategory) return;

    let current: { categoryName: string; amount: number; }[] = [];
    let newState: { categoryName: string; amount: number; changeType: string; }[] = [];
    let totalBudget = this.trackingData.budget.totalAmount;

    switch (adjustmentType) {
      case 'increase':
        current = [{ categoryName: selectedCategory.name, amount: selectedCategory.allocated }];
        newState = [{ 
          categoryName: selectedCategory.name, 
          amount: selectedCategory.allocated + amount,
          changeType: 'increase'
        }];
        totalBudget += amount;
        break;

      case 'decrease':
        current = [{ categoryName: selectedCategory.name, amount: selectedCategory.allocated }];
        newState = [{ 
          categoryName: selectedCategory.name, 
          amount: Math.max(0, selectedCategory.allocated - amount),
          changeType: 'decrease'
        }];
        totalBudget -= Math.min(amount, selectedCategory.allocated);
        break;

      case 'reallocate':
        const targetCategory = this.trackingData.categories.find(c => c.id === targetCategoryId);
        if (!targetCategory) return;

        current = [
          { categoryName: selectedCategory.name, amount: selectedCategory.allocated },
          { categoryName: targetCategory.name, amount: targetCategory.allocated }
        ];
        newState = [
          { 
            categoryName: selectedCategory.name, 
            amount: Math.max(0, selectedCategory.allocated - amount),
            changeType: 'decrease'
          },
          { 
            categoryName: targetCategory.name, 
            amount: targetCategory.allocated + Math.min(amount, selectedCategory.allocated),
            changeType: 'increase'
          }
        ];
        break;
    }

    this.adjustmentPreview = {
      current,
      new: newState,
      totalBudget,
      remainingBudget: totalBudget - this.trackingData.budget.totalSpent
    };

    this.showAdjustmentPreview = true;
    this.cdr.detectChanges();
  }

  applyBudgetAdjustment(): void {
    if (!this.canApplyAdjustment() || !this.adjustmentPreview) return;

    // Here you would call the budget service to apply the changes
    this.notificationService.success('Budget adjustment applied successfully');
    this.resetAdjustmentForm();
    this.loadInitialData(); // Refresh data
  }

  resetAdjustmentForm(): void {
    this.budgetAdjustmentForm.reset();
    this.adjustmentPreview = null;
    this.showAdjustmentPreview = false;
    this.cdr.detectChanges();
  }

  // Mobile Methods
  toggleMobileActionsExpanded(): void {
    this.mobileActionsExpanded = !this.mobileActionsExpanded;
    this.cdr.detectChanges();
  }

  quickAddTransaction(): void {
    this.router.navigate(['/transactions/add']);
  }

  quickBudgetAdjust(): void {
    // Scroll to budget adjustment tool or open a quick dialog
    const element = document.querySelector('.budget-adjustment-tool');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  viewRecommendations(): void {
    // Scroll to recommendations section
    const element = document.querySelector('.smart-recommendations');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  exportMobileReport(): void {
    this.exportBudgetReport();
  }

  // Helper Methods for Recommendations
  private openBudgetAdjustmentForRecommendation(recommendation: BudgetRecommendation): void {
    // Pre-fill budget adjustment form based on recommendation
    if (recommendation.impact?.category) {
      this.budgetAdjustmentForm.patchValue({
        adjustmentType: 'reallocate',
        selectedCategory: recommendation.impact.category
      });
      this.quickBudgetAdjust();
    }
  }

  private applySavingsRecommendation(recommendation: BudgetRecommendation): void {
    // Apply automatic savings recommendations
    this.notificationService.info('Savings recommendation applied automatically');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
