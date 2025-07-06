import * as fromSelectors from './budget.selectors';
import { BudgetState, initialBudgetState, BudgetPagination } from '../state/budget.state';
import { Budget } from '../../shared/models/budget.model';
import { AppState } from '../state/app.state';
import { budgetFeatureKey } from '../reducers/budget.reducer';

describe('Budget Selectors', () => {
  const mockBudget1: Budget = {
    _id: 'b1', user: 'u1', name: 'Budget 1', totalAmount: 1000, period: 'monthly', startDate: new Date(), endDate: new Date(),
    categories: [], alertSettings: {} as any, rolloverSettings: {} as any, isActive: true, isTemplate: false,
    totalSpent: 0, totalRemaining: 0, utilizationPercentage: 0, status: 'on_track', lastCalculated: new Date(),
    createdAt: new Date(), updatedAt: new Date()
  };
  const mockBudget2: Budget = {
    _id: 'b2', user: 'u1', name: 'Budget 2', totalAmount: 2000, period: 'yearly', startDate: new Date(), endDate: new Date(),
    categories: [], alertSettings: {} as any, rolloverSettings: {} as any, isActive: true, isTemplate: false,
    totalSpent: 0, totalRemaining: 0, utilizationPercentage: 0, status: 'on_track', lastCalculated: new Date(),
    createdAt: new Date(), updatedAt: new Date()
   };

  const mockPagination: BudgetPagination = { page: 1, limit: 10, totalItems: 2, totalPages: 1 };
  const mockFilters = { period: 'monthly' };
  const mockError = 'Test Error String';

  const mockBudgetFeatureState: BudgetState = {
    budgets: [mockBudget1, mockBudget2],
    selectedBudget: mockBudget1,
    loading: false,
    error: mockError,
    pagination: mockPagination,
    filters: mockFilters,
  };

  const mockAppState: AppState = {
    [budgetFeatureKey]: mockBudgetFeatureState,
    // other feature states if AppState defines them
  } as AppState; // Cast as AppState if it has other required properties

  it('should select the budget feature state', () => {
    const result = fromSelectors.selectBudgetState(mockAppState);
    expect(result).toEqual(mockBudgetFeatureState);
  });

  it('should select all budgets', () => {
    const result = fromSelectors.selectAllBudgets(mockAppState);
    expect(result).toEqual([mockBudget1, mockBudget2]);
  });

  it('should select the selected budget', () => {
    const result = fromSelectors.selectSelectedBudget(mockAppState);
    expect(result).toEqual(mockBudget1);
  });

  it('should select budget loading state', () => {
    const result = fromSelectors.selectBudgetLoading(mockAppState);
    expect(result).toBe(false);
  });

  it('should select budget error state', () => {
    const result = fromSelectors.selectBudgetError(mockAppState);
    expect(result).toEqual(mockError);
  });

  it('should select budget pagination state', () => {
    const result = fromSelectors.selectBudgetPagination(mockAppState);
    expect(result).toEqual(mockPagination);
  });

  it('should select budget filters state', () => {
    const result = fromSelectors.selectBudgetFilters(mockAppState);
    expect(result).toEqual(mockFilters);
  });

  it('should select current budget page from pagination', () => {
    const result = fromSelectors.selectCurrentBudgetPage(mockAppState);
    expect(result).toBe(1);
  });

  it('should return 1 for current page if pagination is null', () => {
    const stateWithNullPagination: AppState = {
      ...mockAppState,
      [budgetFeatureKey]: { ...mockBudgetFeatureState, pagination: null }
    };
    const result = fromSelectors.selectCurrentBudgetPage(stateWithNullPagination);
    expect(result).toBe(1);
  });

  it('should select total budgets count from pagination', () => {
    const result = fromSelectors.selectTotalBudgetsCount(mockAppState);
    expect(result).toBe(2); // totalItems from mockPagination
  });

  it('should return 0 for total budgets if pagination is null', () => {
     const stateWithNullPagination: AppState = {
      ...mockAppState,
      [budgetFeatureKey]: { ...mockBudgetFeatureState, pagination: null }
    };
    const result = fromSelectors.selectTotalBudgetsCount(stateWithNullPagination);
    expect(result).toBe(0);
  });
});
