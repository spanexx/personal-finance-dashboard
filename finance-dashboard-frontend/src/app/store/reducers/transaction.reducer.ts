import { Action, createReducer, on } from '@ngrx/store';
import { initialTransactionState, TransactionState, Pagination } from '../state/transaction.state';
import * as TransactionActions from '../actions/transaction.actions';

export const transactionFeatureKey = 'transactions'; // Recommended for feature state

export const transactionReducer = createReducer(
  initialTransactionState,

  // Load Transactions
  on(TransactionActions.loadTransactions, (state, { filters, page, limit }) => ({
    ...state,
    loading: true,
    error: null,
    filters: filters || null, // Store current filters
    pagination: { // Update pagination request details
        ...(state.pagination || initialTransactionState.pagination!), // Ensure pagination is not null
        page,
        limit,
    }
  })),
  on(TransactionActions.loadTransactionsSuccess, (state, { transactions, pagination }) => ({
    ...state,
    transactions,
    pagination,
    loading: false,
  })),
  on(TransactionActions.loadTransactionsFailure, (state, { error }) => ({
    ...state,
    error,
    loading: false,
  })),

  // Load Single Transaction
  on(TransactionActions.loadTransaction, (state) => ({
    ...state,
    selectedTransaction: null, // Clear previous before loading
    loading: true,
    error: null,
  })),
  on(TransactionActions.loadTransactionSuccess, (state, { transaction }) => ({
    ...state,
    selectedTransaction: transaction,
    loading: false,
  })),
  on(TransactionActions.loadTransactionFailure, (state, { error }) => ({
    ...state,
    error,
    loading: false,
  })),

  // Create Transaction
  on(TransactionActions.createTransaction, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(TransactionActions.createTransactionSuccess, (state, { transaction }) => {
    // Decide if you want to add to list or require a reload. Adding optimistically:
    const transactions = [...state.transactions, transaction];
    // Update total items in pagination if it exists
    const pagination = state.pagination ? { ...state.pagination, total: state.pagination.total + 1 } : null;
    return {
      ...state,
      transactions,
      pagination,
      loading: false,
    };
  }),
  on(TransactionActions.createTransactionFailure, (state, { error }) => ({
    ...state,
    error,
    loading: false,
  })),

  // Update Transaction
  on(TransactionActions.updateTransaction, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(TransactionActions.updateTransactionSuccess, (state, { transaction }) => ({
    ...state,
    transactions: state.transactions.map((t) =>
      t._id === transaction._id ? transaction : t // Use _id
    ),
    selectedTransaction: state.selectedTransaction?._id === transaction._id ? transaction : state.selectedTransaction,
    loading: false,
  })),
  on(TransactionActions.updateTransactionFailure, (state, { error }) => ({
    ...state,
    error,
    loading: false,
  })),

  // Delete Transaction
  on(TransactionActions.deleteTransaction, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(TransactionActions.deleteTransactionSuccess, (state, { transactionId }) => {
    const transactions = state.transactions.filter((t) => t._id !== transactionId); // Use _id
    // Update total items in pagination if it exists
    const pagination = state.pagination ? { ...state.pagination, total: state.pagination.total - 1 } : null;
    return {
        ...state,
        transactions,
        pagination,
        selectedTransaction: state.selectedTransaction?._id === transactionId ? null : state.selectedTransaction,
        loading: false,
    };
  }),
  on(TransactionActions.deleteTransactionFailure, (state, { error }) => ({
    ...state,
    error,
    loading: false,
  })),

  // Update Transaction Filters
  on(TransactionActions.updateTransactionFilters, (state, { filters }) => ({
    ...state,
    filters: filters || null,
    pagination: { // Reset to first page on filter change
      ...(state.pagination || initialTransactionState.pagination!),
      page: 1,
    }
  })),

  // Select Transaction
  on(TransactionActions.selectTransaction, (state, { transactionId }) => ({
    ...state,
    selectedTransaction: transactionId
      ? state.transactions.find((t) => t._id === transactionId) || null // Use _id
      : null,
  })),

  // Clear Selected Transaction
  on(TransactionActions.clearSelectedTransaction, (state) => ({
    ...state,
    selectedTransaction: null,
  })),

  // Set Loading
  on(TransactionActions.setTransactionLoading, (state, { loading }) => ({
    ...state,
    loading,
  }))
);

export function reducer(state: TransactionState | undefined, action: Action) {
  return transactionReducer(state, action);
}
