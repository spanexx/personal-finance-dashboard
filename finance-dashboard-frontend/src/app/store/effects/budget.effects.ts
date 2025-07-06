import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError, switchMap, exhaustMap } from 'rxjs/operators';

import { BudgetService } from '../../core/services/budget.service'; // Corrected path assumption
import { BudgetActions } from '../actions/budget.actions';
import { Budget } from '../../shared/models/budget.model';
import { BudgetPagination } from '../state/budget.state';
import { PaginatedResponse } from '../../core/services/api.service'; // Import PaginatedResponse

// Remove BudgetsApiResponse as PaginatedResponse<Budget> will be used
// interface BudgetsApiResponse {
//   data: Budget[];
//   page: number;
//   limit: number;
//   totalItems: number;
//   totalPages: number;
// }

@Injectable()
export class BudgetEffects {
  loadBudgets$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BudgetActions.loadBudgets),
      switchMap(({ filters, page, limit }) => {
        const queryParams: any = { page, limit };
        if (filters) {
          Object.assign(queryParams, filters);
        }
        // Use PaginatedResponse<Budget> as the expected return type from the service
        return this.budgetService.getBudgets(filters || undefined, { page, limit }).pipe(
          map((response: PaginatedResponse<Budget>) =>
            BudgetActions.loadBudgetsSuccess({
              budgets: response.data,
              pagination: { // Ensure this mapping matches BudgetPagination
                page: response.pagination.page,
                limit: response.pagination.limit,
                totalItems: response.pagination.total,
                totalPages: response.pagination.totalPages,
              },
            })
          ),
          catchError((error) =>
            of(BudgetActions.loadBudgetsFailure({ error: error.error?.message || error.message || 'Failed to load budgets' }))
          )
        );
      })
    )
  );

  loadBudget$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BudgetActions.loadBudget),
      switchMap(action => // action.budgetId
        this.budgetService.getBudget(action.budgetId).pipe( // Use budgetId
          map(budget => {
            if (budget) {
              return BudgetActions.loadBudgetSuccess({ budget });
            } else {
              return BudgetActions.loadBudgetFailure({ error: 'Budget not found' });
            }
          }),
          catchError((error) =>
            of(BudgetActions.loadBudgetFailure({ error: error.error?.message || error.message || 'Failed to load budget' }))
          )
        )
      )
    )
  );

  loadCurrentBudget$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BudgetActions.loadCurrentBudget),
      switchMap(() =>
        // Placeholder: Call getBudgets to fetch the first active budget as "current"
        // This assumes a "current" budget might be the latest or first active one.
        // Ideally, backend provides a dedicated endpoint or logic.
        this.budgetService.getBudgets({ status: 'active' } as any, { page: 1, limit: 1 }).pipe(
          mergeMap((response: PaginatedResponse<Budget>) => {
            const currentBudget = response.data && response.data.length > 0 ? response.data[0] : null;
            if (currentBudget) {
              return [
                BudgetActions.loadCurrentBudgetSuccess({ budget: currentBudget }),
                BudgetActions.selectBudget({ budget: currentBudget })
              ];
            } else {
              return of(BudgetActions.loadCurrentBudgetFailure({ error: 'No active budget found to set as current' }));
            }
          }),
          catchError(error =>
            of(BudgetActions.loadCurrentBudgetFailure({ error: error.error?.message || error.message || 'Failed to load current budget' }))
          )
        )
      )
    )
  );

  createBudget$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BudgetActions.createBudget),
      exhaustMap(action => // action.budgetData
        this.budgetService.createBudget(action.budgetData).pipe( // Use budgetData
          map(budget => BudgetActions.createBudgetSuccess({ budget })),
          // Optionally dispatch loadBudgets to refresh list or handle optimistically in reducer
          catchError((error) =>
            of(BudgetActions.createBudgetFailure({ error: error.error?.message || error.message || 'Failed to create budget' }))
          )
        )
      )
    )
  );

  updateBudget$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BudgetActions.updateBudget),
      exhaustMap(action => // action.budgetId, action.budgetData
        this.budgetService.updateBudget(action.budgetId, action.budgetData).pipe( // Use budgetId and budgetData
          map(budget => {
            if (budget) {
              return BudgetActions.updateBudgetSuccess({ budget });
            } else {
              // This case might not be reachable if update always returns updated or error
              return BudgetActions.updateBudgetFailure({ error: 'Budget not found after update' });
            }
          }),
          catchError((error) =>
            of(BudgetActions.updateBudgetFailure({ error: error.error?.message || error.message || 'Failed to update budget' }))
          )
        )
      )
    )
  );

  deleteBudget$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BudgetActions.deleteBudget),
      mergeMap(action => // action.budgetId
        this.budgetService.deleteBudget(action.budgetId).pipe( // Use budgetId
          map(() => BudgetActions.deleteBudgetSuccess({ budgetId: action.budgetId })), // Return budgetId
          catchError((error) =>
            of(BudgetActions.deleteBudgetFailure({ error: error.error?.message || error.message || 'Failed to delete budget' }))
          )
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private budgetService: BudgetService
  ) {}
}
