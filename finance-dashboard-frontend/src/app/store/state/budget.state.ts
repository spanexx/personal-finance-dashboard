import { Budget } from '../../shared/models/budget.model';

export interface BudgetPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface BudgetState {
  budgets: Budget[];
  selectedBudget: Budget | null;
  loading: boolean;
  error: string | null; // As per subtask, using string for error
  pagination: BudgetPagination | null;
  filters: any | null; // Placeholder for budget filters
}

export const initialBudgetState: BudgetState = {
  budgets: [],
  selectedBudget: null,
  loading: false,
  error: null,
  pagination: { // Defaulting pagination as it's common for lists
    page: 1,
    limit: 10, // Default limit
    totalItems: 0,
    totalPages: 0,
  },
  filters: null,
};
