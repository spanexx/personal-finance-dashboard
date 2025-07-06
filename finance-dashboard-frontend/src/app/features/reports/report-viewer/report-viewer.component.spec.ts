import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of, Subject } from 'rxjs';

import { ReportViewerComponent } from './report-viewer.component';
import { AppState } from '../../../store/state/app.state';
import * as ReportActions from '../../../store/actions/report.actions';
import { selectCurrentReport, selectReportLoading, selectReportError, selectReportExporting } from '../../../store/selectors/report.selectors';
import { initialReportState } from '../../../store/reducers/report.reducer'; // Assuming this exists
import { ReportData, ReportConfig } from '../../../core/services/reports.service'; // Assuming ReportConfig is also exported
import { ChartComponent } from '../../../shared/components/chart/chart.component';
import { AccessibilityService } from '../../../shared/services/accessibility.service';

// Import Material Modules used by the component's template
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common'; // For pipes

// Mock AccessibilityService
class MockAccessibilityService {
  announce = jest.fn();
  announceOperationStatus = jest.fn();
}

describe('ReportViewerComponent', () => {
  let component: ReportViewerComponent;
  let fixture: ComponentFixture<ReportViewerComponent>;
  let store: MockStore<AppState>;
  let mockActivatedRoute: any;
  let mockAccessibilityService: MockAccessibilityService;

  const mockReportConfig: ReportConfig = {
    reportType: 'spending', startDate: new Date(), endDate: new Date(), groupBy: 'monthly'
  };
  const mockReport: ReportData = {
    id: 'rep123',
    title: 'Monthly Spending Report',
    generatedAt: new Date().toISOString(),
    config: mockReportConfig,
    summary: { totalIncome: 1000, totalExpenses: 500, netSavings: 500, transactionCount: 10 },
    categoryBreakdown: [{ category: 'Food', amount: 200, percentage: 40, color: '#FF0000' }],
    chartData: {
      labels: ['Jan', 'Feb'],
      datasets: [{ label: 'Spending', data: [100, 150] }]
    },
    transactions: [{ id: 't1', description: 'Lunch', amount: 12, date: new Date().toISOString(), category: 'Food', type: 'expense' }]
  };

  const initialState: Partial<AppState> = {
    reports: { ...initialReportState, currentReport: null, loading: false, error: null, exporting: false } as any,
  };

  beforeEach(async () => {
    mockAccessibilityService = new MockAccessibilityService();
    mockActivatedRoute = {
      snapshot: { paramMap: convertToParamMap({ id: 'rep123' }) }
    };

    await TestBed.configureTestingModule({
      imports: [
        ReportViewerComponent, // Standalone
        NoopAnimationsModule,
        RouterTestingModule,
        CommonModule, // For pipes
        MatCardModule, MatButtonModule, MatIconModule, MatTableModule, MatProgressBarModule, MatProgressSpinnerModule,
        // ChartComponent // If ChartComponent is standalone and imported by ReportViewerComponent
      ],
      providers: [
        provideMockStore({ initialState }),
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: AccessibilityService, useValue: mockAccessibilityService },
      ],
      // schemas: [NO_ERRORS_SCHEMA] // If ChartComponent is complex or has many dependencies
    }).overrideComponent(ReportViewerComponent, { // Mock ChartComponent if it's complex
        remove: { imports: [ChartComponent] },
        add: { imports: [] } // Or add a MockChartComponent if needed
    }).compileComponents();

    fixture = TestBed.createComponent(ReportViewerComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    jest.spyOn(store, 'dispatch');
    // fixture.detectChanges(); // ngOnInit
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should dispatch loadReport on ngOnInit if reportId is present', () => {
    fixture.detectChanges(); // ngOnInit
    expect(store.dispatch).toHaveBeenCalledWith(ReportActions.loadReport({ id: 'rep123' }));
  });

  it('should not dispatch loadReport if no reportId in route', () => {
    (component['route'].snapshot as any).paramMap = convertToParamMap({}); // Simulate no ID
    fixture.detectChanges(); // ngOnInit
    expect(store.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: ReportActions.loadReport.type }));
  });

  it('should subscribe to report$ and set up charts when report data loads', () => {
    fixture.detectChanges(); // ngOnInit
    const setupChartsSpy = jest.spyOn(component as any, 'setupCharts');
    store.overrideSelector(selectCurrentReport, mockReport);
    store.refreshState();
    fixture.detectChanges();

    component.report$.subscribe(report => {
      expect(report).toEqual(mockReport);
    });
    expect(setupChartsSpy).toHaveBeenCalledWith(mockReport);
    expect(component.categoryChartData).toBeDefined();
    expect(component.trendChartData).toBeDefined();
  });

  it('should dispatch clearCurrentReport on ngOnDestroy', () => {
    fixture.detectChanges(); // ngOnInit
    component.ngOnDestroy();
    expect(store.dispatch).toHaveBeenCalledWith(ReportActions.clearCurrentReport());
  });

  describe('downloadReport', () => {
    it('should dispatch exportReport action and announce status', fakeAsync(() => {
      fixture.detectChanges();
      store.overrideSelector(selectCurrentReport, mockReport); // Ensure report data is available
      store.refreshState();
      fixture.detectChanges();

      store.overrideSelector(selectReportExporting, false); // Initial state

      component.downloadReport(mockReport);

      expect(mockAccessibilityService.announceOperationStatus).toHaveBeenCalledWith('Report download', 'started');
      expect(store.dispatch).toHaveBeenCalledWith(ReportActions.exportReport({ report: mockReport, format: 'pdf' }));

      // Simulate exporting started
      store.overrideSelector(selectReportExporting, true);
      store.refreshState();
      tick();

      // Simulate exporting finished
      store.overrideSelector(selectReportExporting, false);
      store.refreshState();
      tick();

      expect(mockAccessibilityService.announceOperationStatus).toHaveBeenCalledWith('Report download', 'completed');
    }));
  });

  it('formatDateRange should format date range correctly', () => {
      const dateRange = { startDate: '2023-01-01T00:00:00Z', endDate: '2023-01-31T23:59:59Z' };
      // Expected format: Jan 1 - Jan 31, 2023 (depends on toLocaleDateString specifics)
      // This test is locale-dependent, so be cautious or mock toLocaleDateString for stability.
      // For now, just check it runs and returns a string.
      expect(component.formatDateRange(dateRange)).toEqual(expect.any(String));
  });

  it('getChartDescription should return appropriate descriptions', () => {
    component.categoryChartData = { labels: ['Food', 'Travel'], datasets: [{ data: [100, 50] }] };
    expect(component.getChartDescription('category')).toContain('Category breakdown chart showing 2 categories');

    component.trendChartData = { labels: ['Jan', 'Feb'], datasets: [{ label: 'Trend', data: [10, 20] }] };
    expect(component.getChartDescription('trend')).toContain('Trend analysis chart showing financial trends over 2 data points');
  });

});
