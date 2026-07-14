import { Injectable, inject, signal } from '@angular/core';
import { AuthAccount } from './auth.types';
import { CsrfStateService } from './csrf-state.service';

@Injectable({ providedIn: 'root' })
export class AuthSessionStateService {
  private readonly csrf = inject(CsrfStateService);
  readonly account = signal<AuthAccount | null>(null);
  readonly initialized = signal(false);

  clear(): void {
    this.account.set(null);
    this.csrf.token.set('');
  }
}

