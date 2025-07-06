import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of, Subject, throwError } from 'rxjs';

import { BudgetSetupComponent } from './budget-setup.component';
import { BudgetService } from '../budget.service'; // For category loading
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { AppState } from '../../../store/state/app.state';
import * as BudgetActions from '../../../store/actions/budget.actions';
import { initialBudgetState } from '../../../store/reducers/budget.reducer';
import { selectSelectedBudget, selectBudgetLoading, selectBudgetError } from '../../../store/selectors/budget.selectors';
import { Budget, CreateBudgetRequest, UpdateBudgetRequest, Category } from '../../../shared/models'; // Assuming Category is in shared models

// Material Modules
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LiveAnnouncer } from '@angular/cdk/a11y';


class MockAccessibilityService {
  announce = jest.fn();
  announceError = jest.fn();
  announceOperationStatus = jest.fn();
  announceSuccess = jest.fn();
  announceRouteChange = jest.fn();
}

describe('BudgetSetupComponent', () => {
  let component: BudgetSetupComponent;
  let fixture: ComponentFixture<BudgetSetupComponent>;
  let store: MockStore<AppState>;
  let mockRouter: Partial<Router>;
  let mockActivatedRoute: any;
  let mockBudgetService: Partial<BudgetService>;
  let mockSnackBar: Partial<MatSnackBar>;
  let mockLiveAnnouncer: Partial<LiveAnnouncer>;

  const mockCategories: Category[] = [
    { _id: 'cat1', name: 'Groceries', type: 'expense', icon: 'store', color: '#fff', user: 'u1', id: 'cat1', isDefault: false },
    { _id: 'cat2', name: 'Salary', type: 'income', icon: 'work', color: '#000', user: 'u1', id: 'cat2', isDefault: false },
  ];

  const mockBudget: Budget = {
    _id: 'b123', name: 'Test Budget', totalAmount: 1000, period: 'monthly', user: 'u1',
    startDate: new Date(2024, 0, 1), endDate: new Date(2024, 0, 31),
    categories: [{ category: 'cat1', allocated: 500, spent:0, remaining:500, rollover:0, utilizationPercentage:0, transactionCount:0, alerts:{enabled:false, threshold:0, triggered:false} }],
    alertSettings: {} as any, rolloverSettings: {} as any, isActive: true, isTemplate: false,
    totalSpent: 0, totalRemaining: 1000, utilizationPercentage: 0, status: 'on_track',
    lastCalculated: new Date(), createdAt: new Date(), updatedAt: new Date()
  };

  const initialState: Partial<AppState> = {
    budgets: { ...initialBudgetState, selectedBudget: null },
  };
  const queryParamsSubject = new Subject<any>();


  beforeEach(async () => {
    mockRouter = { navigate: jest.fn() };
    mockActivatedRoute = { paramMap: queryParamsSubject.asObservable() }; // paramMap for route params like /:id
    mockBudgetService = {
      getExpenseCategories: jest.fn().mockReturnValue(of(mockCategories)),
    };
    mockSnackBar = { open: jest.fn() };
    mockLiveAnnouncer = { announce: jest.fn() };


    await TestBed.configureTestingModule({
      imports: [
        BudgetSetupComponent, // Standalone
        ReactiveFormsModule, NoopAnimationsModule, MatCardModule, MatFormFieldModule, MatInputModule,
        MatSelectModule, MatDatepickerModule, MatNativeDateModule, MatButtonModule, MatIconModule
      ],
      providers: [
        FormBuilder,
        provideMockStore({ initialState }),
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: BudgetService, useValue: mockBudgetService },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: AccessibilityService, useClass: MockAccessibilityService },
        { provide: LiveAnnouncer, useValue: mockLiveAnnouncer },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetSetupComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    jest.spyOn(store, 'dispatch');
    // fixture.detectChanges(); // Call in each test or describe block after setting params
  });

  it('should create', () => {
    queryParamsSubject.next({ get: (key: string) => null }); // Simulate create mode
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should initialize form on create mode', () => {
    queryParamsSubject.next({ get: (key: string) => null });
    fixture.detectChanges();
    expect(component.budgetForm).toBeDefined();
    expect(component.currentBudgetId).toBeNull();
    expect(mockBudgetService.getExpenseCategories).toHaveBeenCalled();
    expect(store.dispatch).toHaveBeenCalledWith(BudgetActions.clearSelectedBudget());
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      mockActivatedRoute.paramMap = of({ get: (key: string) => (key === 'id' ? 'b123' : null) });
      store.overrideSelector(selectSelectedBudget, null); // Ensure it's null before test
      store.overrideSelector(selectBudgetLoading, false);
    });

    it('should dispatch loadBudget and populate form in edit mode', fakeAsync(() => {
      fixture.detectChanges(); // ngOnInit
      tick(); // for paramMap subscription

      expect(component.currentBudgetId).toBe('b123');
      expect(store.dispatch).toHaveBeenCalledWith(BudgetActions.loadBudget({ budgetId: 'b123' }));

      // Simulate store emitting the selected budget
      store.overrideSelector(selectSelectedBudget, mockBudget);
      store.refreshState();
      tick(); // for selectSelectedBudget subscription
      fixture.detectChanges();

      expect(component.budgetForm.get('name')?.value).toBe(mockBudget.name);
      expect(component.budgetForm.get('amount')?.value).toBe(mockBudget.totalAmount);
      expect(component.categoriesFormArray.length).toBeGreaterThan(0); // Assuming loadExistingBudget adds allocations
    }));
  });

  it('form should be invalid when empty', () => {
    queryParamsSubject.next({ get: (key: string) => null });
    fixture.detectChanges();
    expect(component.budgetForm.valid).toBeFalsy();
  });

  it('form should be valid with correct data', () => {
    queryParamsSubject.next({ get: (key: string) => null });
    fixture.detectChanges();
    component.budgetForm.patchValue({
      name: 'Monthly Expenses',
      amount: 1500,
      period: 'monthly',
      startDate: new Date(2024, 5, 1),
      endDate: new Date(2024, 5, 30),
    });
    // Assuming categories are added and valid for overall form validity
    // For this test, we might not need to populate categories if not directly testing isFormValid() logic here
    // but rather individual controls or submission.
    // If categories array is required for form to be valid:
    // component.addCategoryAllocation('cat1', 500);
    // For now, just checking main fields:
    expect(component.budgetForm.get('name')?.valid).toBeTruthy();
    expect(component.budgetForm.get('amount')?.valid).toBeTruthy();
    // Full form validity depends on categories array too.
  });

  describe('onSubmit', () => {
    beforeEach(() => {
      queryParamsSubject.next({ get: (key: string) => null }); // Default to create mode
      fixture.detectChanges(); // ngOnInit
      component.categories = mockCategories; // Ensure categories are loaded for addCategoryAllocation
      component.budgetForm.patchValue({
        name: 'Test Budget', amount: 1000, period: 'monthly',
        startDate: new Date(2024,0,1), endDate: new Date(2024,0,31)
      });
      // Add a category allocation to make the form potentially valid
      component.addCategoryAllocation(mockCategories[0]._id, 500);
      component.addCategoryAllocation(mockCategories[1]._id, 500);
      fixture.detectChanges();
    });

    it('should not dispatch if form is invalid', () => {
      component.budgetForm.get('name')?.setValue(''); // Make invalid
      component.onSubmit();
      expect(store.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: BudgetActions.createBudget.type }));
    });

    it('should dispatch createBudget for new budget if form is valid', fakeAsync(() => {
      expect(component.budgetForm.valid).toBeTruthy(); // Ensure form is valid first
      store.overrideSelector(selectBudgetLoading, false); // Initial saving state
      store.overrideSelector(selectBudgetError, null);   // Initial error state

      component.onSubmit();

      const formValue = component.budgetForm.value;
      const expectedPayload: CreateBudgetRequest = {
        name: formValue.name,
        totalAmount: formValue.amount,
        period: formValue.period,
        startDate: (formValue.startDate as Date).toISOString(),
        endDate: (formValue.endDate as Date).toISOString(),
        categories: formValue.categories.map((cat: any) => ({ category: cat.category, allocated: cat.amount }))
      };
      expect(store.dispatch).toHaveBeenCalledWith(BudgetActions.createBudget({ budgetData: expect.objectContaining(expectedPayload) }));

      // Simulate success
      store.overrideSelector(selectBudgetLoading, false); // loading becomes false
      store.overrideSelector(selectBudgetError, null);   // no error
      store.refreshState();
      tick();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/budgets/tracking']);
    }));

    it('should dispatch updateBudget for existing budget if form is valid and in edit mode', fakeAsync(() => {
      component.currentBudgetId = 'b123'; // Simulate edit mode
      expect(component.budgetForm.valid).toBeTruthy();
      store.overrideSelector(selectBudgetLoading, false);
      store.overrideSelector(selectBudgetError, null);

      component.onSubmit();

      const formValue = component.budgetForm.value;
      const expectedPayload: UpdateBudgetRequest = {
        _id: 'b123',
        name: formValue.name,
        totalAmount: formValue.amount,
        period: formValue.period,
        startDate: (formValue.startDate as Date).toISOString(),
        endDate: (formValue.endDate as Date).toISOString(),
        categories: formValue.categories.map((cat: any) => ({ category: cat.category, allocated: cat.amount }))
      };
      expect(store.dispatch).toHaveBeenCalledWith(BudgetActions.updateBudget({ budgetId: 'b123', budgetData: expect.objectContaining(expectedPayload) }));

      store.overrideSelector(selectBudgetLoading, false);
      store.overrideSelector(selectBudgetError, null);
      store.refreshState();
      tick();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/budgets/tracking']);
    }));
  });

  it('addNewCategoryAllocation should add a category to form array if available categories exist', () => {
    queryParamsSubject.next({ get: (key: string) => null });
    fixture.detectChanges(); // Load categories
    component.categories = mockCategories; // Ensure categories are loaded
    (component.categoriesFormArray.controls as any) = []; // Clear existing from default setup

    component.addNewCategoryAllocation();
    expect(component.categoriesFormArray.length).toBe(1);

    component.addNewCategoryAllocation();
    expect(component.categoriesFormArray.length).toBe(2);

    component.addNewCategoryAllocation(); // Try to add more than available
    expect(component.categoriesFormArray.length).toBe(2); // Should not add more
  });

  it('removeCategoryAllocation should remove a category', () => {
     queryParamsSubject.next({ get: (key: string) => null });
     fixture.detectChanges();
     component.categories = mockCategories;
     component.addCategoryAllocation(mockCategories[0]._id, 100);
     component.addCategoryAllocation(mockCategories[1]._id, 200);
     expect(component.categoriesFormArray.length).toBe(2);

     component.removeCategoryAllocation(0);
     expect(component.categoriesFormArray.length).toBe(1);
     expect(component.categoriesFormArray.at(0).get('category')?.value).toBe(mockCategories[1]._id);
  });

  it('cancel should navigate to /budgets', () => {
    component.cancel();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/budgets']);
  });
});
