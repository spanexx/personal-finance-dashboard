import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of, Subject, throwError } from 'rxjs';

import { QuickAddTransactionComponent } from './quick-add-transaction.component';
import { TransactionService } from '../services/transaction.service'; // For category loading
import { AppState } from '../../../store/state/app.state';
import * as TransactionActions from '../../../store/actions/transaction.actions';
import { initialTransactionState } from '../../../store/reducers/transaction.reducer';
import { getTransactionLoading, getTransactionError } from '../../../store/selectors/transaction.selectors';
import { CreateTransactionRequest, Category } from '../../../shared/models'; // Assuming Category is also in shared models or defined

// Import Material modules used by the component's template
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';


describe('QuickAddTransactionComponent', () => {
  let component: QuickAddTransactionComponent;
  let fixture: ComponentFixture<QuickAddTransactionComponent>;
  let store: MockStore<AppState>;
  let mockMatDialogRef: Partial<MatDialogRef<QuickAddTransactionComponent>>;
  let mockTransactionService: Partial<TransactionService>;
  let mockSnackBar: Partial<MatSnackBar>;

  const mockCategories: Category[] = [
    { id: 'cat1', _id: 'cat1', name: 'Groceries', type: 'expense', icon: 'shopping_cart', color: '#FF0000', isDefault: false, user: 'u1' },
    { id: 'cat2', _id: 'cat2', name: 'Salary', type: 'income', icon: 'work', color: '#00FF00', isDefault: false, user: 'u1' },
  ];

  const initialState: Partial<AppState> = {
    transactions: { ...initialTransactionState },
  };

  beforeEach(async () => {
    mockMatDialogRef = { close: jest.fn() };
    mockTransactionService = {
      getCategories: jest.fn().mockReturnValue(of(mockCategories)),
    };
    mockSnackBar = { open: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [
        QuickAddTransactionComponent, // Standalone
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
        MatNativeDateModule, MatButtonModule, MatIconModule, MatButtonToggleModule, MatProgressSpinnerModule
      ],
      providers: [
        FormBuilder,
        provideMockStore({ initialState }),
        { provide: MatDialogRef, useValue: mockMatDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: {} }, // Provide empty mock data for dialog
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickAddTransactionComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    jest.spyOn(store, 'dispatch');
    fixture.detectChanges(); // Trigger ngOnInit
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize quickAddForm', () => {
    expect(component.quickAddForm).toBeDefined();
    expect(component.quickAddForm.get('amount')).toBeDefined();
    expect(component.quickAddForm.get('description')).toBeDefined();
  });

  it('should load categories on init', () => {
    expect(mockTransactionService.getCategories).toHaveBeenCalled();
    expect(component.categories.length).toBe(2);
  });

  it('form should be invalid when empty', () => {
    expect(component.quickAddForm.valid).toBeFalsy();
  });

  it('form should be valid with correct data', () => {
    component.quickAddForm.setValue({
      amount: 50,
      type: 'expense',
      category: 'cat1',
      description: 'Lunch',
      payee: 'Restaurant', // Payee is in form, but not DTO
      paymentMethod: 'cash',
      date: new Date()
    });
    expect(component.quickAddForm.valid).toBeTruthy();
  });

  describe('onSubmit', () => {
    beforeEach(() => {
        component.quickAddForm.setValue({
            amount: 50, type: 'expense', category: 'cat1', description: 'Lunch',
            payee: 'Restaurant', paymentMethod: 'cash', date: new Date()
        });
    });

    it('should not dispatch if form is invalid', () => {
      component.quickAddForm.get('amount')?.setValue(null); // Make invalid
      component.onSubmit();
      expect(store.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: '[Transaction] Create Transaction' }));
    });

    it('should dispatch createTransaction action if form is valid', fakeAsync(() => {
      store.overrideSelector(getTransactionLoading, false);
      store.overrideSelector(getTransactionError, null);

      component.onSubmit();

      const expectedPayload: CreateTransactionRequest = {
        amount: 50,
        type: 'expense',
        category: 'cat1', // This was corrected to 'category' from 'categoryId'
        date: component.quickAddForm.value.date,
        description: 'Lunch',
        paymentMethod: 'cash',
        // payee is not part of CreateTransactionRequest based on previous fixes
      };
      expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.createTransaction({
        transaction: expect.objectContaining(expectedPayload)
      }));

      // Simulate success
      store.overrideSelector(getTransactionLoading, false); // loading becomes false after op
      store.overrideSelector(getTransactionError, null);   // no error
      store.refreshState(); // push new state
      tick(); // process async operations if any in subscription

      expect(mockSnackBar.open).toHaveBeenCalledWith('Transaction added successfully', 'Close', { duration: 3000 });
      expect(mockMatDialogRef.close).toHaveBeenCalledWith(true);
    }));

    it('should handle error if createTransaction fails', fakeAsync(() => {
      const errorResponse = { message: 'Creation failed' };
      store.overrideSelector(getTransactionLoading, false);
      store.overrideSelector(getTransactionError, null); // Initial state no error

      component.onSubmit(); // Dispatch the action

      // Simulate error after action dispatch
      store.overrideSelector(getTransactionLoading, false); // loading becomes false
      store.overrideSelector(getTransactionError, errorResponse); // error is emitted
      store.refreshState();
      tick();

      // The snackbar for error is now handled by the component's direct subscription to error$
      // So, we check that the console error was logged as per the effect's subscription.
      // The component's own error$ subscription will show the snackbar.
      // This test primarily ensures the flow in onSubmit's subscription works.
      expect(mockMatDialogRef.close).not.toHaveBeenCalled(); // Dialog should not close on error
    }));
  });

  it('cancel method should close the dialog', () => {
    component.cancel();
    expect(mockMatDialogRef.close).toHaveBeenCalled();
  });
});
