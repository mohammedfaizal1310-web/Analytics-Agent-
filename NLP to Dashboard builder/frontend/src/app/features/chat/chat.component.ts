import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../shared/components/header/page-header.component';
import { SessionService } from '../../core/services/session.service';
import { ChatService } from '../../core/services/chat.service';
import { UploadService } from '../../core/services/upload.service';
import { ToastService } from '../../core/services/toast.service';
import { ChatMessage, Session } from '../../core/models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements OnInit {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;
  @ViewChild('queryInput') queryInput!: ElementRef;

  messages   = signal<ChatMessage[]>([]);
  query      = signal('');
  sending    = signal(false);
  showSql    = signal<number | null>(null);
  renamingId = signal<number | null>(null);
  renameValue = signal('');
  sidebarOpen = signal(true);

  constructor(
    public  sessionService: SessionService,
    private chatService:    ChatService,
    public  uploadService:  UploadService,
    private toast:          ToastService
  ) {}

  ngOnInit() {
    this.sessionService.loadSessions().subscribe({
      next: (sessions) => {
        if (sessions.length) this.loadHistory(sessions[0].id);
      }
    });
    this.uploadService.loadUploadedFiles().subscribe();
  }

  loadHistory(sessionId: number) {
    this.sessionService.getChatHistory(sessionId).subscribe({
      next: (history) => {
        this.messages.set(history.flatMap(h => [
          { role: 'user'      as const, content: h.user_query,   timestamp: new Date(h.created_at ?? '') },
          { role: 'assistant' as const, content: h.bot_response, sql: h.sql_query, timestamp: new Date(h.created_at ?? '') }
        ]));
        this.scrollToBottom();
      }
    });
  }

  selectSession(session: Session) {
    this.sessionService.activeSession.set(session);
    this.messages.set([]);
    this.loadHistory(session.id);
  }

  newSession() {
    this.sessionService.createSession().subscribe({
      next: () => { this.messages.set([]); this.toast.success('New session created'); },
      error: () => this.toast.error('Failed to create session')
    });
  }

  deleteSession(id: number, event: Event) {
    event.stopPropagation();
    this.sessionService.deleteSession(id).subscribe({
      next: () => { this.messages.set([]); this.toast.success('Session deleted'); }
    });
  }

  startRename(session: Session, event: Event) {
    event.stopPropagation();
    this.renamingId.set(session.id);
    this.renameValue.set(session.session_name ?? `Session ${session.id}`);
  }

  confirmRename(id: number) {
    if (!this.renameValue().trim()) return;
    this.sessionService.renameSession(id, this.renameValue().trim()).subscribe({
      next: () => { this.renamingId.set(null); this.toast.success('Renamed'); },
      error: () => this.toast.error('Rename failed')
    });
  }

  cancelRename() { this.renamingId.set(null); }

  toggleSidebar() { this.sidebarOpen.update(v => !v); }

  getCells(row: unknown): unknown[] {
    return Array.isArray(row) ? (row as unknown[]) : [];
  }

  private lastLoadingIndex(msgs: ChatMessage[]): number {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].isLoading) return i;
    }
    return -1;
  }

  send() {
    const active = this.sessionService.activeSession();
    if (!active || !this.query().trim() || this.sending()) return;

    const q = this.query().trim();
    this.query.set('');
    this.sending.set(true);

    this.messages.update(m => [
      ...m,
      { role: 'user', content: q, timestamp: new Date() },
      { role: 'assistant', content: '', timestamp: new Date(), isLoading: true }
    ]);
    this.scrollToBottom();

    this.chatService.sendMessage({ session_id: active.id, query: q }).subscribe({
      next: (res) => {
        this.messages.update(msgs => {
          const updated = [...msgs];
          const idx = this.lastLoadingIndex(updated);
          if (idx !== -1) {
            updated[idx] = {
              role: 'assistant',
              content: res.response,
              sql: res.sql,
              columns: res.columns,
              rows: res.rows as unknown[][],
              error: res.error,
              timestamp: new Date(),
              isLoading: false
            };
          }
          return updated;
        });
        this.sending.set(false);
        this.scrollToBottom();
      },
      error: (err: Error) => {
        this.messages.update(msgs => {
          const updated = [...msgs];
          const idx = this.lastLoadingIndex(updated);
          if (idx !== -1) {
            updated[idx] = {
              role: 'assistant',
              content: 'Something went wrong. Please try again.',
              error: err.message,
              timestamp: new Date(),
              isLoading: false
            };
          }
          return updated;
        });
        this.sending.set(false);
      }
    });
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  toggleSql(idx: number) {
    this.showSql.update(v => v === idx ? null : idx);
  }

  private scrollToBottom() {
    setTimeout(() => {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  sessionLabel(s: Session) {
    return s.session_name ?? `Session ${s.id}`;
  }
}
