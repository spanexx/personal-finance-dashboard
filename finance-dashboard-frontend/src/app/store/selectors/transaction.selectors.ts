import { createFeatureSelector, createSelector } from '@ngrx/store';
import { TransactionState, Pagination } from '../state/transaction.state';
import { transactionFeatureKey } from '../reducers/transaction.reducer'; // Import key

// Feature selector for the transaction state
export const selectTransactionState = createFeatureSelector<TransactionState>(transactionFeatureKey);

export const getAllTransactions = createSelector(
  selectTransactionState,
  (state: TransactionState) => state.transactions
);

export const getSelectedTransaction = createSelector(
  selectTransactionState,
  (state: TransactionState) => state.selectedTransaction
);

export const getTransactionLoading = createSelector(
  selectTransactionState,
  (state: TransactionState) => state.loading
);

export const getTransactionError = createSelector(
  selectTransactionState,
  (state: TransactionState) => state.error
);

export const getTransactionPagination = createSelector(
  selectTransactionState,
  (state: TransactionState): Pagination | null => state.pagination // Explicitly type return
);

export const getTransactionFilters = createSelector(
  selectTransactionState,
  (state: TransactionState) => state.filters
);

// Example of a more complex selector: get transactions for a specific account
// export const getTransactionsByAccountId = (accountId: string) =>
//   createSelector(getAllTransactions, (transactions) =>
//     transactions.filter((transaction) => transaction.accountId === accountId) // Assuming accountId exists on Transaction
//   );

// Selector for total transactions count from pagination
export const getTotalTransactionsCount = createSelector(
    selectTransactionState,
    (state: TransactionState) => state.pagination?.total || 0
);
