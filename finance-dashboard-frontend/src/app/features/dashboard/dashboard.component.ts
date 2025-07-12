import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
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
  period: string;
  income: number;
  expenses: number;
  net: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatProgressBarModule,
    MatSelectModule,
    MatFormFieldModule,
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
    let summaryPeriod: 'monthly' | 'quarterly' | 'yearly' | undefined;
    switch (this.selectedTimePeriod) {
      case 'month': summaryPeriod = 'monthly'; break;
      case 'quarter': summaryPeriod = 'quarterly'; break;
      case 'year': summaryPeriod = 'yearly'; break;
      default: summaryPeriod = undefined;
    }
    const destroy$ = this.destroy$;

    // 1. Financial summary & income vs expenses
    this.reportService.getDashboardSummary(summaryPeriod).pipe(takeUntil(destroy$)).subscribe(summary => {
      console.log('Dashboard summary:', summary);
      if (summary) {
        this.totalIncome = summary.monthlyIncome ?? 0;
        this.totalExpenses = summary.monthlyExpenses ?? 0;
        // netBalance: use netWorth if available, else income - expenses
        this.netBalance = typeof summary.netWorth === 'number' ? summary.netWorth : (this.totalIncome - this.totalExpenses);
        this.savingsRate = typeof summary.savingsRate === 'number' ? summary.savingsRate : 0; // Add this line
        // Optionally, you can use summary.recentTrends for chart data if available
        if (summary.recentTrends && Array.isArray(summary.recentTrends)) {
          // Map recentTrends to PeriodCashflow[] for the chart
          const cashflowData = summary.recentTrends.map((trend: any) => ({
            period: trend.period,
            income: trend.income,
            expenses: trend.expenses,
            net: trend.income - trend.expenses
          }));
          this.prepareIncomeExpenseChartData(cashflowData);
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
        this.budgetItems = result.data.map((cat: any) => ({
          category: cat.categoryDetails?.name || cat.category,
          limit: cat.amount,
          spent: cat.spent,
          color: cat.categoryDetails?.color || '#cccccc'
        }));
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
    // Use current month as default range for demo; adjust as needed
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    this.reportService.getSpendingAnalysis({
      startDate,
      endDate,
      groupBy: 'category'
    }).pipe(takeUntil(destroy$)).subscribe(spending => {
      if (spending && spending.categoryBreakdown) {
        // Map categoryBreakdown to CategoryExpense[]
        const categoryExpenses = spending.categoryBreakdown.map((cat: any) => ({
          category: {
            id: cat.categoryId,
            name: cat.categoryName,
            color: cat.color || '#cccccc'
          },
          amount: cat.amount,
          percentage: cat.percentage
        }));
        this.prepareExpenseChartData(categoryExpenses);
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
   */
  prepareIncomeExpenseChartData(cashflowData: PeriodCashflow[]): void {
    if (!cashflowData || cashflowData.length === 0) {
      this.incomeExpenseChartData.labels = [];
      this.incomeExpenseChartData.datasets[0].data = [];
      this.incomeExpenseChartData.datasets[1].data = [];
      this.cdr.detectChanges();
      return;
    }

    this.incomeExpenseChartData.labels = cashflowData.map(item => item.period);
    this.incomeExpenseChartData.datasets[0].data = cashflowData.map(item => item.income);
    this.incomeExpenseChartData.datasets[1].data = cashflowData.map(item => item.expenses);
    
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
}
