import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ReportState } from '../state/report.state';

export const selectReportState = createFeatureSelector<ReportState>('reports');

export const selectCurrentReport = createSelector(
  selectReportState,
  (state: ReportState) => state.currentReport
);

export const selectReportLoading = createSelector(
  selectReportState,
  (state: ReportState) => state.loading
);

export const selectReportError = createSelector(
  selectReportState,
  (state: ReportState) => state.error
);

export const selectReportExporting = createSelector(
  selectReportState,
  (state: ReportState) => state.exporting
);

export const selectReportSummary = createSelector(
  selectCurrentReport,
  (report) => report?.data?.summary
);

export const selectReportCharts = createSelector(
  selectCurrentReport,
  (report) => ({
    categoryBreakdown: report?.data?.categoryBreakdown,
    chartData: report?.data?.chartData
  })
);
