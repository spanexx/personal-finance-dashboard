import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError, switchMap, tap } from 'rxjs/operators';
import { ReportService, GenerateReportRequest, FinancialReport } from '../../core/services/report.service';
import * as ReportActions from '../actions/report.actions';

@Injectable()
export class ReportEffects {
  
  constructor(
    private actions$: Actions,
    private reportService: ReportService
  ) {}

  generateReport$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ReportActions.generateReport),
      switchMap(({ config }) =>
        this.reportService.generateReport(config).pipe(
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
        this.reportService.getReport(id).pipe(
          map(report => ReportActions.loadReportSuccess({ report })),
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
        this.reportService.exportReport(report.id, format).pipe(
          map(blob => ReportActions.exportReportSuccess({ 
            blob, 
            filename: `${report.name}.${format}` 
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
