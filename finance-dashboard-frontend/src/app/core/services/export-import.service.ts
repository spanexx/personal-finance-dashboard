import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpClientService } from './http-client.service';
import { ApiResponse, PaginatedResponse } from '../models/api-response.models';

export interface ExportOptions {
  format: 'csv' | 'json' | 'excel' | 'pdf';
  type: 'transactions' | 'budgets' | 'goals' | 'categories' | 'all';
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  includeAttachments?: boolean;
}

export interface ImportOptions {
  type: 'transactions' | 'budgets' | 'goals' | 'categories';
  options?: {
    updateExisting?: boolean;
    skipErrors?: boolean;
    dateFormat?: string;
    [key: string]: any;
  };
}

export interface ExportResult {
  fileName: string;
  downloadUrl: string;
  fileSize: number;
  recordCount: number;
  format: string;
  type: string;
}

export interface ImportResult {
  recordsProcessed: number;
  recordsImported: number;
  recordsSkipped: number;
  errors: any[];
  warnings: any[];
  summary: {
    [key: string]: any;
  };
}

export interface ExportHistoryItem {
  _id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  recordCount: number;
  format: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface ImportHistoryItem {
  _id: string;
  userId: string;
  originalFileName: string;
  type: string;
  recordsProcessed: number;
  recordsImported: number;
  recordsSkipped: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExportImportService {
  constructor(private httpClient: HttpClientService) {}

  /**
   * Export data in specified format
   */
  exportData(options: ExportOptions): Observable<ExportResult> {
    return this.httpClient.post<ApiResponse<ExportResult>>('export-import/export', options)
      .pipe(map(response => response.data));
  }

  /**
   * Import data from file
   * @param file The file to import
   * @param options Import options
   */
  importData(file: File, options: ImportOptions): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('importFile', file); // Changed from 'file' to 'importFile' to match backend expectation
    formData.append('type', options.type);
    
    if (options.options) {
      formData.append('options', JSON.stringify(options.options));
    }

    return this.httpClient.post<ApiResponse<ImportResult>>('export-import/import', formData)
      .pipe(map(response => response.data));
  }

  /**
   * Validate import file before processing
   */
  validateImportFile(file: File, type: string): Observable<any> {
    const formData = new FormData();
    formData.append('importFile', file); // Changed from 'file' to 'importFile' to match backend expectation
    formData.append('type', type);

    return this.httpClient.post<ApiResponse<any>>('export-import/validate', formData)
      .pipe(map(response => response.data));
  }

  /**
   * Get export history for user
   */
  getExportHistory(page = 1, limit = 10): Observable<PaginatedResponse<ExportHistoryItem>> {
    return this.httpClient.get<PaginatedResponse<ExportHistoryItem>>('export-import/exports', {
      params: { page, limit }
    });
  }

  /**
   * Get import history for user
   */
  getImportHistory(page = 1, limit = 10): Observable<PaginatedResponse<ImportHistoryItem>> {
    return this.httpClient.get<PaginatedResponse<ImportHistoryItem>>('export-import/imports', {
      params: { page, limit }
    });
  }

  /**
   * Download exported file
   */
  downloadExport(exportId: string): Observable<Blob> {
    return this.httpClient.getBlob(`export-import/download/${exportId}`);
  }

  /**
   * Get available export formats and types
   */
  getExportOptions(): Observable<any> {
    return this.httpClient.get<ApiResponse<any>>('export-import/export-options')
      .pipe(map(response => response.data));
  }

  /**
   * Get supported import formats and validation rules
   */
  getImportOptions(): Observable<any> {
    return this.httpClient.get<ApiResponse<any>>('export-import/import-options')
      .pipe(map(response => response.data));
  }

  /**
   * Cancel ongoing export/import operation
   */
  cancelOperation(type: 'export' | 'import', operationId: string): Observable<any> {
    return this.httpClient.delete<ApiResponse<any>>(`export-import/cancel/${type}/${operationId}`)
      .pipe(map(response => response.data));
  }
}
