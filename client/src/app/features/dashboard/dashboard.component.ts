import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardApiService, DashboardSummary } from '../../data/dashboard-api.service';
import { ToastService } from '../../shared/toast.service';
import { fmtCurrency, WEDDING_DATE_LABEL, WEDDING_PLACE } from '../../shared/wedding-utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly toast = inject(ToastService);
  readonly fmtCurrency = fmtCurrency;
  readonly weddingDateLabel = WEDDING_DATE_LABEL;
  readonly weddingPlace = WEDDING_PLACE;
  readonly summary = signal<DashboardSummary | null>(null);

  constructor() {
    void this.loadSummary();
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
