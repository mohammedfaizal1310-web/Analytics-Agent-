import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../shared/components/header/page-header.component';
import { DatasetService } from '../../core/services/dataset.service';
import { ToastService } from '../../core/services/toast.service';
import { DatasetSummary } from '../../core/models';

@Component({
  selector: 'app-datasets',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './datasets.component.html',
  styleUrl: './datasets.component.scss'
})
export class DatasetsComponent implements OnInit {
  datasets      = signal<DatasetSummary[]>([]);
  loading       = signal(true);
  showForm      = signal(false);
  creating      = signal(false);

  newName       = signal('');
  newDesc       = signal('');
  newData       = signal('');
  jsonError     = signal('');

  constructor(
    private datasetService: DatasetService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.loadDatasets();
  }

  loadDatasets() {
    this.loading.set(true);
    this.datasetService.listDatasets().subscribe({
      next: (res) => { this.datasets.set(res.datasets ?? []); this.loading.set(false); },
      error: () => { this.toast.error('Failed to load datasets'); this.loading.set(false); }
    });
  }

  toggleForm() {
    this.showForm.update(v => !v);
    this.resetForm();
  }

  validateJson(): boolean {
    try {
      const parsed = JSON.parse(this.newData());
      if (!Array.isArray(parsed)) { this.jsonError.set('Data must be a JSON array'); return false; }
      this.jsonError.set('');
      return true;
    } catch {
      this.jsonError.set('Invalid JSON format');
      return false;
    }
  }

  createDataset() {
    if (!this.newName().trim()) { this.toast.warning('Dataset name is required'); return; }
    if (!this.newData().trim()) { this.toast.warning('Data JSON is required'); return; }
    if (!this.validateJson()) { return; }

    const data = JSON.parse(this.newData()) as Record<string, unknown>[];

    this.creating.set(true);
    this.datasetService.createDataset({
      name: this.newName().trim(),
      description: this.newDesc().trim() || undefined,
      data
    }).subscribe({
      next: () => {
        this.toast.success(`Dataset "${this.newName()}" created`);
        this.creating.set(false);
        this.showForm.set(false);
        this.resetForm();
        this.loadDatasets();
      },
      error: (err) => {
        this.toast.error((err.error as { detail?: string })?.detail ?? 'Failed to create dataset');
        this.creating.set(false);
      }
    });
  }

  deleteDataset(id: string, name: string) {
    if (!confirm(`Delete dataset "${name}"? This cannot be undone.`)) return;
    this.datasetService.deleteDataset(id).subscribe({
      next: () => {
        this.toast.success('Dataset deleted');
        this.datasets.update(ds => ds.filter(d => d.id !== id));
      },
      error: () => this.toast.error('Failed to delete dataset')
    });
  }

  private resetForm() {
    this.newName.set('');
    this.newDesc.set('');
    this.newData.set('');
    this.jsonError.set('');
  }
}
