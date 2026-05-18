import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Session, ChatHistory } from '../models';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private http = inject(HttpClient);

  sessions     = signal<Session[]>([]);
  activeSession = signal<Session | null>(null);

  loadSessions() {
    return this.http.get<Session[]>('/api/sessions').pipe(
      tap(sessions => {
        this.sessions.set(sessions);
        if (sessions.length && !this.activeSession()) {
          this.activeSession.set(sessions[0]);
        }
      })
    );
  }

  createSession() {
    return this.http.post<Session>('/api/create-session', {}).pipe(
      tap(session => {
        this.sessions.update(s => [session, ...s]);
        this.activeSession.set(session);
      })
    );
  }

  deleteSession(id: number) {
    return this.http.delete(`/api/session/${id}`).pipe(
      tap(() => {
        this.sessions.update(s => s.filter(x => x.id !== id));
        if (this.activeSession()?.id === id) {
          const remaining = this.sessions();
          this.activeSession.set(remaining.length ? remaining[0] : null);
        }
      })
    );
  }

  renameSession(id: number, name: string) {
    return this.http.put<Session>(`/api/session/${id}/rename`, { session_name: name }).pipe(
      tap(updated => {
        this.sessions.update(s => s.map(x => x.id === id ? updated : x));
        if (this.activeSession()?.id === id) {
          this.activeSession.set(updated);
        }
      })
    );
  }

  getChatHistory(sessionId: number) {
    return this.http.get<ChatHistory[]>(`/api/chat-history/${sessionId}`);
  }
}
