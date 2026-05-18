import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../shared/components/header/page-header.component';
import { ChartRendererComponent, ChartDef } from '../../shared/components/chart-renderer/chart-renderer.component';
import { DashboardService } from '../../core/services/dashboard.service';
import { DatasetService }   from '../../core/services/dataset.service';
import { UploadService }    from '../../core/services/upload.service';
import { ToastService }     from '../../core/services/toast.service';
import { GeneratedDashboard, DatasetSummary, DashboardChart } from '../../core/models';

const CARD_KEYWORDS = [
  'kpi', 'card', 'tile', 'summary card', 'metric card',
  'dashboard', 'overview', 'summary', 'report', 'full', 'analytics'
];

@Component({
  selector:    'app-dashboard-builder',
  standalone:  true,
  imports:     [CommonModule, FormsModule, PageHeaderComponent, ChartRendererComponent],
  templateUrl: './dashboard-builder.component.html',
  styleUrl:    './dashboard-builder.component.scss',
})
export class DashboardBuilderComponent implements OnInit {

  prompt  = signal('');
  xAxis   = '';
  yAxis   = '';

  sourceType        = signal<'dataset' | 'table'>('table');
  selectedDatasetId = signal('');
  selectedTableName = signal('');

  generating      = signal(false);
  dashboard       = signal<GeneratedDashboard | null>(null);
  datasets        = signal<DatasetSummary[]>([]);
  savedDashboards = signal<any[]>([]);

  /** True only when the user's prompt explicitly asks for KPI cards / dashboard */
  showCards = signal(false);

  readonly chartColors = [
    '#4A7CFF','#00CFAD','#9B72FF','#FF8C42','#FF5E6C','#36E09A'
  ];

  readonly samplePrompts = [
    'Create a sales overview with revenue by region and monthly trend',
    'Show inventory status with stock levels and category breakdown',
    'Build an HR analytics dashboard with headcount and department distribution',
    'Create a financial summary with KPIs and quarterly performance chart',
  ];

  constructor(
    private dashboardService: DashboardService,
    private datasetService:   DatasetService,
    public  uploadService:    UploadService,
    private toast:            ToastService,
  ) {}

  ngOnInit(): void {
    this.uploadService.loadUploadedFiles().subscribe();
    this.datasetService.listDatasets().subscribe({
      next: r => this.datasets.set((r as any).datasets ?? []),
      error: () => {}
    });
    this.dashboardService.listDashboards().subscribe({
      next: r => this.savedDashboards.set((r as any).dashboards ?? []),
      error: () => this.savedDashboards.set([])
    });
  }

  generate(): void {
    if (!this.prompt().trim()) { this.toast.warning('Enter a prompt first'); return; }

    const hasSource = this.sourceType() === 'dataset'
      ? !!this.selectedDatasetId()
      : !!this.selectedTableName();
    if (!hasSource) { this.toast.warning('Select a data source'); return; }

    // Decide whether to show KPI cards based on prompt keywords
    const p = this.prompt().toLowerCase();
    this.showCards.set(CARD_KEYWORDS.some(kw => p.includes(kw)));

    this.generating.set(true);
    this.dashboard.set(null);

    let enriched = this.prompt().trim();
    if (this.xAxis.trim()) enriched += `. X-axis: ${this.xAxis.trim()}`;
    if (this.yAxis.trim()) enriched += `. Y-axis: ${this.yAxis.trim()}`;

    const req = {
      prompt: enriched,
      ...(this.sourceType() === 'dataset'
        ? { dataset_id: this.selectedDatasetId() }
        : { table_name: this.selectedTableName() })
    };

    this.dashboardService.generateDashboard(req).subscribe({
      next: res => {
        this.dashboard.set(res);
        this.generating.set(false);
        this.toast.success('Dashboard generated!');
      },
      error: err => {
        this.toast.error(err.error?.detail ?? 'Generation failed');
        this.generating.set(false);
      },
    });
  }

  prepareChart(chart: DashboardChart, index: number): ChartDef {
    const rawType   = (chart.type ?? 'bar') as string;
    const isStacked = rawType.includes('stacked');
    const xAxisLabel = this.xAxis.trim() || (chart as any).x_axis || undefined;
    const yAxisLabel = this.yAxis.trim() || (chart as any).y_axis || undefined;

    return {
      type:        rawType,
      title:       chart.title,
      description: chart.description,
      labels:      chart.labels ?? [],
      x_axis:      xAxisLabel,
      y_axis:      yAxisLabel,
      datasets:    (chart.datasets ?? []).map((ds, i) => ({
        label: ds.label ?? `Series ${i + 1}`,
        data:  ds.data  ?? [],
        color: (ds as any).color ?? this.chartColors[(index * 3 + i) % this.chartColors.length],
        ...(isStacked ? { stack: (ds as any).stack ?? 'stack0' } : {})
      }))
    };
  }

  getTrendIcon(trend?: string): string {
    return trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'trending_flat';
  }
  getTrendClass(trend?: string): string {
    return trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'flat';
  }
  cardColorAt(i: number): string { return this.chartColors[i % this.chartColors.length]; }
  trackByIdx = (i: number): number => i;
}