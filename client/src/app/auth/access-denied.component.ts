import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  template: `
    <section class="page access-denied-page">
      <article class="panel">
        <div class="script-note">Espace privé</div>
        <h1>Aucun accès configuré</h1>
        <p>Votre compte est actif, mais son profil ne permet encore d’afficher aucune section. Contactez un organisateur.</p>
        <button class="btn secondary" type="button" (click)="logout()">Se déconnecter</button>
      </article>
    </section>
  `,
})
export class AccessDeniedComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/connexion');
  }
}

