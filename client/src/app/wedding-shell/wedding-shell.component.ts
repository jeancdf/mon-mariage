import { Component, computed, inject, signal } from '@angular/core';
import { NgStyle } from '@angular/common';
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
    NgStyle,
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
  }

  readonly themeVars = computed(() => {
    const theme = THEMES[this.store.theme()];
    return {
      '--bg': theme.bg,
      '--surface': theme.surface,
      '--surface-alt': theme.surfaceAlt,
      '--border': theme.border,
      '--text': theme.text,
      '--muted': theme.muted,
      '--accent': theme.accent,
      '--accent-fg': theme.accentFg,
      '--badge-bg': theme.badgeBg,
    };
  });

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
