/**
 * Standard API Response Interfaces
 * These interfaces define the structure of responses from the backend API
 */

export interface ApiResponse<T = any> {
  /** The response data */
  data: T;
  /** Success flag */
  success: boolean;
  /** Optional message */
  message?: string;
  /** Response timestamp */
  timestamp?: string;
  /** Request ID for tracking */
  requestId?: string;
  /** API version */
  version?: string;
}

export interface ApiError {
  /** Error message */
  message: string;
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
  /** Error code for client handling */
  code?: string;
  /** Detailed error information */
  errors?: ErrorDetail[];
  /** Error timestamp */
  timestamp?: string;
  /** Request ID for tracking */
  requestId?: string;
  /** Stack trace (only in development) */
  stackTrace?: string;
}

export interface ErrorDetail {
  /** Field name if field-specific error */
  field?: string;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Additional context */
  context?: Record<string, any>;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  /** Pagination metadata */
  pagination: PaginationMetadata;
}

export interface PaginationMetadata {
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrev: boolean;
  /** Number of items in current page */
  count: number;
  /** Links for navigation */
  links?: PaginationLinks;
}

export interface PaginationLinks {
  /** Link to first page */
  first?: string;
  /** Link to previous page */
  prev?: string;
  /** Link to next page */
  next?: string;
  /** Link to last page */
  last?: string;
  /** Link to current page */
  self?: string;
}

export interface ListResponse<T = any> extends PaginatedResponse<T> {
  /** Filters applied to the list */
  filters?: Record<string, any>;
  /** Sorting information */
  sort?: SortMetadata;
}

export interface SortMetadata {
  /** Field being sorted */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

export interface ValidationError extends ApiError {
  /** Validation errors by field */
  validationErrors: Record<string, string[]>;
}

export interface AuthError extends ApiError {
  /** Authentication error type */
  authErrorType:
    | 'invalid_credentials'
    | 'token_expired'
    | 'token_invalid'
    | 'unauthorized'
    | 'forbidden';
  /** Whether user needs to re-login */
  requiresLogin: boolean;
}

export interface ServerError extends ApiError {
  /** Server error type */
  serverErrorType:
    | 'internal'
    | 'service_unavailable'
    | 'timeout'
    | 'bad_gateway';
  /** Whether the error is retryable */
  retryable: boolean;
  /** Suggested retry delay in milliseconds */
  retryAfter?: number;
}

export interface NetworkError extends ApiError {
  /** Network error type */
  networkErrorType: 'offline' | 'timeout' | 'connection_refused' | 'dns_error';
  /** Whether the user is offline */
  isOffline: boolean;
}

/**
 * Type guards for error types
 */
export function isValidationError(error: any): error is ValidationError {
  return error && typeof error === 'object' && 'validationErrors' in error;
}

export function isAuthError(error: any): error is AuthError {
  return error && typeof error === 'object' && 'authErrorType' in error;
}

export function isServerError(error: any): error is ServerError {
  return error && typeof error === 'object' && 'serverErrorType' in error;
}

export function isNetworkError(error: any): error is NetworkError {
  return error && typeof error === 'object' && 'networkErrorType' in error;
}

/**
 * HTTP Status Code Constants
 */
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/**
 * API Error Codes
 */
export const API_ERROR_CODES = {
  // Authentication & Authorization
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Validation
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resource
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',

  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',

  // Network
  NETWORK_ERROR: 'NETWORK_ERROR',
  OFFLINE: 'OFFLINE',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Business Logic
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  GOAL_NOT_ACHIEVABLE: 'GOAL_NOT_ACHIEVABLE',
} as const;

export type ApiErrorCode =
  (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
