import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { UploadedFile, UploadResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private http = inject(HttpClient);

  uploadedFiles = signal<UploadedFile[]>([]);

  loadUploadedFiles() {
    return this.http.get<{ uploaded_files: UploadedFile[] }>('/api/upload-status').pipe(
      tap(res => this.uploadedFiles.set(res.uploaded_files ?? []))
    );
  }

  uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadResponse>('/api/upload', formData).pipe(
      tap(() => this.loadUploadedFiles().subscribe())
    );
  }

  deleteFile(tableName: string) {
    return this.http.delete(`/api/upload-file/${tableName}`).pipe(
      tap(() => this.uploadedFiles.update(f => f.filter(x => x.table_name !== tableName)))
    );
  }

  clearAll() {
    return this.http.delete('/api/clear-data').pipe(
      tap(() => this.uploadedFiles.set([]))
    );
  }
}
