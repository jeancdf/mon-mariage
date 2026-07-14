import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardApiService, DashboardSummary } from '../../data/dashboard-api.service';
import { ToastService } from '../../shared/toast.service';
import { fmtCurrency } from '../../shared/wedding-utils';
import { EventConfigService } from '../../data/event-config.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly toast = inject(ToastService);
  readonly eventConfig = inject(EventConfigService);
  readonly auth = inject(AuthService);
  readonly fmtCurrency = fmtCurrency;
  readonly summary = signal<DashboardSummary | null>(null);

  constructor() {
    void this.loadSummary();
    void this.eventConfig.load().catch(() => undefined);
  }

  percent(value: number, total: number): number {
    return total ? Math.round((value / total) * 100) : 0;
  }

  budgetCategoryPercent(category: DashboardSummary['budget']['categories'][number]): number {
    return category.estimated ? Math.min((category.spent / category.estimated) * 100, 100) : 0;
  }

  isOverBudget(category: DashboardSummary['budget']['categories'][number]): boolean {
    return category.estimated > 0 && category.spent > category.estimated;
  }

  private async loadSummary(): Promise<void> {
    try {
      this.summary.set(await this.dashboardApi.loadSummary());
    } catch {
      this.summary.set(null);
      this.toast.error('Impossible de charger le tableau de bord.');
    }
  }
}
