import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Observable, of, throwError } from 'rxjs';
import { hot, cold } from 'jasmine-marbles'; // Or 'jest-marbles' if using that

import { TransactionEffects } from './transaction.effects';
import * as TransactionActions from '../actions/transaction.actions';
import { TransactionService } from '../../core/services/transaction.service';
import { Transaction, CreateTransactionRequest, UpdateTransactionRequest, TransactionFilters } from '../../shared/models/transaction.model';
import { Pagination } from '../state/transaction.state';
import { StoreModule, Store } from '@ngrx/store'; // Import Store for withLatestFrom
import { AppState } from '../state/app.state';     // Import AppState
import { initialTransactionState, transactionReducer } from '../reducers/transaction.reducer'; // Import reducer for initial state if needed

describe('TransactionEffects', () => {
  let actions$: Observable<any>;
  let effects: TransactionEffects;
  let transactionServiceMock: any;
  let store: Store<AppState>; // For withLatestFrom tests

  // Mock Data
  const mockTransaction1: Transaction = {
    _id: '1', user: 'u1', amount: 10, description: 't1', category: 'c1', type: 'expense', date: new Date(),
    paymentMethod: 'cash', status: 'completed', attachments: [], tags: [], isReconciled: false, isDeleted: false,
    createdAt: new Date(), updatedAt: new Date()
  };
   const mockPaginatedResponse = {
    data: [mockTransaction1],
    page: 1,
    limit: 10,
    totalItems: 1, // Matches PaginatedResponse from api.service.ts
    totalPages: 1,
  };
  const mockPaginationState: Pagination = { // Matches state/transaction.state.ts
    page: 1,
    limit: 10,
    total: 1, // Mapped from totalItems
    totalPages: 1,
  };
  const mockError = { message: 'Test Error', error: { message: 'Detailed error' } }; // Mock HttpErrorResponse like structure
  const mockCreateDto: CreateTransactionRequest = {
    amount: 50, description: 'New', category: 'c2', type: 'expense', date: new Date(), paymentMethod: 'cash'
  };
  const mockUpdateDto: UpdateTransactionRequest = { description: 'Updated' };


  beforeEach(() => {
    transactionServiceMock = {
      getTransactions: jest.fn(),
      getTransaction: jest.fn(), // Changed from getTransactionById
      createTransaction: jest.fn(),
      updateTransaction: jest.fn(),
      deleteTransaction: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [
        StoreModule.forRoot({}), // Basic store setup
        StoreModule.forFeature('transactions', transactionReducer) // If selectors are used with store
      ],
      providers: [
        TransactionEffects,
        provideMockActions(() => actions$),
        { provide: TransactionService, useValue: transactionServiceMock },
        // Store can be injected directly if needed for withLatestFrom, or use provideMockStore
      ],
    });

    effects = TestBed.inject(TransactionEffects);
    store = TestBed.inject(Store); // Inject store if testing effects with withLatestFrom
  });

  describe('loadTransactions$', () => {
    it('should return loadTransactionsSuccess on successful API call', () => {
      const action = TransactionActions.loadTransactions({ filters: null, page: 1, limit: 10 });
      const completion = TransactionActions.loadTransactionsSuccess({
        transactions: mockPaginatedResponse.data,
        pagination: { ...mockPaginationState, total: mockPaginatedResponse.totalItems }
      });

      actions$ = hot('-a', { a: action });
      const response = cold('-b|', { b: mockPaginatedResponse });
      transactionServiceMock.getTransactions.mockReturnValue(response);
      const expected = cold('--c', { c: completion });

      expect(effects.loadTransactions$).toBeObservable(expected);
    });

    it('should return loadTransactionsFailure on API error', () => {
      const action = TransactionActions.loadTransactions({ filters: null, page: 1, limit: 10 });
      const completion = TransactionActions.loadTransactionsFailure({ error: mockError.error || mockError });

      actions$ = hot('-a', { a: action });
      const response = cold('-#|', {}, mockError);
      transactionServiceMock.getTransactions.mockReturnValue(response);
      const expected = cold('--c', { c: completion });

      expect(effects.loadTransactions$).toBeObservable(expected);
    });
  });

  describe('loadTransaction$', () => {
    it('should return loadTransactionSuccess on successful API call', () => {
      const action = TransactionActions.loadTransaction({ transactionId: '1' });
      const completion = TransactionActions.loadTransactionSuccess({ transaction: mockTransaction1 });

      actions$ = hot('-a', { a: action });
      const response = cold('-b|', { b: mockTransaction1 });
      transactionServiceMock.getTransaction.mockReturnValue(response); // Changed to getTransaction
      const expected = cold('--c', { c: completion });

      expect(effects.loadTransaction$).toBeObservable(expected);
    });

    it('should return loadTransactionFailure if budget not found (service returns null/undefined)', () => {
      const action = TransactionActions.loadTransaction({ transactionId: '1' });
      const completion = TransactionActions.loadTransactionFailure({ error: 'Transaction not found' }); // As per effect logic

      actions$ = hot('-a', { a: action });
      const response = cold('-b|', { b: null }); // Simulate service returning null
      transactionServiceMock.getTransaction.mockReturnValue(response);
      const expected = cold('--c', { c: completion });

      expect(effects.loadTransaction$).toBeObservable(expected);
    });

    it('should return loadTransactionFailure on API error', () => {
      const action = TransactionActions.loadTransaction({ transactionId: '1' });
      const completion = TransactionActions.loadTransactionFailure({ error: mockError.error || mockError });

      actions$ = hot('-a', { a: action });
      const response = cold('-#|', {}, mockError);
      transactionServiceMock.getTransaction.mockReturnValue(response);
      const expected = cold('--c', { c: completion });

      expect(effects.loadTransaction$).toBeObservable(expected);
    });
  });

  describe('createTransaction$', () => {
    it('should return createTransactionSuccess on successful API call', () => {
      const action = TransactionActions.createTransaction({ transaction: mockCreateDto });
      const completion = TransactionActions.createTransactionSuccess({ transaction: mockTransaction1 });

      actions$ = hot('-a', { a: action });
      const response = cold('-b|', { b: mockTransaction1 });
      transactionServiceMock.createTransaction.mockReturnValue(response);
      const expected = cold('--c', { c: completion });

      expect(effects.createTransaction$).toBeObservable(expected);
    });

    it('should return createTransactionFailure on API error', () => {
      const action = TransactionActions.createTransaction({ transaction: mockCreateDto });
      const completion = TransactionActions.createTransactionFailure({ error: mockError.error || mockError });

      actions$ = hot('-a', { a: action });
      const response = cold('-#|', {}, mockError);
      transactionServiceMock.createTransaction.mockReturnValue(response);
      const expected = cold('--c', { c: completion });

      expect(effects.createTransaction$).toBeObservable(expected);
    });
  });

  describe('updateTransaction$', () => {
    it('should return updateTransactionSuccess on successful API call', () => {
      const action = TransactionActions.updateTransaction({ transactionId: '1', transaction: mockUpdateDto });
      const completion = TransactionActions.updateTransactionSuccess({ transaction: mockTransaction1 });

      actions$ = hot('-a', { a: action });
      const response = cold('-b|', { b: mockTransaction1 });
      transactionServiceMock.updateTransaction.mockReturnValue(response);
      const expected = cold('--c', { c: completion });

      expect(effects.updateTransaction$).toBeObservable(expected);
    });

     it('should return updateTransactionFailure if budget not found (service returns null/undefined)', () => {
      const action = TransactionActions.updateTransaction({ transactionId: '1', transaction: mockUpdateDto });
      const completion = TransactionActions.updateTransactionFailure({ error: 'Transaction not found after update' });

      actions$ = hot('-a', { a: action });
      const response = cold('-b|', { b: null });
      transactionServiceMock.updateTransaction.mockReturnValue(response);
      const expected = cold('--c', { c: completion });

      expect(effects.updateTransaction$).toBeObservable(expected);
    });

    it('should return updateTransactionFailure on API error', () => {
      const action = TransactionActions.updateTransaction({ transactionId: '1', transaction: mockUpdateDto });
      const completion = TransactionActions.updateTransactionFailure({ error: mockError.error || mockError });

      actions$ = hot('-a', { a: action });
      const response = cold('-#|', {}, mockError);
      transactionServiceMock.updateTransaction.mockReturnValue(response);
      const expected = cold('--c', { c: completion });

      expect(effects.updateTransaction$).toBeObservable(expected);
    });
  });

  describe('deleteTransaction$', () => {
    it('should return deleteTransactionSuccess on successful API call', () => {
      const action = TransactionActions.deleteTransaction({ transactionId: '1' });
      const completion = TransactionActions.deleteTransactionSuccess({ transactionId: '1' });

      actions$ = hot('-a', { a: action });
      const response = cold('-b|', { b: undefined }); // Service returns void/undefined on success
      transactionServiceMock.deleteTransaction.mockReturnValue(response);
      const expected = cold('--c', { c: completion });

      expect(effects.deleteTransaction$).toBeObservable(expected);
    });

    it('should return deleteTransactionFailure on API error', () => {
      const action = TransactionActions.deleteTransaction({ transactionId: '1' });
      const completion = TransactionActions.deleteTransactionFailure({ error: mockError.error || mockError });

      actions$ = hot('-a', { a: action });
      const response = cold('-#|', {}, mockError);
      transactionServiceMock.deleteTransaction.mockReturnValue(response);
      const expected = cold('--c', { c: completion });

      expect(effects.deleteTransaction$).toBeObservable(expected);
    });
  });
});
