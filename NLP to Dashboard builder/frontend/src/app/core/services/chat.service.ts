import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChatApiResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);

  sendMessage(req: { session_id: number; query: string }) {
    return this.http.post<ChatApiResponse>('/api/chat', req);
  }
}
