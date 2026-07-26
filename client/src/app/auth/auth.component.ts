import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './auth.component.html',
})
export class AuthComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isClaim = this.route.snapshot.data['mode'] === 'claim';
  readonly loading = signal(false);
  readonly demoLoading = signal(false);
  email = '';
  password = '';
  passwordConfirmation = '';
  eventCode = '';
  error = '';

  async submit(): Promise<void> {
    if (!this.email.trim() || !this.password) return;
    if (this.isClaim && this.password !== this.passwordConfirmation) {
      this.error = 'Les deux mots de passe ne correspondent pas.';
      return;
    }
    this.loading.set(true);
    this.error = '';
    try {
      if (this.isClaim) await this.auth.claim(this.email, this.eventCode, this.password);
      else await this.auth.login(this.email, this.password);
      const requested = this.route.snapshot.queryParamMap.get('returnUrl');
      const destination = requested && requested.startsWith('/') ? requested : this.defaultDestination();
      await this.router.navigateByUrl(destination);
    } catch (error: unknown) {
      const response = error as { error?: { message?: string } };
      this.error = response.error?.message ?? (this.isClaim
        ? "Impossible d'activer ce compte."
        : 'Adresse e-mail ou mot de passe incorrect.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Opens the read-anything, break-nothing sandbox used for portfolio visits. */
  async startDemo(): Promise<void> {
    this.demoLoading.set(true);
    this.error = '';
    try {
      await this.auth.enterDemo();
      await this.router.navigateByUrl('/dashboard');
    } catch {
      this.error = 'Impossible de démarrer la démonstration.';
    } finally {
      this.demoLoading.set(false);
    }
  }

  private defaultDestination(): string {
    if (this.auth.can('dashboard')) return '/dashboard';
    if (this.auth.can('final_weeks')) return '/dernieres-semaines';
    return '/aucun-acces';
  }
}
