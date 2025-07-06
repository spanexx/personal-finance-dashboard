import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { ElementRef } from '@angular/core';

import { ReportGeneratorComponent } from './report-generator.component';
import { ReportsService, ReportConfig, ReportData } from '../../../core/services/reports.service';
import { AccessibilityService } from '../../../shared/services/accessibility.service';

// Import Material Modules used by the component's template
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
import { RouterTestingModule } from '@angular/router/testing'; // For routerLink

// Mock Services
class MockAccessibilityService {
  announce = jest.fn();
  announceError = jest.fn();
  announceOperationStatus = jest.fn();
}

class MockElementRef implements ElementRef {
  nativeElement = { focus: jest.fn() };
}

describe('ReportGeneratorComponent', () => {
  let component: ReportGeneratorComponent;
  let fixture: ComponentFixture<ReportGeneratorComponent>;
  let mockReportsService: Partial<ReportsService>;
  let mockAccessibilityService: MockAccessibilityService;
  let mockRouter: Partial<Router>;

  const mockRecentReport: ReportData = {
    id: 'rep1',
    type: 'Spending Analysis',
    title: 'Monthly Spending',
    generatedAt: new Date().toISOString(),
    data: {}, // mock actual report data if needed for other tests
    config: {} as ReportConfig
  };

  beforeEach(async () => {
    mockReportsService = {
      getRecentReports: jest.fn().mockReturnValue(of([mockRecentReport])),
      generateReport: jest.fn(),
      exportReport: jest.fn().mockReturnValue(of(new Blob())),
    };
    mockAccessibilityService = new MockAccessibilityService();
    mockRouter = {
      navigate: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        ReportGeneratorComponent, // Standalone
        ReactiveFormsModule,
        NoopAnimationsModule,
        RouterTestingModule,
        MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
        MatSelectModule, MatDatepickerModule, MatNativeDateModule, MatCheckboxModule,
        MatProgressSpinnerModule
      ],
      providers: [
        FormBuilder,
        { provide: ReportsService, useValue: mockReportsService },
        { provide: AccessibilityService, useValue: mockAccessibilityService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportGeneratorComponent);
    component = fixture.componentInstance;

    // Mock ViewChild elements
    component.firstField = new MockElementRef() as ElementRef<HTMLInputElement>;

    fixture.detectChanges(); // ngOnInit
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize reportForm on creation', () => {
    expect(component.reportForm).toBeDefined();
    expect(component.reportForm.get('reportType')).toBeDefined();
    expect(component.reportForm.get('startDate')).toBeDefined();
  });

  it('should load recent reports on init', () => {
    expect(mockReportsService.getRecentReports).toHaveBeenCalled();
    expect(component.recentReports.length).toBe(1);
    expect(component.recentReports[0]).toEqual(mockRecentReport);
  });

  it('ngAfterViewInit should focus first field', fakeAsync(() => {
    component.ngAfterViewInit();
    tick(100);
    expect(component.firstField.nativeElement.focus).toHaveBeenCalled();
  }));

  describe('generateReport', () => {
    it('should not call service if form is invalid', () => {
      component.reportForm.get('reportType')?.setValue(''); // Make invalid
      component.generateReport();
      expect(mockReportsService.generateReport).not.toHaveBeenCalled();
      expect(mockAccessibilityService.announceError).toHaveBeenCalledWith('Please fix form errors before generating the report');
    });

    it('should call reportsService.generateReport and navigate on success', () => {
      const generatedReportData = { ...mockRecentReport, id: 'newRep', type: 'Income Report' };
      (mockReportsService.generateReport as jest.Mock).mockReturnValue(of(generatedReportData));

      component.reportForm.setValue({
        reportType: 'income',
        startDate: new Date(2023, 0, 1),
        endDate: new Date(2023, 0, 31),
        groupBy: 'monthly',
        includeCharts: true,
        includeTransactions: false
      });
      component.generateReport();

      expect(mockReportsService.generateReport).toHaveBeenCalled();
      expect(component.generating).toBe(false);
      expect(mockAccessibilityService.announceSuccess).toHaveBeenCalledWith('Income Report report generated successfully');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/reports/view', 'newRep']);
    });

    it('should handle error during report generation', () => {
      (mockReportsService.generateReport as jest.Mock).mockReturnValue(throwError(() => new Error('Gen failed')));
      component.reportForm.setValue({
        reportType: 'income', startDate: new Date(), endDate: new Date(), groupBy: 'monthly',
        includeCharts: true, includeTransactions: false
      });
      component.generateReport();

      expect(component.generating).toBe(false);
      expect(mockAccessibilityService.announceError).toHaveBeenCalledWith('Failed to generate report. Please try again.');
    });
  });

  it('resetForm should re-initialize the form', () => {
    component.reportForm.get('reportType')?.setValue('income');
    component.resetForm();
    // Default value for reportType is 'spending' in initForm
    expect(component.reportForm.get('reportType')?.value).toBe('spending');
  });

  it('downloadReport should call reportsService.exportReport', () => {
    // Mock URL.createObjectURL and a.click for a more complete test if needed
    jest.spyOn(window.URL, 'createObjectURL').mockImplementation(() => 'blob:url');
    jest.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: jest.fn(),
        appendChild: jest.fn(),
        removeChild: jest.fn()
    } as any);


    component.downloadReport(mockRecentReport);
    expect(mockReportsService.exportReport).toHaveBeenCalledWith(mockRecentReport, 'pdf');
    // Further expect a.click() etc. if spies are set up on document.createElement('a')
  });

  it('formatDate should format date string correctly', () => {
    const date = new Date(2023, 0, 15); // Jan 15, 2023
    expect(component.formatDate(date.toISOString())).toBe('January 15, 2023');
  });

});
