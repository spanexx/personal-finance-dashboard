import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { TransactionService, TransactionAnalytics } from '../../../core/services/transaction.service';
import { ReportService, SpendingAnalysis, IncomeAnalysis } from '../../../core/services/report.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ChartOptions, ChartConfiguration } from 'chart.js';
import { CategoryDetailsDialogComponent } from './category-details-dialog.component';
import { LiveAnnouncer } from '@angular/cdk/a11y';

@Component({
  selector: 'app-transaction-analytics',
  templateUrl: './transaction-analytics.component.html',
  styleUrls: ['./transaction-analytics.component.scss']
})
export class TransactionAnalyticsComponent implements OnInit, OnDestroy {
  // Data containers
  transactionAnalytics: TransactionAnalytics | null = null;
  spendingAnalysis: SpendingAnalysis | null = null;
  incomeAnalysis: IncomeAnalysis | null = null;
  
  // UI state
  loading = false;
  error: string | null = null;
  selectedTimeframe: 'week' | 'month' | 'quarter' | 'year' | 'custom' = 'month';
  selectedChartType: 'line' | 'bar' | 'pie' = 'line';
  
  // Date range form
  dateRangeForm: FormGroup;
  isCustomDateRange = false;
  
  // Charts
  monthlyTrendsChart: any;
  categoryBreakdownChart: any;
  spendingPatternsChart: any;
  
  // Comparison data
  showComparison = false;
  comparisonPeriod: 'previous' | 'lastYear' = 'previous';
  
  // Accessibility focus management
  @ViewChild('summarySection') summarySection!: ElementRef;
  @ViewChild('chartSection') chartSection!: ElementRef;
  
  // Component lifecycle
  private destroy$ = new Subject<void>();
  constructor(
    private transactionService: TransactionService,
    private reportService: ReportService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private liveAnnouncer: LiveAnnouncer
  ) {
    // Initialize date range form
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    this.dateRangeForm = this.fb.group({
      startDate: [firstDayOfMonth],
      endDate: [lastDayOfMonth]
    });
  }
  
  ngOnInit(): void {
    this.loadAnalyticsData();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Loads transaction analytics data based on selected timeframe
   */
  loadAnalyticsData(): void {
    this.loading = true;
    this.error = null;
    
    // Announce loading state to screen readers
    this.liveAnnouncer.announce('Loading analytics data for the selected time period.');
    
    // Calculate date range based on selected timeframe
    const dateRange = this.calculateDateRange();
    
    // Load transaction analytics
    this.transactionService.getTransactionAnalytics({
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
      compareWith: this.showComparison ? this.comparisonPeriod : undefined
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (data) => {
        this.transactionAnalytics = data;
        this.generateCharts();
        this.loading = false;
        
        // Announce data loaded to screen readers
        const period = this.getPeriodDescription();
        this.liveAnnouncer.announce(`Analytics data loaded for ${period}. Income: ${data.totalIncome.toFixed(2)}, Expenses: ${data.totalExpenses.toFixed(2)}, Net: ${data.netIncome.toFixed(2)}`);
        
        // Set focus to summary section
        setTimeout(() => {
          if (this.summarySection && this.summarySection.nativeElement) {
            this.summarySection.nativeElement.focus();
          }
        }, 100);
      },
      error: (err) => {
        this.error = 'Failed to load transaction analytics';
        this.notificationService.error('Error loading analytics data');
        this.loading = false;
        console.error(err);
        
        // Announce error to screen readers
        this.liveAnnouncer.announce('Error loading analytics data. Please try again.');
      }
    });
    
    // Load spending analysis
    this.reportService.getSpendingAnalysis({
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (data) => {
        this.spendingAnalysis = data;
      },
      error: (err) => {
        console.error('Failed to load spending analysis', err);
      }
    });
    
    // Load income analysis
    this.reportService.getIncomeAnalysis({
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (data) => {
        this.incomeAnalysis = data;
      },
      error: (err) => {
        console.error('Failed to load income analysis', err);
      }
    });
  }
  
  /**
   * Calculate date range based on selected timeframe
   */
  calculateDateRange(): { startDate: Date, endDate: Date } {
    const today = new Date();
    let startDate: Date;
    let endDate = new Date();
    
    switch (this.selectedTimeframe) {
      case 'week':
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), quarter * 3, 1);
        endDate = new Date(today.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        break;
      case 'custom':
        startDate = this.dateRangeForm.get('startDate')?.value || today;
        endDate = this.dateRangeForm.get('endDate')?.value || today;
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    
    return { startDate, endDate };
  }
  
  /**
   * Change the selected timeframe and reload data
   */
  changeTimeframe(timeframe: 'week' | 'month' | 'quarter' | 'year' | 'custom'): void {
    this.selectedTimeframe = timeframe;
    this.isCustomDateRange = timeframe === 'custom';
    
    if (!this.isCustomDateRange) {
      this.loadAnalyticsData();
    }
  }
  
  /**
   * Apply custom date range
   */
  applyCustomDateRange(): void {
    if (this.dateRangeForm.valid) {
      this.loadAnalyticsData();
    }
  }
  
  /**
   * Toggle comparison with previous period
   */
  toggleComparison(): void {
    this.showComparison = !this.showComparison;
    this.loadAnalyticsData();
  }
  
  /**
   * Change comparison period
   */
  changeComparisonPeriod(period: 'previous' | 'lastYear'): void {
    this.comparisonPeriod = period;
    if (this.showComparison) {
      this.loadAnalyticsData();
    }
  }
  
  /**
   * Change chart type
   */
  changeChartType(type: 'line' | 'bar' | 'pie'): void {
    this.selectedChartType = type;
    this.generateCharts();
  }
    /**
   * Show category details in a dialog
   */
  showCategoryDetails(category: any): void {
    const dateRange = this.calculateDateRange();
    
    this.dialog.open(CategoryDetailsDialogComponent, {
      width: '800px',
      data: {
        category: category.category,
        amount: category.amount,
        percentage: category.percentage,
        count: category.count,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString()
      }
    });
  }
  
  /**
   * Generate charts based on analytics data
   */
  generateCharts(): void {
    if (!this.transactionAnalytics) return;
    
    // Monthly trends chart configuration
    this.monthlyTrendsChart = {
      type: this.selectedChartType === 'pie' ? 'line' : this.selectedChartType,
      data: {
        labels: this.transactionAnalytics.monthlyTrends.map(trend => trend.month),
        datasets: [
          {
            label: 'Income',
            data: this.transactionAnalytics.monthlyTrends.map(trend => trend.income),
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          },
          {
            label: 'Expenses',
            data: this.transactionAnalytics.monthlyTrends.map(trend => trend.expenses),
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          },
          {
            label: 'Net Income',
            data: this.transactionAnalytics.monthlyTrends.map(trend => trend.net),
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          },
          title: {
            display: true,
            text: 'Monthly Financial Trends'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Amount'
            }
          }
        }
      }
    };
      // Category breakdown chart
    this.categoryBreakdownChart = {
      type: 'pie',
      data: {
        labels: this.transactionAnalytics.categoryBreakdown.map(cat => cat.category),
        datasets: [
          {
            data: this.transactionAnalytics.categoryBreakdown.map(cat => cat.amount),
            backgroundColor: [
              'rgba(255, 99, 132, 0.6)',
              'rgba(54, 162, 235, 0.6)',
              'rgba(255, 206, 86, 0.6)',
              'rgba(75, 192, 192, 0.6)',
              'rgba(153, 102, 255, 0.6)',
              'rgba(255, 159, 64, 0.6)',
              'rgba(199, 199, 199, 0.6)',
              'rgba(83, 102, 255, 0.6)',
              'rgba(40, 159, 64, 0.6)',
              'rgba(210, 199, 199, 0.6)'
            ],
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
          },
          tooltip: {
            callbacks: {
              label: function(context: any) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const dataset = context.dataset;
                const total = dataset.data.reduce((acc: number, data: number) => acc + data, 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          },
          title: {
            display: true,
            text: 'Spending by Category'
          }
        },
        onClick: (event: any, elements: any) => {
          if (elements && elements.length > 0) {
            const index = elements[0].index;
            const category = this.transactionAnalytics?.categoryBreakdown[index];
            if (category) {
              this.showCategoryDetails(category);
            }
          }
        }
      }
    };
    
    // Spending patterns chart
    this.spendingPatternsChart = {
      type: this.selectedChartType === 'pie' ? 'bar' : this.selectedChartType,
      data: {
        labels: this.transactionAnalytics.spendingPatterns.map(pattern => pattern.dayOfWeek),
        datasets: [
          {
            label: 'Average Amount',
            data: this.transactionAnalytics.spendingPatterns.map(pattern => pattern.averageAmount),
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            borderColor: 'rgba(153, 102, 255, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Spending Patterns by Day of Week'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Average Amount'
            }
          }
        }
      }
    };
  }
  
  /**
   * Export chart as image
   */
  exportChartAsImage(chartId: string): void {
    const canvas = document.getElementById(chartId) as HTMLCanvasElement;
    if (canvas) {
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${chartId}-export.png`;
      link.href = image;
      link.click();
    }
  }
  
  /**
   * Print the analytics dashboard
   */
  printDashboard(): void {
    window.print();
  }
    /**
   * Export analytics data as CSV
   */
  exportAnalyticsData(): void {
    if (!this.transactionAnalytics) return;
    
    // Request export from the report service
    const dateRange = this.calculateDateRange();
    this.reportService.exportAnalyticsData('transaction_analytics', {
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
      format: 'csv'
    }).subscribe({
      next: (response) => {
        // Handle file download
        const url = window.URL.createObjectURL(response);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'transaction-analytics.csv';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.notificationService.error('Failed to export analytics data');
        console.error(err);
      }
    });
  }
  
  /**
   * Get a human-readable description of the current period
   */
  private getPeriodDescription(): string {
    const dateRange = this.calculateDateRange();
    
    switch (this.selectedTimeframe) {
      case 'week':
        return 'the current week';
      case 'month':
        return `${dateRange.startDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
      case 'quarter':
        const quarter = Math.floor(dateRange.startDate.getMonth() / 3) + 1;
        return `Q${quarter} ${dateRange.startDate.getFullYear()}`;
      case 'year':
        return dateRange.startDate.getFullYear().toString();
      case 'custom':
        return `${dateRange.startDate.toLocaleDateString()} to ${dateRange.endDate.toLocaleDateString()}`;
      default:
        return 'the selected period';
    }
  }
}
