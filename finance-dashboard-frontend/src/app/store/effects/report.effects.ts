import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError, switchMap, tap } from 'rxjs/operators';
import { ReportsService } from '../../core/services/reports.service';
import * as ReportActions from '../actions/report.actions';

@Injectable()
export class ReportEffects {
  
  constructor(
    private actions$: Actions,
    private reportsService: ReportsService
  ) {}

  generateReport$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReportActions.generateReport),
      switchMap(({ config }) =>
        this.reportsService.generateReport(config).pipe(
          map(report => ReportActions.generateReportSuccess({ report })),
          catchError(error => of(ReportActions.generateReportFailure({ 
            error: error.message || 'Failed to generate report' 
          })))
        )
      )
    )
  );

  loadReport$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReportActions.loadReport),
      switchMap(({ id }) =>
        // Note: This would need to be implemented in the ReportsService
        // For now, we'll generate a mock report based on the ID
        this.reportsService.generateReport({
          reportType: 'spending',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          groupBy: 'monthly',
          includeCharts: true,
          includeTransactions: true
        }).pipe(
          map(report => ReportActions.loadReportSuccess({ 
            report: { ...report, id } 
          })),
          catchError(error => of(ReportActions.loadReportFailure({ 
            error: error.message || 'Failed to load report' 
          })))
        )
      )
    )
  );

  exportReport$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReportActions.exportReport),
      mergeMap(({ report, format }) =>
        this.reportsService.exportReport(report, format).pipe(
          map(blob => ReportActions.exportReportSuccess({ 
            blob, 
            filename: `${report.title}.${format}` 
          })),
          catchError(error => of(ReportActions.exportReportFailure({ 
            error: error.message || 'Failed to export report' 
          })))
        )
      )
    )
  );

  downloadReport$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReportActions.exportReportSuccess),
      tap(({ blob, filename }) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
    ), 
    { dispatch: false }
  );
}
