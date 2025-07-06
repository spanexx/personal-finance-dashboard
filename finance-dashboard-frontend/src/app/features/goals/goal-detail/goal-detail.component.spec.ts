import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of, Subject } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { GoalDetailComponent } from './goal-detail.component';
import { AppState } from '../../../store/state/app.state';
import * as GoalActions from '../../../store/actions/goal.actions';
import { selectSelectedGoal, selectGoalLoading, selectGoalError } from '../../../store/selectors/goal.selectors';
import { initialGoalState } from '../../../store/reducers/goal.reducer';
import { Goal } from '../../../shared/models';
import { ChartComponent } from '../../../shared/components/chart/chart.component'; // For shallow test or NO_ERRORS_SCHEMA

// Import Material Modules used by the component's template
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common'; // For pipes like |currency and |date

describe('GoalDetailComponent', () => {
  let component: GoalDetailComponent;
  let fixture: ComponentFixture<GoalDetailComponent>;
  let store: MockStore<AppState>;
  let mockRouter: Partial<Router>;
  let mockMatDialog: Partial<MatDialog>;
  let activatedRoute: ActivatedRoute;

  const mockGoal: Goal = {
    _id: 'g123', name: 'Hawaii Trip', targetAmount: 3000, currentAmount: 1500,
    targetDate: new Date(2025, 5, 15).toISOString(), user: 'u1', category: 'Travel', priority: 'High',
    contributions: [{ amount: 50, date: new Date().toISOString(), note: 'Saved' }],
    isAchieved: false, progressPercentage: 50, icon: 'flight', color: '#2196F3',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), description: 'Saving for Hawaii'
  };

  const initialState: Partial<AppState> = {
    goals: { ...initialGoalState, selectedGoal: null, loading: false, error: null } as any,
  };

  beforeEach(async () => {
    mockRouter = { navigate: jest.fn() };
    mockMatDialog = { open: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [
        GoalDetailComponent, // Standalone
        NoopAnimationsModule,
        RouterTestingModule,
        CommonModule, // For pipes
        MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule, MatDialogModule,
        // ChartComponent, // If not mocking ChartComponent with NO_ERRORS_SCHEMA
      ],
      providers: [
        provideMockStore({ initialState }),
        { provide: Router, useValue: mockRouter },
        { provide: MatDialog, useValue: mockMatDialog },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: 'g123' }) } // Default to having an ID
          }
        }
      ],
      // schemas: [NO_ERRORS_SCHEMA] // Use if ChartComponent is complex or has many dependencies
    }).compileComponents();

    fixture = TestBed.createComponent(GoalDetailComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    activatedRoute = TestBed.inject(ActivatedRoute);
    jest.spyOn(store, 'dispatch');
    // fixture.detectChanges(); // Call in tests after mocking selectors for ngOnInit
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should dispatch loadGoal on ngOnInit if goalId is present', () => {
    fixture.detectChanges(); // ngOnInit
    expect(store.dispatch).toHaveBeenCalledWith(GoalActions.loadGoal({ id: 'g123' }));
  });

  it('should not dispatch loadGoal if no goalId in route', () => {
    (activatedRoute.snapshot as any).paramMap = convertToParamMap({}); // Simulate no ID
    fixture.detectChanges(); // ngOnInit
    expect(store.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: GoalActions.loadGoal.type }));
  });


  it('should subscribe to selectedGoal$ and set up chart data', () => {
    fixture.detectChanges(); // ngOnInit
    const setupChartSpy = jest.spyOn(component as any, 'setupProgressChart');
    store.overrideSelector(selectSelectedGoal, mockGoal);
    store.refreshState();
    fixture.detectChanges();

    component.goal$.subscribe(goal => {
      expect(goal).toEqual(mockGoal);
    });
    expect(setupChartSpy).toHaveBeenCalledWith(mockGoal);
    expect(component.progressChartData).toBeDefined();
  });

  it('should dispatch clearSelectedGoal on ngOnDestroy', () => {
    fixture.detectChanges(); // ngOnInit
    component.ngOnDestroy();
    expect(store.dispatch).toHaveBeenCalledWith(GoalActions.clearSelectedGoal());
  });

  describe('UI Helper Methods', () => {
    beforeEach(() => {
        fixture.detectChanges(); // ngOnInit
        store.overrideSelector(selectSelectedGoal, mockGoal);
        store.refreshState();
        fixture.detectChanges();
    });

    it('getProgressColor should return correct color', () => {
      expect(component.getProgressColor({ progressPercentage: 10 } as Goal)).toBe('warn');
      expect(component.getProgressColor({ progressPercentage: 50 } as Goal)).toBe('accent');
      expect(component.getProgressColor({ progressPercentage: 80 } as Goal)).toBe('primary');
    });

    it('getDaysRemaining should calculate remaining days', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const goalWithFutureDate = { ...mockGoal, targetDate: futureDate.toISOString() };
      expect(component.getDaysRemaining(goalWithFutureDate)).toBeCloseTo(10, 0); // CloseTo due to timing

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const goalWithPastDate = { ...mockGoal, targetDate: pastDate.toISOString() };
      expect(component.getDaysRemaining(goalWithPastDate)).toBe(0);
    });

    it('getMonthlyContributionNeeded should calculate correctly', () => {
      const goal = { ...mockGoal, targetAmount: 3000, currentAmount: 0 }; // Needs 3000
      // Set targetDate to be exactly 3 full months from now for easier calculation
      const today = new Date();
      const targetDate = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
      goal.targetDate = targetDate.toISOString();

      // (3000 / 3) = 1000
      expect(component.getMonthlyContributionNeeded(goal)).toBeCloseTo(1000);

      const goalAlmostMet = { ...goal, currentAmount: 2900 };
      expect(component.getMonthlyContributionNeeded(goalAlmostMet)).toBeCloseTo(100 / 3, 0);

      const pastGoal = { ...goal, targetDate: new Date(2020,0,1).toISOString() };
      expect(component.getMonthlyContributionNeeded(pastGoal)).toBe(3000); // If months remaining <=0, returns full remaining
    });
  });

  describe('User Actions', () => {
    beforeEach(() => {
        fixture.detectChanges(); // ngOnInit
        store.overrideSelector(selectSelectedGoal, mockGoal);
        store.refreshState();
        fixture.detectChanges();
    });

    it('updateProgress should dispatch addContribution after prompt', () => {
      jest.spyOn(window, 'prompt').mockReturnValue('150');
      component.updateProgress(mockGoal);
      expect(window.prompt).toHaveBeenCalled();
      expect(store.dispatch).toHaveBeenCalledWith(GoalActions.addContribution({
        goalId: mockGoal._id,
        amount: 150,
        notes: 'Manual contribution'
      }));
    });

    it('updateProgress should not dispatch if prompt is cancelled or invalid', () => {
      jest.spyOn(window, 'prompt').mockReturnValue(null);
      component.updateProgress(mockGoal);
      expect(store.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({type: GoalActions.addContribution.type}));

      (window.prompt as jest.Mock).mockReturnValue('abc');
      component.updateProgress(mockGoal);
      expect(store.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({type: GoalActions.addContribution.type}));
    });

    it('deleteGoal should dispatch deleteGoal action after confirmation', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      component.deleteGoal(mockGoal);
      expect(window.confirm).toHaveBeenCalled();
      expect(store.dispatch).toHaveBeenCalledWith(GoalActions.deleteGoal({ id: mockGoal._id }));
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/goals']);
    });

    it('deleteGoal should not dispatch if not confirmed', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(false);
      component.deleteGoal(mockGoal);
      expect(store.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({type: GoalActions.deleteGoal.type}));
    });

    it('goBack should navigate to /goals', () => {
      component.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/goals']);
    });
  });

  // Test chart data setup
  it('setupProgressChart should correctly set progressChartData', () => {
    (component as any).setupProgressChart(mockGoal); // Call private method for test
    expect(component.progressChartData).toBeDefined();
    expect(component.progressChartData?.labels).toEqual(['Achieved', 'Remaining']);
    expect(component.progressChartData?.datasets[0].data).toEqual([mockGoal.currentAmount, mockGoal.targetAmount - mockGoal.currentAmount]);
  });
});
