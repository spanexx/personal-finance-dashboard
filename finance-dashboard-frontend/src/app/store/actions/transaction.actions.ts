import { createAction, props } from '@ngrx/store';
import {
  Transaction,
  TransactionFilters,
  CreateTransactionRequest,
  UpdateTransactionRequest,
} from '../../shared/models/transaction.model';
import { Pagination } from '../state/transaction.state'; // Import Pagination

// Load Transactions Actions
export const loadTransactions = createAction(
  '[Transaction] Load Transactions',
  props<{ filters: TransactionFilters | null; page: number; limit: number }>()
);

export const loadTransactionsSuccess = createAction(
  '[Transaction] Load Transactions Success',
  props<{ transactions: Transaction[]; pagination: Pagination }>()
);

export const loadTransactionsFailure = createAction(
  '[Transaction] Load Transactions Failure',
  props<{ error: any }>()
);

// Load Single Transaction Actions
export const loadTransaction = createAction(
  '[Transaction] Load Transaction',
  props<{ transactionId: string }>()
);

export const loadTransactionSuccess = createAction(
  '[Transaction] Load Transaction Success',
  props<{ transaction: Transaction }>()
);

export const loadTransactionFailure = createAction(
  '[Transaction] Load Transaction Failure',
  props<{ error: any }>()
);

// Create Transaction Actions
export const createTransaction = createAction(
  '[Transaction] Create Transaction',
  props<{ transaction: CreateTransactionRequest }>() // Use CreateTransactionRequest
);

export const createTransactionSuccess = createAction(
  '[Transaction] Create Transaction Success',
  props<{ transaction: Transaction }>()
);

export const createTransactionFailure = createAction(
  '[Transaction] Create Transaction Failure',
  props<{ error: any }>()
);

// Update Transaction Actions
export const updateTransaction = createAction(
  '[Transaction] Update Transaction',
  props<{ transactionId: string; transaction: UpdateTransactionRequest }>() // Use UpdateTransactionRequest
);

export const updateTransactionSuccess = createAction(
  '[Transaction] Update Transaction Success',
  props<{ transaction: Transaction }>()
);

export const updateTransactionFailure = createAction(
  '[Transaction] Update Transaction Failure',
  props<{ error: any }>()
);

// Delete Transaction Actions
export const deleteTransaction = createAction(
  '[Transaction] Delete Transaction',
  props<{ transactionId: string }>()
);

export const deleteTransactionSuccess = createAction(
  '[Transaction] Delete Transaction Success',
  props<{ transactionId: string }>() // Return ID for easier removal from state
);

export const deleteTransactionFailure = createAction(
  '[Transaction] Delete Transaction Failure',
  props<{ error: any }>()
);

// Update Transaction Filters Action
export const updateTransactionFilters = createAction(
  '[Transaction] Update Transaction Filters',
  props<{ filters: TransactionFilters | null }>() // Allow null to reset filters
);

// Select Transaction Action
export const selectTransaction = createAction(
  '[Transaction] Select Transaction',
  props<{ transactionId: string | null }>()
);

// Clear selected transaction
export const clearSelectedTransaction = createAction(
  '[Transaction] Clear Selected Transaction'
);

// Action to set loading state explicitly if needed by UI components
export const setTransactionLoading = createAction(
  '[Transaction] Set Loading',
  props<{ loading: boolean }>()
);
