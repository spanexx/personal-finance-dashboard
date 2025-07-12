import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, Observable } from 'rxjs'; // Added Observable
import { takeUntil, filter, take } from 'rxjs/operators'; // Added filter and take
import { Chart, ChartConfiguration, ChartOptions } from 'chart.js';
// NgRx
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/state/app.state';
import * as BudgetActions from '../../../store/actions/budget.actions';
import { selectSelectedBudget, selectBudgetLoading, selectBudgetError } from '../../../store/selectors/budget.selectors';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { BudgetService } from '../budget.service';
import { Budget, CategoryAllocation } from '../../../shared/models/budget.model';

import { ChartData, AnalysisData, CategoryAnalysis, TrendAnalysis, PerformanceMetrics } from './interfaces'; // Import interfaces


@Component({
  selector: 'app-budget-analysis',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressBarModule,
    MatMenuModule
  ],
  templateUrl: './budget-analysis.component.html',
  styleUrls: ['./budget-analysis.component.scss']
})
export class BudgetAnalysisComponent implements OnInit, AfterViewInit, OnDestroy {
  loading: boolean = false;
  error: string | null = null;
  currentBudget: any;

  @ViewChild('budgetVsSpentCanvas') budgetVsSpentCanvas!: ElementRef;
  @ViewChild('categoryBreakdownCanvas') categoryBreakdownCanvas!: ElementRef;
  @ViewChild('progressCanvas') progressCanvas!: ElementRef;

  private charts: { [key: string]: Chart } = {};

  // currentBudget: Budget | null = null; // Replaced by selectedBudget$
  selectedBudget$: Observable<Budget | null>;
  analysisData: AnalysisData | null = null; // Remains, calculated locally
  isLoading$: Observable<boolean>;
  error$: Observable<string | null>;
  Math = Math; // For template usage
  // Chart configurations
  chartOptions = {
    responsive: true,
    maintainAspectRatio: true, // Changed to true to prevent chart expansion
    aspectRatio: 2,
    animation: false, // Disable animation for performance
    interaction: {
      intersect: false,
      mode: 'index' as const
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 15,
          usePointStyle: true
        }
      }
    },
    layout: {
      padding: 10
    },
    elements: {
      point: {
        radius: 0,
        hoverRadius: 4
      }
    },
    datasets: {
      bar: {
        maxBarThickness: 50
      }
    }
  };
  // Specific options for pie/doughnut charts
  pieChartOptions = {
    responsive: true,
    maintainAspectRatio: true, // Changed to true to prevent chart expansion
    aspectRatio: 1,
    animation: false, // Disable animation for performance
    interaction: {
      intersect: false
    },
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 12,
          padding: 10,
          usePointStyle: true
        }
      }
    },
    layout: {
      padding: 5
    }
  };

  budgetVsSpentChart: ChartData | null = null;
  categoryBreakdownChart: ChartData | null = null;
  progressChart: ChartData | null = null;
  private destroy$ = new Subject<void>();
  private chartsInitialized = false;

  public BudgetActions = BudgetActions;

  constructor(
    private budgetService: BudgetService, // Still used for some local calculations if needed
    public store: Store<AppState>
  ) {
    this.selectedBudget$ = this.store.select(selectSelectedBudget);
    this.isLoading$ = this.store.select(selectBudgetLoading);
    this.error$ = this.store.select(selectBudgetError);
  }

  loadBudgetAnalysis(): void {
  }

  ngOnInit(): void {
    this.store.dispatch({ type: 'Load Current Budget' });

    this.selectedBudget$.pipe(takeUntil(this.destroy$)).subscribe(budget => {
      if (budget) {
        console.log('Selected budget:', budget);
        this.analysisData = this.generateAnalysisData(budget);
        console.log('Generated analysis data:', this.analysisData);
        this.generateCharts();
        // Only initialize charts if not already initialized and view is ready
        if (!this.chartsInitialized && this.budgetVsSpentCanvas && this.categoryBreakdownCanvas && this.progressCanvas) {
          this.initializeCharts();
        }
      } else {
        this.analysisData = null;
        this.destroyCharts();
      }
    });

    this.isLoading$.pipe(takeUntil(this.destroy$)).subscribe();
    this.error$.pipe(takeUntil(this.destroy$)).subscribe();
  }

  ngAfterViewInit(): void {
    // Only initialize charts if data is ready and not already initialized
    if (this.analysisData && !this.chartsInitialized) {
      this.initializeCharts();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Destroy charts
    this.destroyCharts();
  }

  private destroyCharts(): void {
    Object.values(this.charts).forEach(chart => {
      if (chart) {
        chart.destroy();
      }
    });
    this.charts = {};
    this.chartsInitialized = false;
  }

  // loadBudgetAnalysis(): void { // Replaced by ngOnInit logic using NgRx store
  // }

  private normalizeBudget(budget: any): Budget {
    if (Array.isArray(budget.categories)) return budget;
    return {
      ...budget,
      categories: (budget.categoryAllocations || []).map((alloc: any) => ({
        category: alloc.category?.name || alloc.category || '',
        allocated: alloc.allocatedAmount ?? 0,
        spent: alloc.spentAmount ?? 0,
        // Add other fields as needed
      }))
    };
  }

  private generateAnalysisData(budget: any): AnalysisData {
    console.log('Generating analysis data for budget:', budget);
    const normalizedBudget = this.normalizeBudget(budget);
    const categoryAnalysis = this.generateCategoryAnalysis(normalizedBudget);
    const trendAnalysis = this.generateTrendAnalysis(normalizedBudget);
    const performanceMetrics = this.generatePerformanceMetrics(categoryAnalysis);

    return {
      categoryAnalysis,
      trendAnalysis,
      performanceMetrics
    };
  }
  private generateCategoryAnalysis(budget: Budget): CategoryAnalysis[] {
    if (!budget || !Array.isArray(budget.categories)) {
      return [];
    }
    return budget.categories.map(category => {
      const percentage = category.allocated > 0 ? (category.spent / category.allocated) * 100 : 0;
      const status = this.budgetService.getCategoryStatus(category);

      return {
        categoryName: category.category,
        budgeted: category.allocated,
        spent: category.spent,
        remaining: category.allocated - category.spent,
        percentage,
        status,
        color: this.getStatusColor(status)
      };
    });
  }

  private generateTrendAnalysis(budget: Budget): TrendAnalysis {
    const startDate = new Date(budget.startDate);
    const endDate = new Date(budget.endDate);
    const now = new Date();

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const categories = Array.isArray(budget.categories) ? budget.categories : [];
    const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
    const averageDailySpending = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
    const projectedSpending = totalSpent + (averageDailySpending * daysRemaining);
    const savingsRate = budget.totalAmount > 0 ? ((budget.totalAmount - totalSpent) / budget.totalAmount) * 100 : 0;

    return {
      totalBudget: budget.totalAmount,
      totalSpent,
      projectedSpending,
      savingsRate,
      daysRemaining,
      averageDailySpending
    };
  }

  private generatePerformanceMetrics(categoryAnalysis: CategoryAnalysis[]): PerformanceMetrics {
    const totalCategories = categoryAnalysis.length;
    const onTrackCategories = categoryAnalysis.filter(cat => cat.status === 'good').length;
    const warningCategories = categoryAnalysis.filter(cat => cat.status === 'warning').length;
    const overBudgetCategories = categoryAnalysis.filter(cat => cat.status === 'over').length;
    const totalBudgeted = categoryAnalysis.reduce((sum, cat) => sum + cat.budgeted, 0);
    const totalSpent = categoryAnalysis.reduce((sum, cat) => sum + cat.spent, 0);
    const budgetUtilization = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

    return {
      onTrackCategories,
      warningCategories,
      overBudgetCategories,
      totalCategories,
      budgetUtilization
    };
  }

  private generateCharts(): void {
    if (!this.analysisData) return;

    this.generateBudgetVsSpentChart();
    this.generateCategoryBreakdownChart();
    this.generateProgressChart();
  }

  private generateBudgetVsSpentChart(): void {
    const labels = this.analysisData!.categoryAnalysis.map(cat => cat.categoryName);
    const budgetedData = this.analysisData!.categoryAnalysis.map(cat => cat.budgeted);
    const spentData = this.analysisData!.categoryAnalysis.map(cat => cat.spent);

    this.budgetVsSpentChart = {
      labels,
      datasets: [
        {
          label: 'Budgeted',
          data: budgetedData,
          backgroundColor: 'rgba(25, 118, 210, 0.5)',
          borderColor: 'rgba(25, 118, 210, 1)',
          borderWidth: 1
        },
        {
          label: 'Spent',
          data: spentData,
          backgroundColor: 'rgba(67, 160, 71, 0.5)',
          borderColor: 'rgba(67, 160, 71, 1)',
          borderWidth: 1
        }
      ]
    };
  }

  private generateCategoryBreakdownChart(): void {
    const labels = this.analysisData!.categoryAnalysis.map(cat => cat.categoryName);
    const data = this.analysisData!.categoryAnalysis.map(cat => cat.spent);
    const backgroundColor = this.analysisData!.categoryAnalysis.map(cat => cat.color);

    this.categoryBreakdownChart = {
      labels,
      datasets: [{
        data,
        backgroundColor,
        hoverOffset: 4
      }]
    };
  }

  private generateProgressChart(): void {
    const { performanceMetrics } = this.analysisData!;
    
    this.progressChart = {
      labels: ['On Track', 'Warning', 'Over Budget'],
      datasets: [{
        data: [
          performanceMetrics.onTrackCategories,
          performanceMetrics.warningCategories,
          performanceMetrics.overBudgetCategories
        ],
        backgroundColor: [
          'rgba(67, 160, 71, 0.5)',
          'rgba(255, 193, 7, 0.5)',
          'rgba(244, 67, 54, 0.5)'
        ],
        borderColor: [
          'rgba(67, 160, 71, 1)',
          'rgba(255, 193, 7, 1)',
          'rgba(244, 67, 54, 1)'
        ],
        borderWidth: 1
      }]
    };
  }
  private initializeCharts(): void {
    // Prevent multiple initializations
    if (this.chartsInitialized) {
      return;
    }

    if (!this.analysisData || !this.budgetVsSpentChart || !this.categoryBreakdownChart || !this.progressChart) {
      return;
    }

    try {
      // Destroy existing charts first to prevent memory leaks
      this.destroyCharts();

      // Batch DOM operations to prevent forced reflows
      const canvasElements = [
        { canvas: this.budgetVsSpentCanvas, chartKey: 'budgetVsSpent' },
        { canvas: this.categoryBreakdownCanvas, chartKey: 'categoryBreakdown' },
        { canvas: this.progressCanvas, chartKey: 'progress' }
      ];

      // Initialize Budget vs Spent Chart
      if (this.budgetVsSpentCanvas?.nativeElement) {
        const budgetVsSpentCtx = this.budgetVsSpentCanvas.nativeElement.getContext('2d');
        if (budgetVsSpentCtx) {
          this.charts['budgetVsSpent'] = new Chart(budgetVsSpentCtx, {
            type: 'bar',
            data: this.budgetVsSpentChart!,
            options: {
              ...this.chartOptions,
              animation: {
                duration: 750, // Reduce animation duration
                easing: 'easeOutQuart'
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (value) => {
                      return this.formatCurrency(value as number);
                    }
                  }
                }
              }
            }
          });
          console.log('Budget vs Spent chart initialized');
        }
      }

      // Initialize Category Breakdown Chart
      if (this.categoryBreakdownCanvas?.nativeElement) {
        const categoryBreakdownCtx = this.categoryBreakdownCanvas.nativeElement.getContext('2d');
        if (categoryBreakdownCtx) {
          this.charts['categoryBreakdown'] = new Chart(categoryBreakdownCtx, {
            type: 'doughnut',
            data: this.categoryBreakdownChart!,
            options: {
              ...this.pieChartOptions,
              cutout: '60%',
              animation: {
                duration: 750,
                easing: 'easeOutQuart'
              }
            }
          });
          console.log('Category breakdown chart initialized');
        }
      }

      // Initialize Progress Chart
      if (this.progressCanvas?.nativeElement) {
        const progressCtx = this.progressCanvas.nativeElement.getContext('2d');
        if (progressCtx) {
          this.charts['progress'] = new Chart(progressCtx, {
            type: 'pie',
            data: this.progressChart!,
            options: {
              ...this.pieChartOptions,
              animation: {
                duration: 750,
                easing: 'easeOutQuart'
              },
              plugins: {
                ...this.pieChartOptions.plugins,
                legend: {
                  position: 'bottom' as const,
                  labels: {
                    boxWidth: 12,
                    padding: 10
                  }
                }
              }
            }
          });
          console.log('Progress chart initialized');
        }
      }

      this.chartsInitialized = true;
      console.log('All charts initialized successfully');
    } catch (error: any) {
      console.error('Error initializing charts:', error);
      this.chartsInitialized = false;
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'good': return 'check_circle';
      case 'warning': return 'warning';
      case 'over': return 'error';
      default: return 'info';
    }
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'good':
        return '#43a047'; // Green
      case 'warning':
        return '#ffc107'; // Amber
      case 'over':
        return '#f44336'; // Red
      default:
        return '#90a4ae'; // Grey fallback
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatPercentage(value: number): string {
    return `${Math.round(value)}%`;
  }

  exportAnalysis(): void {
    console.log('Export analysis triggered');
  }

  exportToExcel(): void {
    this.selectedBudget$.pipe(take(1)).subscribe(currentBudget => {
      if (!this.analysisData || !currentBudget) {
        console.error('No data available for export');
        return;
      }

      const wb = XLSX.utils.book_new();

      // Overview sheet
      const overviewData = [
        ['Budget Analysis Report'],
        ['Generated on:', new Date().toLocaleString()],
        ['Budget Name:', currentBudget.name],
        ['Period:', currentBudget.period],
        ['Start Date:', new Date(currentBudget.startDate).toLocaleDateString()],
        ['End Date:', new Date(currentBudget.endDate).toLocaleDateString()],
        [],
        ['Performance Summary'],
      ['Total Budget:', this.formatCurrency(this.analysisData.trendAnalysis.totalBudget)],
      ['Total Spent:', this.formatCurrency(this.analysisData.trendAnalysis.totalSpent)],
      ['Projected Spending:', this.formatCurrency(this.analysisData.trendAnalysis.projectedSpending)],
      ['Savings Rate:', this.formatPercentage(this.analysisData.trendAnalysis.savingsRate)],
      ['Days Remaining:', this.analysisData.trendAnalysis.daysRemaining.toString()],
      ['Average Daily Spending:', this.formatCurrency(this.analysisData.trendAnalysis.averageDailySpending)]
    ];

    const overviewWs = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewWs, 'Overview');

    // Category Analysis sheet
    const categoryHeaders = ['Category', 'Budgeted', 'Spent', 'Remaining', 'Percentage Used', 'Status'];
    const categoryData = this.analysisData.categoryAnalysis.map(cat => [
      cat.categoryName,
      cat.budgeted,
      cat.spent,
      cat.remaining,
      cat.percentage,
      cat.status
    ]);

    const categoryWs = XLSX.utils.aoa_to_sheet([categoryHeaders, ...categoryData]);
    XLSX.utils.book_append_sheet(wb, categoryWs, 'Category Analysis');

    const fileName = `budget-analysis-${currentBudget.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    });
  }

  exportToPDF(): void {
    this.selectedBudget$.pipe(take(1)).subscribe(currentBudget => {
      if (!this.analysisData || !currentBudget) {
        console.error('No data available for export');
        return;
      }

      const doc = new jsPDF();
      const margin = 20;

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Budget Analysis Report', margin, 30);

      // Budget info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Budget: ${currentBudget.name}`, margin, 50);
      doc.text(`Period: ${currentBudget.period}`, margin, 60);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 70);

    // Performance Summary
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Budget', this.formatCurrency(this.analysisData.trendAnalysis.totalBudget)],
      ['Total Spent', this.formatCurrency(this.analysisData.trendAnalysis.totalSpent)],
      ['Projected Spending', this.formatCurrency(this.analysisData.trendAnalysis.projectedSpending)],
      ['Savings Rate', this.formatPercentage(this.analysisData.trendAnalysis.savingsRate)],
      ['Days Remaining', this.analysisData.trendAnalysis.daysRemaining.toString()],
      ['Avg. Daily Spending', this.formatCurrency(this.analysisData.trendAnalysis.averageDailySpending)]
    ];    autoTable(doc, {
      head: [summaryData[0]],
      body: summaryData.slice(1),
      startY: 90,
      theme: 'striped',
      headStyles: { fillColor: [63, 81, 181] },
      margin: { left: margin, right: margin }
    });

    // Category Analysis
    const categoryData = [
      ['Category', 'Budgeted', 'Spent', 'Remaining', '%', 'Status'],
      ...this.analysisData.categoryAnalysis.map(cat => [
        cat.categoryName,
        this.formatCurrency(cat.budgeted),
        this.formatCurrency(cat.spent),
        this.formatCurrency(cat.remaining),
        this.formatPercentage(cat.percentage),
        cat.status.toUpperCase()
      ])    ];

    autoTable(doc, {
      head: [categoryData[0]],
      body: categoryData.slice(1),
      startY: 150,
      theme: 'striped',
      headStyles: { fillColor: [63, 81, 181] },
      margin: { left: margin, right: margin },
      styles: { fontSize: 10 }
    });

    const fileName = `budget-analysis-${currentBudget.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    });
  }
}
