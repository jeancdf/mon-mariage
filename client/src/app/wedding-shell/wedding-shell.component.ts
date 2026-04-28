import { Component, computed, inject } from '@angular/core';
import { NgStyle } from '@angular/common';
import { ThemeKey } from '../data/types';
import { WeddingStore } from '../data/store';
import { GuestApiService } from '../data/guest-api.service';
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
  readonly guestApi = inject(GuestApiService);
  readonly navItems = NAV_ITEMS;
  readonly themeKeys = THEME_KEYS;
  readonly themes = THEMES;
  page: PageId = 'dashboard';

  constructor() {
    void this.loadGuestsFromDatabase();
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

  private async loadGuestsFromDatabase(): Promise<void> {
    try {
      const guests = await this.guestApi.loadGuests();
      this.store.replaceGuests(guests);
    } catch {
      // Keep local state when API is unavailable (local frontend-only run).
    }
  }
}
