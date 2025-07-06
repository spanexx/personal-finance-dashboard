import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse
} from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';

export interface LoadingState {
  isLoading: boolean;
  activeRequests: number;
  requestsQueue: string[];
}

/**
 * LoadingInterceptor - Manages global loading state
 * This interceptor tracks HTTP requests and provides a global loading state
 * that can be used to show/hide loading indicators across the application.
 */
@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  private loadingSubject = new BehaviorSubject<LoadingState>({
    isLoading: false,
    activeRequests: 0,
    requestsQueue: []
  });
  
  public readonly loading$ = this.loadingSubject.asObservable();
  
  // Track active requests
  private activeRequests = new Set<string>();
  
  // URLs that should not trigger loading indicator
  private skipLoadingUrls = [
    '/api/auth/refresh',
    '/api/health',
    '/api/ping'
  ];

  constructor() {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Check if this request should skip loading indicator
    const shouldSkipLoading = this.shouldSkipLoading(request);
    
    if (!shouldSkipLoading) {
      this.startLoading(request);
    }

    return next.handle(request).pipe(
      tap(event => {
        // You can add specific handling for different event types here
        if (event instanceof HttpResponse) {
          // Handle successful responses if needed
        }
      }),
      finalize(() => {
        if (!shouldSkipLoading) {
          this.stopLoading(request);
        }
      })
    );
  }

  /**
   * Start loading for a request
   */
  private startLoading(request: HttpRequest<unknown>): void {
    const requestId = this.getRequestId(request);
    
    if (!this.activeRequests.has(requestId)) {
      this.activeRequests.add(requestId);
      this.updateLoadingState();
    }
  }

  /**
   * Stop loading for a request
   */
  private stopLoading(request: HttpRequest<unknown>): void {
    const requestId = this.getRequestId(request);
    
    if (this.activeRequests.has(requestId)) {
      this.activeRequests.delete(requestId);
      this.updateLoadingState();
    }
  }

  /**
   * Update loading state
   */
  private updateLoadingState(): void {
    const activeRequests = this.activeRequests.size;
    const isLoading = activeRequests > 0;
    const requestsQueue = Array.from(this.activeRequests);
    
    this.loadingSubject.next({
      isLoading,
      activeRequests,
      requestsQueue
    });
  }

  /**
   * Generate unique request ID
   */
  private getRequestId(request: HttpRequest<unknown>): string {
    return `${request.method}:${request.url}:${JSON.stringify(request.body)}`;
  }

  /**
   * Check if request should skip loading indicator
   */
  private shouldSkipLoading(request: HttpRequest<unknown>): boolean {
    // Check if request has skipLoading header
    if (request.headers.has('X-Skip-Loading')) {
      return true;
    }
    
    // Check if URL is in skip list
    return this.skipLoadingUrls.some(url => request.url.includes(url));
  }

  /**
   * Get current loading state
   */
  public getCurrentLoadingState(): LoadingState {
    return this.loadingSubject.value;
  }

  /**
   * Check if currently loading
   */
  public isLoading(): boolean {
    return this.loadingSubject.value.isLoading;
  }

  /**
   * Get number of active requests
   */
  public getActiveRequestsCount(): number {
    return this.loadingSubject.value.activeRequests;
  }

  /**
   * Force stop all loading (useful for error scenarios)
   */
  public forceStopLoading(): void {
    this.activeRequests.clear();
    this.updateLoadingState();
  }

  /**
   * Add URL to skip loading list
   */
  public addSkipLoadingUrl(url: string): void {
    if (!this.skipLoadingUrls.includes(url)) {
      this.skipLoadingUrls.push(url);
    }
  }

  /**
   * Remove URL from skip loading list
   */
  public removeSkipLoadingUrl(url: string): void {
    const index = this.skipLoadingUrls.indexOf(url);
    if (index > -1) {
      this.skipLoadingUrls.splice(index, 1);
    }
  }

  /**
   * Get skip loading URLs
   */
  public getSkipLoadingUrls(): string[] {
    return [...this.skipLoadingUrls];
  }
}
