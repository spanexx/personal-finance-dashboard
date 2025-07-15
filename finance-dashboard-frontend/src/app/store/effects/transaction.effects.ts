import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap, switchMap, withLatestFrom } from 'rxjs/operators';
import { Store } from '@ngrx/store';

import * as TransactionActions from '../actions/transaction.actions';
import { TransactionService } from '../../core/services/transaction.service'; // Adjusted path
import { Transaction, CreateTransactionRequest, UpdateTransactionRequest } from '../../shared/models/transaction.model';
import { AppState } from '../state/app.state';
import { getTransactionFilters, getTransactionPagination } from '../selectors/transaction.selectors';
import { Pagination } from '../state/transaction.state'; // Corrected import syntax
import { PaginatedResponse } from '../../core/services/api.service'; // Import PaginatedResponse

// Remove TransactionsApiResponse as PaginatedResponse<Transaction> will be used
// interface TransactionsApiResponse {
//   data: Transaction[];
//   page: number;
//   limit: number;
//   total: number;
//   totalPages: number;
// }

@Injectable()
export class TransactionEffects {
  constructor(
    private actions$: Actions,
    private transactionService: TransactionService,
    private store: Store<AppState> // Inject store to access current state if necessary
  ) {}

  loadTransactions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.loadTransactions),
      switchMap(({ filters, page, limit }) => {
        const queryParams: any = { page, limit };
        if (filters) {
          Object.keys(filters).forEach(key => {
            const filterKey = key as keyof typeof filters;
            if (filters[filterKey] !== undefined && filters[filterKey] !== null && filters[filterKey] !== '') {
              queryParams[filterKey] = filters[filterKey];
            }
          });
        }
        // Use PaginatedResponse<Transaction> as the expected return type
        return this.transactionService.getTransactions(filters || undefined, { page, limit }).pipe(
          map((response: PaginatedResponse<Transaction>) => {
            // Handle pagination from the transformed response (HttpClientService already processed it)
            let p = response.pagination;
            
            // Fallback to meta.pagination if transformation didn't work
            if (!p && (response as any).meta && (response as any).meta.pagination) {
              p = (response as any).meta.pagination;
            }
            
            const resultPagination = {
              page: p?.page || (p as any)?.currentPage || 1,
              limit: p?.limit || limit, // Use requested limit if response doesn't have it
              total: p?.total || (p as any)?.totalCount || 0,
              totalPages: p?.totalPages || 1,
            };
            
            return TransactionActions.loadTransactionsSuccess({
              transactions: response.data,
              pagination: resultPagination,
            });
          }),
          catchError((error) =>
            of(TransactionActions.loadTransactionsFailure({ error: error.error || error }))
          )
        );
      })
    )
  );

  loadTransaction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.loadTransaction),
      mergeMap(({ transactionId }) => {// transactionId comes from the action payload
        console.log('Effect: Loading transaction with ID:', transactionId); // Debug log
        return this.transactionService.getTransaction(transactionId).pipe( // Changed to getTransaction
          map((transactionData: any) => {
            console.log('Effect: Transaction data received from service:', transactionData); // Debug log
            // Handle both wrapped and unwrapped transaction data from service
            const actualTransaction = transactionData?.transaction || transactionData;
            console.log('Effect: Extracted transaction for state:', actualTransaction); // Debug log
            return TransactionActions.loadTransactionSuccess({ transaction: actualTransaction });
          }),
          catchError((error) => {
            console.error('Effect: Error loading transaction:', error); // Debug log
            return of(TransactionActions.loadTransactionFailure({ error: error.error || error }));
          })
        );
      })
    )
  );

  createTransaction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.createTransaction),
      mergeMap(({ transaction }) =>
        this.transactionService.createTransaction(transaction).pipe(
          map((newTransaction: Transaction) =>
            TransactionActions.createTransactionSuccess({ transaction: newTransaction })
          ),
          catchError((error) =>
            of(TransactionActions.createTransactionFailure({ error: error.error || error }))
          )
        )
      )
    )
  );

  updateTransaction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.updateTransaction),
      mergeMap(({ transactionId, transaction }) =>
        this.transactionService.updateTransaction(transactionId, transaction).pipe(
          map((updatedTransaction: Transaction) =>
            TransactionActions.updateTransactionSuccess({ transaction: updatedTransaction })
          ),
          catchError((error) =>
            of(TransactionActions.updateTransactionFailure({ error: error.error || error }))
          )
        )
      )
    )
  );

  deleteTransaction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.deleteTransaction),
      mergeMap(({ transactionId }) =>
        this.transactionService.deleteTransaction(transactionId).pipe(
          // Assuming backend returns the ID or a success message, not the full transaction object
          map(() =>
            TransactionActions.deleteTransactionSuccess({ transactionId })
          ),
          catchError((error) =>
            of(TransactionActions.deleteTransactionFailure({ error: error.error || error }))
          )
        )
      )
    )
  );

  // Optional: Effect to reload transactions after modification or filter change.
  // This helps keep the main list view consistent.
  // reloadTransactionsAfterModification$ = createEffect(() =>
  //   this.actions$.pipe(
  //     ofType(
  //       TransactionActions.createTransactionSuccess,
  //       TransactionActions.updateTransactionSuccess,
  //       TransactionActions.deleteTransactionSuccess,
  //       // TransactionActions.updateTransactionFilters // Consider if direct reload is always wanted
  //     ),
  //     withLatestFrom(
  //       this.store.select(getTransactionFilters),
  //       this.store.select(getTransactionPagination)
  //     ),
  //     switchMap(([action, filters, pagination]) => {
  //       // Use current filters and pagination for reloading
  //       // Ensure pagination is not null before accessing its properties
  //       const currentPage = pagination?.page || 1;
  //       const currentLimit = pagination?.limit || 10; // Default limit
  //       return of(TransactionActions.loadTransactions({ filters, page: currentPage, limit: currentLimit }));
  //     })
  //   )
  // );

  createMissingTransactions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.createMissingTransactions),
      mergeMap(({ startDate, endDate }) =>
        this.transactionService.createMissingTransactions(startDate, endDate).pipe(
          map((result: any) =>
            TransactionActions.createMissingTransactionsSuccess({ createdCount: result.createdCount })
          ),
          catchError((error) =>
            of(TransactionActions.createMissingTransactionsFailure({ error: error.error || error }))
          )
        )
      )
    )
  );
}
