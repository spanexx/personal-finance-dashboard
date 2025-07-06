import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of, Subject } from 'rxjs';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { LiveAnnouncer } from '@angular/cdk/a11y';

import { TransactionListComponent } from './transaction-list.component';
import { TransactionService } from '../services/transaction.service'; // For non-NgRx parts like category/suggestion loading
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { AppState } from '../../../store/state/app.state';
import * as TransactionActions from '../../../store/actions/transaction.actions';
import { initialTransactionState } from '../../../store/reducers/transaction.reducer';
import {
  getAllTransactions, getTransactionLoading, getTransactionError, getTransactionPagination
} from '../../../store/selectors/transaction.selectors';
import { Transaction } from '../../../shared/models/transaction.model';

// Import Material modules used by the component's template
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar'; // For scroll loading

// Mock services
class MockAccessibilityService {
  announce = jest.fn();
  announceError = jest.fn();
  announceOperationStatus = jest.fn();
  announceRouteChange = jest.fn();
  trapFocus = jest.fn();
  releaseFocus = jest.fn();
}

describe('TransactionListComponent', () => {
  let component: TransactionListComponent;
  let fixture: ComponentFixture<TransactionListComponent>;
  let store: MockStore<AppState>;
  let mockRouter: Partial<Router>;
  let mockMatDialog: Partial<MatDialog>;
  let mockTransactionService: Partial<TransactionService>;
  let mockLiveAnnouncer: Partial<LiveAnnouncer>;

  const mockTransaction: Transaction = {
    _id: '1', user: 'u1', amount: 100, description: 'Test', category: 'cat1', type: 'expense',
    date: new Date(), paymentMethod: 'cash', status: 'completed', attachments: [], tags: [],
    isReconciled: false, createdAt: new Date(), updatedAt: new Date(), isDeleted: false
  };

  const initialState: Partial<AppState> = {
    transactions: { ...initialTransactionState, pagination: { page: 1, limit: 10, total: 0, totalPages: 0} },
    auth: { user: { firstName: 'Test', _id: 'testUser' } } as any, // Mock auth state if user$ is used
  };

  beforeEach(async () => {
    mockRouter = { navigate: jest.fn() };
    mockMatDialog = { open: jest.fn() };
    mockTransactionService = {
      getTransactions: jest.fn().mockReturnValue(of({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 })), // For loadSearchSuggestions
      // Add other methods if called directly by component (should be rare with NgRx)
    };
    mockLiveAnnouncer = { announce: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [
        TransactionListComponent, // Standalone
        NoopAnimationsModule,
        ReactiveFormsModule,
        MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule,
        MatCheckboxModule, MatTableModule, MatPaginatorModule, MatSortModule, MatIconModule, MatButtonModule,
        MatMenuModule, MatProgressBarModule
      ],
      providers: [
        FormBuilder,
        provideMockStore({ initialState }),
        { provide: Router, useValue: mockRouter },
        { provide: MatDialog, useValue: mockMatDialog },
        { provide: MatSnackBar, useValue: { open: jest.fn() } }, // MatSnackBar is used in component
        { provide: TransactionService, useValue: mockTransactionService }, // For non-NgRx calls
        { provide: AccessibilityService, useClass: MockAccessibilityService },
        { provide: LiveAnnouncer, useValue: mockLiveAnnouncer },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionListComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    jest.spyOn(store, 'dispatch'); // Spy on dispatch after store is injected
    fixture.detectChanges(); // Trigger ngOnInit
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should dispatch loadTransactions on ngOnInit if authenticated', () => {
    // Assuming default initialState has isAuthenticated = true or user exists
    // If not, you might need to override auth selectors for this test
    expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.loadTransactions({
      filters: component.currentFilters, // or initial filters
      page: component.currentPage,
      limit: component.pageSize
    }));
  });

  it('should update dataSource when transactions$ emits', () => {
    const transactions = [mockTransaction];
    store.overrideSelector(getAllTransactions, transactions);
    store.refreshState();
    fixture.detectChanges();
    expect(component.dataSource.data).toEqual(transactions);
  });

  it('should set isLoading from isLoading$ selector', () => {
    store.overrideSelector(getTransactionLoading, true);
    store.refreshState();
    fixture.detectChanges();
    component.isLoading$.subscribe(loading => expect(loading).toBe(true));
  });

  it('should display error from error$ selector', () => {
    const error = { message: 'Failed to load' };
    store.overrideSelector(getTransactionError, error);
    store.refreshState();
    fixture.detectChanges();
    component.error$.subscribe(err => expect(err).toEqual(error));
    expect(mockLiveAnnouncer.announce).toHaveBeenCalledWith(`Error: ${error.message}`, 'assertive');
  });

  describe('Filter Logic', () => {
    it('applyAdvancedFilters should dispatch updateTransactionFilters and loadTransactions', () => {
      component.filterForm.setValue({ // Set some filter values
        searchTerm: 'test', dateRange: 'thisMonth', startDate: null, endDate: null,
        categories: [], types: [], paymentMethods: [], status: [],
        minAmount: null, maxAmount: null, tags: '', hasAttachments: null, isRecurring: null
      });
      component.applyAdvancedFilters();
      expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.updateTransactionFilters({ filters: component.currentFilters as any }));
      expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.loadTransactions({
        filters: component.currentFilters,
        page: 1, // Should reset to page 1
        limit: component.pageSize
      }));
    });

    it('clearFilters should dispatch updateTransactionFilters with null and loadTransactions', () => {
      component.clearFilters();
      expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.updateTransactionFilters({ filters: null }));
      expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.loadTransactions({
        filters: null,
        page: 1,
        limit: component.pageSize
      }));
      expect(mockLiveAnnouncer.announce).toHaveBeenCalledWith('Filters cleared. Loading all transactions.', 'polite');
    });
  });

  describe('Pagination and Scrolling', () => {
    it('loadMoreTransactions should dispatch loadTransactions with next page', () => {
      component.currentPage = 1;
      component.totalTransactions = 30; // Assume more data is available
      component.dataSource = new MatTableDataSource([mockTransaction]); // Simulate some data loaded
      component.isScrollLoading = false;

      component.loadMoreTransactions();

      expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.loadTransactions({
        filters: component.currentFilters,
        page: 2,
        limit: component.pageSize
      }));
    });

    // Test for MatPaginator integration if used with store (this component seems to use virtual scroll primarily)
    // it('MatPaginator page event should dispatch loadTransactions', () => {
    //   const paginator = component.paginator; // Assuming @ViewChild(MatPaginator) paginator: MatPaginator;
    //   paginator.page.emit({ pageIndex: 2, pageSize: 25, length: 100 });
    //   expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.loadTransactions(
    //     { filters: component.currentFilters, page: 3, limit: 25 } // pageIndex is 0-based
    //   ));
    // });
  });

  it('deleteTransaction should dispatch deleteTransaction action', () => {
    window.confirm = jest.fn(() => true); // Mock confirm dialog
    component.deleteTransaction(mockTransaction);
    expect(mockLiveAnnouncer.announce).toHaveBeenCalledWith(`Attempting to delete transaction: ${mockTransaction.description}.`, 'polite');
    expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.deleteTransaction({ transactionId: mockTransaction._id }));
  });

  it('editTransaction should dispatch selectTransaction and navigate', () => {
    component.editTransaction(mockTransaction);
    expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.selectTransaction({ transactionId: mockTransaction._id }));
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/transactions/edit', mockTransaction._id]);
  });

  it('addTransaction should dispatch clearSelectedTransaction and navigate', () => {
    component.addTransaction();
    expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.clearSelectedTransaction());
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/transactions/new']);
  });

  // exportTransactions and bulk operations would require more complex mocking of services or file system if tested deeply.
  // For now, test if actions are dispatched for bulk delete.
  it('bulkDeleteTransactions should dispatch deleteTransaction for selected items', () => {
    window.confirm = jest.fn(() => true);
    component.selection.select(mockTransaction, { ...mockTransaction, _id: '2' }); // Select two items
    component.bulkDeleteTransactions([mockTransaction, { ...mockTransaction, _id: '2' }]);

    expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.deleteTransaction({ transactionId: '1' }));
    expect(store.dispatch).toHaveBeenCalledWith(TransactionActions.deleteTransaction({ transactionId: '2' }));
    expect(mockLiveAnnouncer.announce).toHaveBeenCalledWith('Attempting to delete 2 selected transactions.', 'polite');
  });

});
