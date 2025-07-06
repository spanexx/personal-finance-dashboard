import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './auth.interceptor';
import { ErrorInterceptor } from './error.interceptor';
import { LoadingInterceptor } from './loading.interceptor';

/**
 * HTTP interceptor providers in order of execution
 * These interceptors will be applied to all HTTP requests in the application
 * 
 * Order matters:
 * 1. LoadingInterceptor - Track request lifecycle for loading states
 * 2. AuthInterceptor - Add authentication headers and handle token refresh
 * 3. ErrorInterceptor - Handle errors and implement retry logic
 */
export const httpInterceptorProviders = [
  { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
];
