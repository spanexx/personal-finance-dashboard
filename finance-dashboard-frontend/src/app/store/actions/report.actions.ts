import { createAction, props } from '@ngrx/store';
import { ReportData, ReportConfig } from '../../core/services/reports.service';

// Generate Report Actions
export const generateReport = createAction(
  '[Report] Generate Report',
  props<{ config: ReportConfig }>()
);
export const generateReportSuccess = createAction(
  '[Report] Generate Report Success',
  props<{ report: ReportData }>()
);
export const generateReportFailure = createAction(
  '[Report] Generate Report Failure',
  props<{ error: string }>()
);

// Load Report Actions (for viewing saved reports)
export const loadReport = createAction(
  '[Report] Load Report',
  props<{ id: string }>()
);
export const loadReportSuccess = createAction(
  '[Report] Load Report Success',
  props<{ report: ReportData }>()
);
export const loadReportFailure = createAction(
  '[Report] Load Report Failure',
  props<{ error: string }>()
);

// Export Report Actions
export const exportReport = createAction(
  '[Report] Export Report',
  props<{ report: ReportData; format: 'pdf' | 'csv' | 'excel' }>()
);
export const exportReportSuccess = createAction(
  '[Report] Export Report Success',
  props<{ blob: Blob; filename: string }>()
);
export const exportReportFailure = createAction(
  '[Report] Export Report Failure',
  props<{ error: string }>()
);

// Clear Actions
export const clearCurrentReport = createAction('[Report] Clear Current Report');
export const clearError = createAction('[Report] Clear Error');
