import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map, retry } from 'rxjs/operators';
import { HttpClientService, ApiResponse, HttpOptions } from './http-client.service';

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  type?: string;
  status?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Base API Service
 * Provides common API operations with error handling, retry logic, and response transformation
 */
@Injectable({
    providedIn: 'root'
})
export class ApiService {
  constructor(private httpClient: HttpClientService) {}

  /**
   * Generic GET request with optional query parameters
   */
  protected get<T>(
    endpoint: string, 
    params?: any, 
    options?: HttpOptions
  ): Observable<ApiResponse<T>> {
    return this.httpClient.get<ApiResponse<T>>(endpoint, { 
      ...options, 
      params: this.buildParams(params) 
    }).pipe(
      retry(options?.retryAttempts || 1),
      catchError(this.handleError)
    );
  }

  /**
   * Generic POST request
   */
  protected post<T>(
    endpoint: string, 
    data: any, 
    options?: HttpOptions
  ): Observable<ApiResponse<T>> {
    return this.httpClient.post<ApiResponse<T>>(endpoint, data, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generic PUT request
   */
  protected put<T>(
    endpoint: string, 
    data: any, 
    options?: HttpOptions
  ): Observable<ApiResponse<T>> {
    return this.httpClient.put<ApiResponse<T>>(endpoint, data, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generic PATCH request
   */
  protected patch<T>(
    endpoint: string, 
    data: any, 
    options?: HttpOptions
  ): Observable<ApiResponse<T>> {
    return this.httpClient.patch<ApiResponse<T>>(endpoint, data, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generic DELETE request
   */
  protected delete<T>(
    endpoint: string, 
    options?: HttpOptions
  ): Observable<ApiResponse<T>> {
    return this.httpClient.delete<ApiResponse<T>>(endpoint, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * File upload request
   */
  protected upload<T>(
    endpoint: string, 
    formData: FormData, 
    options?: HttpOptions
  ): Observable<ApiResponse<T>> {
    return this.httpClient.post<ApiResponse<T>>(endpoint, formData, {
      ...options,
      headers: { 
        // Remove Content-Type header to let browser set multipart boundary
        ...options?.headers 
      }
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Build HTTP parameters from object
   */
  private buildParams(params?: any): any {
    if (!params) return undefined;
    
    const httpParams: any = {};
    
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          httpParams[key] = value.join(',');
        } else if (value instanceof Date) {
          httpParams[key] = value.toISOString();
        } else {
          httpParams[key] = value.toString();
        }
      }
    });
    
    return httpParams;
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: any): Observable<never> => {
    console.error('API Error:', error);
    
    // Transform error response
    const apiError = {
      message: error.error?.message || error.message || 'An unexpected error occurred',
      status: error.status || 500,
      statusText: error.statusText || 'Internal Server Error',
      errors: error.error?.errors || []
    };
    
    return throwError(() => apiError);
  };

  /**
   * Extract data from API response
   */
  protected extractData<T>(response$: Observable<ApiResponse<T>>): Observable<T> {
    return response$.pipe(
      map(response => response.data)
    );
  }

  /**
   * Extract paginated data from API response
   */
  protected extractPaginatedData<T>(
    response$: Observable<PaginatedResponse<T>>
  ): Observable<{ data: T[], pagination: any }> {
    return response$.pipe(
      map(response => ({
        data: response.data,
        pagination: response.pagination
      }))
    );
  }
}
