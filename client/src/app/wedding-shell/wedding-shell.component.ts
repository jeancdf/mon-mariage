import { Component, DOCUMENT, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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
import { NAV_ITEMS, THEMES, THEME_KEYS, WEDDING_DATE_LABEL, WEDDING_PLACE } from '../shared/wedding-utils';

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
  private readonly guestApi = inject(GuestApiService);
  private readonly housingApi = inject(HousingApiService);
  private readonly seatingApi = inject(SeatingApiService);
  private readonly budgetApi = inject(BudgetApiService);
  private readonly todosApi = inject(TodosApiService);
  private readonly vendorsApi = inject(VendorsApiService);
  readonly navItems = NAV_ITEMS;
  readonly themeKeys = THEME_KEYS;
  readonly themes = THEMES;
  readonly weddingDateLabel = WEDDING_DATE_LABEL;
  readonly weddingPlace = WEDDING_PLACE;
  readonly deploymentMetadata = signal<DeploymentMetadata | null>(null);

  constructor() {
    void this.loadInitialData();
    void this.loadDeploymentMetadata();
    this.title.setTitle(`Mariage · ${WEDDING_PLACE} · ${WEDDING_DATE_LABEL}`);
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
    // allSettled, not all: one failed request must not blank the five others.
    // A failed section keeps its seed data (frontend-only development included).
    const [guests, houses, tables, budget, todos, vendors] = await Promise.allSettled([
      this.guestApi.loadGuests(),
      this.housingApi.loadHousing(),
      this.seatingApi.loadTables(),
      this.budgetApi.loadBudget(),
      this.todosApi.loadTodos(),
      this.vendorsApi.loadVendors(),
    ]);
    if (guests.status === 'fulfilled') this.store.replaceGuests(guests.value);
    if (houses.status === 'fulfilled') this.store.replaceHouses(houses.value);
    if (tables.status === 'fulfilled') this.store.replaceTables(tables.value);
    if (budget.status === 'fulfilled') this.store.replaceBudget(budget.value);
    if (todos.status === 'fulfilled') this.store.replaceTodos(todos.value);
    if (vendors.status === 'fulfilled') this.store.replaceVendors(vendors.value);
    if ([guests, houses, tables, budget, todos, vendors].some(result => result.status === 'rejected')) {
      this.toast.error("Certaines données n'ont pas pu être chargées. Rechargez la page pour réessayer.");
    }
  }
}
