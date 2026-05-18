import { Injectable, signal } from '@angular/core';
import { Toast } from '../models';

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);

  success(message: string): void { this.add('success', message); }
  error(message: string): void   { this.add('error', message); }
  warning(message: string): void { this.add('warning', message); }
  info(message: string): void    { this.add('info', message); }

  dismiss(id: number): void {
    this.toasts.update(t => t.filter(x => x.id !== id));
  }

  private add(type: Toast['type'], message: string): void {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    this.toasts.update(t => [...t, { id, type, message }]);
    setTimeout(() => this.dismiss(id), 4500);
  }
}
