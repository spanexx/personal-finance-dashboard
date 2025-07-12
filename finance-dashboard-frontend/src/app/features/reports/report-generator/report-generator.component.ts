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

import { ReportService, GenerateReportRequest, FinancialReport } from '../../../core/services/report.service';
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
  ],  
  templateUrl: './report-generator.component.html',
  styleUrls: ['./report-generator.component.css'],

})
export class ReportGeneratorComponent implements OnInit, AfterViewInit {
  @ViewChild('firstField') firstField!: ElementRef;
  
  reportForm!: FormGroup;
  generating = false;
  recentReports: FinancialReport[] = [];

  reportTypes = [
    { value: 'expense', label: 'Spending Analysis', description: 'Analyze your spending patterns and categories' },
    { value: 'income', label: 'Income Report', description: 'Track your income sources and trends' },
    { value: 'budget', label: 'Budget Performance', description: 'Compare actual vs budgeted amounts' },
    { value: 'net_worth', label: 'Net Worth Report', description: 'Track assets and liabilities over time' },
    { value: 'goals', label: 'Goals Progress', description: 'Monitor progress towards financial goals' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private reportService: ReportService,
    private accessibilityService: AccessibilityService
  ) {
    this.initForm();
  }  ngOnInit(): void {
    this.loadRecentReports();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (
        this.firstField &&
        this.firstField.nativeElement &&
        typeof this.firstField.nativeElement.focus === 'function'
      ) {
        this.firstField.nativeElement.focus();
      }
    }, 100);
  }
  private async loadRecentReports(): Promise<void> {
    this.reportService.getRecentReports(5).subscribe({
      next: (reports) => {
        console.log('[loadRecentReports] Success. Received recent reports:', reports);
        this.recentReports = reports;
        console.log('[loadRecentReports] Recent reports loaded:', this.recentReports);
      },
      error: (error) => {
        console.error('[loadRecentReports] Error loading recent reports:', error);
        if (error && typeof error === 'object') {
          if ('status' in error) {
            console.error('[loadRecentReports] Error status:', error.status);
          }
          if ('message' in error) {
            console.error('[loadRecentReports] Error message:', error.message);
          }
          if ('code' in error) {
            console.error('[loadRecentReports] Error code:', error.code);
          }
          if ('errors' in error) {
            console.error('[loadRecentReports] Error details:', error.errors);
          }
        }
        this.recentReports = [];
      }
    });
  }

  private initForm(): void {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    this.reportForm = this.fb.group({
      reportType: ['expense', Validators.required],
      startDate: [firstOfMonth, Validators.required],
      endDate: [today, Validators.required],
      groupBy: ['monthly', Validators.required],
      includeCharts: [true],
      includeTransactionDetails: [false] // CHANGED from includeTransactions
    });
  }
  generateReport(): void {
    console.log('Generating report with form value:', this.reportForm.value);
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
    const config: GenerateReportRequest = {
      name: `${formValue.reportType} report`,
      type: formValue.reportType,
      period: formValue.groupBy,
      startDate: formValue.startDate.toISOString(),
      endDate: formValue.endDate.toISOString(),
      format: 'pdf', // or allow user to select
      options: {
        includeCharts: formValue.includeCharts,
        includeTransactionDetails: formValue.includeTransactionDetails, // CHANGED from includeTransactions
        groupBy: formValue.groupBy
      }
    };
    console.log('Report generation config:', config);
    this.reportService.generateReport(config).subscribe({
      next: (reportData) => {
        console.log('Report generated:', reportData);
        this.generating = false;
        this.accessibilityService.announceOperationStatus('Report generation', 'completed');
        this.accessibilityService.announceSuccess(`${reportData.type} report generated successfully`);
        // Navigate to report viewer with fallback if id is missing
        const reportId = reportData.id || 'latest';
        // this.router.navigate(['/reports/view', reportId]);
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
  downloadReport(report: FinancialReport): void {
    this.reportService.exportReport(report.id, 'pdf').subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.name}.pdf`;
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
