import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, retry, retryWhen, switchMap, take } from 'rxjs/operators';
import { 
  ApiError, 
  ValidationError, 
  AuthError, 
  ServerError, 
  NetworkError,
  HTTP_STATUS,
  API_ERROR_CODES 
} from '../models/api-response.models';

/**
 * ErrorInterceptor - Handles HTTP errors globally with retry logic
 * This interceptor catches and processes HTTP errors from API calls,
 * implements retry strategies, and converts errors to standardized format
 */
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  // URLs that should not be retried
  private noRetryUrls = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout'
  ];

  // Maximum retry attempts for different error types
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor() { }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      retryWhen(errors => 
        errors.pipe(
          switchMap((error: HttpErrorResponse, index: number) => {
            // Don't retry if we've exceeded max attempts
            if (index >= this.maxRetries) {
              return throwError(() => this.createApiError(error, request));
            }

            // Don't retry certain requests
            if (this.shouldNotRetry(request, error)) {
              return throwError(() => this.createApiError(error, request));
            }

            // Only retry on specific error conditions
            if (this.shouldRetry(error)) {
              const delay = this.calculateRetryDelay(index, error);
              console.warn(`Retrying request (attempt ${index + 1}/${this.maxRetries}) after ${delay}ms:`, request.url);
              return timer(delay);
            }

            return throwError(() => this.createApiError(error, request));
          }),
          take(this.maxRetries)
        )
      ),
      catchError((error: HttpErrorResponse) => {
        const apiError = this.createApiError(error, request);
        this.logError(apiError, request);
        return throwError(() => apiError);
      })
    );
  }

  /**
   * Create standardized API error from HTTP error
   */
  private createApiError(error: HttpErrorResponse, request: HttpRequest<unknown>): ApiError {
    const timestamp = new Date().toISOString();
    const requestId = this.generateRequestId();

    // Handle network/client-side errors
    if (error.error instanceof ErrorEvent) {
      const networkError: NetworkError = {
        message: error.error.message || 'Network error occurred',
        status: 0,
        statusText: 'Network Error',
        code: this.determineNetworkErrorCode(error),
        timestamp,
        requestId,
        networkErrorType: this.determineNetworkErrorType(error),
        isOffline: !navigator.onLine
      };
      return networkError;
    }

    // Handle server-side errors
    const baseError: ApiError = {
      message: this.getErrorMessage(error),
      status: error.status,
      statusText: error.statusText,
      code: this.getErrorCode(error),
      errors: this.extractErrorDetails(error),
      timestamp,
      requestId
    };

    // Create specific error types based on status code
    switch (error.status) {
      case HTTP_STATUS.BAD_REQUEST:
      case HTTP_STATUS.UNPROCESSABLE_ENTITY:
        return this.createValidationError(error, baseError);
      
      case HTTP_STATUS.UNAUTHORIZED:
      case HTTP_STATUS.FORBIDDEN:
        return this.createAuthError(error, baseError);
      
      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
      case HTTP_STATUS.BAD_GATEWAY:
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
      case HTTP_STATUS.GATEWAY_TIMEOUT:
        return this.createServerError(error, baseError);
      
      default:
        return baseError;
    }
  }

  /**
   * Create validation error
   */
  private createValidationError(error: HttpErrorResponse, baseError: ApiError): ValidationError {
    return {
      ...baseError,
      validationErrors: error.error?.validationErrors || {}
    };
  }

  /**
   * Create authentication error
   */
  private createAuthError(error: HttpErrorResponse, baseError: ApiError): AuthError {
    return {
      ...baseError,
      authErrorType: this.determineAuthErrorType(error),
      requiresLogin: error.status === HTTP_STATUS.UNAUTHORIZED
    };
  }
  /**
   * Create server error
   */
  private createServerError(error: HttpErrorResponse, baseError: ApiError): ServerError {
    const retryAfter = this.extractRetryAfter(error);
    return {
      ...baseError,
      serverErrorType: this.determineServerErrorType(error),
      retryable: this.isRetryableServerError(error),
      retryAfter: retryAfter ?? undefined
    };
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: HttpErrorResponse): string {
    // Try to get message from error response
    if (error.error?.message) {
      return error.error.message;
    }

    // Fallback to status-based messages
    switch (error.status) {
      case HTTP_STATUS.BAD_REQUEST:
        return 'Invalid request. Please check your input.';
      case HTTP_STATUS.UNAUTHORIZED:
        return 'Authentication required. Please log in again.';
      case HTTP_STATUS.FORBIDDEN:
        return 'You do not have permission to access this resource.';
      case HTTP_STATUS.NOT_FOUND:
        return 'The requested resource was not found.';
      case HTTP_STATUS.CONFLICT:
        return 'Resource conflict. The data may have been modified by another user.';
      case HTTP_STATUS.UNPROCESSABLE_ENTITY:
        return 'Invalid data provided. Please check your input.';
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        return 'Too many requests. Please try again later.';
      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
        return 'Server error. Please try again later.';
      case HTTP_STATUS.BAD_GATEWAY:
        return 'Service temporarily unavailable. Please try again.';
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        return 'Service is currently unavailable. Please try again later.';
      case HTTP_STATUS.GATEWAY_TIMEOUT:
        return 'Request timeout. Please try again.';
      default:
        return `An error occurred (${error.status}): ${error.statusText}`;
    }
  }

  /**
   * Get error code
   */
  private getErrorCode(error: HttpErrorResponse): string {
    return error.error?.code || `HTTP_${error.status}`;
  }

  /**
   * Extract error details
   */
  private extractErrorDetails(error: HttpErrorResponse): any[] {
    return error.error?.errors || [];
  }
  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: HttpErrorResponse): boolean {
    // Retry on network errors
    if (error.error instanceof ErrorEvent) {
      return true;
    }

    // Retry on specific server errors
    const retryableStatuses: number[] = [
      HTTP_STATUS.BAD_GATEWAY,
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      HTTP_STATUS.GATEWAY_TIMEOUT,
      HTTP_STATUS.TOO_MANY_REQUESTS
    ];

    return retryableStatuses.includes(error.status);
  }

  /**
   * Check if request should not be retried
   */
  private shouldNotRetry(request: HttpRequest<unknown>, error: HttpErrorResponse): boolean {
    // Don't retry specific URLs
    if (this.noRetryUrls.some(url => request.url.includes(url))) {
      return true;
    }

    // Don't retry non-idempotent methods with client errors
    if (['POST', 'PUT', 'PATCH'].includes(request.method) && error.status >= 400 && error.status < 500) {
      return true;
    }

    // Don't retry if explicitly marked
    if (request.headers.has('X-No-Retry')) {
      return true;
    }

    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, error: HttpErrorResponse): number {
    // Check for Retry-After header
    const retryAfter = this.extractRetryAfter(error);
    if (retryAfter) {
      return retryAfter;
    }

    // Exponential backoff: 1s, 2s, 4s, etc.
    return this.retryDelay * Math.pow(2, attempt);
  }

  /**
   * Extract Retry-After header value
   */
  private extractRetryAfter(error: HttpErrorResponse): number | null {
    const retryAfter = error.headers?.get('Retry-After');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      return isNaN(seconds) ? null : seconds * 1000;
    }
    return null;
  }

  /**
   * Determine authentication error type
   */
  private determineAuthErrorType(error: HttpErrorResponse): AuthError['authErrorType'] {
    const errorCode = error.error?.code;
    
    switch (errorCode) {
      case API_ERROR_CODES.INVALID_CREDENTIALS:
        return 'invalid_credentials';
      case API_ERROR_CODES.TOKEN_EXPIRED:
        return 'token_expired';
      case API_ERROR_CODES.TOKEN_INVALID:
        return 'token_invalid';
      case API_ERROR_CODES.FORBIDDEN:
        return 'forbidden';
      default:
        return error.status === HTTP_STATUS.UNAUTHORIZED ? 'unauthorized' : 'forbidden';
    }
  }

  /**
   * Determine server error type
   */
  private determineServerErrorType(error: HttpErrorResponse): ServerError['serverErrorType'] {
    switch (error.status) {
      case HTTP_STATUS.BAD_GATEWAY:
        return 'bad_gateway';
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        return 'service_unavailable';
      case HTTP_STATUS.GATEWAY_TIMEOUT:
        return 'timeout';
      default:
        return 'internal';
    }
  }

  /**
   * Determine network error type
   */
  private determineNetworkErrorType(error: HttpErrorResponse): NetworkError['networkErrorType'] {
    if (!navigator.onLine) {
      return 'offline';
    }
    
    const errorMessage = error.error?.message?.toLowerCase() || '';
    
    if (errorMessage.includes('timeout')) {
      return 'timeout';
    }
    if (errorMessage.includes('connection refused')) {
      return 'connection_refused';
    }
    if (errorMessage.includes('dns')) {
      return 'dns_error';
    }
    
    return 'offline';
  }

  /**
   * Determine network error code
   */
  private determineNetworkErrorCode(error: HttpErrorResponse): string {
    if (!navigator.onLine) {
      return API_ERROR_CODES.OFFLINE;
    }
    return API_ERROR_CODES.NETWORK_ERROR;
  }
  /**
   * Check if server error is retryable
   */
  private isRetryableServerError(error: HttpErrorResponse): boolean {
    const retryableStatuses: number[] = [
      HTTP_STATUS.BAD_GATEWAY,
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      HTTP_STATUS.GATEWAY_TIMEOUT
    ];
    return retryableStatuses.includes(error.status);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log error for debugging and monitoring
   */
  private logError(error: ApiError, request: HttpRequest<unknown>): void {
    const logData = {
      error,
      request: {
        method: request.method,
        url: request.url,
        headers: this.sanitizeHeaders(request.headers)
      },
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };

    // In production, this would send to a logging service
    console.error('HTTP Error Intercepted:', logData);
  }

  /**
   * Sanitize headers for logging (remove sensitive data)
   */
  private sanitizeHeaders(headers: any): any {
    const sanitized: any = {};
    headers.keys().forEach((key: string) => {
      if (key.toLowerCase() !== 'authorization') {
        sanitized[key] = headers.get(key);
      } else {
        sanitized[key] = '[REDACTED]';
      }
    });
    return sanitized;
  }
}
