import { Component, inject, signal } from '@angular/core';
import { DashboardApiService, DashboardSummary } from '../../data/dashboard-api.service';
import { fmtCurrency } from '../../shared/wedding-utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly dashboardApi = inject(DashboardApiService);
  readonly fmtCurrency = fmtCurrency;
  readonly summary = signal<DashboardSummary | null>(null);

  constructor() {
    void this.loadSummary();
  }

  percent(value: number, total: number): number {
    return total ? Math.round((value / total) * 100) : 0;
  }

  private async loadSummary(): Promise<void> {
    try {
      this.summary.set(await this.dashboardApi.loadSummary());
    } catch {
      this.summary.set(null);
    }
  }
}
