import { createReducer, on } from '@ngrx/store';
import { GoalState, initialGoalState } from '../state/goal.state';
import * as GoalActions from '../actions/goal.actions';

export const goalReducer = createReducer(
  initialGoalState,

  // Load Goals
  on(GoalActions.loadGoals, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(GoalActions.loadGoalsSuccess, (state, { goals }) => ({
    ...state,
    goals,
    loading: false,
    error: null
  })),

  on(GoalActions.loadGoalsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Load Single Goal
  on(GoalActions.loadGoal, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(GoalActions.loadGoalSuccess, (state, { goal }) => {
    const existingGoalIndex = state.goals.findIndex(g => g._id === goal._id);
    let updatedGoals = [...state.goals];

    if (existingGoalIndex > -1) {
      // Update existing goal
      updatedGoals[existingGoalIndex] = goal;
    } else {
      // Add new goal
      updatedGoals = [...updatedGoals, goal];
    }

    return {
      ...state,
      goals: updatedGoals,
      selectedGoal: goal,
      loading: false,
      error: null
    };
  }),

  on(GoalActions.loadGoalFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Create Goal
  on(GoalActions.createGoal, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(GoalActions.createGoalSuccess, (state, { goal }) => ({
    ...state,
    goals: [...state.goals, goal],
    loading: false,
    error: null
  })),

  on(GoalActions.createGoalFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Update Goal
  on(GoalActions.updateGoal, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(GoalActions.updateGoalSuccess, (state, { goal }) => ({
    ...state,
    goals: state.goals.map(g => g._id === goal._id ? goal : g),
    selectedGoal: state.selectedGoal?._id === goal._id ? goal : state.selectedGoal,
    loading: false,
    error: null
  })),

  on(GoalActions.updateGoalFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Delete Goal
  on(GoalActions.deleteGoal, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(GoalActions.deleteGoalSuccess, (state, { id: _id }) => ({
    ...state,
    goals: state.goals.filter(g => g._id !== _id),
    selectedGoal: state.selectedGoal?._id === _id ? null : state.selectedGoal,
    loading: false,
    error: null
  })),

  on(GoalActions.deleteGoalFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Add Contribution
  on(GoalActions.addContribution, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(GoalActions.addContributionSuccess, (state, { goal }) => ({
    ...state,
    goals: state.goals.map(g => g._id === goal._id ? goal : g),
    selectedGoal: state.selectedGoal?._id === goal._id ? goal : state.selectedGoal,
    loading: false,
    error: null
  })),

  on(GoalActions.addContributionFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),

  // Clear Actions
  on(GoalActions.clearSelectedGoal, (state) => ({
    ...state,
    selectedGoal: null
  })),

  on(GoalActions.clearError, (state) => ({
    ...state,
    error: null
  }))
);
