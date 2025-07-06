import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Budget, CreateBudgetRequest, UpdateBudgetRequest } from '../../shared/models/budget.model';
import { BudgetPagination } from '../state/budget.state'; // Corrected import position

export const BudgetActions = createActionGroup({ // Keep only one declaration
  source: 'Budget',
  events: {
    // Load Budgets
    'Load Budgets': props<{ filters: any | null; page: number; limit: number }>(),
    'Load Budgets Success': props<{ budgets: Budget[]; pagination: BudgetPagination | null }>(),
    'Load Budgets Failure': props<{ error: string }>(),

    // Load Budget
    'Load Budget': props<{ budgetId: string }>(), // Standardized to budgetId
    'Load Budget Success': props<{ budget: Budget }>(),
    'Load Budget Failure': props<{ error: string }>(),

    // Create Budget
    'Create Budget': props<{ budgetData: CreateBudgetRequest }>(), // Standardized to budgetData
    'Create Budget Success': props<{ budget: Budget }>(),
    'Create Budget Failure': props<{ error: string }>(),

    // Update Budget
    'Update Budget': props<{ budgetId: string; budgetData: UpdateBudgetRequest }>(), // Standardized
    'Update Budget Success': props<{ budget: Budget }>(),
    'Update Budget Failure': props<{ error: string }>(),

    // Delete Budget
    'Delete Budget': props<{ budgetId: string }>(), // Standardized to budgetId
    'Delete Budget Success': props<{ budgetId: string }>(),
    'Delete Budget Failure': props<{ error: string }>(),

    // Select Budget
    'Select Budget': props<{ budget: Budget | null }>(),
    'Clear Selected Budget': emptyProps(),

    // Update Filters
    'Update Budget Filters': props<{ filters: any | null }>(),

    // Clear errors
    'Clear Budget Error': emptyProps(), // Renamed for clarity

    // Load Current Budget (for overview page, etc.)
    'Load Current Budget': emptyProps(),
    'Load Current Budget Success': props<{ budget: Budget }>(),
    'Load Current Budget Failure': props<{ error: string }>(),
  }
});