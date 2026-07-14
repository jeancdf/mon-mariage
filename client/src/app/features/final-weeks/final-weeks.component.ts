import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import {
  FinalWeeksApiService,
  FinalWeeksHub,
  FinalWeeksMeal,
  FinalWeeksPerson,
  FinalWeeksTask,
  MealKind,
  TaskCategory,
  TaskPayload,
  TaskStatus,
} from '../../data/final-weeks-api.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';

type HubTab = 'overview' | 'timeline' | 'people' | 'meals' | 'tasks';

interface TimelineBucket {
  key: string;
  label: string;
  start: string;
  end: string;
  tasks: FinalWeeksTask[];
  daily: boolean;
}

const MEALS: Array<{ value: MealKind; label: string }> = [
  { value: 'breakfast', label: 'Petit-déjeuner' },
  { value: 'lunch', label: 'Déjeuner' },
  { value: 'dinner', label: 'Dîner' },
];

const CATEGORIES: Array<{ value: TaskCategory; label: string }> = [
  { value: 'groceries', label: 'Courses' },
  { value: 'errands', label: 'Trajets / commissions' },
  { value: 'cooking', label: 'Cuisine' },
  { value: 'cleaning', label: 'Ménage' },
  { value: 'wedding', label: 'Mariage' },
  { value: 'other', label: 'Autre' },
];

@Component({
  selector: 'app-final-weeks',
  standalone: true,
  imports: [FormsModule, IconComponent, ConfirmDialogComponent],
  templateUrl: './final-weeks.component.html',
})
export class FinalWeeksComponent {
  private readonly api = inject(FinalWeeksApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly hub = signal<FinalWeeksHub | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly activeTab = signal<HubTab>('overview');
  readonly selectedDate = signal('');
  readonly meals = MEALS;
  readonly categories = CATEGORIES;
  readonly weekdays = [
    { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mer' },
    { value: 4, label: 'Jeu' }, { value: 5, label: 'Ven' }, { value: 6, label: 'Sam' },
    { value: 0, label: 'Dim' },
  ];
  taskPendingDeletion: FinalWeeksTask | null = null;
  editingTaskId: string | null = null;
  taskForm = this.emptyTaskForm();

  readonly timelineBuckets = computed(() => {
    const hub = this.hub();
    if (!hub) return [];
    const buckets: TimelineBucket[] = [];
    for (let week = 8; week >= 2; week -= 1) {
      const offset = (8 - week) * 7;
      const start = this.addDays(hub.config.preparationStart, offset);
      const end = this.addDays(start, 6);
      buckets.push({ key: `week-${week}`, label: `Semaine D−${week * 7} à D−${week * 7 - 6}`, start, end, tasks: [], daily: false });
    }
    for (let day = 7; day >= 0; day -= 1) {
      const date = this.addDays(hub.config.weddingDate, -day);
      buckets.push({ key: `day-${day}`, label: day ? `D−${day}` : 'Jour J', start: date, end: date, tasks: [], daily: true });
    }
    for (const task of hub.tasks) {
      const date = this.toInputDateTime(task.scheduledAt).slice(0, 10);
      const bucket = buckets.find(item => date >= item.start && date <= item.end);
      if (bucket) bucket.tasks.push(task);
    }
    return buckets;
  });

  readonly taskList = computed(() => [...(this.hub()?.tasks ?? [])]
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt)));

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    try {
      const hub = await this.api.load();
      this.hub.set(hub);
      if (!this.selectedDate()) this.selectedDate.set(this.clampDate(hub.config.today, hub));
      if (!this.taskForm.scheduledAt) this.taskForm.scheduledAt = `${hub.config.preparationStart}T09:00`;
    } catch {
      this.toast.error("Impossible de charger le centre d'opérations.");
    } finally {
      this.loading.set(false);
    }
  }

  phaseLabel(phase: FinalWeeksHub['config']['phase']): string {
    return ({ before: 'Préparation à venir', weekly: 'Jalons hebdomadaires', daily: 'Centre de commandement quotidien', complete: 'Mariage passé' })[phase];
  }

  formatDate(date: string, withTime = false): string {
    const value = new Date(date.length === 10 ? `${date}T12:00:00` : date);
    return new Intl.DateTimeFormat('fr-FR', withTime
      ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { weekday: 'short', day: 'numeric', month: 'short' }).format(value);
  }

  toInputDateTime(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  updateDateTime(person: FinalWeeksPerson, field: 'arrivalAt' | 'departureAt', value: string): void {
    person[field] = value ? new Date(value).toISOString() : null;
  }

  canEditPerson(person: FinalWeeksPerson): boolean {
    return this.auth.isOrganizer() || this.auth.account()?.guestId === person.id;
  }

  mealSelected(person: FinalWeeksPerson, kind: MealKind): boolean {
    return (person.mealSelections[this.selectedDate()] ?? []).includes(kind);
  }

  async togglePersonMeal(person: FinalWeeksPerson, kind: MealKind): Promise<void> {
    if (!this.canEditPerson(person)) return;
    const date = this.selectedDate();
    const values = person.mealSelections[date] ?? [];
    person.mealSelections = {
      ...person.mealSelections,
      [date]: values.includes(kind) ? values.filter(value => value !== kind) : [...values, kind],
    };
    await this.savePresence(person, false);
  }

  async savePresence(person: FinalWeeksPerson, notify = true): Promise<void> {
    this.saving.set(true);
    try {
      await this.api.savePresence(person);
      if (notify) this.toast.success(`Présence de ${person.firstName} enregistrée.`);
      await this.reload();
    } catch {
      this.toast.error("Impossible d'enregistrer cette présence.");
    } finally {
      this.saving.set(false);
    }
  }

  mealFor(kind: MealKind): FinalWeeksMeal {
    const hub = this.hub()!;
    let meal = hub.meals.find(item => item.date === this.selectedDate() && item.kind === kind);
    if (!meal) {
      meal = { date: this.selectedDate(), kind, menu: '', notes: '', cookIds: [], headcount: this.mealHeadcount(kind) };
      hub.meals.push(meal);
    }
    return meal;
  }

  mealHeadcount(kind: MealKind): number {
    return (this.hub()?.people ?? []).filter(person => this.mealSelected(person, kind)
      && this.presentOnDate(person, this.selectedDate(), kind)).length;
  }

  canEditMeal(meal: FinalWeeksMeal): boolean {
    return this.auth.isOrganizer() || meal.cookIds.includes(this.auth.account()?.id ?? '');
  }

  toggleCook(meal: FinalWeeksMeal, accountId: string): void {
    if (!this.auth.isOrganizer()) return;
    meal.cookIds = meal.cookIds.includes(accountId)
      ? meal.cookIds.filter(id => id !== accountId)
      : [...meal.cookIds, accountId];
  }

  async saveMeal(meal: FinalWeeksMeal): Promise<void> {
    this.saving.set(true);
    try {
      await this.api.saveMeal(meal);
      this.toast.success('Repas enregistré.');
      await this.reload();
    } catch {
      this.toast.error("Impossible d'enregistrer ce repas.");
    } finally {
      this.saving.set(false);
    }
  }

  toggleTaskAssignee(accountId: string): void {
    this.taskForm.assigneeIds = this.taskForm.assigneeIds.includes(accountId)
      ? this.taskForm.assigneeIds.filter(id => id !== accountId)
      : [...this.taskForm.assigneeIds, accountId];
  }

  toggleWeekday(day: number): void {
    this.taskForm.weekdays = this.taskForm.weekdays.includes(day)
      ? this.taskForm.weekdays.filter(value => value !== day)
      : [...this.taskForm.weekdays, day];
  }

  editTask(task: FinalWeeksTask): void {
    this.editingTaskId = task.id;
    this.taskForm = {
      title: task.title,
      notes: task.notes,
      category: task.category,
      scheduledAt: this.toInputDateTime(task.scheduledAt),
      assigneeIds: [...task.assigneeIds],
      recurrenceType: 'none',
      weekdays: [],
      untilDate: this.hub()?.config.weddingDate ?? '',
    };
    this.activeTab.set('tasks');
  }

  cancelTaskEdit(): void {
    this.editingTaskId = null;
    this.taskForm = this.emptyTaskForm();
    const hub = this.hub();
    if (hub) this.taskForm.scheduledAt = `${hub.config.preparationStart}T09:00`;
  }

  async submitTask(): Promise<void> {
    if (!this.taskForm.title.trim() || !this.taskForm.scheduledAt) return;
    const payload: TaskPayload = {
      title: this.taskForm.title,
      notes: this.taskForm.notes,
      category: this.taskForm.category,
      scheduledAt: new Date(this.taskForm.scheduledAt).toISOString(),
      assigneeIds: this.taskForm.assigneeIds,
    };
    if (!this.editingTaskId) {
      payload.recurrence = {
        type: this.taskForm.recurrenceType,
        weekdays: this.taskForm.weekdays,
        untilDate: this.taskForm.untilDate,
      };
    }
    this.saving.set(true);
    try {
      if (this.editingTaskId) await this.api.updateTask(this.editingTaskId, payload);
      else await this.api.createTask(payload);
      this.toast.success(this.editingTaskId ? 'Responsabilité modifiée.' : 'Responsabilité créée.');
      this.cancelTaskEdit();
      await this.reload();
    } catch (error: unknown) {
      const response = error as { error?: { message?: string } };
      this.toast.error(response.error?.message ?? "Impossible d'enregistrer cette responsabilité.");
    } finally {
      this.saving.set(false);
    }
  }

  canUpdateTask(task: FinalWeeksTask): boolean {
    return this.auth.isOrganizer() || task.assigneeIds.includes(this.auth.account()?.id ?? '');
  }

  async updateTaskStatus(task: FinalWeeksTask, status: TaskStatus): Promise<void> {
    if (!this.canUpdateTask(task)) return;
    try {
      await this.api.updateTask(task.id, { status });
      await this.reload();
    } catch {
      this.toast.error('Impossible de modifier le statut.');
    }
  }

  requestDeleteTask(task: FinalWeeksTask): void {
    this.taskPendingDeletion = task;
  }

  async confirmDeleteTask(): Promise<void> {
    const task = this.taskPendingDeletion;
    this.taskPendingDeletion = null;
    if (!task) return;
    try {
      await this.api.deleteTask(task.id);
      await this.reload();
    } catch {
      this.toast.error('Impossible de supprimer cette responsabilité.');
    }
  }

  accountName(accountId: string): string {
    return this.hub()?.accounts.find(account => account.id === accountId)?.name ?? 'Compte inconnu';
  }

  assigneeNames(task: FinalWeeksTask): string {
    return task.assigneeIds.map(accountId => this.accountName(accountId)).join(', ');
  }

  categoryLabel(category: TaskCategory): string {
    return CATEGORIES.find(item => item.value === category)?.label ?? category;
  }

  statusLabel(status: TaskStatus): string {
    return ({ todo: 'À faire', in_progress: 'En cours', done: 'Terminée', cancelled: 'Annulée' })[status];
  }

  private presentOnDate(person: FinalWeeksPerson, date: string, kind: MealKind = 'lunch'): boolean {
    const hour = kind === 'breakfast' ? 8 : kind === 'lunch' ? 13 : 20;
    const midday = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
    const arrival = person.arrivalAt ? new Date(person.arrivalAt) : null;
    const departure = person.departureAt ? new Date(person.departureAt) : null;
    return Boolean(arrival || departure) && (!arrival || arrival <= midday) && (!departure || departure >= midday);
  }

  private clampDate(date: string, hub: FinalWeeksHub): string {
    if (date < hub.config.preparationStart) return hub.config.preparationStart;
    if (date > hub.config.weddingDate) return hub.config.weddingDate;
    return date;
  }

  private addDays(date: string, amount: number): string {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + amount);
    return value.toISOString().slice(0, 10);
  }

  private emptyTaskForm() {
    return {
      title: '', notes: '', category: 'other' as TaskCategory, scheduledAt: '', assigneeIds: [] as string[],
      recurrenceType: 'none' as 'none' | 'daily' | 'weekdays', weekdays: [] as number[], untilDate: '',
    };
  }
}
