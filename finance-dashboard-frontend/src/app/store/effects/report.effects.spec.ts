import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Observable, of, throwError } from 'rxjs';
import { cold, hot } from 'jasmine-marbles';

import { ReportEffects } from './report.effects';
import { ReportService, GenerateReportRequest, FinancialReport } from '../../core/services/report.service';
import * as ReportActions from '../actions/report.actions';

describe('ReportEffects', () => {
  let actions$: Observable<any>;
  let effects: ReportEffects;
  let reportService: jasmine.SpyObj<ReportService>;

  const mockReportConfig: GenerateReportRequest = {
    name: 'Monthly Expense Report',
    type: 'expense',
    period: 'monthly',
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-01-31T00:00:00.000Z',
    format: 'pdf',
    options: {
      includeCharts: true,
      includeTransactionDetails: true,
      groupBy: 'date'
    }
  };

  const mockReport: FinancialReport = {
    id: 'report_123',
    userId: '',
    name: 'Monthly Expense Report',
    type: 'expense',
    period: 'monthly',
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-01-31T00:00:00.000Z',
    status: 'completed',
    format: 'pdf',
    data: {},
    metadata: { totalRecords: 1, generationTime: 0 },
    createdAt: '2024-01-31T12:00:00.000Z',
    updatedAt: '2024-01-31T12:00:00.000Z'
  };

  const mockBlob = new Blob(['test content'], { type: 'application/pdf' });

  beforeEach(() => {
    const spy = jasmine.createSpyObj('ReportService', [
      'generateReport',
      'exportReport'
    ]);

    TestBed.configureTestingModule({
      providers: [
        ReportEffects,
        provideMockActions(() => actions$),
        { provide: ReportService, useValue: spy }
      ]
    });

    effects = TestBed.inject(ReportEffects);
    reportService = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
  });

  describe('generateReport$', () => {
    it('should return generateReportSuccess action on successful report generation', () => {
      const action = ReportActions.generateReport({ config: mockReportConfig });
      const completion = ReportActions.generateReportSuccess({ report: mockReport });

      actions$ = hot('-a', { a: action });
      const response = cold('-b|', { b: mockReport });
      const expected = cold('--c', { c: completion });
      reportService.generateReport.and.returnValue(response);

      expect(effects.generateReport$).toBeObservable(expected);
    });

    it('should return generateReportFailure action on error', () => {
      const action = ReportActions.generateReport({ config: mockReportConfig });
      const error = new Error('Failed to generate report');
      const completion = ReportActions.generateReportFailure({ error: 'Failed to generate report' });

      actions$ = hot('-a', { a: action });
      const response = cold('-#|', {}, error);
      const expected = cold('--c', { c: completion });
      reportService.generateReport.and.returnValue(response);

      expect(effects.generateReport$).toBeObservable(expected);
    });

    it('should handle service errors without message property', () => {
      const action = ReportActions.generateReport({ config: mockReportConfig });
      const error = 'String error';
      const completion = ReportActions.generateReportFailure({ error: 'Failed to generate report' });

      actions$ = hot('-a', { a: action });
      const response = cold('-#|', {}, error);
      const expected = cold('--c', { c: completion });
      reportService.generateReport.and.returnValue(response);

      expect(effects.generateReport$).toBeObservable(expected);
    });
  });

  describe('loadReport$', () => {
    it('should return loadReportSuccess action on successful report loading', () => {
      const reportId = 'test-report-id';
      const action = ReportActions.loadReport({ id: reportId });
      const reportWithId = { ...mockReport, id: reportId };
      const completion = ReportActions.loadReportSuccess({ report: reportWithId });

      actions$ = hot('-a', { a: action });
      const response = cold('-b|', { b: mockReport });
      const expected = cold('--c', { c: completion });
      reportService.generateReport.and.returnValue(response);

      expect(effects.loadReport$).toBeObservable(expected);
      expect(reportService.generateReport).toHaveBeenCalledWith({
        name: 'Spending Report',
        type: 'expense',
        period: 'monthly',
        startDate: jasmine.any(String),
        endDate: jasmine.any(String),
        format: 'pdf',
        options: {
          includeCharts: true,
          includeTransactionDetails: true,
          groupBy: 'date'
        }
      });
    });

    it('should return loadReportFailure action on error', () => {
      const reportId = 'test-report-id';
      const action = ReportActions.loadReport({ id: reportId });
      const error = new Error('Report not found');
      const completion = ReportActions.loadReportFailure({ error: 'Report not found' });

      actions$ = hot('-a', { a: action });
      const response = cold('-#|', {}, error);
      const expected = cold('--c', { c: completion });
      reportService.generateReport.and.returnValue(response);

      expect(effects.loadReport$).toBeObservable(expected);
    });

    it('should handle service errors without message property for load', () => {
      const reportId = 'test-report-id';
      const action = ReportActions.loadReport({ id: reportId });
      const error = 'Network error';
      const completion = ReportActions.loadReportFailure({ error: 'Failed to load report' });

      actions$ = hot('-a', { a: action });
      const response = cold('-#|', {}, error);
      const expected = cold('--c', { c: completion });
      reportService.generateReport.and.returnValue(response);

      expect(effects.loadReport$).toBeObservable(expected);
    });
  });

  describe('exportReport$', () => {
    it('should return exportReportSuccess action on successful export', () => {
      const format = 'pdf' as const;
      const action = ReportActions.exportReport({ report: mockReport, format });
      const filename = 'Monthly Expense Report.pdf';
      const completion = ReportActions.exportReportSuccess({ blob: mockBlob, filename });

      actions$ = hot('-a', { a: action });
      const response = cold('-b|', { b: mockBlob });
      const expected = cold('--c', { c: completion });
      reportService.exportReport.and.returnValue(response);

      expect(effects.exportReport$).toBeObservable(expected);
      expect(reportService.exportReport).toHaveBeenCalledWith(mockReport.id, format);
    });

    it('should return exportReportFailure action on error', () => {
      const format = 'csv' as const;
      const action = ReportActions.exportReport({ report: mockReport, format });
      const error = new Error('Export failed');
      const completion = ReportActions.exportReportFailure({ error: 'Export failed' });

      actions$ = hot('-a', { a: action });
      const response = cold('-#|', {}, error);
      const expected = cold('--c', { c: completion });
      reportService.exportReport.and.returnValue(response);

      expect(effects.exportReport$).toBeObservable(expected);
    });

    it('should handle service errors without message property for export', () => {
      const format = 'excel' as const;
      const action = ReportActions.exportReport({ report: mockReport, format });
      const error = { code: 500 };
      const completion = ReportActions.exportReportFailure({ error: 'Failed to export report' });

      actions$ = hot('-a', { a: action });
      const response = cold('-#|', {}, error);
      const expected = cold('--c', { c: completion });
      reportService.exportReport.and.returnValue(response);

      expect(effects.exportReport$).toBeObservable(expected);
    });

    it('should generate correct filename for different formats', () => {
      const formats: Array<'pdf' | 'csv' | 'excel'> = ['pdf', 'csv', 'excel'];
      
      formats.forEach(format => {
        const action = ReportActions.exportReport({ report: mockReport, format });
        const expectedFilename = `${mockReport.name}.${format}`;
        const completion = ReportActions.exportReportSuccess({ 
          blob: mockBlob, 
          filename: expectedFilename 
        });

        actions$ = hot('-a', { a: action });
        const response = hot('-b|', { b: mockBlob });
        const expected = cold('--c', { c: completion });
        reportService.exportReport.and.returnValue(response);

        expect(effects.exportReport$).toBeObservable(expected);
      });
    });
  });

  describe('downloadReport$', () => {
    let createElementSpy: jasmine.Spy;
    let appendChildSpy: jasmine.Spy;
    let removeChildSpy: jasmine.Spy;
    let createObjectURLSpy: jasmine.Spy;
    let revokeObjectURLSpy: jasmine.Spy;
    let mockAnchor: jasmine.SpyObj<HTMLAnchorElement>;

    beforeEach(() => {
      mockAnchor = jasmine.createSpyObj('a', ['click']);
      createElementSpy = spyOn(document, 'createElement').and.returnValue(mockAnchor);
      appendChildSpy = spyOn(document.body, 'appendChild');
      removeChildSpy = spyOn(document.body, 'removeChild');
      createObjectURLSpy = spyOn(window.URL, 'createObjectURL').and.returnValue('blob:url');
      revokeObjectURLSpy = spyOn(window.URL, 'revokeObjectURL');
    });

    it('should trigger file download on exportReportSuccess', () => {
      const filename = 'test-report.pdf';
      const action = ReportActions.exportReportSuccess({ blob: mockBlob, filename });

      actions$ = hot('-a', { a: action });
      const expected = cold('-a', { a: action });

      // Note: This effect doesn't dispatch any action, it just performs side effects
      expect(effects.downloadReport$).toBeObservable(expected);
    });

    it('should create download link and clean up correctly', (done) => {
      const filename = 'test-report.pdf';
      const action = ReportActions.exportReportSuccess({ blob: mockBlob, filename });

      actions$ = of(action);

      effects.downloadReport$.subscribe(() => {
        expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);
        expect(createElementSpy).toHaveBeenCalledWith('a');
        expect(mockAnchor.href).toBe('blob:url');
        expect(mockAnchor.download).toBe(filename);
        expect(appendChildSpy).toHaveBeenCalledWith(mockAnchor);
        expect(mockAnchor.click).toHaveBeenCalled();
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:url');
        expect(removeChildSpy).toHaveBeenCalledWith(mockAnchor);
        done();
      });
    });
  });
});
