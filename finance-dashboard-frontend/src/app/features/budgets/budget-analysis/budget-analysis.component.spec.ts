import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of, Subject } from 'rxjs';
import { Chart, ChartConfiguration, ChartOptions } from 'chart.js'; // Import Chart for mocking

import { BudgetAnalysisComponent } from './budget-analysis.component';
import { BudgetService } from '../budget.service'; // For helper methods
import { AppState } from '../../../store/state/app.state';
import * as BudgetActions from '../../../store/actions/budget.actions';
import { selectSelectedBudget, selectBudgetLoading, selectBudgetError } from '../../../store/selectors/budget.selectors';
import { initialBudgetState } from '../../../store/reducers/budget.reducer';
import { Budget, CategoryAllocation } from '../../../shared/models/budget.model';

// Import Material Modules used by the component's template
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { NgChartsModule } from 'ng2-charts'; // BaseChartDirective

// Mock Chart.js
let mockChartInstance: Partial<Chart>;
const MockChart = jest.fn().mockImplementation((context, config) => {
  mockChartInstance = {
    data: config.data,
    options: config.options,
    update: jest.fn(),
    destroy: jest.fn(),
    config: config
  };
  return mockChartInstance as Chart;
});

describe('BudgetAnalysisComponent', () => {
  let component: BudgetAnalysisComponent;
  let fixture: ComponentFixture<BudgetAnalysisComponent>;
  let store: MockStore<AppState>;
  let mockBudgetService: Partial<BudgetService>;

  const mockCategoryAllocation: CategoryAllocation = {
    category: 'Food', allocated: 500, spent: 250, remaining: 250, rollover: 0,
    utilizationPercentage: 50, transactionCount: 5, alerts: {enabled: false, threshold: 80, triggered: false}
  };
  const mockBudget: Budget = {
    _id: 'b1', user: 'u1', name: 'Monthly Budget', totalAmount: 1000, period: 'monthly',
    startDate: new Date(), endDate: new Date(), categories: [mockCategoryAllocation, {...mockCategoryAllocation, category: 'Travel', spent: 100}],
    alertSettings: {} as any, rolloverSettings: {} as any, isActive: true, isTemplate: false,
    totalSpent: 350, totalRemaining: 650, utilizationPercentage: 35, status: 'on_track',
    lastCalculated: new Date(), createdAt: new Date(), updatedAt: new Date()
  };

  const initialState: Partial<AppState> = {
    budgets: { ...initialBudgetState, selectedBudget: null, loading: false, error: null },
  };

  beforeEach(async () => {
    mockBudgetService = {
      // getCategoryStatus is used in generateCategoryAnalysis
      getCategoryStatus: jest.fn().mockImplementation((category: CategoryAllocation) => {
        const percentage = category.allocated > 0 ? (category.spent / category.allocated) * 100 : 0;
        if (percentage > 100) return 'over';
        if (percentage > 80) return 'warning';
        return 'good';
      })
    };

    await TestBed.configureTestingModule({
      imports: [
        BudgetAnalysisComponent, // Standalone
        NoopAnimationsModule,
        RouterTestingModule,
        MatCardModule, MatButtonModule, MatIconModule, MatTabsModule, MatProgressBarModule, MatMenuModule,
        NgChartsModule
      ],
      providers: [
        provideMockStore({ initialState }),
        { provide: BudgetService, useValue: mockBudgetService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetAnalysisComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    jest.spyOn(store, 'dispatch');

    // Replace the actual Chart constructor with the mock
    (component as any).Chart = MockChart;
    MockChart.mockClear(); // Clear any calls from previous tests if any
    if(mockChartInstance) {
        (mockChartInstance.destroy as jest.Mock)?.mockClear();
        (mockChartInstance.update as jest.Mock)?.mockClear();
    }
    // fixture.detectChanges(); // ngOnInit will be triggered here
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should dispatch loadCurrentBudget on ngOnInit', () => {
    fixture.detectChanges();
    expect(store.dispatch).toHaveBeenCalledWith(BudgetActions.loadCurrentBudget());
  });

  describe('when selectedBudget$ emits a budget', () => {
    beforeEach(() => {
      fixture.detectChanges(); // ngOnInit
      store.overrideSelector(selectSelectedBudget, mockBudget);
      store.refreshState();
      fixture.detectChanges(); // Process subscription
    });

    it('should generate analysisData and chart data', () => {
      expect(component.analysisData).not.toBeNull();
      if (component.analysisData) {
        expect(component.analysisData.categoryAnalysis.length).toBe(mockBudget.categories.length);
        expect(component.analysisData.trendAnalysis.totalBudget).toBe(mockBudget.totalAmount);
      }
      expect(component.budgetVsSpentChart).not.toBeNull();
      expect(component.categoryBreakdownChart).not.toBeNull();
      expect(component.progressChart).not.toBeNull();
    });

    it('should attempt to initialize charts in ngAfterViewInit if data is ready', fakeAsync(() => {
        // Reset chartsInitialized for this specific test path
        (component as any).chartsInitialized = false;
        // Ensure analysisData is set from the beforeEach's selectedBudget emission
        expect(component.analysisData).not.toBeNull();

        component.ngAfterViewInit(); // Manually trigger for test consistency
        tick(); // Allow requestAnimationFrame to execute

        // Check if Chart constructor was called (indirectly, via initializeCharts)
        // MockChart is constructor of Chart.js, so it should be called for each chart.
        // We expect 3 charts to be initialized if data is present.
        // The number of calls depends on how many charts are actually created.
        // Based on the template, there are 3 canvas elements.
        expect(MockChart).toHaveBeenCalledTimes(3);
    }));
  });

  it('should destroy charts on ngOnDestroy', () => {
    // First, simulate chart creation
    fixture.detectChanges(); // ngOnInit
    store.overrideSelector(selectSelectedBudget, mockBudget);
    store.refreshState();
    fixture.detectChanges(); // Process subscription to set analysisData
    component.ngAfterViewInit(); // Initialize charts

    const destroySpy = jest.spyOn(component as any, 'destroyCharts');
    component.ngOnDestroy();
    expect(destroySpy).toHaveBeenCalled();
    if (mockChartInstance && mockChartInstance.destroy) {
         expect(mockChartInstance.destroy).toHaveBeenCalled(); // At least one chart's destroy
    }
  });

  // Test one of the data generation functions for basic correctness
  describe('generateCategoryAnalysis', () => {
    it('should correctly transform budget categories to CategoryAnalysis', () => {
      const analysis = (component as any).generateCategoryAnalysis(mockBudget);
      expect(analysis.length).toBe(mockBudget.categories.length);
      expect(analysis[0].categoryName).toBe(mockBudget.categories[0].category);
      expect(analysis[0].budgeted).toBe(mockBudget.categories[0].allocated);
      expect(analysis[0].spent).toBe(mockBudget.categories[0].spent);
      expect(analysis[0].percentage).toBeCloseTo(50); // 250/500
    });
  });

  // Test export functions (basic calls, not Blob content)
  describe('Export functions', () => {
    beforeEach(() => {
        fixture.detectChanges(); // ngOnInit
        store.overrideSelector(selectSelectedBudget, mockBudget);
        store.refreshState();
        fixture.detectChanges();
    });

    it('exportToExcel should be called (integration with XLSX is complex to unit test)', () => {
      const xlsxSpy = jest.spyOn(XLSX.utils, 'book_new'); // Spy on a utility function
      component.exportToExcel();
      expect(xlsxSpy).toHaveBeenCalled();
    });

    it('exportToPDF should be called (integration with jsPDF is complex to unit test)', () => {
      const pdfSpy = jest.spyOn(jsPDF.prototype, 'save'); // Spy on a prototype method
      component.exportToPDF();
      expect(pdfSpy).toHaveBeenCalled();
    });
  });

});
