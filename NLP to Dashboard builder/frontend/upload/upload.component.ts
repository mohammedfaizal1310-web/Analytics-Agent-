import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '../src/app/shared/components/header/page-header.component';
import { UploadService } from '../src/app/core/services/upload.service';
import { ToastService } from '../src/app/core/services/toast.service';
import { UploadResponse } from '../src/app/core/models';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
})
export class UploadComponent implements OnInit {
  isDragging = signal(false);
  uploading = signal(false);
  lastUpload = signal<UploadResponse | null>(null);

  constructor(
    public uploadService: UploadService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.uploadService.loadUploadedFiles().subscribe();
  }

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging.set(true); }
  onDragLeave() { this.isDragging.set(false); }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) this.upload(file);
  }

  onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.upload(file);
    input.value = '';
  }

  upload(file: File) {
    const allowed = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      this.toast.error('Only CSV and Excel files are supported');
      return;
    }
    this.uploading.set(true);
    this.uploadService.uploadFile(file).subscribe({
      next: (res) => {
        this.lastUpload.set(res);
        this.toast.success(`Uploaded: ${res.file_name} — ${res.rows_loaded} rows`);
        this.uploading.set(false);
      },
      error: (err) => {
        this.toast.error(err.error?.detail ?? 'Upload failed');
        this.uploading.set(false);
      }
    });
  }

  deleteFile(tableName: string) {
    this.uploadService.deleteFile(tableName).subscribe({
      next: () => this.toast.success('File removed'),
      error: () => this.toast.error('Failed to remove file')
    });
  }

  clearAll() {
    this.uploadService.clearAll().subscribe({
      next: () => this.toast.success('All data cleared'),
      error: () => this.toast.error('Failed to clear data')
    });
  }
}