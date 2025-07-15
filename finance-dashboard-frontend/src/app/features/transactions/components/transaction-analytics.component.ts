import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
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
    private liveAnnouncer: LiveAnnouncer,
    private cdr: ChangeDetectorRef
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
    
    // Trigger change detection immediately when loading starts
    this.cdr.detectChanges();
    
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
        
        // Trigger change detection
        this.cdr.detectChanges();
        
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
        this.cdr.detectChanges();
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
        this.cdr.detectChanges();
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
        this.cdr.detectChanges();
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
    
    // Trigger change detection immediately
    this.cdr.detectChanges();
    
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
  private categoryDialogRef: any = null;
  showCategoryDetails(category: any): void {
    if (this.categoryDialogRef) {
      return;
    }
    const dateRange = this.calculateDateRange();
    // Always try to pass the category ID if available, fallback to name (for legacy data)
    let categoryId: string | undefined = undefined;
    if (category.category && typeof category.category === 'object' && category.category._id) {
      categoryId = category.category._id;
    } else if (category.category && typeof category.category === 'string' && category._id) {
      // Some legacy data may have category as string and _id at root
      categoryId = category._id;
    }
    const amount = category.totalAmount || category.amount;
    // Calculate percentage if not present
    let percentage = typeof category.percentage === 'number' ? category.percentage : this.getCategoryPercentage(category);
    this.categoryDialogRef = this.dialog.open(CategoryDetailsDialogComponent, {
      width: '800px',
      data: {
        category: categoryId || category.category, // Prefer ID, fallback to name
        amount: amount,
        percentage: percentage,
        count: category.transactionCount || category.count,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString()
      }
    });
    this.categoryDialogRef.afterClosed().subscribe(() => {
      this.categoryDialogRef = null;
    });
  }
  
  /**
   * Generate charts based on analytics data
   */
  generateCharts(): void {
    if (!this.transactionAnalytics) {
      return;
    }

    // Ensure arrays exist and have data
    const monthlyTrends = this.transactionAnalytics.monthlyTrends || [];
    const categoryBreakdown = this.transactionAnalytics.categoryBreakdown || [];
    const spendingPatterns = this.transactionAnalytics.spendingPatterns || [];
    const topMerchants = this.transactionAnalytics.topMerchants || [];

    // Log Top Merchants data for analysis
    if (topMerchants.length > 0) {
      console.log('🏪 [TOP-MERCHANTS] Processing top merchants data:', {
        rawTopMerchantsCount: topMerchants.length,
        rawTopMerchantsData: topMerchants,
        selectedTimeframe: this.selectedTimeframe,
        dataStructure: topMerchants.map(merchant => {
          const merchantData = merchant as any;
          return {
            name: merchant.name,
            amount: merchant.amount,
            count: merchant.count,
            averageAmount: merchantData.averageAmount,
            lastTransaction: merchantData.lastTransaction,
            keys: Object.keys(merchant)
          };
        }),
        totalSpending: topMerchants.reduce((sum, merchant) => sum + (merchant.amount || 0), 0),
        topMerchantName: topMerchants[0]?.name || 'N/A',
        topMerchantAmount: topMerchants[0]?.amount || 0
      });
    } else {
      console.log('🏪 [TOP-MERCHANTS] No merchant data available for current timeframe:', {
        selectedTimeframe: this.selectedTimeframe,
        transactionAnalyticsKeys: Object.keys(this.transactionAnalytics)
      });
    }

    // Log Category Breakdown data for analysis
    if (categoryBreakdown.length > 0) {
      console.log('📊 [CATEGORY-BREAKDOWN] Processing category breakdown data:', {
        rawCategoryBreakdownCount: categoryBreakdown.length,
        rawCategoryBreakdownData: categoryBreakdown,
        selectedTimeframe: this.selectedTimeframe,
        dataStructure: categoryBreakdown.map(category => {
          const categoryData = category as any;
          return {
            category: category.category,
            categoryType: typeof category.category,
            categoryName: categoryData.category?.name || 'N/A',
            amount: category.amount,
            totalAmount: categoryData.totalAmount,
            percentage: category.percentage,
            count: category.count,
            transactionCount: categoryData.transactionCount,
            keys: Object.keys(category)
          };
        }),
        totalAmount: categoryBreakdown.reduce((sum, cat) => sum + (cat.amount || (cat as any).totalAmount || 0), 0),
        topCategoryName: (() => {
          const firstCategory = categoryBreakdown[0];
          if (!firstCategory) return 'N/A';
          const categoryData = firstCategory as any;
          if (categoryData.category && typeof categoryData.category === 'object' && categoryData.category.name) {
            return categoryData.category.name;
          }
          return String(firstCategory.category || 'N/A');
        })()
      });
    } else {
      console.log('📊 [CATEGORY-BREAKDOWN] No category breakdown data available for current timeframe:', {
        selectedTimeframe: this.selectedTimeframe,
        transactionAnalyticsKeys: Object.keys(this.transactionAnalytics)
      });
    }

    // Only generate charts if we have data
    if (monthlyTrends.length === 0 && categoryBreakdown.length === 0 && spendingPatterns.length === 0) {
      this.monthlyTrendsChart = null;
      this.categoryBreakdownChart = null;
      this.spendingPatternsChart = null;
      return;
    }
    
    // Monthly trends chart configuration
    if (monthlyTrends.length > 0) {
      // Ensure all data is properly formatted
      const labels = monthlyTrends.map(trend => String(trend.month || 'Unknown'));
      const incomeData = monthlyTrends.map(trend => Number(trend.income) || 0);
      const expenseData = monthlyTrends.map(trend => Number(trend.expenses) || 0);
      const netData = monthlyTrends.map(trend => Number(trend.net) || 0);
      
      this.monthlyTrendsChart = {
        type: this.selectedChartType === 'pie' ? 'line' : this.selectedChartType,
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Income',
              data: incomeData,
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            },
            {
              label: 'Expenses',
              data: expenseData,
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            },
            {
              label: 'Net Income',
              data: netData,
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                generateLabels: function(chart: any) {
                  const data = chart.data;
                  if (data.datasets && data.datasets.length) {
                    return data.datasets.map((dataset: any, i: number) => {
                      return {
                        text: String(dataset.label || `Dataset ${i + 1}`),
                        fillStyle: dataset.backgroundColor,
                        strokeStyle: dataset.borderColor,
                        lineWidth: dataset.borderWidth || 1,
                        index: i
                      };
                    });
                  }
                  return [];
                }
              }
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
    } else {
      this.monthlyTrendsChart = null;
    }

    // Category breakdown chart
    if (categoryBreakdown.length > 0) {
      // Ensure all labels are strings - handle both interface format and actual backend format
      const labels = categoryBreakdown.map(cat => {
        const categoryData = cat as any;
        // Check if category is an object with name property (actual backend format)
        if (categoryData.category && typeof categoryData.category === 'object' && categoryData.category.name) {
          return String(categoryData.category.name);
        }
        // Fallback to treating category as string (interface format)
        return String(cat.category || 'Unknown');
      });
      
      // Use totalAmount if available (actual backend format), otherwise use amount (interface format)
      const data = categoryBreakdown.map(cat => {
        const categoryData = cat as any;
        return Number(categoryData.totalAmount || cat.amount) || 0;
      });
      
      this.categoryBreakdownChart = {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [
            {
              data: data,
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
              ].slice(0, labels.length),
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                generateLabels: function(chart: any) {
                  const data = chart.data;
                  if (data.labels && data.datasets.length) {
                    return data.labels.map((label: any, i: number) => {
                      const dataset = data.datasets[0];
                      return {
                        text: String(label),
                        fillStyle: dataset.backgroundColor[i],
                        strokeStyle: dataset.backgroundColor[i],
                        lineWidth: 0,
                        index: i
                      };
                    });
                  }
                  return [];
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context: any) {
                  const label = String(context.label || '');
                  const value = Number(context.parsed) || 0;
                  const dataset = context.dataset;
                  const total = dataset.data.reduce((acc: number, data: number) => acc + data, 0);
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${label}: ${value.toFixed(2)} (${percentage}%)`;
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
              const category = categoryBreakdown[index];
              if (category) {
                this.showCategoryDetails(category);
              }
            }
          }
        }
      };
    } else {
      this.categoryBreakdownChart = null;
    }
    
    // Spending patterns chart
    if (spendingPatterns.length > 0) {
      console.log('� [SPENDING-PATTERNS-CHART] Processing spending patterns by day of week:', {
        rawSpendingPatternsCount: spendingPatterns.length,
        rawSpendingPatternsData: spendingPatterns,
        selectedTimeframe: this.selectedTimeframe,
        dataStructure: spendingPatterns.map(pattern => {
          const patternData = pattern as any;
          return {
            dayOfWeek: pattern.dayOfWeek,
            averageAmount: pattern.averageAmount,
            transactionCount: pattern.transactionCount,
            totalAmount: patternData.totalAmount,
            keys: Object.keys(pattern)
          };
        })
      });
      
      console.log('� [SPENDING-PATTERNS-CHART] Processing spending patterns by day of week:', {
        rawSpendingPatternsCount: spendingPatterns.length,
        rawSpendingPatternsData: spendingPatterns,
        selectedTimeframe: this.selectedTimeframe,
        dataStructure: spendingPatterns.map(pattern => {
          const patternData = pattern as any;
          return {
            dayOfWeek: pattern.dayOfWeek,
            averageAmount: pattern.averageAmount,
            transactionCount: pattern.transactionCount,
            totalAmount: patternData.totalAmount,
            keys: Object.keys(pattern)
          };
        })
      });
      
      // Ensure all data is properly formatted
      const labels = spendingPatterns.map(pattern => String(pattern.dayOfWeek || 'Unknown'));
      const data = spendingPatterns.map(pattern => Number(pattern.averageAmount) || 0);
      
      console.log('📈 [SPENDING-PATTERNS-CHART] Processed chart data:', {
        labels,
        data,
        totalAverageAmount: data.reduce((sum, amount) => sum + amount, 0),
        chartType: this.selectedChartType === 'pie' ? 'bar' : this.selectedChartType
      });
      
      this.spendingPatternsChart = {
        type: this.selectedChartType === 'pie' ? 'bar' : this.selectedChartType,
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Average Amount',
              data: data,
              backgroundColor: 'rgba(153, 102, 255, 0.2)',
              borderColor: 'rgba(153, 102, 255, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                generateLabels: function(chart: any) {
                  const data = chart.data;
                  if (data.datasets && data.datasets.length) {
                    return data.datasets.map((dataset: any, i: number) => {
                      return {
                        text: String(dataset.label || `Dataset ${i + 1}`),
                        fillStyle: dataset.backgroundColor,
                        strokeStyle: dataset.borderColor,
                        lineWidth: dataset.borderWidth || 1,
                        index: i
                      };
                    });
                  }
                  return [];
                }
              }
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
    } else {
      this.spendingPatternsChart = null;
    }
    
    // Trigger change detection to update the UI
    this.cdr.detectChanges();
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

  // Template helper methods
  getCategoryName(category: any): string {
    if (category?.category && typeof category.category === 'object') {
      return category.category.name || 'Unknown Category';
    }
    return category?.category || 'Unknown Category';
  }

  getCategoryAmount(category: any): number {
    return category?.totalAmount || category?.amount || 0;
  }

  getCategoryCount(category: any): number {
    return category?.transactionCount || category?.count || 0;
  }

  /**
   * Calculates the percentage of the total for a given category in the breakdown table.
   * Returns a number between 0 and 100 (rounded to 1 decimal place).
   */
  getCategoryPercentage(category: any): number {
    if (!this.transactionAnalytics || !this.transactionAnalytics.categoryBreakdown) return 0;
    const total = this.transactionAnalytics.categoryBreakdown.reduce(
      (sum: number, cat: any) => sum + (cat.totalAmount || cat.amount || 0),
      0
    );
    const value = category.totalAmount || category.amount || 0;
    if (total === 0) return 0;
    return +(100 * value / total).toFixed(1);
  }
}
