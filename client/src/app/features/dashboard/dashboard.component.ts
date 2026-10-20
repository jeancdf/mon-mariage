import { Component, computed, inject, signal } from '@angular/core';
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
  readonly Math = Math;
  readonly summary = signal<DashboardSummary | null>(null);
  readonly greeting = new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir';
  readonly subtitle = computed(() => {
    const place = this.eventConfig.configuration()?.weddingPlace;
    const days = this.summary()?.daysRemaining;
    const when = days === undefined ? '' : `, dans ${days} ${days === 1 ? 'jour' : 'jours'}`;
    return `${this.eventConfig.dateLabel()}${place ? ` à ${place}` : ''}${when}.`;
  });

  /** The few things that most need attention, phrased as next actions. */
  readonly nextSteps = computed(() => {
    const s = this.summary();
    if (!s) return [];
    const can = (section: Parameters<AuthService['can']>[0]) => this.auth.can(section);
    const steps: { label: string; link: string }[] = [];
    if (can('guests') && s.guests.pending) {
      steps.push({ label: `${s.guests.pending} réponse${s.guests.pending > 1 ? 's' : ''} RSVP en attente`, link: '/invites' });
    }
    const unseated = s.guests.confirmed - s.seating.seated;
    if (can('seating') && unseated > 0) {
      steps.push({ label: `${unseated} invité${unseated > 1 ? 's' : ''} confirmé${unseated > 1 ? 's' : ''} sans place à table`, link: '/plan-de-table' });
    }
    const unhoused = s.housing.totalBeds - s.housing.occupiedBeds;
    if (can('housing') && unhoused > 0) {
      steps.push({ label: `${unhoused} couchage${unhoused > 1 ? 's' : ''} encore libre${unhoused > 1 ? 's' : ''}`, link: '/hebergement' });
    }
    const todo = s.todos.total - s.todos.done;
    if (can('todos') && todo > 0) {
      steps.push({ label: `${todo} tâche${todo > 1 ? 's' : ''} à terminer`, link: '/a-faire' });
    }
    if (can('final_weeks') && s.finalWeeks.unassigned) {
      steps.push({ label: `${s.finalWeeks.unassigned} responsabilité${s.finalWeeks.unassigned > 1 ? 's' : ''} sans responsable`, link: '/dernieres-semaines/taches' });
    }
    return steps.slice(0, 4);
  });

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
