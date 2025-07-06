import { createReducer, on } from '@ngrx/store';
import { ReportState, initialReportState } from '../state/report.state';
import * as ReportActions from '../actions/report.actions';

// Re-export initialReportState for convenience
export { initialReportState } from '../state/report.state';

export const reportReducer = createReducer(
  initialReportState,

  // Generate Report
  on(ReportActions.generateReport, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(ReportActions.generateReportSuccess, (state, { report }) => ({
    ...state,
    currentReport: report,
    loading: false,
    error: null
  })),

  on(ReportActions.generateReportFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Load Report
  on(ReportActions.loadReport, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(ReportActions.loadReportSuccess, (state, { report }) => ({
    ...state,
    currentReport: report,
    loading: false,
    error: null
  })),

  on(ReportActions.loadReportFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Export Report
  on(ReportActions.exportReport, (state) => ({
    ...state,
    exporting: true,
    error: null
  })),

  on(ReportActions.exportReportSuccess, (state) => ({
    ...state,
    exporting: false,
    error: null
  })),

  on(ReportActions.exportReportFailure, (state, { error }) => ({
    ...state,
    exporting: false,
    error
  })),

  // Clear Actions
  on(ReportActions.clearCurrentReport, (state) => ({
    ...state,
    currentReport: null
  })),

  on(ReportActions.clearError, (state) => ({
    ...state,
    error: null
  }))
);
