import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// Models
export interface DataExportRequest {
  format: 'json' | 'csv' | 'pdf' | 'excel';
  categories: string[];
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  includeAttachments: boolean;
  email?: string;
  reason?: string;
}

export interface DataExportResponse {
  success: boolean;
  data: {
    exportId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    downloadUrl?: string;
    estimatedSize?: string;
    expiresAt?: string;
    createdAt: string;
  };
  message: string;
}

export interface ExportStatus {
  exportId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  downloadUrl?: string;
  estimatedSize?: string;
  actualSize?: string;
  expiresAt?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface ExportHistory {
  exports: {
    id: string;
    format: string;
    categories: string[];
    status: string;
    downloadUrl?: string;
    createdAt: string;
    expiresAt?: string;
    fileSize?: string;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  pagination?: object;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private readonly baseUrl = `${environment.apiUrl}/export-import`;

  constructor(private http: HttpClient) {}

  /**
   * Request a data export
   */
  requestDataExport(request: DataExportRequest): Observable<DataExportResponse> {
    const payload = {
      format: request.format,
      categories: request.categories,
      includeAttachments: request.includeAttachments,
      email: request.email,
      reason: request.reason || 'User data export request',
      ...(request.dateRange && {
        startDate: request.dateRange.startDate.toISOString(),
        endDate: request.dateRange.endDate.toISOString()
      })
    };

    return this.http.post<DataExportResponse>(`${this.baseUrl}/export`, payload)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Get export status by ID
   */
  getExportStatus(exportId: string): Observable<ExportStatus> {
    return this.http.get<ApiResponse<ExportStatus>>(`${this.baseUrl}/export/${exportId}/status`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Download export file
   */
  downloadExport(exportId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export/${exportId}/download`, {
      responseType: 'blob',
      headers: new HttpHeaders({
        'Accept': 'application/octet-stream'
      })
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get export history for the current user
   */
  getExportHistory(page: number = 1, limit: number = 10): Observable<ExportHistory> {
    const params = { page: page.toString(), limit: limit.toString() };
    
    return this.http.get<ApiResponse<ExportHistory>>(`${this.baseUrl}/exports`, { params })
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Cancel an export request
   */
  cancelExport(exportId: string): Observable<{ message: string }> {
    return this.http.delete<ApiResponse<{ message: string }>>(`${this.baseUrl}/export/${exportId}`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Get available export categories
   */
  getExportCategories(): Observable<{
    categories: {
      id: string;
      name: string;
      description: string;
      estimatedSize: string;
      dataTypes: string[];
    }[];
  }> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/categories`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Get export statistics
   */
  getExportStats(): Observable<{
    totalExports: number;
    pendingExports: number;
    completedExports: number;
    failedExports: number;
    totalDataSize: string;
    lastExportDate?: string;
  }> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/stats`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Validate export request before submission
   */
  validateExportRequest(request: Partial<DataExportRequest>): Observable<{
    valid: boolean;
    errors?: string[];
    warnings?: string[];
    estimatedSize?: string;
    estimatedTime?: string;
  }> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/validate`, request)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Request immediate export (for small datasets)
   */
  requestImmediateExport(request: DataExportRequest): Observable<Blob> {
    const payload = {
      format: request.format,
      categories: request.categories,
      includeAttachments: request.includeAttachments,
      ...(request.dateRange && {
        startDate: request.dateRange.startDate.toISOString(),
        endDate: request.dateRange.endDate.toISOString()
      })
    };

    return this.http.post(`${this.baseUrl}/export/immediate`, payload, {
      responseType: 'blob',
      headers: new HttpHeaders({
        'Accept': 'application/octet-stream'
      })
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get supported export formats
   */
  getSupportedFormats(): Observable<{
    formats: {
      id: string;
      name: string;
      description: string;
      mimeType: string;
      extension: string;
      maxSize?: string;
      features: string[];
    }[];
  }> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/formats`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Request bulk export of multiple categories
   */
  requestBulkExport(requests: DataExportRequest[]): Observable<{
    batchId: string;
    exports: DataExportResponse[];
  }> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/export/bulk`, { requests })
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Get bulk export status
   */
  getBulkExportStatus(batchId: string): Observable<{
    batchId: string;
    status: string;
    progress: number;
    exports: ExportStatus[];
    completedCount: number;
    totalCount: number;
  }> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/export/bulk/${batchId}/status`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Schedule recurring export
   */
  scheduleRecurringExport(request: DataExportRequest & {
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      time: string; // HH:MM format
      dayOfWeek?: number; // 0-6 for weekly
      dayOfMonth?: number; // 1-31 for monthly
    };
    enabled: boolean;
  }): Observable<{
    scheduleId: string;
    nextRun: string;
  }> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/export/schedule`, request)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Get scheduled exports
   */
  getScheduledExports(): Observable<{
    schedules: {
      id: string;
      request: DataExportRequest;
      schedule: any;
      enabled: boolean;
      lastRun?: string;
      nextRun?: string;
      createdAt: string;
    }[];
  }> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/export/schedules`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Update scheduled export
   */
  updateScheduledExport(scheduleId: string, updates: any): Observable<{ message: string }> {
    return this.http.put<ApiResponse<{ message: string }>>(`${this.baseUrl}/export/schedule/${scheduleId}`, updates)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Delete scheduled export
   */
  deleteScheduledExport(scheduleId: string): Observable<{ message: string }> {
    return this.http.delete<ApiResponse<{ message: string }>>(`${this.baseUrl}/export/schedule/${scheduleId}`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Get data usage statistics for exports
   */
  getDataUsage(period: 'day' | 'week' | 'month' | 'year' = 'month'): Observable<{
    period: string;
    totalExports: number;
    totalSize: string;
    averageSize: string;
    popularFormats: {
      format: string;
      count: number;
      percentage: number;
    }[];
    popularCategories: {
      category: string;
      count: number;
      percentage: number;
    }[];
    timeline: {
      date: string;
      exports: number;
      size: string;
    }[];
  }> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/usage`, { 
      params: { period } 
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Error handling
   */
  private handleError = (error: any): Observable<never> => {
    console.error('ExportService Error:', error);
    
    // Transform backend errors to user-friendly messages
    let errorMessage = 'An error occurred while processing your request';
    
    if (error.status === 400) {
      errorMessage = error.error?.message || 'Invalid export request';
    } else if (error.status === 401) {
      errorMessage = 'You are not authorized to perform this action';
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to export this data';
    } else if (error.status === 404) {
      errorMessage = 'Export not found or has expired';
    } else if (error.status === 429) {
      errorMessage = 'Too many export requests. Please try again later';
    } else if (error.status === 413) {
      errorMessage = 'Export request is too large. Please reduce the data selection';
    } else if (error.status === 500) {
      errorMessage = 'Server error occurred. Please try again later';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    throw new Error(errorMessage);
  };
}
