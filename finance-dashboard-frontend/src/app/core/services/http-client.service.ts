import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, retry, timeout, finalize, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface HttpOptions {
  headers?: HttpHeaders | { [header: string]: string | string[] };
  params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
  observe?: 'body' | 'events' | 'response';
  withCredentials?: boolean;
  timeout?: number;
  retryAttempts?: number;
  skipLoading?: boolean;
  skipAuth?: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
  timestamp?: string;
  errors?: string[];
}

export interface ApiError {
  message: string;
  status: number;
  statusText: string;
  errors?: string[];
  timestamp?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  // Optionally keep the old pagination object for backward compatibility
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface RequestCacheEntry {
  response: Observable<any>;
  timestamp: number;
}

/**
 * HttpClientService - Centralized HTTP client for API communication
 * Provides standardized methods for making HTTP requests with built-in error handling,
 * loading states, caching, and retry logic.
 */
@Injectable({
  providedIn: 'root'
})
export class HttpClientService {  private readonly baseUrl = environment.apiUrl;
  private readonly defaultTimeout = environment.timeout || 30000;
  private readonly defaultRetryAttempts = environment.retryAttempts || 3;
  private readonly cacheExpiration = environment.cacheDuration || 300000; // 5 minutes
  
  // Request cache for deduplication and caching
  private requestCache = new Map<string, RequestCacheEntry>();
  
  // Active requests tracker for deduplication
  private activeRequests = new Map<string, Observable<any>>();

  constructor(private http: HttpClient) {}

  /**
   * GET request
   */
  get<T>(endpoint: string, options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(endpoint);
    const cacheKey = this.buildCacheKey('GET', url, options.params);
    
    // Check cache first
    if (!options.skipLoading) {
      const cached = this.getCachedResponse<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Check for active duplicate requests
    const activeRequest = this.activeRequests.get(cacheKey);
    if (activeRequest) {
      return activeRequest as Observable<T>;
    }    const request$ = (this.http.get<T>(url, this.buildHttpOptions(options)) as Observable<T>).pipe(
      timeout(options.timeout || this.defaultTimeout),
      retry(options.retryAttempts || this.defaultRetryAttempts),
      catchError(this.handleError.bind(this)),
      finalize(() => {
        this.activeRequests.delete(cacheKey);
      })
    );

    // Cache the request
    this.activeRequests.set(cacheKey, request$);
    
    // Cache successful responses
    if (!options.skipLoading) {
      this.cacheResponse(cacheKey, request$);
    }

    // Patch for paginated responses: flatten pagination object to root if present
    return request$.pipe(
      map((response: any) => {
        // Handle both direct pagination and meta.pagination structures
        let paginationData = null;
        
        if (response && response.meta && response.meta.pagination) {
          // Backend returns pagination under meta.pagination
          paginationData = response.meta.pagination;
        } else if (response && response.pagination) {
          // Direct pagination structure
          paginationData = response.pagination;
        }
        
        if (paginationData) {
          const transformedResponse = {
            ...response,
            pagination: {
              page: paginationData.page,
              limit: paginationData.limit,
              total: paginationData.total,
              totalPages: paginationData.totalPages,
              hasNext: paginationData.hasNext,
              hasPrev: paginationData.hasPrev
            }
          };
          return transformedResponse;
        }
        
        return response;
      })
    );
  }
  /**
   * POST request
   */
  post<T>(endpoint: string, data: any, options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(endpoint);
    
    return (this.http.post<T>(url, data, this.buildHttpOptions(options)) as Observable<T>).pipe(
      timeout(options.timeout || this.defaultTimeout),
      retry(options.retryAttempts || 0), // Usually don't retry POST requests
      catchError(this.handleError.bind(this))
    );
  }
  /**
   * PUT request
   */
  put<T>(endpoint: string, data: any, options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(endpoint);
    
    return (this.http.put<T>(url, data, this.buildHttpOptions(options)) as Observable<T>).pipe(
      timeout(options.timeout || this.defaultTimeout),
      retry(options.retryAttempts || 0),
      catchError(this.handleError.bind(this))
    );
  }
  /**
   * PATCH request
   */
  patch<T>(endpoint: string, data: any, options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(endpoint);
    
    return (this.http.patch<T>(url, data, this.buildHttpOptions(options)) as Observable<T>).pipe(
      timeout(options.timeout || this.defaultTimeout),
      retry(options.retryAttempts || 0),
      catchError(this.handleError.bind(this))
    );
  }
  /**
   * DELETE request
   */
  delete<T>(endpoint: string, options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(endpoint);
    
    return (this.http.delete<T>(url, this.buildHttpOptions(options)) as Observable<T>).pipe(
      timeout(options.timeout || this.defaultTimeout),
      retry(options.retryAttempts || 1),
      catchError(this.handleError.bind(this))
    );
  }
  /**
   * Upload file(s)
   */
  upload<T>(endpoint: string, file: File | FileList, options: HttpOptions = {}): Observable<T> {
    const url = this.buildUrl(endpoint);
    const formData = new FormData();
    
    if (file instanceof FileList) {
      for (let i = 0; i < file.length; i++) {
        formData.append('files', file[i], file[i].name);
      }
    } else {
      formData.append('file', file, file.name);
    }
    
    return (this.http.post<T>(url, formData, this.buildHttpOptions({
      ...options,
      headers: {} // Let Angular set Content-Type for multipart/form-data
    })) as Observable<T>).pipe(
      timeout(options.timeout || this.defaultTimeout * 3), // Longer timeout for uploads
      catchError(this.handleError.bind(this))
    );
  }  /**
   * Download file
   */
  download(endpoint: string, filename?: string, options: HttpOptions = {}): Observable<Blob> {
    const url = this.buildUrl(endpoint);
    
    return (this.http.get(url, {
      ...this.buildHttpOptions(options),
      responseType: 'blob',
      observe: 'body'
    }) as unknown as Observable<Blob>).pipe(
      timeout(options.timeout || this.defaultTimeout * 2),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Download file as blob
   */
  getBlob(endpoint: string, options: HttpOptions = {}): Observable<Blob> {
    const url = this.buildUrl(endpoint);
    
    return (this.http.get(url, {
      ...this.buildHttpOptions(options),
      responseType: 'blob',
      observe: 'body'
    }) as unknown as Observable<Blob>).pipe(
      timeout(options.timeout || this.defaultTimeout * 2),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Build full URL from endpoint
   */
  private buildUrl(endpoint: string): string {
    // Remove leading slash if present to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${this.baseUrl}/${cleanEndpoint}`;
  }  /**
   * Build HTTP options from our custom options
   */
  private buildHttpOptions(options: HttpOptions): any {
    const httpOptions: any = {
      observe: options.observe || 'body',  // Default to body only
      responseType: options.responseType || 'json'  // Default to JSON
    };
    
    if (options.headers) {
      httpOptions.headers = options.headers;
    }
    
    if (options.params) {
      httpOptions.params = options.params;
    }
    
    if (options.withCredentials !== undefined) {
      httpOptions.withCredentials = options.withCredentials;
    }
    
    return httpOptions;
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let apiError: ApiError;
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      apiError = {
        message: error.error.message || 'An error occurred',
        status: 0,
        statusText: 'Client Error',
        timestamp: new Date().toISOString()
      };
    } else {
      // Server-side error
      apiError = {
        message: error.error?.message || error.message || 'Server error occurred',
        status: error.status,
        statusText: error.statusText,
        errors: error.error?.errors || [],
        timestamp: new Date().toISOString()
      };
    }
    
    console.error('HTTP Error:', apiError);
    return throwError(() => apiError);
  }

  /**
   * Build cache key for request
   */
  private buildCacheKey(method: string, url: string, params?: any): string {
    const paramsStr = params ? JSON.stringify(params) : '';
    return `${method}:${url}:${paramsStr}`;
  }

  /**
   * Get cached response if available and not expired
   */
  private getCachedResponse<T>(cacheKey: string): Observable<T> | null {
    const cached = this.requestCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiration) {
      return cached.response as Observable<T>;
    }
    
    if (cached) {
      this.requestCache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * Cache successful response
   */
  private cacheResponse<T>(cacheKey: string, response$: Observable<T>): void {
    this.requestCache.set(cacheKey, {
      response: response$,
      timestamp: Date.now()
    });
  }

  /**
   * Clear entire cache
   */
  public clearCache(): void {
    this.requestCache.clear();
    this.activeRequests.clear();
  }

  /**
   * Clear cache for specific pattern
   */
  public clearCachePattern(pattern: string): void {
    for (const [key] of this.requestCache) {
      if (key.includes(pattern)) {
        this.requestCache.delete(key);
      }
    }
  }

  /**
   * Check if request is currently active
   */
  public isRequestActive(endpoint: string, method: string = 'GET', params?: any): boolean {
    const url = this.buildUrl(endpoint);
    const cacheKey = this.buildCacheKey(method, url, params);
    return this.activeRequests.has(cacheKey);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.requestCache.size,
      keys: Array.from(this.requestCache.keys())
    };
  }
}
