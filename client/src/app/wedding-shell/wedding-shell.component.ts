import { Component, computed, inject } from '@angular/core';
import { NgStyle } from '@angular/common';
import { ThemeKey } from '../data/types';
import { BudgetApiService } from '../data/budget-api.service';
import { GuestApiService } from '../data/guest-api.service';
import { HousingApiService } from '../data/housing-api.service';
import { SeatingApiService } from '../data/seating-api.service';
import { WeddingStore } from '../data/store';
import { TodosApiService } from '../data/todos-api.service';
import { DashboardComponent } from '../features/dashboard/dashboard.component';
import { GuestsComponent } from '../features/guests/guests.component';
import { HousingComponent } from '../features/housing/housing.component';
import { SeatingComponent } from '../features/seating/seating.component';
import { BudgetComponent } from '../features/budget/budget.component';
import { TodosComponent } from '../features/todos/todos.component';
import { IconComponent } from '../shared/icon.component';
import { NAV_ITEMS, PageId, THEMES, THEME_KEYS } from '../shared/wedding-utils';

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
  readonly navItems = NAV_ITEMS;
  readonly themeKeys = THEME_KEYS;
  readonly themes = THEMES;
  page: PageId = 'dashboard';

  constructor() {
    void this.loadInitialData();
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

  private async loadInitialData(): Promise<void> {
    try {
      const [guests, houses, tables, budget, todos] = await Promise.all([
        this.guestApi.loadGuests(),
        this.housingApi.loadHousing(),
        this.seatingApi.loadTables(),
        this.budgetApi.loadBudget(),
        this.todosApi.loadTodos(),
      ]);
      this.store.replaceGuests(guests);
      this.store.replaceHouses(houses);
      this.store.replaceTables(tables);
      this.store.replaceBudget(budget);
      this.store.replaceTodos(todos);
    } catch {
      // Keep seed data when the API is unavailable during frontend-only development.
    }
  }
}
