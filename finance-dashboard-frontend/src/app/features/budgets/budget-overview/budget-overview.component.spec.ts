import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';

import { BudgetOverviewComponent } from './budget-overview.component';
import { BudgetService } from '../budget.service'; // For helper methods
import { AppState } from '../../../store/state/app.state';
import * as BudgetActions from '../../../store/actions/budget.actions';
import { selectSelectedBudget, selectBudgetLoading, selectBudgetError } from '../../../store/selectors/budget.selectors';
import { initialBudgetState } from '../../../store/reducers/budget.reducer';
import { Budget, CategoryAllocation } from '../../../shared/models/budget.model';

// Import Material Modules used by the component's template
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';

describe('BudgetOverviewComponent', () => {
  let component: BudgetOverviewComponent;
  let fixture: ComponentFixture<BudgetOverviewComponent>;
  let store: MockStore<AppState>;
  let mockBudgetService: Partial<BudgetService>;

  const mockCategoryAllocation: CategoryAllocation = {
    category: 'Food',
    allocated: 500,
    spent: 250,
    remaining: 250,
    rollover: 0,
    utilizationPercentage: 50,
    transactionCount: 5,
    alerts: { enabled: false, threshold: 80, triggered: false }
  };

  const mockBudget: Budget = {
    _id: 'b1', user: 'u1', name: 'Monthly Budget', totalAmount: 1000, period: 'monthly',
    startDate: new Date(), endDate: new Date(), categories: [mockCategoryAllocation],
    alertSettings: {} as any, rolloverSettings: {} as any, isActive: true, isTemplate: false,
    totalSpent: 250, totalRemaining: 750, utilizationPercentage: 25, status: 'on_track',
    lastCalculated: new Date(), createdAt: new Date(), updatedAt: new Date()
  };

  const initialState: Partial<AppState> = {
    budgets: { ...initialBudgetState, selectedBudget: null, loading: false, error: null },
  };

  beforeEach(async () => {
    mockBudgetService = {
      calculateBudgetProgress: jest.fn().mockReturnValue({
        totalBudget: 1000, totalSpent: 250, totalRemaining: 750, percentageSpent: 25
      }),
      getCategoryStatus: jest.fn().mockReturnValue('on_track'), // Default status
    };

    await TestBed.configureTestingModule({
      imports: [
        BudgetOverviewComponent, // Standalone
        NoopAnimationsModule,
        RouterTestingModule, // For routerLink directives in template
        MatCardModule, MatIconModule, MatButtonModule, MatListModule, MatProgressBarModule
      ],
      providers: [
        provideMockStore({ initialState }),
        { provide: BudgetService, useValue: mockBudgetService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetOverviewComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    jest.spyOn(store, 'dispatch');
    // fixture.detectChanges(); // ngOnInit will be triggered here
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should dispatch loadCurrentBudget on ngOnInit', () => {
    fixture.detectChanges();
    expect(store.dispatch).toHaveBeenCalledWith(BudgetActions.loadCurrentBudget());
  });

  it('should update budgetProgress when selectedBudget$ emits a budget', () => {
    fixture.detectChanges(); // ngOnInit
    store.overrideSelector(selectSelectedBudget, mockBudget);
    store.refreshState();
    fixture.detectChanges();

    expect(component.budgetProgress).toBeDefined();
    expect(component.budgetProgress.totalBudget).toBe(1000);
    expect(mockBudgetService.calculateBudgetProgress).toHaveBeenCalledWith(mockBudget);
  });

  it('should set budgetProgress to null if selectedBudget$ emits null', () => {
    fixture.detectChanges(); // ngOnInit
    store.overrideSelector(selectSelectedBudget, null);
    store.refreshState();
    fixture.detectChanges();

    expect(component.budgetProgress).toBeNull();
  });

  it('getCategoryStatusClass should call budgetService.getCategoryStatus', () => {
    component.getCategoryStatusClass(mockCategoryAllocation);
    expect(mockBudgetService.getCategoryStatus).toHaveBeenCalledWith(mockCategoryAllocation);
  });

  it('getCategoryProgressPercentage should calculate percentage correctly', () => {
    expect(component.getCategoryProgressPercentage(mockCategoryAllocation)).toBe(50);
    const zeroAllocatedCategory = { ...mockCategoryAllocation, allocated: 0, spent: 10 };
    expect(component.getCategoryProgressPercentage(zeroAllocatedCategory)).toBe(0);
    const overspentCategory = { ...mockCategoryAllocation, allocated: 100, spent: 120 };
    expect(component.getCategoryProgressPercentage(overspentCategory)).toBe(100); // Max 100
  });

  it('getOverallProgressColor should return correct color based on percentage', () => {
    component.budgetProgress = { percentageSpent: 25 };
    expect(component.getOverallProgressColor()).toBe('primary');

    component.budgetProgress = { percentageSpent: 85 };
    expect(component.getOverallProgressColor()).toBe('accent');

    component.budgetProgress = { percentageSpent: 105 };
    expect(component.getOverallProgressColor()).toBe('warn');

    component.budgetProgress = null;
    expect(component.getOverallProgressColor()).toBe('primary');
  });
});
