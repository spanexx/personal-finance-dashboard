import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { AccessibilityService } from '../../shared/services/accessibility.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ReportService } from '../../core/services/report.service';
import { TransactionService } from '../../core/services/transaction.service';
import { BudgetService } from '../../core/services/budget.service';
import { GoalsService } from '../../core/services/goals.service';
import { CategoryService } from '../../core/services/category.service';
import { AiInsightsComponent } from './components/ai-insights/ai-insights.component';
import { AiChatComponent } from './components/ai-chat/ai-chat.component';
import { MaterialModule } from '../../shared/modules/material.module';

interface TimePeriod {
  value: string;
  label: string;
}

interface BudgetItem {
  category: string;
  limit: number;
  spent: number;
  color?: string;
}

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
}

interface CategoryExpense {
  category: {
    id: string;
    name: string;
    color: string;
  };
  amount: number;
  percentage: number;
}

interface PeriodCashflow {
  period?: string | number;
  year?: number;
  income: number;
  expenses?: number;
  expense?: number;
  net?: number;
  periodLabel?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MaterialModule,
    FormsModule,
    NgChartsModule,
    AiInsightsComponent,
    AiChatComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('dashboardTitle') dashboardTitle!: ElementRef;
  @ViewChild('periodSelect') periodSelect!: ElementRef;

  private destroy$ = new Subject<void>();
  private currentChartIndex = 0;
  private isLoading = false;
  private lastAnnouncementTime = 0;
  // Time period filter
  selectedTimePeriod = 'month';
  timePeriods: TimePeriod[] = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'all', label: 'All Time' }
  ];

  // Financial summary data
  totalIncome = 0;
  totalExpenses = 0;
  netBalance = 0;
  savingsRate = 0; // Add this line
  currentDateDisplay = '';

  // Transactions data
  recentTransactions: any[] = [];

  // Budget data
  budgetItems: BudgetItem[] = [];  // Savings goals data
  savingsGoals: SavingsGoal[] = [];
  // Chart data
  expenseChartData: ChartConfiguration<'pie'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: []
      }
    ]
  };

  expenseChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
      }
    }
  };

  incomeExpenseChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Income',
        backgroundColor: 'rgba(76, 175, 80, 0.7)',
      },
      {
        data: [],
        label: 'Expenses',
        backgroundColor: 'rgba(244, 67, 54, 0.7)',
      }
    ]
  };

  incomeExpenseChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '$' + value;
          }
        }
      }
    }
  };
  // Add this property to store top expense categories from summary
  public topExpenseCategories: any[] = [];

  constructor(
    private reportService: ReportService,
    private transactionService: TransactionService,
    private budgetService: BudgetService,
    private goalsService: GoalsService,
    private categoryService: CategoryService,
    private cdr: ChangeDetectorRef,
    private accessibilityService: AccessibilityService
  ) { }

  ngOnInit(): void {
    this.loadDashboardData();
    this.updateCurrentDateDisplay();
  }

  ngAfterViewInit(): void {
    // Set focus on the main dashboard title for accessibility
    setTimeout(() => {
      if (this.dashboardTitle?.nativeElement) {
        this.dashboardTitle.nativeElement.focus();
      }
    }, 100);

    // Announce dashboard load completion
    this.accessibilityService.announce('Dashboard loaded. Use Tab to navigate between widgets.');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load all dashboard data from real API services
   */
  loadDashboardData(): void {
    this.isLoading = true;
    this.announceLoadingStart();

    // Map dashboard period to allowed values for getDashboardSummary
    let summaryPeriod: 'week' | 'all' | 'monthly' | 'quarterly' | 'yearly';
    switch (this.selectedTimePeriod) {
      case 'week': summaryPeriod = 'week'; break;
      case 'month': summaryPeriod = 'monthly'; break;
      case 'quarter': summaryPeriod = 'quarterly'; break;
      case 'year': summaryPeriod = 'yearly'; break;
      case 'all': summaryPeriod = 'all'; break;
      default: summaryPeriod = 'monthly';
    }
    const destroy$ = this.destroy$;

    // 1. Financial summary (set all summary fields from period-aware summary API)
    this.reportService.getDashboardSummary(summaryPeriod).pipe(takeUntil(destroy$)).subscribe(summary => {
      // Log the summary for debugging
      console.log('DashboardSummary:', summary);
      if (summary) {
        this.totalIncome = summary.monthlyIncome ?? 0;
        this.totalExpenses = summary.monthlyExpenses ?? 0;
        this.netBalance = typeof summary.netWorth === 'number' ? summary.netWorth : (this.totalIncome - this.totalExpenses);
        this.savingsRate = typeof summary.savingsRate === 'number' ? summary.savingsRate : 0;
        
        // Extract top expense categories
        if (Array.isArray(summary.topExpenseCategories) && summary.topExpenseCategories.length > 0) {
          this.topExpenseCategories = summary.topExpenseCategories.map(cat => ({
            category: cat.categoryName || 'Unknown',
            amount: cat.totalAmount || 0,
            percentage: cat.percentage || 0
          }));
        }
        
        // Process transaction trends for income/expense chart if available
        if (Array.isArray(summary.recentTrends) && 
            summary.recentTrends.length > 0 && 
            summary.recentTrends[0] !== 'insufficient-data') {
          // Convert the API response to our PeriodCashflow interface
          const trendData: PeriodCashflow[] = summary.recentTrends.map(item => ({
            year: typeof item.year === 'number' ? item.year : undefined,
            period: typeof item.period === 'number' ? item.period : undefined,
            income: typeof item.income === 'number' ? item.income : 0,
            expense: typeof item.expense === 'number' ? item.expense : 0
          }));
          this.prepareIncomeExpenseChartData(trendData);
        } else {
          // If no trend data available, fetch from separate cashflow API as fallback
          this.reportService.getCashflowChartData().pipe(takeUntil(destroy$)).subscribe(result => {
            if (result && Array.isArray(result.cashflow)) {
              this.prepareIncomeExpenseChartData(result.cashflow);
            }
            this.cdr.detectChanges();
          });
        }
        
        this.cdr.detectChanges();
      }
    });

    // 2. Recent transactions (getTransactions, limit to 5, sort desc)
    this.transactionService.getTransactions({}, { page: 1, limit: 5, sortBy: 'date', sortOrder: 'desc' }).pipe(takeUntil(destroy$)).subscribe(result => {
      this.recentTransactions = (result && result.data) ? result.data : [];
      this.cdr.detectChanges();
    });

    // 3. Budget progress (getBudgets returns paginated)
    this.budgetService.getBudgets({}).pipe(takeUntil(destroy$)).subscribe(result => {
      if (result && result.data) {
        // Flatten all categoryAllocations from all budgets
        this.budgetItems = result.data.flatMap((budget: any) =>
          (budget.categoryAllocations || []).map((alloc: any) => ({
            category: alloc.category?.name || 'Unknown',
            limit: alloc.allocatedAmount ?? alloc.adjustedAmount ?? 0,
            spent: alloc.spentAmount ?? 0,
            color: alloc.category?.color || '#cccccc'
          }))
        );
        this.cdr.detectChanges();
      }
    });

    // 4. Savings goals (getGoals returns paginated)
    this.goalsService.getGoals({}, { page: 1, limit: 5 }).pipe(takeUntil(destroy$)).subscribe(result => {
      this.savingsGoals = (result && result.data) ? result.data.map((goal: any) => ({
        id: goal._id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        targetDate: goal.targetDate
      })) : [];
      this.cdr.detectChanges();
    });

    // 5. Expense breakdown by category (getSpendingAnalysis)
    // Use selected time period for date range
    const { startDate, endDate } = this.getDateRangeForPeriod(this.selectedTimePeriod);
    
    this.reportService.getSpendingAnalysis({
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      groupBy: 'category'
    }).pipe(takeUntil(destroy$)).subscribe(spending => {
      if (spending && spending.categoryBreakdown) {
        // Use topExpenseCategories if available, otherwise fall back to category breakdown
        if (this.topExpenseCategories.length > 0) {
          const categoryExpenses: CategoryExpense[] = this.topExpenseCategories.map((cat: any, idx: number) => ({
            category: {
              id: String(idx),
              name: cat.category || `Category ${idx + 1}`,
              color: this.getFallbackColor(idx)
            },
            amount: cat.amount ?? 0,
            percentage: cat.percentage ?? 0
          }));
          this.prepareExpenseChartData(categoryExpenses);
        } else {
          const categoryExpenses: CategoryExpense[] = spending.categoryBreakdown.map((cat: any, idx: number) => {
            const categoryObj = cat.category || {};
            return {
              category: {
                id: categoryObj.id ?? String(idx),
                name: categoryObj.name || `Category ${idx + 1}`,
                color: categoryObj.color || this.getFallbackColor(idx)
              },
              amount: cat.amount ?? 0,
              percentage: cat.percentage ?? 0
            };
          });
          this.prepareExpenseChartData(categoryExpenses);
        }
        this.cdr.detectChanges();
      }
      this.isLoading = false;
      this.announceDataUpdateComplete();
    }, (error: any) => {
      this.isLoading = false;
      this.accessibilityService.announce('Error loading dashboard data');
    });
  }

  /**
   * Announce loading start to screen readers
   */
  private announceLoadingStart(): void {
    this.accessibilityService.announce('Loading dashboard data...');
  }

  /**
   * Announce data update completion to screen readers
   */
  private announceDataUpdateComplete(): void {
    const message = `Dashboard updated for ${this.getSelectedPeriodLabel()}. ` +
      `Total income: ${this.formatCurrencyForAnnouncement(this.totalIncome)}, ` +
      `Total expenses: ${this.formatCurrencyForAnnouncement(this.totalExpenses)}, ` +
      `Net balance: ${this.formatCurrencyForAnnouncement(this.netBalance)}`;
    
    this.accessibilityService.announce(message);
  }

  /**
   * Handle keyboard navigation
   */
  onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'r':
      case 'R':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.refreshDashboard();
        }
        break;
      case 'f':
      case 'F':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.focusTimeFilter();
        }
        break;
      case 'Escape':
        this.focusDashboardTitle();
        break;
    }
  }

  /**
   * Refresh dashboard data
   */
  refreshDashboard(): void {
    this.accessibilityService.announce('Refreshing dashboard...');
    this.loadDashboardData();
  }

  /**
   * Focus the time filter for keyboard users
   */
  focusTimeFilter(): void {
    if (this.periodSelect?.nativeElement) {
      this.periodSelect.nativeElement.focus();
      this.accessibilityService.announce('Time period filter focused');
    }
  }

  /**
   * Focus the dashboard title
   */
  focusDashboardTitle(): void {
    if (this.dashboardTitle?.nativeElement) {
      this.dashboardTitle.nativeElement.focus();
      this.accessibilityService.announce('Dashboard title focused');
    }
  }

  /**
   * Handle time period change
   */
  onTimePeriodChange(): void {
    const periodLabel = this.getSelectedPeriodLabel();
    this.accessibilityService.announce(`Time period changed to ${periodLabel}. Loading data...`);
    this.loadDashboardData();
  }

  /**
   * Set current date display based on selected time period
   */
  setCurrentDateDisplay(): void {
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    
    this.currentDateDisplay = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  }
  /**
   * Update current date display based on selected time period
   */
  updateCurrentDateDisplay(): void {
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    
    switch (this.selectedTimePeriod) {
      case 'week':
        this.currentDateDisplay = `Week of ${now.toLocaleDateString()}`;
        break;
      case 'month':
        this.currentDateDisplay = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3) + 1;
        this.currentDateDisplay = `Q${quarter} ${now.getFullYear()}`;
        break;
      case 'year':
        this.currentDateDisplay = `${now.getFullYear()}`;
        break;
      default:
        this.currentDateDisplay = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    }
  }

  /**
   * Prepare data for expense breakdown chart
   */
  prepareExpenseChartData(spendingData: CategoryExpense[]): void {
    if (!spendingData || spendingData.length === 0) {
      this.expenseChartData.labels = [];
      this.expenseChartData.datasets[0].data = [];
      this.expenseChartData.datasets[0].backgroundColor = [];
      this.cdr.detectChanges();
      return;
    }

    this.expenseChartData.labels = spendingData.map(item => item.category.name);
    this.expenseChartData.datasets[0].data = spendingData.map(item => item.amount);
    this.expenseChartData.datasets[0].backgroundColor = spendingData.map(item => item.category.color);
    
    this.cdr.detectChanges();
  }

  /**
   * Prepare data for income vs expense chart
   * Handles both legacy format and new transaction trends format
   */
  prepareIncomeExpenseChartData(cashflowData: PeriodCashflow[]): void {
    if (!cashflowData || cashflowData.length === 0) {
      this.incomeExpenseChartData.labels = [];
      this.incomeExpenseChartData.datasets[0].data = [];
      this.incomeExpenseChartData.datasets[1].data = [];
      this.cdr.detectChanges();
      return;
    }

    // Determine if we're using new format based on presence of 'year' field
    const isNewFormat = typeof cashflowData[0].year === 'number';
    
    if (isNewFormat) {
      // New format from transaction trends
      // Sort data by date if needed
      const sortedData = [...cashflowData].sort((a, b) => {
        const yearA = typeof a.year === 'number' ? a.year : 0;
        const yearB = typeof b.year === 'number' ? b.year : 0;
        
        if (yearA !== yearB) return yearA - yearB;
        
        const periodA = typeof a.period === 'number' ? a.period : 0;
        const periodB = typeof b.period === 'number' ? b.period : 0;
        return periodA - periodB;
      });
      
      // Generate labels based on period type (day or month number)
      this.incomeExpenseChartData.labels = sortedData.map(item => {
        const year = typeof item.year === 'number' ? item.year : new Date().getFullYear();
        const periodNum = typeof item.period === 'number' ? item.period : 0;
        
        // Determine if this is a day (1-31) or month (1-12)
        if (periodNum > 12) {
          // Day format
          return `${periodNum}/${year}`;
        } else {
          // Month format - use month name
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const index = Math.max(0, Math.min(periodNum - 1, 11));
          return `${monthNames[index]} ${year}`;
        }
      });
      
      this.incomeExpenseChartData.datasets[0].data = sortedData.map(item => typeof item.income === 'number' ? item.income : 0);
      this.incomeExpenseChartData.datasets[1].data = sortedData.map(item => {
        if (typeof item.expense === 'number') return item.expense;
        if (typeof item.expenses === 'number') return item.expenses;
        return 0;
      });
    } else {
      // Old format from cashflow API
      this.incomeExpenseChartData.labels = cashflowData.map(item => {
        if (item.periodLabel) return item.periodLabel;
        if (typeof item.period === 'string') return item.period;
        return '';
      });
      this.incomeExpenseChartData.datasets[0].data = cashflowData.map(item => typeof item.income === 'number' ? item.income : 0);
      this.incomeExpenseChartData.datasets[1].data = cashflowData.map(item => {
        if (typeof item.expenses === 'number') return item.expenses;
        if (typeof item.expense === 'number') return item.expense;
        return 0;
      });
    }
    
    this.cdr.detectChanges();
  }

  /**
   * Get appropriate color for budget progress bar
   */
  getBudgetColor(budget: BudgetItem): string {
    const ratio = budget.spent / budget.limit;
    
    if (ratio < 0.7) {
      return 'primary'; // Good
    } else if (ratio < 1) {
      return 'accent'; // Warning
    } else {
      return 'warn'; // Over budget
    }
  }

  /**
   * Get budget status for screen readers
   */
  getBudgetStatusText(budget: BudgetItem): string {
    const ratio = budget.spent / budget.limit;
    const percentage = Math.round(ratio * 100);
    
    if (ratio < 0.7) {
      return `${budget.category}: ${percentage}% of budget used - on track`;
    } else if (ratio < 1) {
      return `${budget.category}: ${percentage}% of budget used - approaching limit`;
    } else {
      return `${budget.category}: ${percentage}% of budget used - over budget`;
    }
  }

  /**
   * Get savings goal status for screen readers
   */
  getSavingsGoalStatusText(goal: SavingsGoal): string {
    const percentage = Math.round((goal.currentAmount / goal.targetAmount) * 100);
    const remaining = goal.targetAmount - goal.currentAmount;
    
    return `${goal.name}: ${percentage}% complete, ${this.formatCurrencyForAnnouncement(remaining)} remaining to reach target`;
  }

  /**
   * Generates a text summary of the expense chart data for screen readers
   */
  getChartSummaryText(): string {
    if (!this.expenseChartData.labels || this.expenseChartData.labels.length === 0) {
      return 'No expense data available for chart display';
    }

    const total = (this.expenseChartData.datasets[0].data as number[]).reduce((sum, val) => sum + val, 0);
    const topCategory = this.getTopExpenseCategory();
    
    return `Expense breakdown chart showing ${this.expenseChartData.labels.length} categories. ` +
           `Total expenses: ${this.formatCurrencyForAnnouncement(total)}. ` +
           `Highest category: ${topCategory.name} with ${this.formatCurrencyForAnnouncement(topCategory.amount)}.`;
  }

  /**
   * Handles keyboard navigation for chart data
   */
  navigateChartData(direction: 'next' | 'previous'): void {
    if (!this.expenseChartData.labels || this.expenseChartData.labels.length === 0) {
      this.accessibilityService.announce('No chart data available to navigate');
      return;
    }

    const dataLength = this.expenseChartData.labels.length;
    
    if (direction === 'next') {
      this.currentChartIndex = (this.currentChartIndex + 1) % dataLength;
    } else {
      this.currentChartIndex = this.currentChartIndex === 0 ? dataLength - 1 : this.currentChartIndex - 1;
    }

    const message = this.getCurrentChartSegmentInfo();
    this.accessibilityService.announce(message);
  }

  /**
   * Gets information about the current chart segment for accessibility
   */
  private getCurrentChartSegmentInfo(): string {
    if (!this.expenseChartData.labels || this.expenseChartData.labels.length === 0) {
      return 'No chart data available';
    }

    const categoryName = this.expenseChartData.labels[this.currentChartIndex] as string;
    const amount = (this.expenseChartData.datasets[0].data as number[])[this.currentChartIndex];
    const total = (this.expenseChartData.datasets[0].data as number[]).reduce((sum, val) => sum + val, 0);
    const percentage = Math.round((amount / total) * 100);

    return `${categoryName}: ${this.formatCurrencyForAnnouncement(amount)}, ${percentage}% of total expenses`;
  }

  /**
   * Gets the top expense category for accessibility summary
   */
  private getTopExpenseCategory(): { name: string; amount: number } {
    if (!this.expenseChartData.labels || this.expenseChartData.labels.length === 0) {
      return { name: 'None', amount: 0 };
    }

    const data = this.expenseChartData.datasets[0].data as number[];
    const maxIndex = data.indexOf(Math.max(...data));

    return {
      name: this.expenseChartData.labels[maxIndex] as string,
      amount: data[maxIndex]
    };
  }

  /**
   * Get selected period label for announcements
   */
  private getSelectedPeriodLabel(): string {
    const period = this.timePeriods.find(p => p.value === this.selectedTimePeriod);
    return period ? period.label : 'Unknown period';
  }

  /**
   * Format currency for accessibility announcements
   */
  private formatCurrencyForAnnouncement(amount: number): string {
    if (amount === 0) {
      return 'zero dollars';
    }
    
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    
    return formatter.format(Math.abs(amount)) + (amount < 0 ? ' negative' : '');
  }

  /**
   * Throttle announcements to prevent spam
   */
  private throttleAnnouncement(message: string, minInterval: number = 1000): void {
    const now = Date.now();
    if (now - this.lastAnnouncementTime >= minInterval) {
      this.accessibilityService.announce(message);
      this.lastAnnouncementTime = now;
    }
  }

  /**
   * Get a fallback color for chart segments
   */
  private getFallbackColor(index: number): string {
    // Use a palette of visually distinct colors
    const palette = [
      '#4caf50', '#f44336', '#2196f3', '#ff9800', '#9c27b0',
      '#00bcd4', '#e91e63', '#8bc34a', '#ffc107', '#3f51b5',
      '#ff5722', '#607d8b', '#cddc39', '#795548', '#673ab7'
    ];
    return palette[index % palette.length];
  }

  /**
   * Get date range for the selected period
   */
  private getDateRangeForPeriod(period: string): { startDate: Date, endDate: Date } {
    const endDate = new Date();
    let startDate = new Date();
    
    switch(period) {
      case 'week': {
        // Start of week (Sunday)
        const day = startDate.getDay();
        startDate.setDate(startDate.getDate() - day);
        break;
      }
      case 'month': {
        // Start of month
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      }
      case 'quarter': {
        // Start of quarter
        const quarterMonth = Math.floor(endDate.getMonth() / 3) * 3;
        startDate = new Date(endDate.getFullYear(), quarterMonth, 1);
        break;
      }
      case 'year': {
        // Start of year
        startDate = new Date(endDate.getFullYear(), 0, 1);
        break;
      }
      case 'all': {
        // Start from 2020 as default for "all time"
        startDate = new Date(2020, 0, 1);
        break;
      }
      default: {
        // Default to month
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      }
    }
    
    // Set start date to beginning of day
    startDate.setHours(0, 0, 0, 0);
    
    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999);
    
    return { startDate, endDate };
  }
}
