import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { GoalsListComponent } from './goals-list.component';
import { AppState } from '../../../store/state/app.state';
import * as GoalActions from '../../../store/actions/goal.actions';
import { selectAllGoals, selectGoalLoading, selectGoalError } from '../../../store/selectors/goal.selectors';
import { initialGoalState } from '../../../store/reducers/goal.reducer'; // Assuming this exists
import { Goal } from '../../../shared/models';

// Import Material Modules used by the component's template
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule } from '@angular/material/dialog'; // For MatDialog itself

// Mock Goal model
const mockGoal1: Goal = {
  _id: 'g1',
  name: 'Vacation Fund',
  targetAmount: 1000,
  currentAmount: 250,
  targetDate: new Date(2025, 11, 31).toISOString(),
  user: 'user1',
  description: 'Trip to Hawaii',
  category: 'Travel',
  priority: 'High',
  contributions: [],
  isAchieved: false,
  progressPercentage: 25, // Calculated or part of model
  icon: 'flight', // Assuming these are part of model
  color: '#00BCD4' // Assuming these are part of model
};
const mockGoal2: Goal = {
  _id: 'g2',
  name: 'New Laptop',
  targetAmount: 1500,
  currentAmount: 1000,
  targetDate: new Date(2024, 8, 15).toISOString(),
  user: 'user1',
  description: 'For work',
  category: 'Technology',
  priority: 'Medium',
  contributions: [],
  isAchieved: false,
  progressPercentage: 66,
  icon: 'laptop',
  color: '#FF9800'
};

describe('GoalsListComponent', () => {
  let component: GoalsListComponent;
  let fixture: ComponentFixture<GoalsListComponent>;
  let store: MockStore<AppState>;
  let mockMatDialog: Partial<MatDialog>;

  const initialState: Partial<AppState> = {
    goals: { ...initialGoalState, goals: [], loading: false, error: null } as any, // Cast if initialGoalState is not fully AppState's goals slice
  };

  beforeEach(async () => {
    mockMatDialog = {
      open: jest.fn(), // Mock the open method
    };

    await TestBed.configureTestingModule({
      imports: [
        GoalsListComponent, // Standalone
        NoopAnimationsModule,
        RouterTestingModule, // For routerLink
        MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule, MatDialogModule
      ],
      providers: [
        provideMockStore({ initialState }),
        { provide: MatDialog, useValue: mockMatDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GoalsListComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    jest.spyOn(store, 'dispatch');
    fixture.detectChanges(); // ngOnInit
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should dispatch loadGoals action on ngOnInit', () => {
    expect(store.dispatch).toHaveBeenCalledWith(GoalActions.loadGoals());
  });

  it('should select and display goals from the store', () => {
    const mockGoals = [mockGoal1, mockGoal2];
    store.overrideSelector(selectAllGoals, mockGoals);
    store.refreshState();
    fixture.detectChanges();

    const cardElements = fixture.nativeElement.querySelectorAll('mat-card.goal-card');
    expect(cardElements.length).toBe(mockGoals.length);
    expect(cardElements[0].querySelector('mat-card-title').textContent).toContain(mockGoal1.name);
  });

  it('should display loading state when loading$ is true', () => {
    // Note: This component doesn't have a specific loading indicator in its template in the provided code.
    // If one were added, this test would verify it.
    // For now, we test that the component correctly subscribes.
    store.overrideSelector(selectGoalLoading, true);
    store.refreshState();
    fixture.detectChanges();
    component.loading$.subscribe(loading => expect(loading).toBe(true));
  });

  it('should display error state when error$ emits', () => {
    // Note: This component doesn't have a specific error display area in its template.
    // This test verifies the selector subscription.
    const errorMsg = 'Failed to load goals';
    store.overrideSelector(selectGoalError, errorMsg);
    store.refreshState();
    fixture.detectChanges();
    component.error$.subscribe(error => expect(error).toBe(errorMsg));
  });

  describe('openAddFundsDialog', () => {
    beforeEach(() => {
      // Mock window.prompt
      jest.spyOn(window, 'prompt');
    });

    it('should dispatch addContribution action if amount is provided via prompt', () => {
      (window.prompt as jest.Mock).mockReturnValue('100'); // User enters 100
      component.openAddFundsDialog(mockGoal1);
      expect(window.prompt).toHaveBeenCalledWith(`How much would you like to add to "${mockGoal1.name}"?`);
      expect(store.dispatch).toHaveBeenCalledWith(GoalActions.addContribution({
        goalId: mockGoal1._id,
        amount: 100,
        notes: 'Manual contribution'
      }));
    });

    it('should not dispatch addContribution if prompt is cancelled (returns null)', () => {
      (window.prompt as jest.Mock).mockReturnValue(null);
      component.openAddFundsDialog(mockGoal1);
      expect(store.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({type: GoalActions.addContribution.type}));
    });

    it('should not dispatch addContribution if amount is not a number', () => {
      (window.prompt as jest.Mock).mockReturnValue('abc');
      component.openAddFundsDialog(mockGoal1);
      expect(store.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({type: GoalActions.addContribution.type}));
    });
  });

  it('getProgressColor should return correct color based on progressPercentage', () => {
    expect(component.getProgressColor({ progressPercentage: 20 } as Goal)).toBe('warn');
    expect(component.getProgressColor({ progressPercentage: 60 } as Goal)).toBe('accent');
    expect(component.getProgressColor({ progressPercentage: 80 } as Goal)).toBe('primary');
  });

  it('formatCurrency should format number to USD currency string', () => {
    expect(component.formatCurrency(1234.56)).toBe('$1,234.56');
    expect(component.formatCurrency(0)).toBe('$0.00');
  });

  // formatDate is not used in the current template, but test if it were
  // it('formatDate should format date string', () => {
  //   const date = new Date(2023, 0, 15); // Jan 15, 2023
  //   expect(component.formatDate(date.toISOString())).toBe('January 15, 2023');
  // });
});
