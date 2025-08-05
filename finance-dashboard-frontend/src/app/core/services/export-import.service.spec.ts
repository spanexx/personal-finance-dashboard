import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ExportImportService, ExportOptions, ImportOptions, ExportResult, ImportResult } from './export-import.service';
import { HttpClientService } from './http-client.service';
import { ApiResponse, PaginatedResponse } from '../models/api-response.models';

describe('ExportImportService', () => {
  let service: ExportImportService;
  let httpClientSpy: jasmine.SpyObj<HttpClientService>;

  beforeEach(() => {
    httpClientSpy = jasmine.createSpyObj('HttpClientService', ['post', 'get', 'getBlob', 'delete']);

    TestBed.configureTestingModule({
      providers: [
        ExportImportService,
        { provide: HttpClientService, useValue: httpClientSpy }
      ]
    });
    service = TestBed.inject(ExportImportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should export data', (done) => {
    const mockExportResult: ExportResult = {
      fileName: 'test.csv',
      downloadUrl: 'http://test.com/test.csv',
      fileSize: 100,
      recordCount: 10,
      format: 'csv',
      type: 'transactions'
    };
    const mockApiResponse: ApiResponse<ExportResult> = { success: true, data: mockExportResult };
    httpClientSpy.post.and.returnValue(of(mockApiResponse));

    const options: ExportOptions = { format: 'csv', type: 'transactions' };
    service.exportData(options).subscribe(result => {
      expect(result).toEqual(mockExportResult);
      expect(httpClientSpy.post).toHaveBeenCalledWith('export-import/export', options);
      done();
    });
  });

  it('should import data', (done) => {
    const mockImportResult: ImportResult = {
      recordsProcessed: 10,
      recordsImported: 10,
      recordsSkipped: 0,
      errors: [],
      warnings: [],
      summary: {}
    };
    const mockApiResponse: ApiResponse<ImportResult> = { success: true, data: mockImportResult };
    httpClientSpy.post.and.returnValue(of(mockApiResponse));

    const file = new File([''], 'test.csv', { type: 'text/csv' });
    const options: ImportOptions = { type: 'transactions' };
    const formData = new FormData();
    formData.append('importFile', file);
    formData.append('type', options.type);

    service.importData(file, options).subscribe(result => {
      expect(result).toEqual(mockImportResult);
      expect(httpClientSpy.post).toHaveBeenCalled(); // Cannot directly compare FormData
      done();
    });
  });

  it('should validate import file', (done) => {
    const mockValidationResult = { isValid: true };
    const mockApiResponse: ApiResponse<any> = { success: true, data: mockValidationResult };
    httpClientSpy.post.and.returnValue(of(mockApiResponse));

    const file = new File([''], 'test.csv', { type: 'text/csv' });
    const type = 'transactions';

    service.validateImportFile(file, type).subscribe(result => {
      expect(result).toEqual(mockValidationResult);
      expect(httpClientSpy.post).toHaveBeenCalled(); // Cannot directly compare FormData
      done();
    });
  });

  it('should get export history', (done) => {
    const mockExportHistory: PaginatedResponse<any> = { data: [], totalCount: 0, pageSize: 10, currentPage: 1 };
    httpClientSpy.get.and.returnValue(of(mockExportHistory));

    service.getExportHistory().subscribe(history => {
      expect(history).toEqual(mockExportHistory);
      expect(httpClientSpy.get).toHaveBeenCalledWith('export-import/exports', { params: { page: 1, limit: 10 } });
      done();
    });
  });

  it('should get import history', (done) => {
    const mockImportHistory: PaginatedResponse<any> = { data: [], totalCount: 0, pageSize: 10, currentPage: 1 };
    httpClientSpy.get.and.returnValue(of(mockImportHistory));

    service.getImportHistory().subscribe(history => {
      expect(history).toEqual(mockImportHistory);
      expect(httpClientSpy.get).toHaveBeenCalledWith('export-import/imports', { params: { page: 1, limit: 10 } });
      done();
    });
  });

  it('should download export', (done) => {
    const mockBlob = new Blob(['test'], { type: 'text/csv' });
    httpClientSpy.getBlob.and.returnValue(of(mockBlob));

    const exportId = '123';
    service.downloadExport(exportId).subscribe(blob => {
      expect(blob).toEqual(mockBlob);
      expect(httpClientSpy.getBlob).toHaveBeenCalledWith(`export-import/download/${exportId}`);
      done();
    });
  });

  it('should get export options', (done) => {
    const mockExportOptions = { formats: ['csv'] };
    const mockApiResponse: ApiResponse<any> = { success: true, data: mockExportOptions };
    httpClientSpy.get.and.returnValue(of(mockApiResponse));

    service.getExportOptions().subscribe(options => {
      expect(options).toEqual(mockExportOptions);
      expect(httpClientSpy.get).toHaveBeenCalledWith('export-import/export-options');
      done();
    });
  });

  it('should get import options', (done) => {
    const mockImportOptions = { formats: ['csv'] };
    const mockApiResponse: ApiResponse<any> = { success: true, data: mockImportOptions };
    httpClientSpy.get.and.returnValue(of(mockApiResponse));

    service.getImportOptions().subscribe(options => {
      expect(options).toEqual(mockImportOptions);
      expect(httpClientSpy.get).toHaveBeenCalledWith('export-import/import-options');
      done();
    });
  });

  it('should cancel operation', (done) => {
    const mockCancelResult = { message: 'Cancelled' };
    const mockApiResponse: ApiResponse<any> = { success: true, data: mockCancelResult };
    httpClientSpy.delete.and.returnValue(of(mockApiResponse));

    const type = 'export';
    const operationId = '456';
    service.cancelOperation(type, operationId).subscribe(result => {
      expect(result).toEqual(mockCancelResult);
      expect(httpClientSpy.delete).toHaveBeenCalledWith(`export-import/cancel/${type}/${operationId}`);
      done();
    });
  });
});
