import { transactionReducer, initialTransactionState, TransactionState } from './transaction.reducer';
import * as TransactionActions from '../actions/transaction.actions';
import { Transaction, TransactionFilters, CreateTransactionRequest, UpdateTransactionRequest } from '../../shared/models/transaction.model';
import { Pagination } from '../state/transaction.state';

describe('Transaction Reducer', () => {
  // Mock Data
  const mockTransaction1: Transaction = {
    _id: '1', user: 'u1', amount: 10, description: 't1', category: 'c1', type: 'expense', date: new Date(),
    paymentMethod: 'cash', status: 'completed', attachments: [], tags: [], isReconciled: false, isDeleted: false,
    createdAt: new Date(), updatedAt: new Date()
  };
  const mockTransaction2: Transaction = {
    _id: '2', user: 'u1', amount: 20, description: 't2', category: 'c2', type: 'income', date: new Date(),
    paymentMethod: 'cash', status: 'completed', attachments: [], tags: [], isReconciled: false, isDeleted: false,
    createdAt: new Date(), updatedAt: new Date()
   };

  const mockInitialState: TransactionState = {
    ...initialTransactionState,
    transactions: [mockTransaction1],
    selectedTransaction: mockTransaction1,
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    filters: { type: 'expense' }
  };

  const mockError = { message: 'Test Error' };
  const mockPagination: Pagination = { page: 1, limit: 10, total: 2, totalPages: 1 };


  it('should return the initial state', () => {
    const action = {} as any;
    const state = transactionReducer(undefined, action);
    expect(state).toBe(initialTransactionState);
  });

  describe('Load Transactions Actions', () => {
    it('should set loading to true and store filters on loadTransactions', () => {
      const filters: TransactionFilters = { type: 'income' };
      const action = TransactionActions.loadTransactions({ filters, page: 1, limit: 10 });
      const state = transactionReducer(initialTransactionState, action);

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
      expect(state.filters).toEqual(filters);
      expect(state.pagination?.page).toBe(1);
      expect(state.pagination?.limit).toBe(10);
    });

    it('should store transactions and pagination on loadTransactionsSuccess', () => {
      const action = TransactionActions.loadTransactionsSuccess({ transactions: [mockTransaction1, mockTransaction2], pagination: mockPagination });
      const state = transactionReducer({ ...initialTransactionState, loading: true }, action);

      expect(state.loading).toBe(false);
      expect(state.transactions.length).toBe(2);
      expect(state.transactions[1]).toEqual(mockTransaction2);
      expect(state.pagination).toEqual(mockPagination);
    });

    it('should store error on loadTransactionsFailure', () => {
      const action = TransactionActions.loadTransactionsFailure({ error: mockError });
      const state = transactionReducer({ ...initialTransactionState, loading: true }, action);

      expect(state.loading).toBe(false);
      expect(state.error).toEqual(mockError);
    });
  });

  describe('Load Single Transaction Actions', () => {
    it('should set loading to true and clear selectedTransaction on loadTransaction', () => {
      const action = TransactionActions.loadTransaction({ transactionId: '1' });
      const state = transactionReducer(mockInitialState, action); // Use mockInitialState that has a selected transaction

      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
      expect(state.selectedTransaction).toBeNull();
    });

    it('should store selected transaction on loadTransactionSuccess', () => {
      const action = TransactionActions.loadTransactionSuccess({ transaction: mockTransaction2 });
      const state = transactionReducer({ ...initialTransactionState, loading: true }, action);

      expect(state.loading).toBe(false);
      expect(state.selectedTransaction).toEqual(mockTransaction2);
    });

    it('should store error on loadTransactionFailure', () => {
      const action = TransactionActions.loadTransactionFailure({ error: mockError });
      const state = transactionReducer({ ...initialTransactionState, loading: true }, action);

      expect(state.loading).toBe(false);
      expect(state.error).toEqual(mockError);
    });
  });

  describe('Create Transaction Actions', () => {
    it('should set loading to true on createTransaction', () => {
      const createDto: CreateTransactionRequest = { amount: 1, description: 'd', category: 'c', type: 'expense', date: new Date(), paymentMethod: 'cash' };
      const action = TransactionActions.createTransaction({ transaction: createDto });
      const state = transactionReducer(initialTransactionState, action);
      expect(state.loading).toBe(true);
    });

    it('should add transaction to list on createTransactionSuccess', () => {
      const action = TransactionActions.createTransactionSuccess({ transaction: mockTransaction2 });
      const state = transactionReducer({ ...initialTransactionState, transactions: [mockTransaction1], loading: true }, action);

      expect(state.loading).toBe(false);
      expect(state.transactions.length).toBe(2);
      expect(state.transactions.find(t => t._id === '2')).toEqual(mockTransaction2);
      expect(state.pagination?.total).toBe(initialTransactionState.pagination!.total + 1); // Check pagination update
    });
  });

  describe('Update Transaction Actions', () => {
    it('should update transaction in list on updateTransactionSuccess', () => {
      const updatedTransaction = { ...mockTransaction1, description: 'Updated' };
      const action = TransactionActions.updateTransactionSuccess({ transaction: updatedTransaction });
      const state = transactionReducer(mockInitialState, action);

      expect(state.loading).toBe(false);
      const found = state.transactions.find(t => t._id === mockTransaction1._id);
      expect(found?.description).toBe('Updated');
      expect(state.selectedTransaction?.description).toBe('Updated'); // If it was selected
    });
  });

  describe('Delete Transaction Actions', () => {
    it('should remove transaction from list on deleteTransactionSuccess', () => {
      const action = TransactionActions.deleteTransactionSuccess({ transactionId: mockTransaction1._id });
      const state = transactionReducer(mockInitialState, action);

      expect(state.loading).toBe(false);
      expect(state.transactions.find(t => t._id === mockTransaction1._id)).toBeUndefined();
      expect(state.selectedTransaction).toBeNull(); // If it was selected
      expect(state.pagination?.total).toBe(mockInitialState.pagination!.total - 1);
    });
  });

  describe('Filter and Select Actions', () => {
    it('should update filters on updateTransactionFilters', () => {
      const newFilters: TransactionFilters = { type: 'income', maxAmount: 100 };
      const action = TransactionActions.updateTransactionFilters({ filters: newFilters });
      const state = transactionReducer(initialTransactionState, action);

      expect(state.filters).toEqual(newFilters);
      expect(state.pagination?.page).toBe(1); // Page should reset
    });

    it('should select transaction by ID on selectTransaction', () => {
      const stateWithTransactions = { ...initialTransactionState, transactions: [mockTransaction1, mockTransaction2] };
      const action = TransactionActions.selectTransaction({ transactionId: mockTransaction2._id });
      const state = transactionReducer(stateWithTransactions, action);
      expect(state.selectedTransaction).toEqual(mockTransaction2);
    });

    it('should clear selectedTransaction on selectTransaction with null ID', () => {
      const action = TransactionActions.selectTransaction({ transactionId: null });
      const state = transactionReducer(mockInitialState, action); // mockInitialState has a selected transaction
      expect(state.selectedTransaction).toBeNull();
    });

    it('should clear selectedTransaction on clearSelectedTransaction', () => {
      const action = TransactionActions.clearSelectedTransaction();
      const state = transactionReducer(mockInitialState, action);
      expect(state.selectedTransaction).toBeNull();
    });
  });

  it('should set loading on setTransactionLoading', () => {
    const action = TransactionActions.setTransactionLoading({ loading: true });
    const state = transactionReducer(initialTransactionState, action);
    expect(state.loading).toBe(true);
  });
});
