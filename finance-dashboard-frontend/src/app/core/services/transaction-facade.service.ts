import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { 
  Transaction, 
  TransactionFilters 
} from '../../shared/models/transaction.model';
import { AppState } from '../../store/state/app.state';
import * as TransactionActions from '../../store/actions/transaction.actions';
import { 
  getAllTransactions,
  getTransactionLoading,
  getTransactionError,
  getTransactionPagination,
  getTransactionFilters,
  getSelectedTransaction,
  getTotalTransactionsCount
} from '../../store/selectors/transaction.selectors';
import { Pagination } from '../../store/state/transaction.state';
import { catchError, map, shareReplay, take, tap } from 'rxjs/operators';

/**
 * Error types for transaction operations
 */
export enum TransactionErrorType {
  LOAD = 'LOAD_ERROR',
  CREATE = 'CREATE_ERROR',
  UPDATE = 'UPDATE_ERROR',
  DELETE = 'DELETE_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}

/**
 * Transaction Facade Service
 * 
 * This service acts as a facade between components and the NgRx store,
 * providing a simplified API for transaction-related operations.
 * It abstracts away the details of store dispatches and selections.
 * 
 * Enhancements:
 * - Error handling with typed errors
 * - Caching for frequently accessed data
 * - Selector factories for common data transformations
 */
@Injectable({
  providedIn: 'root'
})
export class TransactionFacadeService {
  // Cache for expensive selectors or frequently accessed data
  private transactionCache = new Map<string, any>();
  
  // Error handling
  private errorSubject = new BehaviorSubject<{ type: TransactionErrorType, message: string } | null>(null);
  public error$ = this.errorSubject.asObservable();

  // Enhanced selectors with caching
  private transactions$: Observable<Transaction[]> | null = null;
  private pagination$: Observable<Pagination | null> | null = null;
  
  constructor(private store: Store<AppState>) {
    // Subscribe to store errors to convert to typed errors
    this.store.select(getTransactionError)
      .subscribe(error => {
        if (error) {
          this.handleError(error);
        } else {
          this.clearError();
        }
      });
  }

  /**
   * Returns an observable of the transactions array with caching
   */
  getTransactions(): Observable<Transaction[]> {
    if (!this.transactions$) {
      this.transactions$ = this.store.select(getAllTransactions).pipe(
        shareReplay(1)
      );
    }
    return this.transactions$;
  }

  /**
   * Returns an observable of the loading state
   */
  isLoading(): Observable<boolean> {
    return this.store.select(getTransactionLoading);
  }

  /**
   * Returns an observable of any error state
   */
  getError(): Observable<any | null> {
    return this.store.select(getTransactionError);
  }

  /**
   * Returns an observable of the current pagination with caching
   */
  getPagination(): Observable<Pagination | null> {
    if (!this.pagination$) {
      this.pagination$ = this.store.select(getTransactionPagination).pipe(
        shareReplay(1)
      );
    }
    return this.pagination$;
  }

  /**
   * Returns an observable of the current filters
   */
  getFilters(): Observable<TransactionFilters | null> {
    return this.store.select(getTransactionFilters);
  }

  /**
   * Returns an observable of the total transaction count
   */
  getTotalCount(): Observable<number> {
    return this.store.select(getTotalTransactionsCount);
  }

  /**
   * Returns an observable of the selected transaction
   */
  getSelectedTransaction(): Observable<Transaction | null> {
    return this.store.select(getSelectedTransaction);
  }

  /**
   * Loads transactions with the provided filters and pagination
   * @param filters The filters to apply
   * @param page The page number
   * @param limit The number of items per page
   * @returns Observable of the operation result
   */
  loadTransactions(filters: TransactionFilters | null, page: number, limit: number): Observable<boolean> {
    // Reset cache when loading new transactions
    this.invalidateCache();
    
    try {
      this.store.dispatch(TransactionActions.loadTransactions({ 
        filters, 
        page, 
        limit 
      }));
      
      // Return observable that completes when loading is done
      return this.isLoading().pipe(
        take(1),
        map(() => true),
        catchError(error => {
          this.handleError(error, TransactionErrorType.LOAD);
          return of(false);
        })
      );
    } catch (error: any) {
      this.handleError(error, TransactionErrorType.LOAD);
      return of(false);
    }
  }

  /**
   * Updates the transaction filters
   */
  updateFilters(filters: TransactionFilters | null): void {
    // Clear cache when filters change
    this.invalidateCache();
    
    this.store.dispatch(TransactionActions.updateTransactionFilters({ filters }));
  }

  /**
   * Selects a transaction by ID
   */
  selectTransaction(transactionId: string | null): void {
    this.store.dispatch(TransactionActions.selectTransaction({ transactionId }));
  }

  /**
   * Clears the selected transaction
   */
  clearSelectedTransaction(): void {
    this.store.dispatch(TransactionActions.clearSelectedTransaction());
  }

  /**
   * Deletes a transaction with enhanced error handling
   * @param transactionId The ID of the transaction to delete
   * @returns Observable of the operation result
   */
  deleteTransaction(transactionId: string): Observable<boolean> {
    try {
      this.store.dispatch(TransactionActions.deleteTransaction({ transactionId }));
      
      // Return observable that completes when deletion is done
      return this.isLoading().pipe(
        take(1),
        map(() => true),
        catchError(error => {
          this.handleError(error, TransactionErrorType.DELETE);
          return of(false);
        })
      );
    } catch (error: any) {
      this.handleError(error, TransactionErrorType.DELETE);
      return of(false);
    }
  }

  /**
   * Sets the loading state manually if needed
   */
  setLoading(loading: boolean): void {
    this.store.dispatch(TransactionActions.setTransactionLoading({ loading }));
  }

  /**
   * Selector factory: Get transactions filtered by category
   * @param categoryId The category ID to filter by
   * @returns Observable of transactions with the specified category
   */
  getTransactionsByCategory(categoryId: string): Observable<Transaction[]> {
    const cacheKey = `transactions_by_category_${categoryId}`;
    
    if (this.transactionCache.has(cacheKey)) {
      return of(this.transactionCache.get(cacheKey));
    }
    
    return this.getTransactions().pipe(
      map(transactions => transactions.filter(tx => {
        // Handle both object with _id and direct string reference
        if (typeof tx.category === 'object' && tx.category !== null) {
          // Safely access _id with type checking
          return (tx.category as {_id?: string})._id === categoryId;
        } else {
          return tx.category === categoryId;
        }
      })),
      tap(result => this.transactionCache.set(cacheKey, result))
    );
  }

  /**
   * Selector factory: Get transactions for a specific date range
   * @param startDate The start date
   * @param endDate The end date
   * @returns Observable of transactions within the date range
   */
  getTransactionsByDateRange(startDate: Date, endDate: Date): Observable<Transaction[]> {
    const cacheKey = `transactions_by_date_${startDate.toISOString()}_${endDate.toISOString()}`;
    
    if (this.transactionCache.has(cacheKey)) {
      return of(this.transactionCache.get(cacheKey));
    }
    
    return this.getTransactions().pipe(
      map(transactions => transactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= startDate && txDate <= endDate;
      })),
      tap(result => this.transactionCache.set(cacheKey, result))
    );
  }

  /**
   * Selector factory: Get transactions by type (income/expense)
   * @param type The transaction type ('income' or 'expense')
   * @returns Observable of transactions of the specified type
   */
  getTransactionsByType(type: 'income' | 'expense'): Observable<Transaction[]> {
    const cacheKey = `transactions_by_type_${type}`;
    
    if (this.transactionCache.has(cacheKey)) {
      return of(this.transactionCache.get(cacheKey));
    }
    
    return this.getTransactions().pipe(
      map(transactions => transactions.filter(tx => tx.type === type)),
      tap(result => this.transactionCache.set(cacheKey, result))
    );
  }

  /**
   * Get transactions with a specific tag
   * @param tag The tag to filter by
   * @returns Observable of transactions with the specified tag
   */
  getTransactionsByTag(tag: string): Observable<Transaction[]> {
    const cacheKey = `transactions_by_tag_${tag}`;
    
    if (this.transactionCache.has(cacheKey)) {
      return of(this.transactionCache.get(cacheKey));
    }
    
    return this.getTransactions().pipe(
      map(transactions => transactions.filter(tx => tx.tags?.includes(tag))),
      tap(result => this.transactionCache.set(cacheKey, result))
    );
  }

  /**
   * Clear the error state
   */
  clearError(): void {
    this.errorSubject.next(null);
  }

  /**
   * Handle an error with specific error type
   * @param error The error object
   * @param type The type of error
   */
  private handleError(error: any, type: TransactionErrorType = TransactionErrorType.UNKNOWN): void {
    const errorMessage = this.extractErrorMessage(error);
    this.errorSubject.next({ type, message: errorMessage });
    console.error(`Transaction Error (${type}):`, error);
  }

  /**
   * Extract a user-friendly error message from various error formats
   * @param error The error object
   * @returns A user-friendly error message
   */
  extractErrorMessage(error: any): string {
    if (!error) return 'Unknown error occurred';
    
    if (typeof error === 'string') return error;
    
    if (error.message) return error.message;
    
    if (error.error) {
      if (typeof error.error === 'string') return error.error;
      if (error.error.message) return error.error.message;
    }
    
    return 'An unexpected error occurred';
  }

  /**
   * Invalidate the cache by clearing all cached data
   * This should be called whenever the transaction data is modified
   */
  invalidateCache(): void {
    this.transactionCache.clear();
    this.transactions$ = null;
    this.pagination$ = null;
  }
}
