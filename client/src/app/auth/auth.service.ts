import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthResponse, SectionKey } from './auth.types';
import { CsrfStateService } from './csrf-state.service';
import { AuthSessionStateService } from './auth-session-state.service';
import { DemoModeService } from '../demo/demo-mode.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly csrf = inject(CsrfStateService);
  private readonly state = inject(AuthSessionStateService);
  private readonly demo = inject(DemoModeService);
  private initialization: Promise<void> | null = null;

  readonly account = this.state.account;
  readonly initialized = this.state.initialized;
  readonly authenticated = computed(() => Boolean(this.account()));
  readonly isOrganizer = computed(() => Boolean(this.account()?.isOrganizer));
  readonly isDemo = this.demo.active;

  initialize(): Promise<void> {
    if (this.initialization) return this.initialization;
    this.initialization = this.loadCurrentAccount();
    return this.initialization;
  }

  async login(email: string, password: string): Promise<void> {
    this.applyResponse(await firstValueFrom(this.http.post<AuthResponse>('/api/auth/login', { email, password })));
  }

  async verifyInvitation(token: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/invitation/verify', { token }));
  }

  async acceptInvitation(token: string, password: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/invitation/accept', { token, password }));
  }

  /**
   * Turns on the sandboxed demo dataset and reloads the session from it. The
   * interceptor answers `/api/auth/me` locally, so the regular guards, shell and
   * feature pages then run unchanged against fake data.
   */
  async enterDemo(): Promise<void> {
    this.demo.activate();
    this.initialization = this.loadCurrentAccount();
    await this.initialization;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.demo.deactivate();
      this.initialization = null;
      this.clear();
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/password', { currentPassword, newPassword }));
    this.clear();
  }

  can(section: SectionKey, level: 'view' | 'edit' = 'view'): boolean {
    const account = this.account();
    if (!account) return false;
    if (account.isOrganizer) return true;
    const permission = account.permissions[section];
    return level === 'edit' ? Boolean(permission?.canEdit) : Boolean(permission?.canView);
  }

  clear(): void {
    this.state.clear();
  }

  private async loadCurrentAccount(): Promise<void> {
    try {
      this.applyResponse(await firstValueFrom(this.http.get<AuthResponse>('/api/auth/me')));
    } catch {
      this.clear();
    } finally {
      this.initialized.set(true);
    }
  }

  private applyResponse(response: AuthResponse): void {
    this.account.set(response.account);
    this.csrf.token.set(response.csrfToken);
    this.initialized.set(true);
  }
}
