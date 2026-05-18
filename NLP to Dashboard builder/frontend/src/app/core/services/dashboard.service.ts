import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GeneratedDashboard } from '../models';

interface DashboardRequest {
  prompt: string;
  dataset_id?: string;
  table_name?: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);

  generateDashboard(req: DashboardRequest) {
    return this.http.post<GeneratedDashboard>('/api/generate-page', req);
  }

  listDashboards() {
    return this.http.get<{ dashboards: unknown[] }>('/api/dashboards');
  }

  getDashboard(id: string) {
    return this.http.get(`/api/dashboard/${id}`);
  }
}
