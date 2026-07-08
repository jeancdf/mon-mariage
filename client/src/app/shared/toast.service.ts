import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  tone: 'error' | 'success';
}

const TOAST_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  error(message: string): void {
    this.push(message, 'error');
  }

  success(message: string): void {
    this.push(message, 'success');
  }

  dismiss(id: number): void {
    this.toasts.update(toasts => toasts.filter(toast => toast.id !== id));
  }

  private push(message: string, tone: Toast['tone']): void {
    const id = this.nextId++;
    this.toasts.update(toasts => [...toasts, { id, message, tone }]);
    setTimeout(() => this.dismiss(id), TOAST_DURATION_MS);
  }
}
