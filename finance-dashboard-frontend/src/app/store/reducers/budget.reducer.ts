import { Action, createReducer, on } from '@ngrx/store'; // Added Action
import { initialBudgetState, BudgetState } from '../state/budget.state'; // Import initialBudgetState
import { BudgetActions } from '../actions/budget.actions';

export const budgetFeatureKey = 'budgets'; // Added feature key

// export const initialState: BudgetState = { ... }; // Removed, using imported initialBudgetState

export const budgetReducer = createReducer(
  initialBudgetState, // Use imported initialBudgetState

  // Load Budgets
  on(BudgetActions.loadBudgets, (state, { filters, page, limit }) => ({ // Added action props
    ...state,
    loading: true,
    error: null,
    filters: filters || null, // Store filters
    pagination: { // Store page & limit, keep existing totalItems/totalPages or use initial if null
      ...(state.pagination || initialBudgetState.pagination!),
      page,
      limit
    }
  })),

  on(BudgetActions.loadBudgetsSuccess, (state, { budgets, pagination }) => ({ // Added pagination from action
    ...state,
    budgets,
    pagination, // Store full pagination object
    loading: false,
    error: null // Explicitly set error to null on success
  })),

  on(BudgetActions.loadBudgetsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Load Budget
  on(BudgetActions.loadBudget, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(BudgetActions.loadBudgetSuccess, (state, { budget }) => ({
    ...state,
    selectedBudget: budget,
    loading: false,
    error: null
  })),

  on(BudgetActions.loadBudgetFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Create Budget
  on(BudgetActions.createBudget, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(BudgetActions.createBudgetSuccess, (state, { budget }) => ({
    ...state,
    budgets: [...state.budgets, budget],
    loading: false,
    error: null,
    // Optionally update pagination totalItems if not refetching list
    pagination: state.pagination ? { ...state.pagination, totalItems: state.pagination.totalItems + 1 } : null,
  })),

  on(BudgetActions.createBudgetFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Update Budget
  on(BudgetActions.updateBudget, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(BudgetActions.updateBudgetSuccess, (state, { budget }) => ({
    ...state,
    budgets: state.budgets.map(b => b._id === budget._id ? budget : b),
    selectedBudget: state.selectedBudget?._id === budget._id ? budget : state.selectedBudget,
    loading: false,
    error: null
  })),

  on(BudgetActions.updateBudgetFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Delete Budget
  on(BudgetActions.deleteBudget, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(BudgetActions.deleteBudgetSuccess, (state, { budgetId }) => ({ // Changed id to budgetId
    ...state,
    budgets: state.budgets.filter(b => b._id !== budgetId),
    selectedBudget: state.selectedBudget?._id === budgetId ? null : state.selectedBudget,
    loading: false,
    error: null,
    // Optionally update pagination totalItems
    pagination: state.pagination ? { ...state.pagination, totalItems: state.pagination.totalItems - 1 } : null,
  })),

  on(BudgetActions.deleteBudgetFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Select Budget
  on(BudgetActions.selectBudget, (state, { budget }) => ({
    ...state,
    selectedBudget: budget,
  })),
  on(BudgetActions.clearSelectedBudget, (state) => ({
    ...state,
    selectedBudget: null,
  })),

  // Update Budget Filters
  on(BudgetActions.updateBudgetFilters, (state, { filters }) => ({
    ...state,
    filters: filters || null,
    pagination: {
      ...(state.pagination || initialBudgetState.pagination!),
      page: 1
    }
  })),

  // Clear errors
  on(BudgetActions.clearBudgetError, (state) => ({ // Renamed from clearError
    ...state,
    error: null
  }))
);

// Exporting reducer function for AoT compatibility and consistency
export function reducer(state: BudgetState | undefined, action: Action) {
  return budgetReducer(state, action);
}