import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of, Subject, throwError } from 'rxjs';

import { TransactionFormComponent } from './transaction-form.component';
import { TransactionService } from '../services/transaction.service'; // For category loading
import { NotificationService } from '../../../core/services/notification.service'; // If used
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { AppState } from '../../../store/state/app.state';
import * as TransactionActions from '../../../store/actions/transaction.actions';
import { initialTransactionState } from '../../../store/reducers/transaction.reducer';
import { getSelectedTransaction, getTransactionLoading, getTransactionError } from '../../../store/selectors/transaction.selectors';
import { Transaction, CreateTransactionRequest, UpdateTransactionRequest } from '../../../shared/models/transaction.model';
import { Category } from '../../../shared/models/category.model'; // Assuming Category model exists

// Import Material modules used by the component's template
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';


// Mock services
class MockAccessibilityService {
  announce = jest.fn();
  announceError = jest.fn();
  announceOperationStatus = jest.fn();
  announceSuccess = jest.fn();
}
class MockNotificationService {
    success = jest.fn();
    error = jest.fn();
}


describe('TransactionFormComponent', () => {
  let component: TransactionFormComponent;
  let fixture: ComponentFixture<TransactionFormComponent>;
  let store: MockStore<AppState>;
  let mockRouter: Partial<Router>;
  let mockActivatedRoute: any;
  let mockTransactionService: Partial<TransactionService>;
  let mockMatDialog: Partial<MatDialog>;
  let mockNotificationServiceInstance: MockNotificationService;


  const mockTransaction: Transaction = {
    _id: '1', user: 'u1', amount: 100, description: 'Test Edit', category: 'cat1', type: 'expense',
    date: new Date(), paymentMethod: 'credit_card', status: 'completed', attachments: [], tags: ['food'],
    isReconciled: false, createdAt: new Date(), updatedAt: new Date(), isDeleted: false,
    payee: 'Test Payee'
  };

  const initialAuthState = { user: { _id: 'user123', firstName: 'TestUser' } } as any;

  const initialState: Partial<AppState> = {
    transactions: { ...initialTransactionState, selectedTransaction: null },
    auth: initialAuthState,
  };

  const mockCategories: Category[] = [
    { id: 'cat1', _id: 'cat1', name: 'Food', type: 'expense', icon: 'fastfood', color: '#FF0000', isDefault: false, user: 'u1' },
    { id: 'cat2', _id: 'cat2', name: 'Salary', type: 'income', icon: 'work', color: '#00FF00', isDefault: false, user: 'u1' },
  ];

  beforeEach(async () => {
    mockRouter = { navigate: jest.fn() };
    mockActivatedRoute = {
      paramMap: of({ get: (key: string) => null }), // Default to create mode
    };
    mockTransactionService = {
      getCategories: jest.fn().mockReturnValue(of(mockCategories)), // For loadCategories
      // Mock other methods if component calls them directly
    };
    mockMatDialog = { open: jest.fn() };
    mockNotificationServiceInstance = new MockNotificationService();


    await TestBed.configureTestingModule({
      imports: [
        TransactionFormComponent, // Standalone
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule,
        MatCheckboxModule, MatIconModule, MatButtonModule, MatChipsModule, MatAutocompleteModule, MatButtonToggleModule,
        MatProgressSpinnerModule
      ],
      providers: [
        FormBuilder,
        provideMockStore({ initialState }),
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: MatSnackBar, useValue: { open: jest.fn() } },
        { provide: MatDialog, useValue: mockMatDialog },
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: AccessibilityService, useClass: MockAccessibilityService },
        { provide: NotificationService, useValue: mockNotificationServiceInstance }
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionFormComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    jest.spyOn(store, 'dispatch');
    // fixture.detectChanges(); // ngOnInit is triggered here
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should initialize form in create mode if no ID in route', () => {
    fixture.detectChanges(); // ngOnInit
    expect(component.isEditMode).toBe(false);
    expect(component.pageTitle).toBe('Add Transaction');
    expect(component.transactionForm).toBeDefined();
    expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.clearSelectedTransaction());
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      mockActivatedRoute.paramMap = of({ get: (key: string) => (key === 'id' ? '1' : null) });
      // Reset selectors before setting new state for edit mode
      store.overrideSelector(getSelectedTransaction, null);
      store.overrideSelector(getTransactionLoading, false);
    });

    it('should initialize form in edit mode if ID is in route and dispatch loadTransaction', () => {
      fixture.detectChanges(); // ngOnInit
      expect(component.isEditMode).toBe(true);
      expect(component.transactionId).toBe('1');
      expect(component.pageTitle).toBe('Edit Transaction');
      expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.loadTransaction({ transactionId: '1' }));
    });

    it('should populate form when selectedTransaction$ emits a transaction in edit mode', () => {
      // Initial detection to set up edit mode and dispatch loadTransaction
      fixture.detectChanges();

      // Simulate store emitting the selected transaction
      store.overrideSelector(getSelectedTransaction, mockTransaction);
      store.refreshState();
      fixture.detectChanges(); // Re-run change detection for subscription to pick up

      expect(component.transactionForm.get('description')?.value).toBe(mockTransaction.description);
      expect(component.transactionForm.get('amount')?.value).toBe(mockTransaction.amount);
      expect(component.transactionForm.get('payee')?.value).toBe(mockTransaction.payee); // Check if payee is handled
      expect(component.tags).toEqual(mockTransaction.tags);
    });
  });

  it('form should be invalid when empty (required fields)', () => {
    fixture.detectChanges();
    expect(component.transactionForm.valid).toBeFalsy();
  });

  it('form should be valid with correct data', () => {
    fixture.detectChanges();
    component.transactionForm.setValue({
      amount: 100, type: 'expense', category: 'cat1', date: new Date(),
      description: 'Valid Desc', notes: '', payee: 'Valid Payee', paymentMethod: 'cash',
      isRecurring: false, recurringDetails: { frequency: 'monthly', interval: 1, endDate: null },
      tags: [], isSplitTransaction: false, splitTransactions: []
    });
    expect(component.transactionForm.valid).toBeTruthy();
  });

  describe('onSubmit', () => {
    beforeEach(() => fixture.detectChanges()); // Initial ngOnInit call

    it('should not dispatch if form is invalid', () => {
      component.transactionForm.get('amount')?.setValue(null); // Make form invalid
      component.onSubmit();
      expect(store.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: '[Transaction] Create Transaction' }));
    });

    it('should dispatch createTransaction for new transaction if form is valid', fakeAsync(() => {
      component.isEditMode = false;
      component.transactionForm.setValue({
        amount: 100, type: 'expense', category: 'cat1', date: new Date(),
        description: 'New Desc', notes: '', payee: 'Test Payee', paymentMethod: 'credit_card',
        isRecurring: false, recurringDetails: { frequency: 'monthly', interval: 1, endDate: null },
        tags: [], isSplitTransaction: false, splitTransactions: []
      });

      store.overrideSelector(getTransactionLoading, false); // Ensure not initially loading
      store.overrideSelector(getTransactionError, null);   // Ensure no initial error

      component.onSubmit();

      const expectedPayload: CreateTransactionRequest = {
        amount: 100, type: 'expense', category: 'cat1', date: component.transactionForm.value.date,
        description: 'New Desc', notes: '',
        // payee: 'Test Payee', // Payee is not in DTO, was commented out in component
        paymentMethod: 'credit_card', tags: [], recurringConfig: undefined
      };
      expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.createTransaction({ transaction: expect.objectContaining(expectedPayload) }));

      // Simulate success
      store.overrideSelector(getTransactionLoading, false); // Simulate loading finished
      store.overrideSelector(getTransactionError, null);    // Simulate no error
      store.refreshState(); // Trigger subscriptions
      tick(); // Process async operations in subscription

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/transactions']);
    }));

    it('should dispatch updateTransaction for existing transaction if form is valid', fakeAsync(() => {
      component.isEditMode = true;
      component.transactionId = '1';
      component.transactionForm.setValue({
        amount: 150, type: 'income', category: 'cat2', date: new Date(),
        description: 'Updated Desc', notes: 'note', payee: 'Another Payee', paymentMethod: 'bank_transfer',
        isRecurring: false, recurringDetails: { frequency: 'monthly', interval: 1, endDate: null },
        tags: ['updated'], isSplitTransaction: false, splitTransactions: []
      });

      store.overrideSelector(getTransactionLoading, false);
      store.overrideSelector(getTransactionError, null);

      component.onSubmit();

      const expectedPayload: UpdateTransactionRequest = {
        amount: 150, type: 'income', category: 'cat2', date: component.transactionForm.value.date,
        description: 'Updated Desc', notes: 'note',
        // payee: 'Another Payee', // Payee is not in DTO
        paymentMethod: 'bank_transfer', tags: ['updated'], recurringConfig: undefined
      };
      expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.updateTransaction({
        transactionId: '1',
        transaction: expect.objectContaining(expectedPayload)
      }));

      // Simulate success
      store.overrideSelector(getTransactionLoading, false);
      store.overrideSelector(getTransactionError, null);
      store.refreshState();
      tick();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/transactions']);
    }));
  });

  it('openNewCategoryDialog should open MatDialog', () => {
    component.openNewCategoryDialog();
    expect(mockMatDialog.open).toHaveBeenCalled();
  });
});
