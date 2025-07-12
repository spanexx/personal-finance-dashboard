import { FinancialReport } from '../../core/services/report.service';

export interface ReportState {
  currentReport: FinancialReport | null;
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
