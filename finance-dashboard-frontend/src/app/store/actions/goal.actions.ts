import { createAction, props } from '@ngrx/store';
import { Goal, CreateGoalRequest } from '../../shared/models';

// Load Goals Actions
export const loadGoals = createAction('[Goal] Load Goals');
export const loadGoalsSuccess = createAction(
  '[Goal] Load Goals Success',
  props<{ goals: Goal[] }>()
);
export const loadGoalsFailure = createAction(
  '[Goal] Load Goals Failure',
  props<{ error: string }>()
);

// Load Single Goal Actions
export const loadGoal = createAction(
  '[Goal] Load Goal',
  props<{ id: string }>()
);
export const loadGoalSuccess = createAction(
  '[Goal] Load Goal Success',
  props<{ goal: Goal }>()
);
export const loadGoalFailure = createAction(
  '[Goal] Load Goal Failure',
  props<{ error: string }>()
);

// Create Goal Actions
export const createGoal = createAction(
  '[Goal] Create Goal',
  props<{ goal: CreateGoalRequest }>()
);
export const createGoalSuccess = createAction(
  '[Goal] Create Goal Success',
  props<{ goal: Goal }>()
);
export const createGoalFailure = createAction(
  '[Goal] Create Goal Failure',
  props<{ error: string }>()
);

// Update Goal Actions
export const updateGoal = createAction(
  '[Goal] Update Goal',
  props<{ id: string; updates: Partial<Goal> }>()
);
export const updateGoalSuccess = createAction(
  '[Goal] Update Goal Success',
  props<{ goal: Goal }>()
);
export const updateGoalFailure = createAction(
  '[Goal] Update Goal Failure',
  props<{ error: string }>()
);

// Delete Goal Actions
export const deleteGoal = createAction(
  '[Goal] Delete Goal',
  props<{ id: string }>()
);
export const deleteGoalSuccess = createAction(
  '[Goal] Delete Goal Success',
  props<{ id: string }>()
);
export const deleteGoalFailure = createAction(
  '[Goal] Delete Goal Failure',
  props<{ error: string }>()
);

// Add Contribution Actions
export const addContribution = createAction(
  '[Goal] Add Contribution',
  props<{ goalId: string; amount: number; notes: string }>()
);
export const addContributionSuccess = createAction(
  '[Goal] Add Contribution Success',
  props<{ goal: Goal }>()
);
export const addContributionFailure = createAction(
  '[Goal] Add Contribution Failure',
  props<{ error: string }>()
);

// Clear Actions
export const clearSelectedGoal = createAction('[Goal] Clear Selected Goal');
export const clearError = createAction('[Goal] Clear Error');
