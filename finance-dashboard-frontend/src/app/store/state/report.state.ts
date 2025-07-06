import { ReportData } from '../../core/services/reports.service';

export interface ReportState {
  currentReport: ReportData | null;
  loading: boolean;
  error: string | null;
  exporting: boolean;
}

export const initialReportState: ReportState = {
  currentReport: null,
  loading: false,
  error: null,
  exporting: false
};
