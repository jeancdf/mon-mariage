import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicApiService, PublicSiteInfo } from '../../data/public-api.service';
import { THEMES } from '../../shared/wedding-utils';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './public-home.component.html',
})
export class PublicHomeComponent {
  private readonly api = inject(PublicApiService);
  readonly theme = THEMES.ivoire;
  readonly site = signal<PublicSiteInfo | null>(null);
  readonly error = signal('');
  readonly loading = signal(true);

  readonly coupleLabel = computed(() => {
    const names = this.site()?.coupleNames ?? [];
    if (names.length >= 2) return `${names[0]} & ${names[1]}`;
    if (names.length === 1) return names[0];
    return '';
  });

  readonly dateLabel = computed(() => {
    const date = this.site()?.weddingDate;
    if (!date) return '';
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .format(new Date(`${date}T12:00:00`));
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.site.set(await this.api.loadSite());
      this.error.set('');
    } catch {
      this.error.set('Impossible de charger les informations du mariage.');
    } finally {
      this.loading.set(false);
    }
  }
}
