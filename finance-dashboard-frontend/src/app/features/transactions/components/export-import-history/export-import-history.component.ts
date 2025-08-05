import { Component, OnInit } from '@angular/core';
import { ExportImportHistoryService } from '../../services/export-import-history.service';
import { ExportHistoryItem, ImportHistoryItem } from '../../../../core/services/export-import.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { PaginatedResponse } from '../../../../core/models/api-response.models';
import { PageEvent } from '@angular/material/paginator';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-export-import-history',
  templateUrl: './export-import-history.component.html',
  styleUrls: ['./export-import-history.component.scss']
})
export class ExportImportHistoryComponent implements OnInit {
  exports$: Observable<PaginatedResponse<ExportHistoryItem>>;
  imports$: Observable<PaginatedResponse<ImportHistoryItem>>;

  exportDisplayedColumns: string[] = ['fileName', 'format', 'status', 'recordCount', 'createdAt', 'actions'];
  importDisplayedColumns: string[] = ['originalFileName', 'type', 'status', 'recordsImported', 'createdAt', 'actions'];

  exportPagination = new BehaviorSubject<PageEvent>({ pageIndex: 0, pageSize: 10, length: 0 });
  importPagination = new BehaviorSubject<PageEvent>({ pageIndex: 0, pageSize: 10, length: 0 });

  isLoadingExports = false;
  isLoadingImports = false;

  constructor(
    private exportImportHistoryService: ExportImportHistoryService,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadExports();
    this.loadImports();
  }

  loadExports(): void {
    this.isLoadingExports = true;
    const pageEvent = this.exportPagination.getValue();
    this.exports$ = this.exportImportHistoryService.getExportHistory(pageEvent.pageIndex + 1, pageEvent.pageSize);
    this.exports$.subscribe(() => this.isLoadingExports = false);
  }

  loadImports(): void {
    this.isLoadingImports = true;
    const pageEvent = this.importPagination.getValue();
    this.imports$ = this.exportImportHistoryService.getImportHistory(pageEvent.pageIndex + 1, pageEvent.pageSize);
    this.imports$.subscribe(() => this.isLoadingImports = false);
  }

  onExportPageChange(event: PageEvent): void {
    this.exportPagination.next(event);
    this.loadExports();
  }

  onImportPageChange(event: PageEvent): void {
    this.importPagination.next(event);
    this.loadImports();
  }

  downloadExport(exportItem: ExportHistoryItem): void {
    this.exportImportHistoryService.downloadExport(exportItem._id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportItem.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.notificationService.showSuccess('File downloaded successfully.');
      },
      error: () => {
        this.notificationService.showError('Failed to download file.');
      }
    });
  }
}