import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, mergeMap, catchError, switchMap } from 'rxjs/operators';
import { GoalsService } from '../../core/services/goals.service';
import * as GoalActions from '../actions/goal.actions';

@Injectable()
export class GoalEffects {
  
  constructor(
    private actions$: Actions,
    private goalsService: GoalsService
  ) {}
  loadGoals$ = createEffect(() =>
    this.actions$.pipe(
      ofType(GoalActions.loadGoals),
      switchMap(() =>
        this.goalsService.getGoals().pipe(
          map(response => GoalActions.loadGoalsSuccess({ goals: response.data })),
          catchError(error => of(GoalActions.loadGoalsFailure({ 
            error: error.message || 'Failed to load goals' 
          })))
        )
      )
    )
  );
  loadGoal$ = createEffect(() =>
    this.actions$.pipe(
      ofType(GoalActions.loadGoal),
      switchMap(({ id }) =>
        this.goalsService.getGoal(id).pipe(
          map(response => {
            console.log('Goal loaded:', response);
            if (response && response.goal) {
              // Merge all response fields into the goal object for easy access in the store/component
              const mergedGoal = { ...response.goal, ...response };
              return GoalActions.loadGoalSuccess({ goal: mergedGoal });
            } else {
              return GoalActions.loadGoalFailure({ error: 'Goal not found' });
            }
          }),
          catchError(error => of(GoalActions.loadGoalFailure({ 
            error: error.message || 'Failed to load goal' 
          })))
        )
      )
    )
  );

  createGoal$ = createEffect(() =>
    this.actions$.pipe(
      ofType(GoalActions.createGoal),
      mergeMap(({ goal }) =>
        this.goalsService.createGoal(goal).pipe(
          map(createdGoal => GoalActions.createGoalSuccess({ goal: createdGoal })),
          catchError(error => of(GoalActions.createGoalFailure({ 
            error: error.message || 'Failed to create goal' 
          })))
        )
      )
    )
  );
  updateGoal$ = createEffect(() =>
    this.actions$.pipe(
      ofType(GoalActions.updateGoal),
      mergeMap(({ id, updates }) =>
        this.goalsService.updateGoal(id, updates).pipe(
          map(goal => {
            if (goal) {
              return GoalActions.updateGoalSuccess({ goal });
            } else {
              return GoalActions.updateGoalFailure({ error: 'Goal not found or update failed' });
            }
          }),
          catchError(error => of(GoalActions.updateGoalFailure({ 
            error: error.message || 'Failed to update goal' 
          })))
        )
      )
    )
  );

  deleteGoal$ = createEffect(() =>
    this.actions$.pipe(
      ofType(GoalActions.deleteGoal),
      mergeMap(({ id }) =>
        this.goalsService.deleteGoal(id).pipe(
          map(() => GoalActions.deleteGoalSuccess({ id })),
          catchError(error => of(GoalActions.deleteGoalFailure({ 
            error: error.message || 'Failed to delete goal' 
          })))
        )
      )
    )
  );  addContribution$ = createEffect(() =>
    this.actions$.pipe(
      ofType(GoalActions.addContribution),
      mergeMap(({ goalId, amount, notes }) =>
        this.goalsService.addContribution(goalId, { amount, notes }).pipe(
          map(goal => {
            if (goal) {
              return GoalActions.addContributionSuccess({ goal });
            } else {
              return GoalActions.addContributionFailure({ error: 'Goal not found or contribution failed' });
            }
          }),
          catchError(error => of(GoalActions.addContributionFailure({ 
            error: error.message || 'Failed to add contribution' 
          })))
        )
      )
    )
  );
}
