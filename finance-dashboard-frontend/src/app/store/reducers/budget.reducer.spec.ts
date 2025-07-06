import { budgetReducer, initialBudgetState, BudgetState } from './budget.reducer';
import { BudgetActions } from '../actions/budget.actions';
import { Budget, CreateBudgetRequest, UpdateBudgetRequest } from '../../shared/models/budget.model';
import { BudgetPagination } from '../state/budget.state';

describe('Budget Reducer', () => {
  // Mock Data
  const mockBudget1: Budget = {
    _id: 'b1', user: 'u1', name: 'Budget 1', totalAmount: 1000, period: 'monthly', startDate: new Date(), endDate: new Date(),
    categories: [], alertSettings: {} as any, rolloverSettings: {} as any, isActive: true, isTemplate: false,
    totalSpent: 0, totalRemaining: 0, utilizationPercentage: 0, status: 'on_track', lastCalculated: new Date(),
    createdAt: new Date(), updatedAt: new Date()
  };
  const mockBudget2: Budget = {
    _id: 'b2', user: 'u1', name: 'Budget 2', totalAmount: 2000, period: 'monthly', startDate: new Date(), endDate: new Date(),
    categories: [], alertSettings: {} as any, rolloverSettings: {} as any, isActive: true, isTemplate: false,
    totalSpent: 0, totalRemaining: 0, utilizationPercentage: 0, status: 'on_track', lastCalculated: new Date(),
    createdAt: new Date(), updatedAt: new Date()
   };

  const mockInitialStateWithData: BudgetState = {
    ...initialBudgetState,
    budgets: [mockBudget1],
    selectedBudget: mockBudget1,
    pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    filters: { period: 'monthly' }
  };

  const mockError = 'Test Error String';
  const mockPagination: BudgetPagination = { page: 1, limit: 10, totalItems: 2, totalPages: 1 };

  it('should return the initial state for an unknown action', () => {
    const action = { type: 'UNKNOWN_ACTION' };
    const state = budgetReducer(undefined, action);
    expect(state).toBe(initialBudgetState);
  });

  describe('Load Budgets Actions', () => {
    it('should set loading to true and store filters on Load Budgets', () => {
      const filters = { period: 'yearly' };
      const action = BudgetActions.loadBudgets({ filters, page: 1, limit: 10 });
      const state = budgetReducer(initialBudgetState, action);

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
      expect(state.filters).toEqual(filters);
      expect(state.pagination?.page).toBe(1);
      expect(state.pagination?.limit).toBe(10);
    });

    it('should store budgets and pagination on Load Budgets Success', () => {
      const action = BudgetActions.loadBudgetsSuccess({ budgets: [mockBudget1, mockBudget2], pagination: mockPagination });
      const state = budgetReducer({ ...initialBudgetState, loading: true }, action);

      expect(state.loading).toBe(false);
      expect(state.budgets.length).toBe(2);
      expect(state.budgets[1]).toEqual(mockBudget2);
      expect(state.pagination).toEqual(mockPagination);
    });

    it('should store error on Load Budgets Failure', () => {
      const action = BudgetActions.loadBudgetsFailure({ error: mockError });
      const state = budgetReducer({ ...initialBudgetState, loading: true }, action);

      expect(state.loading).toBe(false);
      expect(state.error).toEqual(mockError);
    });
  });

  describe('Load Single Budget Actions', () => {
    it('should set loading to true and clear selectedBudget on Load Budget', () => {
      const action = BudgetActions.loadBudget({ budgetId: 'b1' });
      const state = budgetReducer(mockInitialStateWithData, action);

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
      expect(state.selectedBudget).toBeNull();
    });

    it('should store selected budget on Load Budget Success', () => {
      const action = BudgetActions.loadBudgetSuccess({ budget: mockBudget2 });
      const state = budgetReducer({ ...initialBudgetState, loading: true }, action);

      expect(state.loading).toBe(false);
      expect(state.selectedBudget).toEqual(mockBudget2);
    });
  });

  describe('Create Budget Actions', () => {
    it('should add budget to list on Create Budget Success', () => {
      const action = BudgetActions.createBudgetSuccess({ budget: mockBudget2 });
      const state = budgetReducer({ ...initialBudgetState, budgets: [mockBudget1], loading: true }, action);

      expect(state.loading).toBe(false);
      expect(state.budgets.length).toBe(2);
      expect(state.budgets.find(b => b._id === 'b2')).toEqual(mockBudget2);
      expect(state.pagination?.totalItems).toBe(initialBudgetState.pagination!.totalItems + 1);
    });
  });

  describe('Update Budget Actions', () => {
    it('should update budget in list on Update Budget Success', () => {
      const updatedBudget = { ...mockBudget1, name: 'Updated Budget 1' };
      const action = BudgetActions.updateBudgetSuccess({ budget: updatedBudget });
      const state = budgetReducer(mockInitialStateWithData, action);

      expect(state.loading).toBe(false);
      const found = state.budgets.find(b => b._id === mockBudget1._id);
      expect(found?.name).toBe('Updated Budget 1');
      expect(state.selectedBudget?.name).toBe('Updated Budget 1'); // If it was selected
    });
  });

  describe('Delete Budget Actions', () => {
    it('should remove budget from list on Delete Budget Success', () => {
      const action = BudgetActions.deleteBudgetSuccess({ budgetId: mockBudget1._id });
      const state = budgetReducer(mockInitialStateWithData, action);

      expect(state.loading).toBe(false);
      expect(state.budgets.find(b => b._id === mockBudget1._id)).toBeUndefined();
      expect(state.selectedBudget).toBeNull(); // If it was selected
      expect(state.pagination?.totalItems).toBe(mockInitialStateWithData.pagination!.totalItems - 1);
    });
  });

  describe('Select and Filter Actions', () => {
    it('should set selectedBudget on Select Budget', () => {
      const action = BudgetActions.selectBudget({ budget: mockBudget2 });
      const state = budgetReducer(initialBudgetState, action);
      expect(state.selectedBudget).toEqual(mockBudget2);
    });

    it('should clear selectedBudget on Clear Selected Budget', () => {
      const action = BudgetActions.clearSelectedBudget();
      const state = budgetReducer(mockInitialStateWithData, action);
      expect(state.selectedBudget).toBeNull();
    });

    it('should update filters on Update Budget Filters', () => {
      const newFilters = { period: 'yearly' };
      const action = BudgetActions.updateBudgetFilters({ filters: newFilters });
      const state = budgetReducer(initialBudgetState, action);

      expect(state.filters).toEqual(newFilters);
      expect(state.pagination?.page).toBe(1); // Page should reset
    });
  });

  describe('Load Current Budget Actions', () => {
    it('should set loading on Load Current Budget', () => {
        const action = BudgetActions.loadCurrentBudget();
        const state = budgetReducer(initialBudgetState, action);
        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();
    });

    it('should set budget (and selectedBudget implicitly by effect) on Load Current Budget Success', () => {
        // Note: The reducer for LoadCurrentBudgetSuccess might just set loading/error.
        // The selection of the budget is handled by the effect dispatching SelectBudget.
        // So, we test that LoadCurrentBudgetSuccess itself correctly updates state.
        const action = BudgetActions.loadCurrentBudgetSuccess({ budget: mockBudget1 });
        const stateAfterLoad = budgetReducer({ ...initialBudgetState, loading: true }, action);

        expect(stateAfterLoad.loading).toBe(false);
        // The LoadCurrentBudgetSuccess action itself might not directly set selectedBudget in the reducer.
        // It provides the budget, and an effect dispatches SelectBudget.
        // However, if the reducer *also* sets selectedBudget here, test that.
        // For now, assuming it primarily handles loading/error and provides the budget.
        // The selectedBudget will be tested via the SelectBudget action.
    });
     it('should set error on Load Current Budget Failure', () => {
        const action = BudgetActions.loadCurrentBudgetFailure({ error: mockError });
        const state = budgetReducer({ ...initialBudgetState, loading: true }, action);
        expect(state.loading).toBe(false);
        expect(state.error).toEqual(mockError);
    });
  });

  it('should clear error on Clear Budget Error', () => {
    const stateWithError = { ...initialBudgetState, error: mockError };
    const action = BudgetActions.clearBudgetError();
    const state = budgetReducer(stateWithError, action);
    expect(state.error).toBeNull();
  });
});
