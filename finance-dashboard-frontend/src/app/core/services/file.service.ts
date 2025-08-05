import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FileUploadResponse {
  success: boolean;
  message: string;
  data: any;
}

export interface FileDetailsResponse {
  success: boolean;
  message: string;
  data: any;
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private readonly baseUrl = `${environment.apiUrl}/uploads`;

  constructor(private http: HttpClient) {}

  /**
   * Upload a single file
   */
  uploadSingle(file: File, entityType: string, entityId: string, generateThumbnail = false): Observable<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    formData.append('generateThumbnail', String(generateThumbnail));
    return this.http.post<FileUploadResponse>(`${this.baseUrl}/single`, formData);
  }

  uploadAvatar(file: File): Observable<FileUploadResponse> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.http.post<FileUploadResponse>(`${this.baseUrl}/avatar`, formData);
  }

  /**
   * Upload multiple files
   */
  uploadMultiple(files: File[], entityType: string, entityId: string, generateThumbnail = false): Observable<FileUploadResponse> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    formData.append('generateThumbnail', String(generateThumbnail));
    return this.http.post<FileUploadResponse>(`${this.baseUrl}/multiple`, formData);
  }

  /**
   * Get file details by ID
   */
  getFile(id: string): Observable<FileDetailsResponse> {
    return this.http.get<FileDetailsResponse>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get files by entity
   */
  getFilesByEntity(entityType: string, entityId: string, page = 1, limit = 10): Observable<FileDetailsResponse> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this.http.get<FileDetailsResponse>(`${this.baseUrl}/entity/${entityType}/${entityId}`, { params });
  }

  /**
   * Delete a file by ID
   */
  deleteFile(id: string): Observable<FileDetailsResponse> {
    return this.http.delete<FileDetailsResponse>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get user's avatar
   */
  getUserAvatar(): Observable<FileDetailsResponse> {
    return this.http.get<FileDetailsResponse>(`${this.baseUrl}/avatar/current`);
  }

  /**
   * Update file metadata
   */
  updateFile(id: string, data: { name?: string; description?: string; tags?: string[] }): Observable<FileDetailsResponse> {
    return this.http.put<FileDetailsResponse>(`${this.baseUrl}/${id}`, data);
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): Observable<FileDetailsResponse> {
    return this.http.get<FileDetailsResponse>(`${this.baseUrl}/stats/storage`);
  }

  /**
   * Download file (get download URL)
   */
  getDownloadUrl(id: string): Observable<FileDetailsResponse> {
    return this.http.get<FileDetailsResponse>(`${this.baseUrl}/${id}/download`);
  }
}
