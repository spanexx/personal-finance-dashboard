import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms'; // FormBuilder for forms in component
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of, throwError, Subject, BehaviorSubject } from 'rxjs'; // Added BehaviorSubject

import { BudgetTrackingEnhancedComponent } from './budget-tracking.component';
import { BudgetService, BudgetAlert, BudgetHealthScore } from '../../../core/services/budget.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { AppState } from '../../../store/state/app.state';
import * as BudgetActions from '../../../store/actions/budget.actions';
import {
  selectAllBudgets, selectBudgetLoading, selectBudgetError, selectSelectedBudget
} from '../../../store/selectors/budget.selectors';
import { Budget, BudgetAnalysis } from '../../../shared/models/budget.model';
import { initialBudgetState } from '../../../store/reducers/budget.reducer';

// Import Material Modules & other dependencies used by the component's template
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgChartsModule } from 'ng2-charts';
import { FormsModule } from '@angular/forms'; // For ngModel if used, template does use it for summaryPeriod
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
// import { BudgetHealthScoreComponent } from '../budget-health-score/budget-health-score.component'; // If deeply testing, mock or declare

// Mock Services
class MockAccessibilityService {
  announce = jest.fn();
}
class MockNotificationService {
  success = jest.fn();
  error = jest.fn();
  info = jest.fn();
}
class MockWebSocketService {
  isConnected = new BehaviorSubject<boolean>(true);
  budgetAlerts = new Subject<any>();
  budgetPerformanceUpdates = new Subject<any>();
  joinRoom = jest.fn();
  reconnect = jest.fn();
}

describe('BudgetTrackingEnhancedComponent', () => {
  let component: BudgetTrackingEnhancedComponent;
  let fixture: ComponentFixture<BudgetTrackingEnhancedComponent>;
  let store: MockStore<AppState>;
  let mockBudgetService: Partial<BudgetService>;
  let mockAccessibilityService: MockAccessibilityService;

  const mockBudget1: Budget = {
    _id: 'b1', user: 'u1', name: 'Budget 1', totalAmount: 1000, period: 'monthly',
    startDate: new Date(), endDate: new Date(), categories: [{category: 'Food', allocated: 500, spent: 100, remaining: 400, rollover: 0, utilizationPercentage: 20, transactionCount: 1, alerts: {enabled: false, threshold: 80, triggered: false}}],
    alertSettings: {} as any, rolloverSettings: {} as any, isActive: true, isTemplate: false,
    totalSpent: 100, totalRemaining: 900, utilizationPercentage: 10, status: 'on_track',
    lastCalculated: new Date(), createdAt: new Date(), updatedAt: new Date()
  };
  const mockBudgetAnalysis: BudgetAnalysis = { budgetId: 'b1', period: 'monthly', performance: {} as any, categoryAnalysis: [], recommendations: [], alerts: [] };
  const mockBudgetHealthScore: BudgetHealthScore = { score: 80, overallScore: 80, healthLevel: 'Good', factors: [], improvementAreas: [], recommendations: [], lastCalculated: new Date(), spendingControlScore: 0, savingsRateScore: 0, goalProgressScore: 0, emergencyFundScore: 0 };
  const mockBudgetAlerts: BudgetAlert[] = [];

  const initialState: Partial<AppState> = {
    budgets: { ...initialBudgetState, budgets: [mockBudget1] },
  };

  beforeEach(async () => {
    mockBudgetService = {
      getBudget: jest.fn().mockReturnValue(of(mockBudget1)), // Will be replaced by store selector
      getBudgetAnalysis: jest.fn().mockReturnValue(of(mockBudgetAnalysis)),
      getBudgetHealthScore: jest.fn().mockReturnValue(of(mockBudgetHealthScore)),
      getBudgetAlerts: jest.fn().mockReturnValue(of(mockBudgetAlerts)),
      getBudgetOptimizationRecommendations: jest.fn().mockReturnValue(of({recommendations: [], summary: '', analysisDate: new Date(), budgetsAnalyzed: 0})),
    };
    mockAccessibilityService = new MockAccessibilityService();

    await TestBed.configureTestingModule({
      imports: [
        BudgetTrackingEnhancedComponent, // Standalone
        CommonModule, RouterModule.forRoot([]), FormsModule, ReactiveFormsModule, // Added ReactiveFormsModule
        NoopAnimationsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
        MatButtonModule, MatIconModule, MatProgressBarModule, MatProgressSpinnerModule, NgChartsModule,
        // BudgetHealthScoreComponent, // Could be mocked with NO_ERRORS_SCHEMA or a simple mock component
      ],
      providers: [
        FormBuilder, // Component uses FormBuilder
        provideMockStore({ initialState }),
        { provide: BudgetService, useValue: mockBudgetService },
        { provide: NotificationService, useClass: MockNotificationService },
        { provide: WebSocketService, useClass: MockWebSocketService },
        { provide: AccessibilityService, useValue: mockAccessibilityService },
      ],
      // schemas: [NO_ERRORS_SCHEMA] // If child components are complex and not directly tested
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetTrackingEnhancedComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    jest.spyOn(store, 'dispatch');

    // Set initial values for selectors used in ngOnInit -> loadInitialData -> selectedBudgetId$.subscribe
    store.overrideSelector(selectAllBudgets, [mockBudget1]);
    store.overrideSelector(selectSelectedBudget, null); // Initially no budget is "selected" in store for detail view
    store.overrideSelector(selectBudgetLoading, false);
    store.overrideSelector(selectBudgetError, null);

    fixture.detectChanges(); // ngOnInit
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should dispatch loadBudgets on init (via dispatchLoadBudgets in ngOnInit)', () => {
    expect(store.dispatch).toHaveBeenCalledWith(BudgetActions.loadBudgets({
      filters: { status: 'active' }, page: 1, limit: 100
    }));
  });

  it('should select the first budget from the list if budgets are loaded and none is selected', () => {
    // ngOnInit already called, selectors are set up
    // The subscription to budgets$ in ngOnInit should trigger selectedBudgetId$.next()
    expect(component.selectedBudgetId$.getValue()).toBe(mockBudget1._id);
  });

  describe('when a budget is selected (selectedBudgetId$ emits)', () => {
    beforeEach(() => {
      // Ensure initial selection has occurred and then simulate a change or re-selection
      component.selectedBudgetId$.next(mockBudget1._id);
      // For testing the effect of selectedBudgetId$ subscription,
      // we need to ensure the store is set up to provide the selected budget
      store.overrideSelector(selectSelectedBudget, mockBudget1);
      store.refreshState();
      fixture.detectChanges();
    });

    it('should dispatch loadBudget action', () => {
       // This test needs to ensure that the switchMap in setupDataSubscriptions is triggered
       // by selectedBudgetId$ emitting.
       // The dispatch occurs inside the switchMap.
       component.selectedBudgetId$.next(mockBudget1._id); // Re-emit to trigger
       expect(store.dispatch).toHaveBeenCalledWith(BudgetActions.loadBudget({ budgetId: mockBudget1._id }));
    });

    it('should update trackingData when selectedBudget from store and service calls complete', fakeAsync(() => {
      component.selectedBudgetId$.next(mockBudget1._id);
      store.overrideSelector(selectSelectedBudget, mockBudget1); // Simulate store updating after loadBudget
      store.refreshState();
      tick(); // Allow time for combineLatest and service mocks
      fixture.detectChanges();

      expect(component.trackingData).not.toBeNull();
      if(component.trackingData) { // Type guard
        expect(component.trackingData.budget._id).toBe(mockBudget1._id);
        expect(component.trackingData.analysis).toEqual(mockBudgetAnalysis);
        expect(component.trackingData.healthScore).toEqual(mockBudgetHealthScore);
      }
    }));
  });

  it('onBudgetChange should update selectedBudgetId$ and join WebSocket room', () => {
    const newBudgetId = 'b2';
    const joinRoomSpy = jest.spyOn(TestBed.inject(WebSocketService), 'joinRoom');
    component.onBudgetChange(newBudgetId);
    expect(component.selectedBudgetId$.getValue()).toBe(newBudgetId);
    expect(joinRoomSpy).toHaveBeenCalledWith(`budget:${newBudgetId}`);
  });

  it('refreshTrackingData should call services and update trackingData', () => {
    // This method is private but called by public methods or websocket updates.
    // To test it, we can set a selected budget and call it.
    component.selectedBudgetId$.next(mockBudget1._id);
    store.overrideSelector(selectSelectedBudget, mockBudget1);
    store.refreshState();

    (component as any).refreshTrackingData(mockBudget1._id); // Call private method for test

    expect(mockBudgetService.getBudget).toHaveBeenCalledWith(mockBudget1._id);
    expect(mockBudgetService.getBudgetAnalysis).toHaveBeenCalledWith(mockBudget1._id, expect.any(Object));
    expect(mockBudgetService.getBudgetHealthScore).toHaveBeenCalledWith(mockBudget1._id);
    expect(mockBudgetService.getBudgetAlerts).toHaveBeenCalledWith({ budgetId: mockBudget1._id });
    // Further checks on trackingData update could be added after service calls resolve
  });

  // Add more tests for other public methods like loadRecommendations, calculateSummaryData,
  // chart updates, alert handling, settings, export, etc.
  // These would follow similar patterns of setting up component state,
  // triggering methods, spying on service calls, and checking outcomes.
});
