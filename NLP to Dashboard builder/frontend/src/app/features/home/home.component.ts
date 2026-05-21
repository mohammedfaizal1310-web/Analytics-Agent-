import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../shared/components/header/page-header.component';
import { UploadService } from '../../core/services/upload.service';
import { SessionService } from '../../core/services/session.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { DatasetService } from '../../core/services/dataset.service';
import { forkJoin } from 'rxjs';

interface QuickAction {
  icon: string;
  label: string;
  description: string;
  route: string;
  color: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  uploadCount    = signal(0);
  sessionCount   = signal(0);
  dashboardCount = signal(0);
  datasetCount   = signal(0);
  loading        = signal(true);

  today = new Date();

  readonly quickActions: QuickAction[] = [
    {
      icon: 'psychology',
      label: 'Query Studio',
      description: 'Ask questions about your data in plain English. Get SQL + AI-powered narrative insights.',
      route: '/chat',
      color: '#4A7CFF',
    },
    {
      icon: 'insights',
      label: 'Insights Hub',
      description: 'Describe what you want to visualise and the AI generates a complete dashboard instantly.',
      route: '/builder',
      color: '#9B72FF',
    },
    {
      icon: 'dataset',
      label: 'Data Sources',
      description: 'Manage JSON datasets stored in Datasources. Attach them to dashboards for rich visualisations.',
      route: '/datasets',
      color: '#FF8C42',
    }
  ];

  readonly capabilities = [
    { icon: 'auto_awesome',  label: 'LLM-Powered SQL Generation' },
    { icon: 'table_chart',   label: 'Multi-format Data Ingestion' },
    { icon: 'bar_chart',     label: 'Dynamic Chart Rendering' },
    { icon: 'storage',       label: 'SQLite + MongoDB Storage' },
    { icon: 'history',       label: 'Persistent Chat Sessions' },
    { icon: 'bolt',          label: 'Real-time Query Execution' },
  ];

  constructor(
    private uploadService:    UploadService,
    private sessionService:   SessionService,
    private dashboardService: DashboardService,
    private datasetService:   DatasetService
  ) {}

  ngOnInit() {
    forkJoin({
      uploads:    this.uploadService.loadUploadedFiles(),
      sessions:   this.sessionService.loadSessions(),
      dashboards: this.dashboardService.listDashboards(),
      datasets:   this.datasetService.listDatasets()
    }).subscribe({
      next: (results) => {
        this.uploadCount.set((results.uploads as { uploaded_files?: unknown[] }).uploaded_files?.length ?? 0);
        this.sessionCount.set((results.sessions as unknown[]).length ?? 0);
        this.dashboardCount.set((results.dashboards as { dashboards?: unknown[] }).dashboards?.length ?? 0);
        this.datasetCount.set((results.datasets as { datasets?: unknown[] }).datasets?.length ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}