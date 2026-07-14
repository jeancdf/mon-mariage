import { Component, DOCUMENT, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeKey } from '../data/types';
import { BudgetApiService } from '../data/budget-api.service';
import { GuestApiService } from '../data/guest-api.service';
import { HousingApiService } from '../data/housing-api.service';
import { SeatingApiService } from '../data/seating-api.service';
import { WeddingStore } from '../data/store';
import { TodosApiService } from '../data/todos-api.service';
import { VendorsApiService } from '../data/vendors-api.service';
import { IconComponent } from '../shared/icon.component';
import { ToastComponent } from '../shared/toast.component';
import { ToastService } from '../shared/toast.service';
import { NAV_ITEMS, THEMES, THEME_KEYS } from '../shared/wedding-utils';
import { AuthService } from '../auth/auth.service';
import { EventConfigService } from '../data/event-config.service';

interface DeploymentMetadata {
  readonly deployedAt: string;
  readonly revision: string;
  readonly version: number;
}

@Component({
  selector: 'app-wedding-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    ToastComponent,
  ],
  templateUrl: './wedding-shell.component.html',
})
export class WeddingShellComponent {
  readonly store = inject(WeddingStore);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly eventConfig = inject(EventConfigService);
  private readonly router = inject(Router);
  private readonly guestApi = inject(GuestApiService);
  private readonly housingApi = inject(HousingApiService);
  private readonly seatingApi = inject(SeatingApiService);
  private readonly budgetApi = inject(BudgetApiService);
  private readonly todosApi = inject(TodosApiService);
  private readonly vendorsApi = inject(VendorsApiService);
  readonly navItems = computed(() => NAV_ITEMS.filter(item => this.auth.can(item.section)));
  readonly themeKeys = THEME_KEYS;
  readonly themes = THEMES;
  readonly weddingDateLabel = computed(() => this.eventConfig.dateLabel());
  readonly weddingPlace = computed(() => this.eventConfig.configuration()?.weddingPlace ?? '');
  readonly deploymentMetadata = signal<DeploymentMetadata | null>(null);

  constructor() {
    void this.loadInitialData();
    void this.loadEventConfiguration();
    void this.loadDeploymentMetadata();
    // Theme variables live on <html> so elements CDK appends to <body>
    // (drag previews, overlays) inherit them too.
    effect(() => {
      const theme = THEMES[this.store.theme()];
      const style = this.document.documentElement.style;
      style.setProperty('--bg', theme.bg);
      style.setProperty('--surface', theme.surface);
      style.setProperty('--surface-alt', theme.surfaceAlt);
      style.setProperty('--border', theme.border);
      style.setProperty('--text', theme.text);
      style.setProperty('--muted', theme.muted);
      style.setProperty('--accent', theme.accent);
      style.setProperty('--accent-fg', theme.accentFg);
      style.setProperty('--badge-bg', theme.badgeBg);
    });
  }

  setTheme(theme: ThemeKey): void {
    this.store.setTheme(theme);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/connexion');
  }

  readonly deployedAtLabel = computed(() => {
    const deployedAt = this.deploymentMetadata()?.deployedAt;
    if (!deployedAt) {
      return '';
    }

    const date = new Date(deployedAt);
    if (Number.isNaN(date.getTime())) {
      return deployedAt;
    }

    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  });

  private async loadDeploymentMetadata(): Promise<void> {
    try {
      const response = await fetch('/deploy-version.json', { cache: 'no-store' });
      if (!response.ok) {
        return;
      }

      const metadata = (await response.json()) as DeploymentMetadata;
      this.deploymentMetadata.set(metadata);
    } catch {
      // The metadata file only exists in the production Docker image.
    }
  }

  private async loadInitialData(): Promise<void> {
    try {
      // allSettled, not all: one failed request must not blank the five others.
      // A failed section keeps its seed data (frontend-only development included).
      const requests = [
        this.auth.can('guests') ? this.guestApi.loadGuests().then(value => this.store.replaceGuests(value)) : Promise.resolve(),
        this.auth.can('housing') ? this.housingApi.loadHousing().then(value => this.store.replaceHouses(value)) : Promise.resolve(),
        this.auth.can('seating') ? this.seatingApi.loadTables().then(value => this.store.replaceTables(value)) : Promise.resolve(),
        this.auth.can('budget') ? this.budgetApi.loadBudget().then(value => this.store.replaceBudget(value)) : Promise.resolve(),
        this.auth.can('todos') ? this.todosApi.loadTodos().then(value => this.store.replaceTodos(value)) : Promise.resolve(),
        this.auth.can('vendors') ? this.vendorsApi.loadVendors().then(value => this.store.replaceVendors(value)) : Promise.resolve(),
      ];
      const results = await Promise.allSettled(requests);
      if (results.some(result => result.status === 'rejected')) {
        this.toast.error("Certaines données n'ont pas pu être chargées. Rechargez la page pour réessayer.");
      }
    } finally {
      this.store.markLoaded();
    }
  }

  private async loadEventConfiguration(): Promise<void> {
    try {
      const config = await this.eventConfig.load();
      this.title.setTitle(`Mariage · ${config.weddingPlace} · ${this.eventConfig.dateLabel()}`);
    } catch {
      this.toast.error("Impossible de charger la configuration de l'événement.");
    }
  }
}
