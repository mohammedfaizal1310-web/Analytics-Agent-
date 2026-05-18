import {
  Component, Input, ViewChild, ElementRef,
  AfterViewInit, OnChanges, SimpleChanges, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

export interface ChartDef {
  type: string;
  title: string;
  description?: string;
  labels?: string[];
  x_axis?: string;
  y_axis?: string;
  datasets: { label: string; data: number[]; color?: string; stack?: string; }[];
}

const PALETTE = [
  '#4A7CFF','#00CFAD','#9B72FF','#FF8C42',
  '#FF5E6C','#36E09A','#FFD166','#06D6A0','#118AB2','#EF476F'
];

@Component({
  selector: 'app-chart-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-card">
      <div class="chart-header">
        <div class="chart-header-left">
          <h3 class="chart-title">{{ chart.title }}</h3>
          <p class="chart-desc" *ngIf="chart.description">{{ chart.description }}</p>
          <div class="axis-tags" *ngIf="chart.x_axis || chart.y_axis">
            <span class="axis-tag" *ngIf="chart.x_axis"><b class="ax">X</b> {{ chart.x_axis }}</span>
            <span class="axis-tag" *ngIf="chart.y_axis"><b class="ax">Y</b> {{ chart.y_axis }}</span>
          </div>
        </div>
        <span class="chart-badge">{{ chart.type }}</span>
      </div>

      <!-- Wrapper: explicit 380px height, position:relative -->
      <div class="chart-body" #wrapperRef>
        <canvas #canvasRef></canvas>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .chart-card {
      background: #141827;
      border: 1px solid #1E2640;
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transition: border-color .25s ease, box-shadow .25s ease;
    }
    .chart-card:hover {
      border-color: rgba(74,124,255,.35);
      box-shadow: 0 8px 28px rgba(0,0,0,.3);
    }

    .chart-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .chart-header-left { display:flex; flex-direction:column; gap:6px; flex:1; min-width:0; }
    .chart-title { margin:0; font-family:'Syne',sans-serif; font-size:1rem; font-weight:700; color:#E8ECF8; letter-spacing:-.01em; }
    .chart-desc  { margin:0; font-size:.77rem; color:#5A6484; line-height:1.45; }

    .axis-tags { display:flex; gap:8px; flex-wrap:wrap; }
    .axis-tag {
      display:inline-flex; align-items:center; gap:5px;
      font-size:.68rem; color:#A8B4D0;
      background:rgba(74,124,255,.09); border:1px solid rgba(74,124,255,.22);
      padding:2px 10px; border-radius:99px;
    }
    .ax { color:#4A7CFF; font-weight:700; font-style:normal; }

    .chart-badge {
      flex-shrink:0; padding:3px 10px; border-radius:99px;
      font-size:.62rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
      background:rgba(74,124,255,.13); color:#4A7CFF;
      border:1px solid rgba(74,124,255,.22); white-space:nowrap;
    }

    /*
     * CRITICAL: wrapper must be position:relative with a hard pixel height.
     * canvas must be position:absolute so height:100% resolves to 380px.
     * This is the ONLY CSS pattern that works reliably across all grid cells.
     */
    .chart-body {
      position: relative;
      width: 100%;
      height: 380px;
    }
    canvas {
      position: absolute !important;
      top: 0 !important; left: 0 !important;
      width: 100% !important;
      height: 100% !important;
    }
  `]
})
export class ChartRendererComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() chart!: ChartDef;
  @ViewChild('canvasRef')  canvasRef!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('wrapperRef') wrapperRef!: ElementRef<HTMLDivElement>;

  private instance: Chart | null = null;
  private observer: ResizeObserver | null = null;

  ngAfterViewInit(): void  { this.attach(); }
  ngOnChanges(c: SimpleChanges): void { if (c['chart'] && !c['chart'].firstChange) { this.detach(); this.attach(); } }
  ngOnDestroy(): void { this.detach(); this.kill(); }

  private attach(): void {
    const wrapper = this.wrapperRef?.nativeElement;
    if (!wrapper) return;

    /*
     * ResizeObserver fires as soon as the wrapper element gains real pixel
     * dimensions — this works for ALL charts in a *ngFor grid, not just the
     * first one. disconnect() after the first successful build so we never
     * rebuild on window resize (Chart.js handles that via responsive:true).
     */
    this.observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 10 && rect.height > 10) {
        this.detach();
        this.kill();
        this.build();
      }
    });
    this.observer.observe(wrapper);
  }

  private detach(): void { if (this.observer) { this.observer.disconnect(); this.observer = null; } }
  private kill():   void { if (this.instance)  { this.instance.destroy();    this.instance  = null; } }

  private mapType(raw: string): ChartType {
    const t = (raw || 'bar').toLowerCase().trim();
    const m: Record<string, ChartType> = {
      column:'bar', clustered_column:'bar', clustered_bar:'bar',
      stacked_bar:'bar', stacked_column:'bar',
      area:'line', donut:'doughnut', polar:'polarArea',
    };
    return (m[t] ?? t) as ChartType;
  }

  private build(): void {
    const canvas  = this.canvasRef?.nativeElement;
    const wrapper = this.wrapperRef?.nativeElement;
    if (!canvas || !wrapper || !this.chart) return;

    // Stamp explicit pixel dimensions before getContext() — belt and suspenders
    canvas.width  = wrapper.clientWidth  || 600;
    canvas.height = wrapper.clientHeight || 380;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const raw     = this.chart.type || 'bar';
    const type    = this.mapType(raw);
    const isCirc  = type === 'pie' || type === 'doughnut';
    const isLine  = type === 'line';
    const isStack = raw.toLowerCase().includes('stacked');
    const isRadar = type === 'radar';
    const isScat  = type === 'scatter';
    const labels  = this.chart.labels || [];

    const datasets = (this.chart.datasets || []).map((ds, i) => {
      const clr = ds.color || PALETTE[i % PALETTE.length];
      // Circular: each slice MUST have its own colour in an array
      const sliceBg = labels.map((_, li) => PALETTE[(i * 4 + li) % PALETTE.length]);

      return {
        label:            ds.label || `Series ${i + 1}`,
        data:             ds.data  || [],
        backgroundColor:  isCirc ? sliceBg : isLine ? clr + '22' : clr + 'CC',
        borderColor:      isCirc ? '#141827' : clr,
        borderWidth:      isCirc ? 2 : isLine ? 2.5 : 0,
        fill:             isLine ? 'origin' : false,
        tension:          0.4,
        pointRadius:      isLine ? 4 : isScat ? 6 : 0,
        pointHoverRadius: isLine ? 7 : isScat ? 9 : 0,
        pointBackgroundColor: isLine ? clr : undefined,
        borderRadius:     (!isCirc && !isLine && !isRadar && !isScat) ? 5 : 0,
        hoverOffset:      isCirc ? 10 : undefined,
        ...(isStack ? { stack: ds.stack || 'stack0' } : {}),
      };
    });

    const grid = 'rgba(30,38,64,0.7)';
    const tick = '#5A6484';
    const ff   = "'DM Sans',sans-serif";

    const axisTitle = (label?: string) =>
      label ? { display:true, text:label, color:'#A8B4D0', font:{ size:12, weight:700 as any, family:ff } }
            : { display:false as const };

    const scales: any =
      isCirc  ? {}
    : isRadar ? { r:{ ticks:{ color:tick, backdropColor:'transparent', font:{ size:10, family:ff } },
                      grid:{ color:grid }, pointLabels:{ color:'#A8B4D0', font:{ size:11, family:ff } } } }
             : { x:{ stacked:isStack, grid:{ color:grid },
                     ticks:{ color:tick, font:{ size:11, family:ff }, maxRotation:45 },
                     title:axisTitle(this.chart.x_axis) },
                 y:{ stacked:isStack, beginAtZero:true, grid:{ color:grid },
                     ticks:{ color:tick, font:{ size:11, family:ff } },
                     title:axisTitle(this.chart.y_axis) } };

    this.instance = new Chart(ctx, {
      type,
      data: { labels, datasets },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        animation: { duration:600, easing:'easeInOutQuart' },
        layout:  { padding: isCirc ? 16 : 8 },
        plugins: {
          legend: {
            display:  true,
            position: isCirc ? 'right' : 'top',
            align:    isCirc ? 'center' : 'start',
            labels: { color:'#A8B4D0', font:{ family:ff, size:11 },
                      boxWidth:12, boxHeight:12, padding:14,
                      usePointStyle:isCirc, pointStyle:isCirc ? 'circle' : undefined },
          },
          tooltip: { backgroundColor:'#141827', borderColor:'#1E2640', borderWidth:1,
                     titleColor:'#E8ECF8', bodyColor:'#A8B4D0', padding:10, cornerRadius:8 },
        },
        scales,
      },
    });
  }
}