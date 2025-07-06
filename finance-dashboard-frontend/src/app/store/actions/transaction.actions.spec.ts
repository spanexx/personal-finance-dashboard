import * as TransactionActions from './transaction.actions';
import { Transaction, CreateTransactionRequest, UpdateTransactionRequest, TransactionFilters } from '../../shared/models/transaction.model';
import { Pagination } from '../state/transaction.state'; // Assuming Pagination is defined here

describe('Transaction Actions', () => {
  // Mock Data
  const mockTransaction: Transaction = {
    _id: '1',
    user: 'user1',
    amount: 100,
    description: 'Test Transaction',
    category: 'cat1',
    type: 'expense',
    date: new Date(),
    paymentMethod: 'credit_card',
    attachments: [],
    tags: [],
    status: 'completed',
    isReconciled: false,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPagination: Pagination = {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  };

  const mockError = { message: 'Test Error' };
  const mockFilters: TransactionFilters = { type: 'expense' };
  const mockCreateDto: CreateTransactionRequest = {
    amount: 50,
    description: 'New Item',
    category: 'cat2',
    type: 'expense',
    date: new Date(),
    paymentMethod: 'cash'
  };
  const mockUpdateDto: UpdateTransactionRequest = { description: 'Updated Item' };

  // Load Transactions
  it('should create a loadTransactions action', () => {
    const action = TransactionActions.loadTransactions({ filters: mockFilters, page: 1, limit: 10 });
    expect(action.type).toBe('[Transaction] Load Transactions');
    expect(action.filters).toEqual(mockFilters);
    expect(action.page).toBe(1);
    expect(action.limit).toBe(10);
  });

  it('should create a loadTransactionsSuccess action', () => {
    const action = TransactionActions.loadTransactionsSuccess({ transactions: [mockTransaction], pagination: mockPagination });
    expect(action.type).toBe('[Transaction] Load Transactions Success');
    expect(action.transactions).toEqual([mockTransaction]);
    expect(action.pagination).toEqual(mockPagination);
  });

  it('should create a loadTransactionsFailure action', () => {
    const action = TransactionActions.loadTransactionsFailure({ error: mockError });
    expect(action.type).toBe('[Transaction] Load Transactions Failure');
    expect(action.error).toEqual(mockError);
  });

  // Load Single Transaction
  it('should create a loadTransaction action', () => {
    const action = TransactionActions.loadTransaction({ transactionId: '1' });
    expect(action.type).toBe('[Transaction] Load Transaction');
    expect(action.transactionId).toBe('1');
  });

  it('should create a loadTransactionSuccess action', () => {
    const action = TransactionActions.loadTransactionSuccess({ transaction: mockTransaction });
    expect(action.type).toBe('[Transaction] Load Transaction Success');
    expect(action.transaction).toEqual(mockTransaction);
  });

  it('should create a loadTransactionFailure action', () => {
    const action = TransactionActions.loadTransactionFailure({ error: mockError });
    expect(action.type).toBe('[Transaction] Load Transaction Failure');
    expect(action.error).toEqual(mockError);
  });

  // Create Transaction
  it('should create a createTransaction action', () => {
    const action = TransactionActions.createTransaction({ transaction: mockCreateDto });
    expect(action.type).toBe('[Transaction] Create Transaction');
    expect(action.transaction).toEqual(mockCreateDto);
  });

  it('should create a createTransactionSuccess action', () => {
    const action = TransactionActions.createTransactionSuccess({ transaction: mockTransaction });
    expect(action.type).toBe('[Transaction] Create Transaction Success');
    expect(action.transaction).toEqual(mockTransaction);
  });

  it('should create a createTransactionFailure action', () => {
    const action = TransactionActions.createTransactionFailure({ error: mockError });
    expect(action.type).toBe('[Transaction] Create Transaction Failure');
    expect(action.error).toEqual(mockError);
  });

  // Update Transaction
  it('should create an updateTransaction action', () => {
    const action = TransactionActions.updateTransaction({ transactionId: '1', transaction: mockUpdateDto });
    expect(action.type).toBe('[Transaction] Update Transaction');
    expect(action.transactionId).toBe('1');
    expect(action.transaction).toEqual(mockUpdateDto);
  });

  it('should create an updateTransactionSuccess action', () => {
    const action = TransactionActions.updateTransactionSuccess({ transaction: mockTransaction });
    expect(action.type).toBe('[Transaction] Update Transaction Success');
    expect(action.transaction).toEqual(mockTransaction);
  });

  it('should create an updateTransactionFailure action', () => {
    const action = TransactionActions.updateTransactionFailure({ error: mockError });
    expect(action.type).toBe('[Transaction] Update Transaction Failure');
    expect(action.error).toEqual(mockError);
  });

  // Delete Transaction
  it('should create a deleteTransaction action', () => {
    const action = TransactionActions.deleteTransaction({ transactionId: '1' });
    expect(action.type).toBe('[Transaction] Delete Transaction');
    expect(action.transactionId).toBe('1');
  });

  it('should create a deleteTransactionSuccess action', () => {
    const action = TransactionActions.deleteTransactionSuccess({ transactionId: '1' });
    expect(action.type).toBe('[Transaction] Delete Transaction Success');
    expect(action.transactionId).toBe('1');
  });

  it('should create a deleteTransactionFailure action', () => {
    const action = TransactionActions.deleteTransactionFailure({ error: mockError });
    expect(action.type).toBe('[Transaction] Delete Transaction Failure');
    expect(action.error).toEqual(mockError);
  });

  // Update Filters
  it('should create an updateTransactionFilters action', () => {
    const action = TransactionActions.updateTransactionFilters({ filters: mockFilters });
    expect(action.type).toBe('[Transaction] Update Transaction Filters');
    expect(action.filters).toEqual(mockFilters);
  });

  // Select Transaction
  it('should create a selectTransaction action with an ID', () => {
    const action = TransactionActions.selectTransaction({ transactionId: '1' });
    expect(action.type).toBe('[Transaction] Select Transaction');
    expect(action.transactionId).toBe('1');
  });

  it('should create a selectTransaction action with null', () => {
    const action = TransactionActions.selectTransaction({ transactionId: null });
    expect(action.type).toBe('[Transaction] Select Transaction');
    expect(action.transactionId).toBeNull();
  });

  // Clear Selected Transaction
  it('should create a clearSelectedTransaction action', () => {
    const action = TransactionActions.clearSelectedTransaction();
    expect(action.type).toBe('[Transaction] Clear Selected Transaction');
  });

  // Set Loading
  it('should create a setTransactionLoading action', () => {
    const action = TransactionActions.setTransactionLoading({ loading: true });
    expect(action.type).toBe('[Transaction] Set Loading');
    expect(action.loading).toBe(true);
  });
});
