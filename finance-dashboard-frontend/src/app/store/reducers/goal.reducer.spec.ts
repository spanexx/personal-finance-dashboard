import { goalReducer } from './goal.reducer';
import * as GoalActions from '../actions/goal.actions';
import { GoalState, initialGoalState } from '../state/goal.state';
import { Goal } from '../../core/services/goals.service';

describe('Goal Reducer', () => {
  const mockGoal: Goal = {
    id: 'goal1',
    user: 'user1',
    name: 'Emergency Fund',
    targetAmount: 10000,
    currentAmount: 2500,
    progress: 25,
    startDate: '2024-01-01T00:00:00Z',
    targetDate: '2024-12-31T00:00:00Z',
    description: 'Build emergency fund',
    category: 'savings',
    priority: 'high',
    status: 'active',
    monthlyContributionNeeded: 625,
    projectedCompletionDate: '2024-12-31T00:00:00Z',
    contributions: [
      {
        amount: 2500,
        date: '2024-01-01T00:00:00Z',
        notes: 'Initial contribution'
      }
    ],
    reminderFrequency: 'monthly',
    icon: 'savings',
    color: '#1976d2',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  const mockGoal2: Goal = {
    id: 'goal2',
    user: 'user1',
    name: 'Vacation Fund',
    targetAmount: 5000,
    currentAmount: 1000,
    progress: 20,
    startDate: '2024-01-01T00:00:00Z',
    targetDate: '2024-06-30T00:00:00Z',
    description: 'Save for vacation',
    category: 'travel',
    priority: 'medium',
    status: 'active',
    monthlyContributionNeeded: 800,
    projectedCompletionDate: '2024-06-30T00:00:00Z',
    contributions: [
      {
        amount: 1000,
        date: '2024-01-01T00:00:00Z',
        notes: 'Initial contribution'
      }
    ],
    reminderFrequency: 'monthly',
    icon: 'flight',
    color: '#43a047',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };
  describe('unknown action', () => {
    it('should return the default state', () => {
      const action = { type: 'Unknown' } as any;
      const state = goalReducer(initialGoalState, action);

      expect(state).toBe(initialGoalState);
    });
  });

  describe('loadGoals actions', () => {
    it('should set loading to true on loadGoals', () => {
      const action = GoalActions.loadGoals();
      const state = goalReducer(initialGoalState, action);

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should load goals on loadGoalsSuccess', () => {
      const goals = [mockGoal, mockGoal2];
      const action = GoalActions.loadGoalsSuccess({ goals });
      const state = goalReducer(initialGoalState, action);

      expect(state.goals).toEqual(goals);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set error on loadGoalsFailure', () => {
      const error = 'Failed to load goals';
      const action = GoalActions.loadGoalsFailure({ error });
      const state = goalReducer(initialGoalState, action);

      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
      expect(state.goals).toEqual([]);
    });
  });

  describe('loadGoal actions', () => {
    it('should set loading to true on loadGoal', () => {
      const action = GoalActions.loadGoal({ id: 'goal1' });
      const state = goalReducer(initialGoalState, action);

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should set selected goal on loadGoalSuccess', () => {
      const action = GoalActions.loadGoalSuccess({ goal: mockGoal });
      const state = goalReducer(initialGoalState, action);

      expect(state.selectedGoal).toEqual(mockGoal);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should add goal to goals array if not exists on loadGoalSuccess', () => {
      const existingState: GoalState = {
        ...initialGoalState,
        goals: [mockGoal2]
      };
      const action = GoalActions.loadGoalSuccess({ goal: mockGoal });
      const state = goalReducer(existingState, action);

      expect(state.goals).toEqual([mockGoal2, mockGoal]);
      expect(state.selectedGoal).toEqual(mockGoal);
    });

    it('should update existing goal in goals array on loadGoalSuccess', () => {
      const updatedGoal = { ...mockGoal, name: 'Updated Goal' };
      const existingState: GoalState = {
        ...initialGoalState,
        goals: [mockGoal, mockGoal2]
      };
      const action = GoalActions.loadGoalSuccess({ goal: updatedGoal });
      const state = goalReducer(existingState, action);

      expect(state.goals[0]).toEqual(updatedGoal);
      expect(state.selectedGoal).toEqual(updatedGoal);
    });

    it('should set error on loadGoalFailure', () => {
      const error = 'Goal not found';
      const action = GoalActions.loadGoalFailure({ error });
      const state = goalReducer(initialGoalState, action);

      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
      expect(state.selectedGoal).toBeNull();
    });
  });

  describe('createGoal actions', () => {
    it('should set loading to true on createGoal', () => {
      const goalData: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> = {
        user: 'user1',
        name: 'New Goal',
        targetAmount: 1000,
        currentAmount: 0,
        progress: 0,
        startDate: '2024-01-01T00:00:00Z',
        targetDate: '2024-12-31T00:00:00Z',
        description: 'A new goal',
        category: 'savings',
        priority: 'low',
        status: 'active',
        monthlyContributionNeeded: 83.33,
        projectedCompletionDate: '2024-12-31T00:00:00Z',
        contributions: [],
        reminderFrequency: 'monthly',
        icon: 'savings',
        color: '#1976d2'
      };
      const action = GoalActions.createGoal({ goal: goalData });
      const state = goalReducer(initialGoalState, action);

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should add new goal on createGoalSuccess', () => {
      const existingState: GoalState = {
        ...initialGoalState,
        goals: [mockGoal]
      };
      const action = GoalActions.createGoalSuccess({ goal: mockGoal2 });
      const state = goalReducer(existingState, action);

      expect(state.goals).toEqual([mockGoal, mockGoal2]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set error on createGoalFailure', () => {
      const error = 'Failed to create goal';
      const action = GoalActions.createGoalFailure({ error });
      const state = goalReducer(initialGoalState, action);

      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
    });
  });

  describe('updateGoal actions', () => {
    it('should set loading to true on updateGoal', () => {
      const action = GoalActions.updateGoal({ 
        id: 'goal1', 
        updates: { name: 'Updated Goal' } 
      });
      const state = goalReducer(initialGoalState, action);

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should update goal on updateGoalSuccess', () => {
      const updatedGoal = { ...mockGoal, name: 'Updated Emergency Fund' };
      const existingState: GoalState = {
        ...initialGoalState,
        goals: [mockGoal, mockGoal2]
      };
      const action = GoalActions.updateGoalSuccess({ goal: updatedGoal });
      const state = goalReducer(existingState, action);

      expect(state.goals[0]).toEqual(updatedGoal);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should update selected goal if it matches on updateGoalSuccess', () => {
      const updatedGoal = { ...mockGoal, name: 'Updated Emergency Fund' };
      const existingState: GoalState = {
        ...initialGoalState,
        goals: [mockGoal, mockGoal2],
        selectedGoal: mockGoal
      };
      const action = GoalActions.updateGoalSuccess({ goal: updatedGoal });
      const state = goalReducer(existingState, action);

      expect(state.selectedGoal).toEqual(updatedGoal);
    });

    it('should set error on updateGoalFailure', () => {
      const error = 'Failed to update goal';
      const action = GoalActions.updateGoalFailure({ error });
      const state = goalReducer(initialGoalState, action);

      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
    });
  });

  describe('deleteGoal actions', () => {
    it('should set loading to true on deleteGoal', () => {
      const action = GoalActions.deleteGoal({ id: 'goal1' });
      const state = goalReducer(initialGoalState, action);

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should remove goal on deleteGoalSuccess', () => {
      const existingState: GoalState = {
        ...initialGoalState,
        goals: [mockGoal, mockGoal2]
      };
      const action = GoalActions.deleteGoalSuccess({ id: 'goal1' });
      const state = goalReducer(existingState, action);

      expect(state.goals).toEqual([mockGoal2]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should clear selected goal if it was deleted on deleteGoalSuccess', () => {
      const existingState: GoalState = {
        ...initialGoalState,
        goals: [mockGoal, mockGoal2],
        selectedGoal: mockGoal
      };
      const action = GoalActions.deleteGoalSuccess({ id: 'goal1' });
      const state = goalReducer(existingState, action);

      expect(state.selectedGoal).toBeNull();
    });

    it('should keep selected goal if different goal was deleted on deleteGoalSuccess', () => {
      const existingState: GoalState = {
        ...initialGoalState,
        goals: [mockGoal, mockGoal2],
        selectedGoal: mockGoal2
      };
      const action = GoalActions.deleteGoalSuccess({ id: 'goal1' });
      const state = goalReducer(existingState, action);

      expect(state.selectedGoal).toEqual(mockGoal2);
    });

    it('should set error on deleteGoalFailure', () => {
      const error = 'Failed to delete goal';
      const action = GoalActions.deleteGoalFailure({ error });
      const state = goalReducer(initialGoalState, action);

      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
    });
  });

  describe('clearSelectedGoal action', () => {
    it('should clear selected goal', () => {
      const existingState: GoalState = {
        ...initialGoalState,
        goals: [mockGoal, mockGoal2],
        selectedGoal: mockGoal
      };
      const action = GoalActions.clearSelectedGoal();
      const state = goalReducer(existingState, action);

      expect(state.selectedGoal).toBeNull();
      expect(state.goals).toEqual([mockGoal, mockGoal2]);
    });
  });
});
