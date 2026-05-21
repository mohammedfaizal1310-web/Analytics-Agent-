import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PageHeaderComponent } from '../../shared/components/header/page-header.component';
import { DatasetService } from '../../core/services/dataset.service';
import { ToastService } from '../../core/services/toast.service';

export interface Connector {
  id: string;
  name: string;
  abbr: string;
  tag: string;
  color: string;
  svgLogo?: string;
  imagePath?: string;
  comingSoon?: boolean;
}

export interface ConnectedSource {
  name: string;
  meta: string;
  color: string;
  icon: string;
  logo?: string;
}

@Component({
  selector: 'app-datasets',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './datasets.component.html',
  styleUrl: './datasets.component.scss'
})
export class DatasetsComponent implements OnInit {

  // ── Connected sources ─────────────────────────────────────────
  connectedSources = signal<ConnectedSource[]>([]);

  // ── Modal state ───────────────────────────────────────────────
  showMongoModal      = signal(false);
  showComingSoonModal = signal(false);
  activeConnector     = signal<Connector | null>(null);

  // ── MongoDB wizard state ──────────────────────────────────────
  mongoStep       = signal(1);
  mongoDriver     = signal('nodejs');
  mongoVersion    = signal('6.7+');
  mongoUri        = signal('');
  mongoDb         = signal('');
  mongoCollection = signal('');

  // ── Image-based connector logos ───────────────────────────────
  // Maps connector id → path under assets/connectors/
  private readonly connectorImages: Record<string, string> = {
    'sap':       'assets/connectors/sap.png',
    'sap-s4':    'assets/connectors/sap.png',
    'sap-sf':    'assets/connectors/sap.png',
    'sap-bw':    'assets/connectors/sap.png',
    'sap-ecc':   'assets/connectors/sap.png',
    'sap-ariba': 'assets/connectors/sap.png',
    'adf':       'assets/connectors/azure_data_factory.webp',
    'fabric':    'assets/connectors/fabric_twitter_OG_image.png',
    'mongodb':   'assets/connectors/mongo-db.png',
    'bigquery':  'assets/connectors/bigquery.png',
    'oracle':    'assets/connectors/oracle.png',
  };

  // ── Fallback SVG logos (only used for connectors with no image) ──
  private readonly fallbackSvgs: Record<string, string> = {
    // SQL Server — official red
    'sql': `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sqlg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#CC2927"/>
          <stop offset="100%" stop-color="#FF6B6B"/>
        </linearGradient>
      </defs>
      <rect width="56" height="56" rx="8" fill="url(#sqlg)"/>
      <ellipse cx="28" cy="18" rx="14" ry="5" fill="#fff" opacity="0.9"/>
      <rect x="14" y="18" width="28" height="18" fill="#fff" opacity="0.2"/>
      <ellipse cx="28" cy="36" rx="14" ry="5" fill="#fff" opacity="0.6"/>
      <line x1="14" y1="18" x2="14" y2="36" stroke="#fff" stroke-width="1.5" opacity="0.5"/>
      <line x1="42" y1="18" x2="42" y2="36" stroke="#fff" stroke-width="1.5" opacity="0.5"/>
    </svg>`,

    // Others — plus icon
    'others': `<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
      <rect width="56" height="56" rx="8" fill="#2A2F3A"/>
      <line x1="28" y1="14" x2="28" y2="42" stroke="#6B7480" stroke-width="4" stroke-linecap="round"/>
      <line x1="14" y1="28" x2="42" y2="28" stroke="#6B7480" stroke-width="4" stroke-linecap="round"/>
    </svg>`,
  };

  /** Returns image path if one exists for the connector id, otherwise null */
  getConnectorImage(id: string): string | null {
    return this.connectorImages[id] ?? null;
  }

  /** Returns fallback SVG SafeHtml for connectors without an image */
  getSafeSvg(id: string): SafeHtml {
    const svg = this.fallbackSvgs[id] ?? this.fallbackSvgs['others'];
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  // ── SAP Connectors ────────────────────────────────────────────
  readonly sapConnectors: Connector[] = [
    { id: 'sap-s4',    name: 'SAP S/4HANA',        abbr: 'S4',  tag: 'ERP · Real-time',       color: '#0070F3', imagePath: 'assets/connectors/sap.png' },
    { id: 'sap-sf',    name: 'SAP SuccessFactors',  abbr: 'SF',  tag: 'HCM · HR Analytics',    color: '#F0AB00', imagePath: 'assets/connectors/sap.png' },
    { id: 'sap-bw',    name: 'SAP BW/4HANA',        abbr: 'BW',  tag: 'Data Warehouse',         color: '#009FDB', imagePath: 'assets/connectors/sap.png' },
    { id: 'sap-ecc',   name: 'SAP ECC',             abbr: 'EC',  tag: 'Legacy ERP',             color: '#1C77B8', imagePath: 'assets/connectors/sap.png' },
    { id: 'sap-ariba', name: 'SAP Ariba',           abbr: 'AR',  tag: 'Procurement',            color: '#007DB8', imagePath: 'assets/connectors/sap.png' },
  ];

  // ── Microsoft Connectors ──────────────────────────────────────
  readonly microsoftConnectors: Connector[] = [
    { id: 'adf',    name: 'Azure Data Factory', abbr: 'ADF', tag: 'ETL · Pipelines',   color: '#0078D4', imagePath: 'assets/connectors/azure_data_factory.webp' },
    { id: 'fabric', name: 'Microsoft Fabric',   abbr: 'MF',  tag: 'Unified Analytics', color: '#742774', imagePath: 'assets/connectors/fabric_twitter_OG_image.png' },
    { id: 'sql',    name: 'SQL Server',         abbr: 'SQL', tag: 'Relational DB',     color: '#CC2927' },
  ];

  // ── Database Connectors ───────────────────────────────────────
  readonly dbConnectors: Connector[] = [
    { id: 'mongodb',  name: 'MongoDB',         abbr: 'MG', tag: 'NoSQL · Document DB',   color: '#00ED64', imagePath: 'assets/connectors/mongo-db.png' },
    { id: 'bigquery', name: 'Google BigQuery', abbr: 'BQ', tag: 'Cloud Data Warehouse',  color: '#1A73E8', imagePath: 'assets/connectors/bigquery.png' },
    { id: 'oracle',   name: 'Oracle DB',       abbr: 'OR', tag: 'Enterprise RDBMS',      color: '#F80000', imagePath: 'assets/connectors/oracle.png' },
    { id: 'others',   name: 'Others',          abbr: '+',  tag: 'Custom / REST / JDBC',  color: '#6B7480' },
  ];

  constructor(
    private datasetService: DatasetService,
    private toast: ToastService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {}

  openConnector(c: Connector) {
    this.activeConnector.set(c);
    if (c.id === 'mongodb') {
      this.mongoStep.set(1);
      this.showMongoModal.set(true);
    } else {
      this.showComingSoonModal.set(true);
    }
  }

  stepNext() { this.mongoStep.set(this.mongoStep() + 1); }
  stepBack() { this.mongoStep.set(this.mongoStep() - 1); }

  closeModal() {
    this.showMongoModal.set(false);
    this.showComingSoonModal.set(false);
    this.activeConnector.set(null);
    this.mongoStep.set(1);
  }

  connectMongo() {
    if (!this.mongoUri().trim()) {
      this.toast.warning('Please enter a connection string');
      return;
    }
    if (!this.mongoDb().trim()) {
      this.toast.warning('Please enter a database name');
      return;
    }
    this.connectedSources.update(src => [
      ...src,
      {
        name: `MongoDB · ${this.mongoDb()}`,
        meta: this.mongoUri().slice(0, 38) + '…',
        color: '#00ED64',
        icon: 'storage',
        logo: 'assets/connectors/mongo-db.png',
      }
    ]);
    this.toast.success('MongoDB connection established successfully');
    this.closeModal();
  }
}