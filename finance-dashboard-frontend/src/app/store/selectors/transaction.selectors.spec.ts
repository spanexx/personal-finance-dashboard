import * as fromSelectors from './transaction.selectors';
import { TransactionState, initialTransactionState, Pagination } from '../state/transaction.state';
import { Transaction, TransactionFilters } from '../../shared/models/transaction.model';
import { AppState } from '../state/app.state'; // Assuming AppState structure

describe('Transaction Selectors', () => {
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

  const mockPagination: Pagination = { page: 1, limit: 10, total: 2, totalPages: 1 };
  const mockFilters: TransactionFilters = { type: 'expense' };
  const mockError = { message: 'Test Error' };

  const mockTransactionFeatureState: TransactionState = {
    transactions: [mockTransaction1, mockTransaction2],
    selectedTransaction: mockTransaction1,
    loading: false,
    error: mockError,
    pagination: mockPagination,
    filters: mockFilters,
  };

  // Mock AppState. 'transactions' should match the feature key used in store setup.
  const mockAppState: AppState = {
    transactions: mockTransactionFeatureState,
    // other feature states if AppState defines them
  } as AppState; // Cast as AppState if it has other required properties

  it('should select the transaction feature state', () => {
    const result = fromSelectors.selectTransactionState(mockAppState);
    expect(result).toEqual(mockTransactionFeatureState);
  });

  it('should select all transactions', () => {
    const result = fromSelectors.getAllTransactions(mockAppState);
    expect(result).toEqual([mockTransaction1, mockTransaction2]);
  });

  it('should select the selected transaction', () => {
    const result = fromSelectors.getSelectedTransaction(mockAppState);
    expect(result).toEqual(mockTransaction1);
  });

  it('should select transaction loading state', () => {
    const result = fromSelectors.getTransactionLoading(mockAppState);
    expect(result).toBe(false);
  });

  it('should select transaction error state', () => {
    const result = fromSelectors.getTransactionError(mockAppState);
    expect(result).toEqual(mockError);
  });

  it('should select transaction pagination state', () => {
    const result = fromSelectors.getTransactionPagination(mockAppState);
    expect(result).toEqual(mockPagination);
  });

  it('should select transaction filters state', () => {
    const result = fromSelectors.getTransactionFilters(mockAppState);
    expect(result).toEqual(mockFilters);
  });

  it('should select total transactions count from pagination', () => {
    const result = fromSelectors.getTotalTransactionsCount(mockAppState);
    expect(result).toBe(2); // total from mockPagination
  });

  it('should return 0 for total transactions if pagination is null', () => {
    const stateWithNullPagination: AppState = {
      ...mockAppState,
      transactions: { ...mockTransactionFeatureState, pagination: null }
    };
    const result = fromSelectors.getTotalTransactionsCount(stateWithNullPagination);
    expect(result).toBe(0);
  });
});
