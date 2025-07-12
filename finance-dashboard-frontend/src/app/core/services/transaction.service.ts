import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService, PaginationParams, FilterParams, PaginatedResponse } from './api.service';
import { ApiResponse } from './http-client.service';
import {
  Transaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TransactionFilters,
  TransactionSummary,
  BulkTransactionOperation,
  TransactionUploadResponse,
  TransactionAttachment,
  RecurringConfig,
  Location
} from '../../shared/models';

export interface TransactionAnalytics {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  transactionCount: number;
  averageTransaction: number;
  categoryBreakdown: {
    category: string;
    amount: number;
    percentage: number;
    count: number;
  }[];
  monthlyTrends: {
    month: string;
    income: number;
    expenses: number;
    net: number;
  }[];
  topMerchants: {
    name: string;
    amount: number;
    count: number;
  }[];
  spendingPatterns: {
    dayOfWeek: string;
    averageAmount: number;
    transactionCount: number;
  }[];
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  categoryId: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
  startDate: string;
  endDate?: string;
  dayOfMonth?: number;
  dayOfWeek?: number;
  isActive: boolean;
  nextDueDate: string;
  lastProcessedDate?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringTransactionRequest {
  name: string;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  categoryId: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
  startDate: string;
  endDate?: string;
  dayOfMonth?: number;
  dayOfWeek?: number;
}

/**
 * Transaction Service
 * Handles all transaction-related API operations
 */
@Injectable({
  providedIn: 'root'
})
export class TransactionService extends ApiService {
  private readonly endpoint = 'transactions';

  /**
   * Get transactions with filtering, search, and pagination
   */  getTransactions(
    filters?: TransactionFilters,
    pagination?: PaginationParams
  ): Observable<PaginatedResponse<Transaction>> {
    const params = { ...filters, ...pagination };
    return this.get<Transaction[]>(this.endpoint, params) as Observable<PaginatedResponse<Transaction>>;
  }

  /**
   * Get a single transaction by ID
   */
  getTransaction(id: string): Observable<Transaction> {
    console.log('Service: Getting transaction with ID:', id); // Debug log
    return this.extractData(
      this.get<Transaction>(`${this.endpoint}/${id}`)
    ).pipe(
      map(transaction => {
        console.log('Service: Transaction retrieved:', transaction); // Debug log
        return transaction;
      }),
      catchError(error => {
        console.error('Service: Error getting transaction:', error); // Debug log
        throw error;
      })
    );
  }

  /**
   * Create a new transaction
   */
  createTransaction(data: CreateTransactionRequest): Observable<Transaction> {
    return this.extractData(
      this.post<Transaction>(this.endpoint, data)
    );
  }

  /**
   * Update an existing transaction
   */
  updateTransaction(id: string, data: UpdateTransactionRequest): Observable<Transaction> {
    return this.extractData(
      this.put<Transaction>(`${this.endpoint}/${id}`, data)
    );
  }

  /**
   * Delete a transaction
   */
  deleteTransaction(id: string): Observable<void> {
    return this.extractData(
      this.delete<void>(`${this.endpoint}/${id}`)
    );
  }

  /**
   * Get transaction analytics and insights
   */
  getTransactionAnalytics(
    filters?: TransactionFilters
  ): Observable<TransactionAnalytics> {
    return this.extractData(
      this.get<TransactionAnalytics>(`${this.endpoint}/analytics`, filters)
    );
  }

  /**
   * Get transaction statistics summary
   */
  getTransactionStats(filters?: TransactionFilters): Observable<any> {
    return this.extractData(
      this.get<any>(`${this.endpoint}/stats`, filters)
    );
  }

  /**
   * Upload receipt/attachment to a transaction
   */
  uploadReceipt(transactionId: string, file: File): Observable<TransactionAttachment> {
    const formData = new FormData();
    formData.append('receipt', file);
    
    return this.extractData(
      this.upload<TransactionAttachment>(`${this.endpoint}/${transactionId}/receipt`, formData)
    );
  }

  /**
   * Delete transaction attachment
   */
  deleteAttachment(transactionId: string, attachmentId: string): Observable<void> {
    return this.extractData(
      this.delete<void>(`${this.endpoint}/${transactionId}/attachments/${attachmentId}`)
    );
  }

  /**
   * Get recurring transactions
   */
  getRecurringTransactions(): Observable<RecurringTransaction[]> {
    return this.extractData(
      this.get<RecurringTransaction[]>(`${this.endpoint}/recurring`)
    );
  }

  /**
   * Get due recurring transactions
   */
  getDueRecurringTransactions(): Observable<RecurringTransaction[]> {
    return this.extractData(
      this.get<RecurringTransaction[]>(`${this.endpoint}/recurring/due`)
    );
  }

  /**
   * Create a recurring transaction
   */
  createRecurringTransaction(data: CreateRecurringTransactionRequest): Observable<RecurringTransaction> {
    return this.extractData(
      this.post<RecurringTransaction>(`${this.endpoint}/recurring`, data)
    );
  }

  /**
   * Update a recurring transaction
   */
  updateRecurringTransaction(
    id: string, 
    data: Partial<CreateRecurringTransactionRequest>
  ): Observable<RecurringTransaction> {
    return this.extractData(
      this.put<RecurringTransaction>(`${this.endpoint}/recurring/${id}`, data)
    );
  }

  /**
   * Delete a recurring transaction
   */
  deleteRecurringTransaction(id: string): Observable<void> {
    return this.extractData(
      this.delete<void>(`${this.endpoint}/recurring/${id}`)
    );
  }

  /**
   * Process due recurring transactions
   */
  processRecurringTransactions(): Observable<{ processed: number; created: Transaction[] }> {
    return this.extractData(
      this.post<{ processed: number; created: Transaction[] }>(
        `${this.endpoint}/recurring/process`, 
        {}
      )
    );
  }

  /**
   * Bulk create transactions
   */
  bulkCreateTransactions(transactions: CreateTransactionRequest[]): Observable<{
    created: Transaction[];
    errors: any[];
  }> {
    return this.extractData(
      this.post<{ created: Transaction[]; errors: any[] }>(
        `${this.endpoint}/bulk`, 
        { transactions }
      )
    );
  }

  /**
   * Bulk update transactions
   */
  bulkUpdateTransactions(updates: { id: string; data: UpdateTransactionRequest }[]): Observable<{
    updated: Transaction[];
    errors: any[];
  }> {
    return this.extractData(
      this.put<{ updated: Transaction[]; errors: any[] }>(
        `${this.endpoint}/bulk`, 
        { updates }
      )
    );
  }

  /**
   * Bulk delete transactions
   */
  bulkDeleteTransactions(ids: string[]): Observable<{ deleted: number; errors: any[] }> {
    return this.extractData(
      this.delete<{ deleted: number; errors: any[] }>(`${this.endpoint}/bulk`, {
        params: { ids: ids.join(',') }
      })
    );
  }
  /**
   * Export transactions
   */
  exportTransactions(
    format: 'csv' | 'pdf' | 'excel', 
    filters?: TransactionFilters
  ): Observable<Blob> {
    return this.extractData(
      this.get<Blob>(`${this.endpoint}/export/${format}`, filters, {
        responseType: 'blob'
      })
    );
  }

  /**
   * Import transactions from file
   */
  importTransactions(file: File, options?: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
  }): Observable<{
    imported: number;
    updated: number;
    skipped: number;
    errors: any[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options) {
      Object.keys(options).forEach(key => {
        formData.append(key, (options as any)[key].toString());
      });
    }
    
    return this.extractData(
      this.upload<{
        imported: number;
        updated: number;
        skipped: number;
        errors: any[];
      }>(`${this.endpoint}/import`, formData)
    );
  }
}
