import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ExportImportService, ExportHistoryItem, ImportHistoryItem } from '../../../../core/services/export-import.service';
import { PaginatedResponse } from '../../../../core/models/api-response.models';

@Injectable({
  providedIn: 'root'
})
export class ExportImportHistoryService {

  constructor(private exportImportService: ExportImportService) { }

  getExportHistory(page = 1, limit = 10): Observable<PaginatedResponse<ExportHistoryItem>> {
    return this.exportImportService.getExportHistory(page, limit);
  }

  getImportHistory(page = 1, limit = 10): Observable<PaginatedResponse<ImportHistoryItem>> {
    return this.exportImportService.getImportHistory(page, limit);
  }

  downloadExport(exportId: string): Observable<Blob> {
    return this.exportImportService.downloadExport(exportId);
  }
}
