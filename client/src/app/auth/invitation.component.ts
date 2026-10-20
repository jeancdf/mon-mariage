import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-invitation',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './invitation.component.html',
})
export class InvitationComponent {
  private readonly auth = inject(AuthService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';

  readonly state = signal<'checking' | 'ready' | 'invalid' | 'success'>('checking');
  readonly loading = signal(false);
  password = '';
  confirmation = '';
  error = '';

  constructor() {
    void this.checkInvitation();
  }

  async submit(): Promise<void> {
    if (this.password.length < 12) {
      this.error = 'Le mot de passe doit contenir au moins 12 caractères.';
      return;
    }
    if (this.password !== this.confirmation) {
      this.error = 'Les deux mots de passe ne correspondent pas.';
      return;
    }
    this.loading.set(true);
    this.error = '';
    try {
      await this.auth.acceptInvitation(this.token, this.password);
      this.state.set('success');
    } catch (error: unknown) {
      const response = error as { error?: { message?: string } };
      this.error = response.error?.message ?? "Impossible d'activer cet accès.";
    } finally {
      this.loading.set(false);
    }
  }

  private async checkInvitation(): Promise<void> {
    if (!this.token) {
      this.state.set('invalid');
      return;
    }
    try {
      await this.auth.verifyInvitation(this.token);
      this.state.set('ready');
    } catch {
      this.state.set('invalid');
    }
  }
}
