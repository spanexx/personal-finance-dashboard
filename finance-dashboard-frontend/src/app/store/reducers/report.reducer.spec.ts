import { reportReducer } from './report.reducer';
import * as ReportActions from '../actions/report.actions';
import { ReportState, initialReportState } from '../state/report.state';
import { ReportData, ReportConfig } from '../../core/services/reports.service';

describe('Report Reducer', () => {
  const mockReportConfig: ReportConfig = {
    reportType: 'expense',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    includeCharts: true,
    includeTransactions: true,
    groupBy: 'monthly'
  };

  const mockReport: ReportData = {
    id: 'report_123',
    title: 'Monthly Expense Report',
    type: 'expense',
    dateRange: {
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-01-31T00:00:00.000Z'
    },
    summary: {
      totalIncome: 5000,
      totalExpenses: 3250,
      netSavings: 1750,
      transactionCount: 45
    },
    chartData: {
      labels: ['Food', 'Transport', 'Bills'],
      datasets: [{
        label: 'Expenses',
        data: [800, 400, 1200],
        backgroundColor: ['#ff6384', '#36a2eb', '#ffce56']
      }]
    },
    categoryBreakdown: [
      { category: 'Food', amount: 800, percentage: 24.6, color: '#ff6384' },
      { category: 'Transport', amount: 400, percentage: 12.3, color: '#36a2eb' },
      { category: 'Bills', amount: 1200, percentage: 36.9, color: '#ffce56' }
    ],
    transactions: [
      {
        id: 'txn_1',
        date: '2024-01-15',
        description: 'Grocery shopping',
        category: 'Food',
        amount: 120.50,
        type: 'expense'
      }
    ],
    generatedAt: '2024-01-31T12:00:00.000Z'
  };

  const mockReport2: ReportData = {
    id: 'report_456',
    title: 'Income Analysis Report',
    type: 'income',
    dateRange: {
      startDate: '2024-02-01T00:00:00.000Z',
      endDate: '2024-02-28T00:00:00.000Z'
    },
    summary: {
      totalIncome: 6000,
      totalExpenses: 2800,
      netSavings: 3200,
      transactionCount: 28
    },
    chartData: {
      labels: ['Salary', 'Freelance', 'Investments'],
      datasets: [{
        label: 'Income',
        data: [4500, 1200, 300],
        backgroundColor: ['#4caf50', '#2196f3', '#ff9800']
      }]
    },
    categoryBreakdown: [
      { category: 'Salary', amount: 4500, percentage: 75, color: '#4caf50' },
      { category: 'Freelance', amount: 1200, percentage: 20, color: '#2196f3' },
      { category: 'Investments', amount: 300, percentage: 5, color: '#ff9800' }
    ],
    generatedAt: '2024-02-28T12:00:00.000Z'
  };

  describe('unknown action', () => {
    it('should return the default state', () => {
      const action = { type: 'Unknown' } as any;
      const state = reportReducer(initialReportState, action);

      expect(state).toBe(initialReportState);
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      expect(initialReportState).toEqual({
        currentReport: null,
        loading: false,
        error: null,
        exporting: false
      });
    });
  });

  describe('generateReport actions', () => {
    it('should set loading to true on generateReport', () => {
      const action = ReportActions.generateReport({ config: mockReportConfig });
      const state = reportReducer(initialReportState, action);

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should set current report and loading to false on generateReportSuccess', () => {
      const existingState: ReportState = {
        ...initialReportState,
        loading: true
      };
      const action = ReportActions.generateReportSuccess({ report: mockReport });
      const state = reportReducer(existingState, action);

      expect(state.currentReport).toEqual(mockReport);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set error on generateReportFailure', () => {
      const existingState: ReportState = {
        ...initialReportState,
        loading: true
      };
      const error = 'Failed to generate report';
      const action = ReportActions.generateReportFailure({ error });
      const state = reportReducer(existingState, action);

      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
      expect(state.currentReport).toBeNull();
    });

    it('should clear previous error on generateReport', () => {
      const existingState: ReportState = {
        ...initialReportState,
        error: 'Previous error'
      };
      const action = ReportActions.generateReport({ config: mockReportConfig });
      const state = reportReducer(existingState, action);

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  describe('loadReport actions', () => {
    it('should set loading to true on loadReport', () => {
      const action = ReportActions.loadReport({ id: 'report_123' });
      const state = reportReducer(initialReportState, action);

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should set current report and loading to false on loadReportSuccess', () => {
      const existingState: ReportState = {
        ...initialReportState,
        loading: true
      };
      const action = ReportActions.loadReportSuccess({ report: mockReport });
      const state = reportReducer(existingState, action);

      expect(state.currentReport).toEqual(mockReport);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set error on loadReportFailure', () => {
      const existingState: ReportState = {
        ...initialReportState,
        loading: true
      };
      const error = 'Report not found';
      const action = ReportActions.loadReportFailure({ error });
      const state = reportReducer(existingState, action);

      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
      expect(state.currentReport).toBeNull();
    });

    it('should replace existing report on loadReportSuccess', () => {
      const existingState: ReportState = {
        ...initialReportState,
        currentReport: mockReport,
        loading: true
      };
      const action = ReportActions.loadReportSuccess({ report: mockReport2 });
      const state = reportReducer(existingState, action);

      expect(state.currentReport).toEqual(mockReport2);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should clear previous error on loadReport', () => {
      const existingState: ReportState = {
        ...initialReportState,
        error: 'Previous load error'
      };
      const action = ReportActions.loadReport({ id: 'report_456' });
      const state = reportReducer(existingState, action);

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  describe('exportReport actions', () => {
    it('should set exporting to true on exportReport', () => {
      const action = ReportActions.exportReport({ 
        report: mockReport, 
        format: 'pdf' 
      });
      const state = reportReducer(initialReportState, action);

      expect(state.exporting).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should set exporting to false on exportReportSuccess', () => {
      const existingState: ReportState = {
        ...initialReportState,
        exporting: true
      };
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      const action = ReportActions.exportReportSuccess({ 
        blob: mockBlob, 
        filename: 'report.pdf' 
      });
      const state = reportReducer(existingState, action);

      expect(state.exporting).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set error and exporting to false on exportReportFailure', () => {
      const existingState: ReportState = {
        ...initialReportState,
        exporting: true
      };
      const error = 'Export failed';
      const action = ReportActions.exportReportFailure({ error });
      const state = reportReducer(existingState, action);

      expect(state.exporting).toBe(false);
      expect(state.error).toBe(error);
    });

    it('should clear previous error on exportReport', () => {
      const existingState: ReportState = {
        ...initialReportState,
        error: 'Previous export error'
      };
      const action = ReportActions.exportReport({ 
        report: mockReport, 
        format: 'csv' 
      });
      const state = reportReducer(existingState, action);

      expect(state.exporting).toBe(true);
      expect(state.error).toBeNull();
    });    it('should not affect currentReport during export operations', () => {
      const existingState: ReportState = {
        ...initialReportState,
        currentReport: mockReport
      };
      
      // Export action should not change current report
      const exportAction = ReportActions.exportReport({ 
        report: mockReport, 
        format: 'excel' 
      });
      let state = reportReducer(existingState, exportAction);
      expect(state.currentReport).toEqual(mockReport);

      // Success should not change current report
      const mockBlob = new Blob(['test'], { type: 'application/excel' });
      const successAction = ReportActions.exportReportSuccess({ 
        blob: mockBlob, 
        filename: 'report.excel' 
      });
      state = reportReducer({ ...state, exporting: true }, successAction);
      expect(state.currentReport).toEqual(mockReport);

      // Failure should not change current report
      const failureAction = ReportActions.exportReportFailure({ error: 'Export failed' });
      state = reportReducer({ ...existingState, exporting: true }, failureAction);
      expect(state.currentReport).toEqual(mockReport);
    });
  });

  describe('clear actions', () => {
    it('should clear current report on clearCurrentReport', () => {
      const existingState: ReportState = {
        ...initialReportState,
        currentReport: mockReport,
        loading: false,
        error: null,
        exporting: false
      };
      const action = ReportActions.clearCurrentReport();
      const state = reportReducer(existingState, action);

      expect(state.currentReport).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.exporting).toBe(false);
    });

    it('should clear error on clearError', () => {
      const existingState: ReportState = {
        ...initialReportState,
        currentReport: mockReport,
        error: 'Some error'
      };
      const action = ReportActions.clearError();
      const state = reportReducer(existingState, action);

      expect(state.error).toBeNull();
      expect(state.currentReport).toEqual(mockReport);
      expect(state.loading).toBe(false);
      expect(state.exporting).toBe(false);
    });

    it('should not affect other state properties when clearing error', () => {
      const existingState: ReportState = {
        currentReport: mockReport,
        loading: true,
        error: 'Error to clear',
        exporting: true
      };
      const action = ReportActions.clearError();
      const state = reportReducer(existingState, action);

      expect(state.error).toBeNull();
      expect(state.currentReport).toEqual(mockReport);
      expect(state.loading).toBe(true);
      expect(state.exporting).toBe(true);
    });
  });

  describe('state immutability', () => {
    it('should not mutate original state on generateReportSuccess', () => {
      const originalState = { ...initialReportState };
      const action = ReportActions.generateReportSuccess({ report: mockReport });
      const newState = reportReducer(originalState, action);

      expect(originalState).toEqual(initialReportState);
      expect(newState).not.toBe(originalState);
      expect(newState.currentReport).toEqual(mockReport);
    });

    it('should not mutate original state on error actions', () => {
      const originalState: ReportState = {
        ...initialReportState,
        loading: true
      };
      const action = ReportActions.generateReportFailure({ error: 'Test error' });
      const newState = reportReducer(originalState, action);

      expect(originalState.error).toBeNull();
      expect(newState).not.toBe(originalState);
      expect(newState.error).toBe('Test error');
    });
  });

  describe('complex state transitions', () => {
    it('should handle multiple actions in sequence', () => {
      // Start with generate report
      let state = reportReducer(initialReportState, 
        ReportActions.generateReport({ config: mockReportConfig }));
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();

      // Generate succeeds
      state = reportReducer(state, 
        ReportActions.generateReportSuccess({ report: mockReport }));
      expect(state.currentReport).toEqual(mockReport);
      expect(state.loading).toBe(false);

      // Export the report
      state = reportReducer(state, 
        ReportActions.exportReport({ report: mockReport, format: 'pdf' }));
      expect(state.exporting).toBe(true);
      expect(state.currentReport).toEqual(mockReport);

      // Export succeeds
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      state = reportReducer(state, 
        ReportActions.exportReportSuccess({ blob: mockBlob, filename: 'report.pdf' }));
      expect(state.exporting).toBe(false);
      expect(state.currentReport).toEqual(mockReport);
      expect(state.error).toBeNull();
    });

    it('should handle error during export while having current report', () => {
      // Start with a report already loaded
      let state: ReportState = {
        currentReport: mockReport,
        loading: false,
        error: null,
        exporting: false
      };

      // Export fails
      state = reportReducer(state, 
        ReportActions.exportReportFailure({ error: 'Network error' }));
      
      expect(state.currentReport).toEqual(mockReport);
      expect(state.exporting).toBe(false);
      expect(state.error).toBe('Network error');
    });

    it('should handle concurrent operations correctly', () => {
      // Start loading a report
      let state = reportReducer(initialReportState, 
        ReportActions.loadReport({ id: 'report_123' }));
      expect(state.loading).toBe(true);

      // If we start exporting while loading (edge case)
      state = reportReducer(state, 
        ReportActions.exportReport({ report: mockReport, format: 'csv' }));
      expect(state.loading).toBe(true);
      expect(state.exporting).toBe(true);

      // Load completes
      state = reportReducer(state, 
        ReportActions.loadReportSuccess({ report: mockReport }));
      expect(state.loading).toBe(false);
      expect(state.exporting).toBe(true);
      expect(state.currentReport).toEqual(mockReport);
    });
  });
});
