import { createFeatureSelector, createSelector } from '@ngrx/store';
import { GoalState } from '../state/goal.state';

export const selectGoalState = createFeatureSelector<GoalState>('goals');

export const selectAllGoals = createSelector(
  selectGoalState,
  (state: GoalState) => state.goals
);

export const selectSelectedGoal = createSelector(
  selectGoalState,
  (state: GoalState) => state.selectedGoal
);

export const selectGoalLoading = createSelector(
  selectGoalState,
  (state: GoalState) => state.loading
);

export const selectGoalError = createSelector(
  selectGoalState,
  (state: GoalState) => state.error
);

export const selectGoalById = (id: string) => createSelector(
  selectAllGoals,
  (goals) => goals.find(goal => goal._id === id)
);

export const selectActiveGoals = createSelector(
  selectAllGoals,
  (goals) => goals.filter(goal => goal.status === 'active')
);

export const selectCompletedGoals = createSelector(
  selectAllGoals,
  (goals) => goals.filter(goal => goal.status === 'completed')
);

export const selectGoalsByCategory = createSelector(
  selectAllGoals,
  (goals) => {
    const categories: { [key: string]: typeof goals } = {};
    goals.forEach(goal => {
      if (!categories[goal.category]) {
        categories[goal.category] = [];
      }
      categories[goal.category].push(goal);
    });
    return categories;
  }
);

export const selectGoalsProgress = createSelector(
  selectAllGoals,
  (goals) => {
    const totalGoals = goals.length;
    const completedGoals = goals.filter(goal => goal.status === 'completed').length;
    const totalTargetAmount = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
    const totalCurrentAmount = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
    
    return {
      totalGoals,
      completedGoals,
      completedPercentage: totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0,
      totalTargetAmount,
      totalCurrentAmount,
      overallProgress: totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0
    };
  }
);
