import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatasetSummary } from '../models';

interface DatasetCreate {
  name: string;
  description?: string;
  data: Record<string, unknown>[];
}

@Injectable({ providedIn: 'root' })
export class DatasetService {
  private http = inject(HttpClient);

  listDatasets() {
    return this.http.get<{ datasets: DatasetSummary[] }>('/api/datasets');
  }

  getDataset(id: string) {
    return this.http.get<DatasetSummary>(`/api/datasets/${id}`);
  }

  createDataset(payload: DatasetCreate) {
    return this.http.post<{ id: string; message: string }>('/api/datasets', payload);
  }

  deleteDataset(id: string) {
    return this.http.delete<{ message: string }>(`/api/datasets/${id}`);
  }
}
