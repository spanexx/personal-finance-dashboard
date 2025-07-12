import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HttpClientService } from '../../../core/services/http-client.service';
import { ApiResponse, PaginatedResponse } from '../../../core/models/api-response.models';

export interface Transaction {
  id: string;
  user: string;
  amount: number;
  type: 'expense' | 'income' | 'transfer';
  category: string;
  categoryDetails?: {
    name: string;
    color: string;
    icon: string;
  };
  date: string;
  description: string;
  notes?: string;
  payee: string;
  status?: 'pending' | 'completed' | 'cancelled';
  paymentMethod?: string;
  isRecurring: boolean;
  recurringDetails?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate: string | null;
  };
  tags?: string[];
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  color: string;
  icon: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionFilters {
  type?: 'expense' | 'income' | 'transfer';
  category?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  minAmount?: number;
  maxAmount?: number;
  tags?: string[];
  paymentMethod?: string;
  hasAttachments?: boolean;
  isRecurring?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'amount' | 'description';
  sortOrder?: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  constructor(private httpClient: HttpClientService) { }  // Get all transactions with filters
  getTransactions(filters?: TransactionFilters): Observable<PaginatedResponse<Transaction>> {
    return this.httpClient.get<PaginatedResponse<Transaction>>('transactions', {
      params: filters as any
    });
  }

  // Get a transaction by id
  getTransaction(id: string): Observable<Transaction> {
    console.log('Service: Getting transaction with ID:', id); // Debug log
    return this.httpClient.get<ApiResponse<{transaction: Transaction, attachments: any[]}>>(`transactions/${id}`).pipe(
      map(response => {
        console.log('Service: Raw API response:', response); // Debug log
        // Extract transaction from the wrapped response
        const transaction = response.data.transaction;
        console.log('Service: Extracted transaction:', transaction); // Debug log
        return transaction;
      }),
      catchError((error: any) => {
        console.error('Service: Error getting transaction:', error); // Debug log
        throw error;
      })
    );
  }

  // Create a new transaction
  createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Observable<Transaction> {
    return this.httpClient.post<ApiResponse<Transaction>>('transactions', transaction).pipe(
      map(response => response.data)
    );
  }

  // Update an existing transaction
  updateTransaction(id: string, transaction: Partial<Transaction>): Observable<Transaction> {
    return this.httpClient.put<ApiResponse<Transaction>>(`transactions/${id}`, transaction).pipe(
      map(response => response.data)
    );
  }

  // Delete a transaction
  deleteTransaction(id: string): Observable<void> {
    return this.httpClient.delete<ApiResponse<void>>(`transactions/${id}`).pipe(
      map(() => void 0)
    );
  }
  // Get all categories
  getCategories(): Observable<Category[]> {
    return this.httpClient.get<any>('categories').pipe(
      map(response => response.categories || [])
    );
  }

  // Get categories by type (expense or income)
  getCategoriesByType(type: 'expense' | 'income'): Observable<Category[]> {
    return this.httpClient.get<ApiResponse<Category[]>>('categories', {
      params: { type }
    }).pipe(
      map(response => response.data)
    );
  }

  // Create a new category
  createCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Observable<Category> {
    return this.httpClient.post<ApiResponse<Category>>('categories', category).pipe(
      map(response => response.data)
    );
  }

  // Update an existing category
  updateCategory(id: string, category: Partial<Category>): Observable<Category> {
    return this.httpClient.put<ApiResponse<Category>>(`categories/${id}`, category).pipe(
      map(response => response.data)
    );
  }

  // Delete a category
  deleteCategory(id: string): Observable<void> {
    return this.httpClient.delete<ApiResponse<void>>(`categories/${id}`).pipe(
      map(() => void 0)
    );
  }
}
