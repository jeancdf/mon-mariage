import { Component, DOCUMENT, computed, effect, inject, signal } from '@angular/core';
import { ThemeKey } from '../data/types';
import { BudgetApiService } from '../data/budget-api.service';
import { GuestApiService } from '../data/guest-api.service';
import { HousingApiService } from '../data/housing-api.service';
import { SeatingApiService } from '../data/seating-api.service';
import { WeddingStore } from '../data/store';
import { TodosApiService } from '../data/todos-api.service';
import { VendorsApiService } from '../data/vendors-api.service';
import { DashboardComponent } from '../features/dashboard/dashboard.component';
import { GuestsComponent } from '../features/guests/guests.component';
import { HousingComponent } from '../features/housing/housing.component';
import { SeatingComponent } from '../features/seating/seating.component';
import { BudgetComponent } from '../features/budget/budget.component';
import { TodosComponent } from '../features/todos/todos.component';
import { VendorsComponent } from '../features/vendors/vendors.component';
import { IconComponent } from '../shared/icon.component';
import { NAV_ITEMS, PageId, THEMES, THEME_KEYS } from '../shared/wedding-utils';

interface DeploymentMetadata {
  readonly deployedAt: string;
  readonly revision: string;
  readonly version: number;
}

@Component({
  selector: 'app-wedding-shell',
  standalone: true,
  imports: [
    IconComponent,
    DashboardComponent,
    GuestsComponent,
    HousingComponent,
    SeatingComponent,
    BudgetComponent,
    TodosComponent,
    VendorsComponent,
  ],
  templateUrl: './wedding-shell.component.html',
})
export class WeddingShellComponent {
  readonly store = inject(WeddingStore);
  private readonly document = inject(DOCUMENT);
  private readonly guestApi = inject(GuestApiService);
  private readonly housingApi = inject(HousingApiService);
  private readonly seatingApi = inject(SeatingApiService);
  private readonly budgetApi = inject(BudgetApiService);
  private readonly todosApi = inject(TodosApiService);
  private readonly vendorsApi = inject(VendorsApiService);
  readonly navItems = NAV_ITEMS;
  readonly themeKeys = THEME_KEYS;
  readonly themes = THEMES;
  readonly deploymentMetadata = signal<DeploymentMetadata | null>(null);
  page: PageId = 'dashboard';

  constructor() {
    void this.loadInitialData();
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
      const [guests, houses, tables, budget, todos, vendors] = await Promise.all([
        this.guestApi.loadGuests(),
        this.housingApi.loadHousing(),
        this.seatingApi.loadTables(),
        this.budgetApi.loadBudget(),
        this.todosApi.loadTodos(),
        this.vendorsApi.loadVendors(),
      ]);
      this.store.replaceGuests(guests);
      this.store.replaceHouses(houses);
      this.store.replaceTables(tables);
      this.store.replaceBudget(budget);
      this.store.replaceTodos(todos);
      this.store.replaceVendors(vendors);
    } catch {
      // Keep seed data when the API is unavailable during frontend-only development.
    }
  }
}
