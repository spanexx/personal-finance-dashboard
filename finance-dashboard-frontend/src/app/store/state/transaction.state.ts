import { Transaction, TransactionFilters } from '../../shared/models/transaction.model';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TransactionState {
  transactions: Transaction[];
  selectedTransaction: Transaction | null;
  loading: boolean;
  error: any | null;
  pagination: Pagination | null;
  filters: TransactionFilters | null;
}

export const initialTransactionState: TransactionState = {
  transactions: [],
  selectedTransaction: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10, // Default limit
    total: 0,
    totalPages: 0,
  },
  filters: null, // Or some default filters if applicable
};
