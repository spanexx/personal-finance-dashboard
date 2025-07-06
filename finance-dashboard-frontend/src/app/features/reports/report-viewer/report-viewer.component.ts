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

import { ReportData } from '../../../core/services/reports.service';
import { ChartComponent, ChartData } from '../../../shared/components/chart/chart.component';
import { AppState } from '../../../store/state/app.state';
import * as ReportActions from '../../../store/actions/report.actions';
import * as ReportSelectors from '../../../store/selectors/report.selectors';
import { AccessibilityService } from '../../../shared/services/accessibility.service';

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
  ],  template: `
    <div class="report-viewer-container" role="main">
      <!-- Skip Links for Keyboard Navigation -->
      <div class="skip-links">
        <a href="#report-summary" class="skip-link">Skip to report summary</a>
        <a href="#report-charts" class="skip-link">Skip to charts</a>
        <a href="#report-details" class="skip-link">Skip to detailed data</a>
      </div>

      @if (loading$ | async) {
        <div class="loading-container" role="status" aria-live="polite">
          <mat-spinner diameter="50" aria-label="Loading report data"></mat-spinner>
          <p>Loading report...</p>
        </div>
      }
      
      @if (report$ | async; as report) {
        <div class="page-header">
          <div class="header-content">
            <h1 #pageTitle 
                class="page-title" 
                tabindex="-1"
                [attr.aria-label]="'Report: ' + report.title">{{ report.title }}</h1>
            <div class="header-actions" role="group" aria-label="Report actions">
              <button mat-stroked-button 
                      routerLink="/reports"
                      aria-label="Return to reports list">
                <mat-icon aria-hidden="true">arrow_back</mat-icon>
                Back to Reports
              </button>              
              <button mat-raised-button 
                      color="primary" 
                      (click)="downloadReport(report)"
                      [attr.aria-describedby]="'download-help'"
                      [disabled]="exporting$ | async">
                @if (exporting$ | async) {
                  <mat-spinner diameter="16" aria-label="Downloading report"></mat-spinner>
                } @else {
                  <mat-icon aria-hidden="true">download</mat-icon>
                }
                {{ (exporting$ | async) ? 'Downloading...' : 'Download Report' }}
              </button>
              <div id="download-help" class="sr-only">Download this report as a PDF file</div>
            </div>
          </div>
          <p class="report-date">Generated on {{ formatDate(report.generatedAt) }}</p>
        </div>

        <div class="report-content">
          <!-- Summary Card -->
          <mat-card id="report-summary" class="summary-card">
            <mat-card-header>
              <mat-card-title>Report Summary</mat-card-title>
              <mat-card-subtitle>Key financial metrics for the selected period</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="summary-grid" role="grid" aria-label="Financial summary metrics">
                <div class="summary-item" role="gridcell">
                  <div class="label" aria-describedby="total-income-value">Total Income</div>
                  <div id="total-income-value" class="value income" [attr.aria-label]="'Total income: ' + formatCurrency(report.summary.totalIncome)">
                    {{ formatCurrency(report.summary.totalIncome) }}
                  </div>
                </div>
                <div class="summary-item" role="gridcell">
                  <div class="label" aria-describedby="total-expenses-value">Total Expenses</div>
                  <div id="total-expenses-value" class="value expense" [attr.aria-label]="'Total expenses: ' + formatCurrency(report.summary.totalExpenses)">
                    {{ formatCurrency(report.summary.totalExpenses) }}
                  </div>
                </div>
                <div class="summary-item" role="gridcell">
                  <div class="label" aria-describedby="net-savings-value">Net Savings</div>
                  <div id="net-savings-value" class="value savings" [attr.aria-label]="'Net savings: ' + formatCurrency(report.summary.netSavings)">
                    {{ formatCurrency(report.summary.netSavings) }}
                  </div>
                </div>
                <div class="summary-item" role="gridcell">
                  <div class="label" aria-describedby="transaction-count-value">Total Transactions</div>
                  <div id="transaction-count-value" class="value" [attr.aria-label]="'Total transactions: ' + report.summary.transactionCount">
                    {{ report.summary.transactionCount }}
                  </div>
                </div>
                <div class="summary-item" role="gridcell">
                  <div class="label" aria-describedby="period-value">Period</div>
                  <div id="period-value" class="value" [attr.aria-label]="'Report period: ' + formatDateRange(report.dateRange)">
                    {{ formatDateRange(report.dateRange) }}
                  </div>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Charts and Analysis -->
          <div id="report-charts" class="charts-grid">
            <mat-card class="chart-card">
              <mat-card-header>
                <mat-card-title>Category Breakdown</mat-card-title>
                <mat-card-subtitle>Visual breakdown of spending by category</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="chart-container" *ngIf="categoryChartData" role="img" [attr.aria-label]="getChartDescription('category')">
                  <app-chart 
                    type="pie" 
                    [data]="categoryChartData"
                    [options]="chartOptions">
                  </app-chart>
                </div>
                <div class="chart-placeholder" *ngIf="!categoryChartData" role="status">
                  <mat-icon aria-hidden="true">pie_chart</mat-icon>
                  <p>No data available for chart visualization</p>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="chart-card">
              <mat-card-header>
                <mat-card-title>Trend Analysis</mat-card-title>
                <mat-card-subtitle>Financial trends over the selected period</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="chart-container" *ngIf="trendChartData" role="img" [attr.aria-label]="getChartDescription('trend')">
                  <app-chart 
                    type="line" 
                    [data]="trendChartData"
                    [options]="trendChartOptions">
                  </app-chart>
                </div>
                <div class="chart-placeholder" *ngIf="!trendChartData" role="status">
                  <mat-icon aria-hidden="true">show_chart</mat-icon>
                  <p>No data available for trend chart</p>
                </div>
              </mat-card-content>
            </mat-card>
          </div>

          <!-- Category Breakdown Table -->
          <mat-card id="report-details" class="details-card">
            <mat-card-header>
              <mat-card-title>Category Breakdown</mat-card-title>
              <mat-card-subtitle>Detailed breakdown of expenses by category</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <table mat-table 
                     [dataSource]="report.categoryBreakdown" 
                     class="category-table"
                     role="table"
                     aria-label="Category breakdown data"
                     [attr.aria-rowcount]="report.categoryBreakdown.length + 1">
                <ng-container matColumnDef="category">
                  <th mat-header-cell *matHeaderCellDef role="columnheader" scope="col">Category</th>
                  <td mat-cell *matCellDef="let item; let i = index" role="gridcell" [attr.aria-rowindex]="i + 2">
                    <div class="category-cell">
                      <div class="category-color" 
                           [style.background-color]="item.color"
                           [attr.aria-label]="'Color indicator for ' + item.category"
                           role="img"></div>
                      {{ item.category }}
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="amount">
                  <th mat-header-cell *matHeaderCellDef role="columnheader" scope="col">Amount</th>
                  <td mat-cell *matCellDef="let item; let i = index" role="gridcell" [attr.aria-rowindex]="i + 2">
                    <span [attr.aria-label]="'Amount for ' + item.category + ': ' + formatCurrency(item.amount)">
                      {{ formatCurrency(item.amount) }}
                    </span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="percentage">
                  <th mat-header-cell *matHeaderCellDef role="columnheader" scope="col">% of Total</th>
                  <td mat-cell *matCellDef="let item; let i = index" role="gridcell" [attr.aria-rowindex]="i + 2">
                    <div class="percentage-cell">
                      <span [attr.aria-label]="'Percentage for ' + item.category + ': ' + formatPercentage(item.percentage)">
                        {{ formatPercentage(item.percentage) }}
                      </span>
                      <mat-progress-bar 
                        mode="determinate" 
                        [value]="item.percentage"
                        [color]="'primary'"
                        [attr.aria-label]="'Progress bar showing ' + formatPercentage(item.percentage) + ' for ' + item.category"
                        role="progressbar"
                        [attr.aria-valuenow]="item.percentage"
                        aria-valuemin="0"
                        aria-valuemax="100">
                      </mat-progress-bar>
                    </div>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns" role="row"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;" role="row"></tr>
              </table>
            </mat-card-content>
          </mat-card>

          <!-- Transactions Table (if included) -->
          @if (report.transactions && report.transactions.length > 0) {
            <mat-card class="transactions-card">
              <mat-card-header>
                <mat-card-title>Recent Transactions</mat-card-title>
                <mat-card-subtitle>{{ report.transactions.length }} transactions included in this report</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <table mat-table 
                       [dataSource]="report.transactions" 
                       class="transactions-table"
                       role="table"
                       aria-label="Transaction details"
                       [attr.aria-rowcount]="report.transactions.length + 1">
                  <ng-container matColumnDef="date">
                    <th mat-header-cell *matHeaderCellDef role="columnheader" scope="col">Date</th>
                    <td mat-cell *matCellDef="let txn; let i = index" role="gridcell" [attr.aria-rowindex]="i + 2">
                      <span [attr.aria-label]="'Transaction date: ' + formatDate(txn.date)">
                        {{ formatDate(txn.date) }}
                      </span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="description">
                    <th mat-header-cell *matHeaderCellDef role="columnheader" scope="col">Description</th>
                    <td mat-cell *matCellDef="let txn; let i = index" role="gridcell" [attr.aria-rowindex]="i + 2">
                      {{ txn.description }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="category">
                    <th mat-header-cell *matHeaderCellDef role="columnheader" scope="col">Category</th>
                    <td mat-cell *matCellDef="let txn; let i = index" role="gridcell" [attr.aria-rowindex]="i + 2">
                      {{ txn.category }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="amount">
                    <th mat-header-cell *matHeaderCellDef role="columnheader" scope="col">Amount</th>
                    <td mat-cell *matCellDef="let txn; let i = index" role="gridcell" [attr.aria-rowindex]="i + 2">
                      <span [class]="txn.type === 'income' ? 'income' : 'expense'"
                            [attr.aria-label]="txn.type + ' of ' + formatCurrency(txn.amount)">
                        {{ (txn.type === 'income' ? '+' : '-') + formatCurrency(txn.amount) }}
                      </span>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="transactionColumns" role="row"></tr>
                  <tr mat-row *matRowDef="let row; columns: transactionColumns;" role="row"></tr>
                </table>
              </mat-card-content>            
            </mat-card>
          }
        </div>
      }
      
      @if (error$ | async; as error) {
        <div class="error-container" role="alert" aria-live="assertive">
          <mat-icon aria-hidden="true">error_outline</mat-icon>
          <h2>Error Loading Report</h2>
          <p>{{ error }}</p>
          <button mat-raised-button 
                  color="primary" 
                  routerLink="/reports"
                  aria-label="Return to reports list after error">
            <mat-icon aria-hidden="true">arrow_back</mat-icon>
            Back to Reports
          </button>
        </div>
      }
    </div>
  `,styles: [`
    /* Skip Links */
    .skip-links {
      position: absolute;
      top: -40px;
      left: 6px;
      z-index: 1000;
    }

    .skip-link {
      position: absolute;
      left: -10000px;
      top: auto;
      width: 1px;
      height: 1px;
      overflow: hidden;
      background: #000;
      color: #fff;
      padding: 8px 16px;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
      z-index: 100000;
    }

    .skip-link:focus {
      position: static;
      left: auto;
      width: auto;
      height: auto;
      overflow: visible;
    }

    /* Screen Reader Only Content */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .report-viewer-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .loading-container, .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px;
      text-align: center;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        color: rgba(0, 0, 0, 0.4);
      }

      h2 {
        margin: 16px 0;
        color: rgba(0, 0, 0, 0.7);
      }

      p {
        color: rgba(0, 0, 0, 0.6);
        margin-bottom: 24px;
      }
    }

    .page-header {
      margin-bottom: 24px;

      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .page-title {
        margin: 0;
        font-size: 2.5rem;
        font-weight: 300;
      }

      .header-actions {
        display: flex;
        gap: 16px;
      }

      .report-date {
        margin: 0;
        color: rgba(0, 0, 0, 0.6);
      }
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 24px;
      padding: 16px;
    }

    .summary-item {
      text-align: center;
      padding: 16px;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 8px;

      .label {
        font-size: 0.875rem;
        color: rgba(0, 0, 0, 0.6);
        margin-bottom: 8px;
      }

      .value {
        font-size: 1.5rem;
        font-weight: 500;

        &.income {
          color: #4caf50;
        }

        &.expense {
          color: #f44336;
        }

        &.savings {
          color: #2196f3;
        }
      }
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
      gap: 24px;
      margin: 24px 0;
    }    .chart-card {
      .chart-container {
        height: 400px;
        padding: 16px;
      }
      
      .chart-placeholder {
        height: 300px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.04);
        border-radius: 4px;
        color: rgba(0, 0, 0, 0.6);
        text-align: center;

        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          margin-bottom: 16px;
        }

        p {
          margin: 8px 0;
          font-weight: 500;
        }

        small {
          font-size: 0.75rem;
          opacity: 0.7;
        }
      }
    }

    .details-card, .transactions-card {
      margin-top: 24px;

      table {
        width: 100%;
      }

      th.mat-header-cell,
      td.mat-cell {
        padding: 12px;
      }
    }

    .category-cell {
      display: flex;
      align-items: center;
      gap: 8px;

      .category-color {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        flex-shrink: 0;
      }
    }

    .percentage-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;

      span {
        font-weight: 500;
      }

      mat-progress-bar {
        height: 6px;
      }
    }

    .transactions-table {
      .income {
        color: #4caf50;
        font-weight: 500;
      }

      .expense {
        color: #f44336;
        font-weight: 500;
      }
    }
  `]
})
export class ReportViewerComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('pageTitle') pageTitle!: ElementRef;
  
  report$: Observable<ReportData | null>;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  exporting$: Observable<boolean>;
  
  displayedColumns: string[] = ['category', 'amount', 'percentage'];
  transactionColumns: string[] = ['date', 'description', 'category', 'amount'];
  
  // Chart data properties
  categoryChartData?: ChartData;
  trendChartData?: ChartData;
  
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
    private accessibilityService: AccessibilityService
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
      
      // Setup charts when report data loads
      this.report$.pipe(
        takeUntil(this.destroy$),
        filter(report => !!report)
      ).subscribe(report => {
        if (report) {
          this.setupCharts(report);
        }
      });
    }
  }

  ngAfterViewInit(): void {
    // Set focus to page title for screen readers
    if (this.pageTitle) {
      setTimeout(() => {
        this.pageTitle.nativeElement.focus();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.store.dispatch(ReportActions.clearCurrentReport());
  }  downloadReport(report: ReportData): void {
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

  formatDateRange(dateRange: { startDate: string, endDate: string }): string {
    if (!dateRange) return '';
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

  private setupCharts(report: ReportData): void {
    this.setupCategoryChart(report);
    this.setupTrendChart(report);
  }

  private setupCategoryChart(report: ReportData): void {
    if (!report?.categoryBreakdown) return;
    
    const breakdown = report.categoryBreakdown.slice(0, 10); // Top 10 categories
    
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
  private setupTrendChart(report: ReportData): void {
    if (!report?.chartData) return;
    
    this.trendChartData = {
      labels: report.chartData.labels,
      datasets: [{
        label: report.chartData.datasets[0]?.label || 'Amount',
        data: report.chartData.datasets[0]?.data || [],
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        borderColor: '#1976d2',
        borderWidth: 2,
        fill: true
      }]
    };
  }
}
