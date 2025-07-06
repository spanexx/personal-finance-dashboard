import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ReportsService, ReportConfig, ReportData } from '../../../core/services/reports.service';
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { FocusTrapDirective } from '../../../shared/directives/focus-trap.directive';

@Component({
  selector: 'app-report-generator',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    FocusTrapDirective
  ],  template: `
    <div class="report-generator-container" role="main">
      <!-- Skip Links for Keyboard Navigation -->
      <div class="skip-links">
        <a href="#report-config" class="skip-link">Skip to report configuration</a>
        <a href="#recent-reports" class="skip-link">Skip to recent reports</a>
      </div>

      <div class="page-header">
        <h1 id="page-title" class="page-title">Generate Report</h1>
        <button mat-stroked-button routerLink="/dashboard" aria-label="Return to dashboard">
          <mat-icon aria-hidden="true">dashboard</mat-icon>
          Back to Dashboard
        </button>
      </div>

      <mat-card class="generator-card" [appFocusTrap]="true">
        <mat-card-header>
          <mat-card-title id="report-config">Report Configuration</mat-card-title>
          <mat-card-subtitle>Customize your financial report</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="reportForm" 
                (ngSubmit)="generateReport()" 
                role="form"
                aria-labelledby="report-config"
                aria-describedby="form-instructions">
            
            <div id="form-instructions" class="sr-only">
              Configure your report by selecting the report type, date range, and additional options. All fields marked with asterisk are required.
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Report Type *</mat-label>
                <mat-select #firstField
                           formControlName="reportType"
                           aria-required="true"
                           aria-describedby="report-type-help"
                           [attr.aria-invalid]="reportForm.get('reportType')?.invalid && reportForm.get('reportType')?.touched">
                  <mat-option *ngFor="let type of reportTypes; let i = index" 
                              [value]="type.value"
                              [attr.aria-label]="type.label + ': ' + type.description">
                    <div class="report-type-option">
                      <div class="type-label">{{ type.label }}</div>
                      <div class="type-description">{{ type.description }}</div>
                    </div>
                  </mat-option>
                </mat-select>
                <mat-hint id="report-type-help">Select the type of financial report to generate</mat-hint>
                <mat-error *ngIf="reportForm.get('reportType')?.hasError('required')">Report type is required</mat-error>
              </mat-form-field>
            </div>

            <div class="form-row date-range" role="group" aria-labelledby="date-range-label">
              <div id="date-range-label" class="section-label">Date Range *</div>
              <mat-form-field appearance="outline">
                <mat-label>Start Date</mat-label>
                <input matInput 
                       [matDatepicker]="startPicker" 
                       formControlName="startDate"
                       aria-required="true"
                       aria-describedby="start-date-help"
                       [attr.aria-invalid]="reportForm.get('startDate')?.invalid && reportForm.get('startDate')?.touched">
                <mat-datepicker-toggle matIconSuffix [for]="startPicker" aria-label="Open start date calendar"></mat-datepicker-toggle>
                <mat-datepicker #startPicker></mat-datepicker>
                <mat-hint id="start-date-help">Select the beginning date for the report period</mat-hint>
                <mat-error *ngIf="reportForm.get('startDate')?.hasError('required')">Start date is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>End Date</mat-label>
                <input matInput 
                       [matDatepicker]="endPicker" 
                       formControlName="endDate"
                       aria-required="true"
                       aria-describedby="end-date-help"
                       [attr.aria-invalid]="reportForm.get('endDate')?.invalid && reportForm.get('endDate')?.touched">
                <mat-datepicker-toggle matIconSuffix [for]="endPicker" aria-label="Open end date calendar"></mat-datepicker-toggle>
                <mat-datepicker #endPicker></mat-datepicker>
                <mat-hint id="end-date-help">Select the ending date for the report period</mat-hint>
                <mat-error *ngIf="reportForm.get('endDate')?.hasError('required')">End date is required</mat-error>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Group By *</mat-label>
                <mat-select formControlName="groupBy"
                           aria-required="true"
                           aria-describedby="group-by-help"
                           [attr.aria-invalid]="reportForm.get('groupBy')?.invalid && reportForm.get('groupBy')?.touched">
                  <mat-option value="daily" aria-label="Group data by daily periods">Daily</mat-option>
                  <mat-option value="weekly" aria-label="Group data by weekly periods">Weekly</mat-option>
                  <mat-option value="monthly" aria-label="Group data by monthly periods">Monthly</mat-option>
                  <mat-option value="yearly" aria-label="Group data by yearly periods">Yearly</mat-option>
                </mat-select>
                <mat-hint id="group-by-help">Choose how to group the data in your report</mat-hint>
                <mat-error *ngIf="reportForm.get('groupBy')?.hasError('required')">Grouping option is required</mat-error>
              </mat-form-field>
            </div>

            <div class="form-row checkbox-row" role="group" aria-labelledby="options-label">
              <div id="options-label" class="section-label">Report Options</div>
              <mat-checkbox formControlName="includeCharts" 
                           aria-describedby="charts-help">
                Include Charts
              </mat-checkbox>
              <div id="charts-help" class="sr-only">Add visual charts and graphs to the report</div>
              
              <mat-checkbox formControlName="includeTransactions" 
                           aria-describedby="transactions-help">
                Include Transaction Details
              </mat-checkbox>
              <div id="transactions-help" class="sr-only">Include detailed transaction listings in the report</div>
            </div>

            <div class="form-actions">
              <button mat-stroked-button 
                      type="button" 
                      (click)="resetForm()"
                      aria-label="Reset form to default values">
                <mat-icon aria-hidden="true">refresh</mat-icon>
                Reset
              </button>
              <button mat-raised-button 
                      color="primary" 
                      type="submit" 
                      [disabled]="!reportForm.valid || generating"
                      [attr.aria-describedby]="'generate-help'"
                      aria-live="polite">
                @if (generating) {
                  <mat-spinner diameter="20" aria-label="Generating report"></mat-spinner>
                } @else {
                  <mat-icon aria-hidden="true">assessment</mat-icon>
                }
                {{ generating ? 'Generating...' : 'Generate Report' }}
              </button>
              <div id="generate-help" class="sr-only">
                {{ generating ? 'Report generation in progress. Please wait.' : 'Generate the report with the selected configuration' }}
              </div>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <div class="recent-reports">
        <h2 id="recent-reports">Recent Reports</h2>
        <div class="reports-grid" 
             role="list" 
             aria-labelledby="recent-reports"
             [attr.aria-label]="'Recent reports list with ' + recentReports.length + ' items'">
          <mat-card *ngFor="let report of recentReports; let i = index" 
                    class="report-card" 
                    role="listitem"
                    [attr.aria-label]="'Report ' + (i + 1) + ' of ' + recentReports.length + ': ' + report.type + ' report from ' + formatDate(report.generatedAt)">
            <mat-card-header>
              <mat-icon mat-card-avatar aria-hidden="true">description</mat-icon>
              <mat-card-title>{{ report.type }} Report</mat-card-title>
              <mat-card-subtitle>{{ formatDate(report.generatedAt) }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-actions role="group" [attr.aria-label]="'Actions for ' + report.type + ' report'">
              <button mat-button 
                      [routerLink]="['view', report.id]"
                      [attr.aria-label]="'View ' + report.type + ' report from ' + formatDate(report.generatedAt)">
                <mat-icon aria-hidden="true">visibility</mat-icon>
                View
              </button>
              <button mat-button 
                      (click)="downloadReport(report)"
                      [attr.aria-label]="'Download ' + report.type + ' report from ' + formatDate(report.generatedAt)">
                <mat-icon aria-hidden="true">download</mat-icon>
                Download
              </button>
            </mat-card-actions>
          </mat-card>
          
          <div *ngIf="recentReports.length === 0" 
               class="empty-state" 
               role="status"
               aria-live="polite">
            <mat-icon aria-hidden="true">description</mat-icon>
            <p>No recent reports found</p>
            <p class="empty-description">Generate your first report using the form above</p>
          </div>
        </div>
      </div>
    </div>
  `,  styles: [`
    .report-generator-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Skip Links */
    .skip-links {
      position: absolute;
      top: -40px;
      left: 0;
      z-index: 1000;
    }

    .skip-link {
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }

    .skip-link:focus {
      position: static;
      left: auto;
      width: auto;
      height: auto;
      padding: 8px 16px;
      background: #000;
      color: #fff;
      text-decoration: none;
      border-radius: 4px;
      margin-right: 8px;
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

    /* Section Labels */
    .section-label {
      font-weight: 500;
      margin-bottom: 8px;
      color: rgba(0, 0, 0, 0.87);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;

      .page-title {
        margin: 0;
        font-size: 2.5rem;
        font-weight: 300;
      }
    }

    .generator-card {
      margin-bottom: 32px;

      mat-card-content {
        padding: 24px;
      }
    }

    .form-row {
      margin-bottom: 16px;

      mat-form-field {
        width: 100%;
      }
    }

    .date-range {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .checkbox-row {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin-top: 24px;
    }

    .recent-reports {
      h2 {
        margin: 0 0 16px;
        font-size: 1.5rem;
        font-weight: normal;
      }
    }

    .reports-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .report-card {
      mat-card-actions {
        padding: 8px;
        display: flex;
        justify-content: space-around;
      }
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: rgba(0, 0, 0, 0.6);

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      .empty-description {
        margin-top: 8px;
        font-size: 0.875rem;
      }
    }

    .report-type-option {
      .type-label {
        font-weight: 500;
      }
      
      .type-description {
        font-size: 0.75rem;
        color: rgba(0, 0, 0, 0.6);
        margin-top: 4px;
      }
    }
  `]
})
export class ReportGeneratorComponent implements OnInit, AfterViewInit {
  @ViewChild('firstField') firstField!: ElementRef;
  
  reportForm!: FormGroup;
  generating = false;
  recentReports: ReportData[] = [];

  reportTypes = [
    { value: 'spending', label: 'Spending Analysis', description: 'Analyze your spending patterns and categories' },
    { value: 'income', label: 'Income Report', description: 'Track your income sources and trends' },
    { value: 'budget', label: 'Budget Performance', description: 'Compare actual vs budgeted amounts' },
    { value: 'net-worth', label: 'Net Worth Report', description: 'Track assets and liabilities over time' },
    { value: 'goals', label: 'Goals Progress', description: 'Monitor progress towards financial goals' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private reportsService: ReportsService,
    private accessibilityService: AccessibilityService
  ) {
    this.initForm();
  }  ngOnInit(): void {
    this.loadRecentReports();
  }

  ngAfterViewInit(): void {
    // Set initial focus on the first form field
    if (this.firstField) {
      setTimeout(() => {
        this.firstField.nativeElement.focus();
      }, 100);
    }
  }
  private async loadRecentReports(): Promise<void> {
    this.reportsService.getRecentReports().subscribe({
      next: (reports) => {
        this.recentReports = reports;
      },
      error: (error) => {
        console.error('Error loading recent reports:', error);
        this.recentReports = [];
      }
    });
  }

  private initForm(): void {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    this.reportForm = this.fb.group({
      reportType: ['spending', Validators.required],
      startDate: [firstOfMonth, Validators.required],
      endDate: [today, Validators.required],
      groupBy: ['monthly', Validators.required],
      includeCharts: [true],
      includeTransactions: [false]
    });
  }
  generateReport(): void {
    if (this.reportForm.invalid) {
      this.accessibilityService.announceError('Please fix form errors before generating the report');
      // Focus on first invalid field
      const firstInvalidControl = Object.keys(this.reportForm.controls)
        .find(key => this.reportForm.get(key)?.invalid);
      if (firstInvalidControl) {
        const element = document.querySelector(`[formControlName="${firstInvalidControl}"]`) as HTMLElement;
        if (element) {
          element.focus();
        }
      }
      return;
    }

    this.generating = true;
    this.accessibilityService.announceOperationStatus('Report generation', 'started');
    
    const formValue = this.reportForm.value;
    
    const config: ReportConfig = {
      reportType: formValue.reportType,
      startDate: formValue.startDate,
      endDate: formValue.endDate,
      groupBy: formValue.groupBy,
      includeCharts: formValue.includeCharts,
      includeTransactions: formValue.includeTransactions
    };

    this.reportsService.generateReport(config).subscribe({
      next: (reportData) => {
        this.generating = false;
        this.accessibilityService.announceOperationStatus('Report generation', 'completed');
        this.accessibilityService.announceSuccess(`${reportData.type} report generated successfully`);
        console.log('Report generated:', reportData);
        // Navigate to report viewer
        this.router.navigate(['/reports/view', reportData.id]);
      },
      error: (error) => {
        this.generating = false;
        this.accessibilityService.announceOperationStatus('Report generation', 'failed');
        this.accessibilityService.announceError('Failed to generate report. Please try again.');
        console.error('Error generating report:', error);
      }
    });
  }

  resetForm(): void {
    this.initForm();
  }
  downloadReport(report: ReportData): void {
    this.reportsService.exportReport(report, 'pdf').subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.title}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
      error: (error) => {
        console.error('Error downloading report:', error);
      }
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
