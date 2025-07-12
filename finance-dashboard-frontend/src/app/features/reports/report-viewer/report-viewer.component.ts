import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject, takeUntil, filter } from 'rxjs';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { FinancialReport } from '../../../core/services/report.service';
import { ChartComponent, ChartData } from '../../../shared/components/chart/chart.component';
import { AppState } from '../../../store/state/app.state';
import * as ReportActions from '../../../store/actions/report.actions';
import * as ReportSelectors from '../../../store/selectors/report.selectors';
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { ReportService } from '../../../core/services/report.service';

@Component({
  selector: 'app-report-viewer',
  standalone: true,  
  imports:[
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    ChartComponent
  ], 
  templateUrl: './report-viewer.component.html',
  styleUrls: ['./report-viewer.component.css'],

})
export class ReportViewerComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('pageTitle') pageTitle!: ElementRef;
  
  report$: Observable<FinancialReport | null>;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  exporting$: Observable<boolean>;
  
  displayedColumns: string[] = ['category', 'amount', 'percentage'];
  transactionColumns: string[] = ['date', 'description', 'category', 'amount'];
  
  // Chart data properties
  categoryChartData?: ChartData;
  trendChartData?: ChartData;

  // Local computed category breakdown for table/chart
  categoryBreakdown: any[] = [];

  // Local computed date range for summary card
  dateRange: { startDate: string, endDate: string } | null = null;
  
  private destroy$ = new Subject<void>();
  
  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const
      }
    }
  };
  
  trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };
  constructor(
    private route: ActivatedRoute,
    private store: Store<AppState>,
    private accessibilityService: AccessibilityService,
    private reportService: ReportService // Inject ReportService
  ) {
    this.report$ = this.store.select(ReportSelectors.selectCurrentReport);
    this.loading$ = this.store.select(ReportSelectors.selectReportLoading);
    this.error$ = this.store.select(ReportSelectors.selectReportError);
    this.exporting$ = this.store.select(ReportSelectors.selectReportExporting);
  }
  ngOnInit(): void {
    const reportId = this.route.snapshot.paramMap.get('id');
    if (reportId) {
      this.store.dispatch(ReportActions.loadReport({ id: reportId }));
      // Optionally: Fetch report directly using ReportService
      // this.fetchReportDirectly(reportId);
      
      // Setup charts when report data loads
      this.report$.pipe(
        takeUntil(this.destroy$),
        filter(report => !!report)
      ).subscribe(report => {
        if (report) {
          // --- Compute categoryBreakdown locally, do not mutate backend object ---
          const total = report.data.summary?.totalExpenses ?? report.data.summary?.totalSpending ?? 0;
          if (report.data.categoryAnalysis && total) {
            this.categoryBreakdown = report.data.categoryAnalysis.map((cat: any) => ({
              category: cat.categoryName,
              amount: cat.totalAmount,
              color: cat.categoryColor || '#1976d2',
              percentage: total > 0 ? (cat.totalAmount / total) * 100 : 0,
              transactionCount: cat.transactionCount || 0
            }));
          } else if (report.data.categoryBreakdown) {
            this.categoryBreakdown = report.data.categoryBreakdown;
          } else {
            this.categoryBreakdown = [];
          }

          // --- Compute dateRange locally, do not mutate backend object ---
          if (report.data.dateRange) {
            this.dateRange = report.data.dateRange;
          } else {
            const startDate = report.data.startDate || report.startDate;
            const endDate = report.data.endDate || report.endDate;
            if (startDate && endDate) {
              this.dateRange = { startDate, endDate };
            } else {
              this.dateRange = null;
            }
          }
          // -------------------------------------------------------------
          console.log('Loaded report:', report); // <-- LOG REPORT DATA
          this.setupCharts(report);
        }
      });
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (
        this.pageTitle &&
        this.pageTitle.nativeElement &&
        typeof this.pageTitle.nativeElement.focus === 'function'
      ) {
        this.pageTitle.nativeElement.focus();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.store.dispatch(ReportActions.clearCurrentReport());
  }  downloadReport(report: FinancialReport): void {
    this.accessibilityService.announceOperationStatus('Report download', 'started');
    this.store.dispatch(ReportActions.exportReport({ report, format: 'pdf' }));
    
    // Monitor export completion for accessibility announcements
    this.exporting$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(isExporting => {
      if (!isExporting) {
        this.accessibilityService.announceOperationStatus('Report download', 'completed');
      }
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatDateRange(dateRange: { startDate: string, endDate: string } | null): string {
    if (!dateRange || !dateRange.startDate || !dateRange.endDate) return '';
    const start = new Date(dateRange.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = new Date(dateRange.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  }  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  getChartDescription(chartType: 'category' | 'trend'): string {
    if (chartType === 'category') {
      const totalCategories = this.categoryChartData?.labels?.length || 0;
      return `Category breakdown chart showing ${totalCategories} categories with their respective spending amounts`;
    } else {
      const dataPoints = this.trendChartData?.datasets?.[0]?.data?.length || 0;
      return `Trend analysis chart showing financial trends over ${dataPoints} data points`;
    }
  }

  private setupCharts(report: FinancialReport): void {
    this.setupCategoryChart(report);
    this.setupTrendChart(report);
  }

  private setupCategoryChart(report: FinancialReport): void {
    // Use local categoryBreakdown for chart
    let breakdown: any[] = this.categoryBreakdown.slice(0, 10);
    this.categoryChartData = {
      labels: breakdown.map((item: any) => item.category),
      datasets: [{
        label: 'Amount',
        data: breakdown.map((item: any) => item.amount),
        backgroundColor: breakdown.map((item: any) => item.color || '#1976d2'),
        borderColor: breakdown.map((item: any) => item.color || '#1976d2'),
        borderWidth: 1
      }]
    };
  }
  private setupTrendChart(report: FinancialReport): void {
    // Support both chartData and timeBasedAnalysis from backend
    if (report?.data?.chartData) {
      this.trendChartData = {
        labels: report.data.chartData.labels,
        datasets: [{
          label: report.data.chartData.datasets[0]?.label || 'Amount',
          data: report.data.chartData.datasets[0]?.data || [],
          backgroundColor: 'rgba(25, 118, 210, 0.1)',
          borderColor: '#1976d2',
          borderWidth: 2,
          fill: true
        }]
      };
      return;
    }
    // If no chartData, try to build from timeBasedAnalysis
    if (Array.isArray(report?.data?.timeBasedAnalysis) && report.data.timeBasedAnalysis.length > 0) {
      this.trendChartData = {
        labels: report.data.timeBasedAnalysis.map((item: any) => {
          // Try to format date or use month/year if available
          if (item.date) return this.formatDate(item.date);
          if (item._id && item._id.month && item._id.year) return `${item._id.month}/${item._id.year}`;
          return '';
        }),
        datasets: [{
          label: 'Total Amount',
          data: report.data.timeBasedAnalysis.map((item: any) => item.totalAmount || 0),
          backgroundColor: 'rgba(25, 118, 210, 0.1)',
          borderColor: '#1976d2',
          borderWidth: 2,
          fill: true
        }]
      };
      return;
    }
    // No trend data available
    this.trendChartData = undefined;
  }

  // Example: Directly fetch a report (optional, for demonstration)
  fetchReportDirectly(reportId: string): void {
    this.reportService.getReport(reportId).subscribe({
      next: (report) => {
        // You can use this data as needed
        console.log('Directly fetched report:', report);
      },
      error: (err) => {
        console.error('Error fetching report directly:', err);
      }
    });
  }
}
