// ─── SESSION ──────────────────────────────────────────────────────────────────
export interface Session {
  id: number;
  session_name: string;
  created_at?: string;
}

// ─── CHAT ─────────────────────────────────────────────────────────────────────
export interface ChatRequest {
  session_id: number;
  query: string;
}

export interface ChatResponse {
  session_id: number;
  sql: string;
  columns?: string[];
  rows?: any[][];
  response: string;
  error?: string;
}

// Alias — some services import this name
export type ChatApiResponse = ChatResponse;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  columns?: string[];
  rows?: any[][];
  error?: string;
  timestamp: Date;
  isLoading?: boolean;
}

export interface ChatHistoryEntry {
  id: number;
  session_id: number;
  user_query: string;
  bot_response: string;
  sql_query: string;
  created_at?: string;
}

// Alias — some services import this name
export type ChatHistory = ChatHistoryEntry;

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
export interface UploadedFile {
  file_name: string;
  table_name: string;
  uploaded_at?: string;
}

export interface UploadResponse {
  message: string;
  file_name: string;
  table_name: string;
  rows_loaded: number;
  columns: string[];
}

// ─── DATASET ──────────────────────────────────────────────────────────────────
export interface Dataset {
  id?: string;
  name: string;
  description?: string;
  data: Record<string, any>[];
  created_at?: string;
}

export interface DatasetSummary {
  id: string;
  name: string;
  description?: string;
  row_count?: number;
  created_at?: string;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export interface DashboardCard {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trend_value?: string;
  color?: string;
  icon?: string;
}

export interface DashboardChart {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'area' | 'radar'
      | 'polarArea' | 'stacked_bar' | 'stacked_column' | 'donut' | 'column';
  title: string;
  labels: string[];
  x_axis?: string;
  y_axis?: string;
  datasets: {
    label: string;
    data: number[];
    color?: string;
    stack?: string;
  }[];
  description?: string;
}

export interface DashboardJSON {
  title: string;
  description?: string;
  cards: DashboardCard[];
  charts: DashboardChart[];
}

export interface GeneratedDashboard {
  prompt: string;
  title: string;
  description?: string;
  inference?: string;
  cards: DashboardCard[];
  charts: DashboardChart[];
}

export interface PromptRequest {
  prompt: string;
  dataset_id?: string;
  table_name?: string;
}

export interface SavedDashboard {
  id: string;
  prompt: string;
  response: any;
  created_at: string;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}