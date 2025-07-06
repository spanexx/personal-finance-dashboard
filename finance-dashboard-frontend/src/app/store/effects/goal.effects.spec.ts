import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { Observable, of, throwError } from 'rxjs';
import { GoalEffects } from './goal.effects';
import { GoalsService } from '../../core/services/goals.service';
import * as GoalActions from '../actions/goal.actions';

describe('GoalEffects', () => {
  let actions$: Observable<Action>;
  let effects: GoalEffects;
  let goalsService: jasmine.SpyObj<GoalsService>;
  const mockGoal = {
    id: 'goal1',
    user: 'user1',
    name: 'Emergency Fund',
    targetAmount: 10000,
    currentAmount: 2500,
    progress: 25,
    startDate: '2024-01-01T00:00:00.000Z',
    targetDate: '2024-12-31T23:59:59.999Z',
    description: 'Build emergency fund',
    category: 'savings',
    priority: 'high' as const,
    status: 'active' as const,
    monthlyContributionNeeded: 416.67,
    projectedCompletionDate: '2024-12-31T00:00:00.000Z',
    contributions: [],
    reminderFrequency: 'monthly' as const,
    icon: 'savings',
    color: '#1976d2',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  };

  beforeEach(() => {
    const goalsServiceSpy = jasmine.createSpyObj('GoalsService', [
      'getGoals',
      'getGoal',
      'createGoal',
      'updateGoal',
      'deleteGoal'
    ]);

    TestBed.configureTestingModule({
      providers: [
        GoalEffects,
        provideMockActions(() => actions$),
        { provide: GoalsService, useValue: goalsServiceSpy }
      ]
    });

    effects = TestBed.inject(GoalEffects);
    goalsService = TestBed.inject(GoalsService) as jasmine.SpyObj<GoalsService>;
  });
  describe('loadGoals$', () => {
    it('should return loadGoalsSuccess action on successful goals load', (done) => {
      const goals = [mockGoal];
      const action = GoalActions.loadGoals();
      const outcome = GoalActions.loadGoalsSuccess({ goals });

      actions$ = of(action);
      goalsService.getGoals.and.returnValue(of(goals));

      effects.loadGoals$.subscribe((result) => {
        expect(result).toEqual(outcome);
        expect(goalsService.getGoals).toHaveBeenCalled();
        done();
      });
    });

    it('should return loadGoalsFailure action on error', (done) => {
      const error = 'Failed to load goals';
      const action = GoalActions.loadGoals();
      const outcome = GoalActions.loadGoalsFailure({ error });

      actions$ = of(action);
      goalsService.getGoals.and.returnValue(throwError(() => new Error(error)));

      effects.loadGoals$.subscribe((result) => {
        expect(result).toEqual(outcome);
        done();
      });
    });
  });

  describe('loadGoal$', () => {
    it('should return loadGoalSuccess action on successful goal load', (done) => {
      const action = GoalActions.loadGoal({ id: 'goal1' });
      const outcome = GoalActions.loadGoalSuccess({ goal: mockGoal });

      actions$ = of(action);
      goalsService.getGoal.and.returnValue(of(mockGoal));

      effects.loadGoal$.subscribe((result) => {
        expect(result).toEqual(outcome);
        expect(goalsService.getGoal).toHaveBeenCalledWith('goal1');
        done();
      });
    });

    it('should return loadGoalFailure action on error', (done) => {
      const error = 'Goal not found';
      const action = GoalActions.loadGoal({ id: 'nonexistent' });
      const outcome = GoalActions.loadGoalFailure({ error });

      actions$ = of(action);
      goalsService.getGoal.and.returnValue(throwError(() => new Error(error)));

      effects.loadGoal$.subscribe((result) => {
        expect(result).toEqual(outcome);
        done();
      });
    });
  });
  describe('createGoal$', () => {
    it('should return createGoalSuccess action on successful goal creation', (done) => {
      const goalData = {
        name: 'New Goal',
        targetAmount: 5000,
        targetDate: '2024-12-31',
        category: 'savings',
        priority: 'medium' as const,
        currentAmount: 0,
        description: 'Test goal',
        user: 'user1',
        progress: 0,
        startDate: '2024-01-01T00:00:00.000Z',
        monthlyContributionNeeded: 416.67,
        projectedCompletionDate: '2024-12-31T00:00:00.000Z',
        contributions: [],
        reminderFrequency: 'monthly' as const,
        icon: 'savings',
        color: '#1976d2',
        status: 'active' as const
      };
      const action = GoalActions.createGoal({ goal: goalData });
      const outcome = GoalActions.createGoalSuccess({ goal: mockGoal });

      actions$ = of(action);
      goalsService.createGoal.and.returnValue(of(mockGoal));

      effects.createGoal$.subscribe((result) => {
        expect(result).toEqual(outcome);
        expect(goalsService.createGoal).toHaveBeenCalled();
        done();
      });
    });

    it('should return createGoalFailure action on error', (done) => {
      const goalData = {
        name: 'New Goal',
        targetAmount: 5000,
        targetDate: '2024-12-31',
        category: 'savings',
        priority: 'medium' as const,
        currentAmount: 0,
        description: 'Test goal',
        user: 'user1',
        progress: 0,
        startDate: '2024-01-01T00:00:00.000Z',
        monthlyContributionNeeded: 416.67,
        projectedCompletionDate: '2024-12-31T00:00:00.000Z',
        contributions: [],
        reminderFrequency: 'monthly' as const,
        icon: 'savings',
        color: '#1976d2',
        status: 'active' as const
      };
      const error = 'Invalid goal data';
      const action = GoalActions.createGoal({ goal: goalData });
      const outcome = GoalActions.createGoalFailure({ error });

      actions$ = of(action);
      goalsService.createGoal.and.returnValue(throwError(() => new Error(error)));

      effects.createGoal$.subscribe((result) => {
        expect(result).toEqual(outcome);
        done();
      });
    });
  });
  describe('updateGoal$', () => {
    it('should return updateGoalSuccess action on successful goal update', (done) => {
      const updates = { name: 'Updated Goal Name' };
      const updatedGoal = { ...mockGoal, ...updates };
      const action = GoalActions.updateGoal({ id: 'goal1', updates });
      const outcome = GoalActions.updateGoalSuccess({ goal: updatedGoal });

      actions$ = of(action);
      goalsService.updateGoal.and.returnValue(of(updatedGoal));

      effects.updateGoal$.subscribe((result) => {
        expect(result).toEqual(outcome);
        expect(goalsService.updateGoal).toHaveBeenCalledWith('goal1', updates);
        done();
      });
    });

    it('should return updateGoalFailure action on error', (done) => {
      const updates = { name: '' };
      const error = 'Invalid update data';
      const action = GoalActions.updateGoal({ id: 'goal1', updates });
      const outcome = GoalActions.updateGoalFailure({ error });

      actions$ = of(action);
      goalsService.updateGoal.and.returnValue(throwError(() => new Error(error)));

      effects.updateGoal$.subscribe((result) => {
        expect(result).toEqual(outcome);
        done();
      });
    });
  });
  describe('deleteGoal$', () => {
    it('should return deleteGoalSuccess action on successful goal deletion', (done) => {
      const action = GoalActions.deleteGoal({ id: 'goal1' });
      const outcome = GoalActions.deleteGoalSuccess({ id: 'goal1' });

      actions$ = of(action);
      goalsService.deleteGoal.and.returnValue(of(true));

      effects.deleteGoal$.subscribe((result) => {
        expect(result).toEqual(outcome);
        expect(goalsService.deleteGoal).toHaveBeenCalledWith('goal1');
        done();
      });
    });

    it('should return deleteGoalFailure action on error', (done) => {
      const error = 'Failed to delete goal';
      const action = GoalActions.deleteGoal({ id: 'goal1' });
      const outcome = GoalActions.deleteGoalFailure({ error });

      actions$ = of(action);
      goalsService.deleteGoal.and.returnValue(throwError(() => new Error(error)));

      effects.deleteGoal$.subscribe((result) => {
        expect(result).toEqual(outcome);
        done();
      });
    });
  });
});
