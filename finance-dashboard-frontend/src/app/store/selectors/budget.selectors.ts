import { createFeatureSelector, createSelector } from '@ngrx/store';
import { BudgetState, BudgetPagination } from '../state/budget.state';
import { budgetFeatureKey } from '../reducers/budget.reducer';

// Feature selector for the budget state
export const selectBudgetState = createFeatureSelector<BudgetState>(budgetFeatureKey);

export const selectAllBudgets = createSelector(
  selectBudgetState,
  (state: BudgetState) => state.budgets
);

export const selectSelectedBudget = createSelector(
  selectBudgetState,
  (state: BudgetState) => state.selectedBudget
);

export const selectBudgetLoading = createSelector(
  selectBudgetState,
  (state: BudgetState) => state.loading
);

export const selectBudgetError = createSelector(
  selectBudgetState,
  (state: BudgetState) => state.error
);

export const selectBudgetPagination = createSelector(
  selectBudgetState,
  (state: BudgetState): BudgetPagination | null => state.pagination
);

export const selectBudgetFilters = createSelector(
  selectBudgetState,
  (state: BudgetState) => state.filters
);

// Example of a composed selector: Get current page number
export const selectCurrentBudgetPage = createSelector(
  selectBudgetPagination,
  (pagination: BudgetPagination | null) => pagination?.page || 1
);

// Example: Get total number of budgets
export const selectTotalBudgetsCount = createSelector(
  selectBudgetPagination,
  (pagination: BudgetPagination | null) => pagination?.totalItems || 0
);
