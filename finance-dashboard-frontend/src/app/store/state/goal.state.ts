import { Goal } from '../../shared/models';

export interface GoalState {
  goals: Goal[];
  selectedGoal: Goal | null;
  loading: boolean;
  error: string | null;
}

export const initialGoalState: GoalState = {
  goals: [],
  selectedGoal: null,
  loading: false,
  error: null
};
