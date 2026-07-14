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

interface GanttDay {
  date: string;
  label: string;
  detail: string;
}

interface GanttTaskItem {
  task: FinalWeeksTask;
  left: number;
  width: number;
  lane: number;
}

interface GanttRange {
  left: number;
  width: number;
}

interface GanttRow {
  id: string;
  name: string;
  subtitle: string;
  person: FinalWeeksPerson | null;
  tasks: GanttTaskItem[];
  presence: GanttRange | null;
  trackHeight: number;
}

const DEFAULT_TASK_DURATION = 2 * 60 * 60 * 1000;

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
  readonly selectedDate = signal('');
  readonly selectedPersonId = signal<string | null>(null);
  readonly selectedTaskId = signal<string | null>(null);
  readonly showTaskForm = signal(false);
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

  readonly ganttDays = computed<GanttDay[]>(() => {
    const hub = this.hub();
    if (!hub) return [];
    const days: GanttDay[] = [];
    for (let offset = 0; offset <= 7; offset += 1) {
      const date = this.addDays(hub.config.dailyStart, offset);
      days.push({
        date,
        label: offset === 7 ? 'Jour J' : `J−${7 - offset}`,
        detail: this.shortDate(date),
      });
    }
    return days;
  });

  readonly ganttRows = computed<GanttRow[]>(() => {
    const hub = this.hub();
    if (!hub) return [];
    const start = new Date(`${hub.config.dailyStart}T00:00:00`).getTime();
    const end = new Date(`${this.addDays(hub.config.weddingDate, 1)}T00:00:00`).getTime();
    const visibleTasks = hub.tasks
      .filter(task => {
        const taskStart = new Date(task.scheduledAt).getTime();
        const taskEnd = task.endsAt ? new Date(task.endsAt).getTime() : taskStart + DEFAULT_TASK_DURATION;
        return taskStart < end && taskEnd > start;
      })
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));

    const createRow = (
      id: string,
      name: string,
      subtitle: string,
      person: FinalWeeksPerson | null,
      tasks: FinalWeeksTask[],
    ): GanttRow => {
      const laneEnds: number[] = [];
      const items = tasks.map(task => {
        const taskStart = new Date(task.scheduledAt).getTime();
        const taskEnd = task.endsAt ? new Date(task.endsAt).getTime() : taskStart + DEFAULT_TASK_DURATION;
        let lane = laneEnds.findIndex(laneEnd => laneEnd <= taskStart);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = taskEnd;
        const clippedStart = Math.max(start, taskStart);
        const clippedEnd = Math.min(end, taskEnd);
        return {
          task,
          left: ((clippedStart - start) / (end - start)) * 100,
          width: ((clippedEnd - clippedStart) / (end - start)) * 100,
          lane,
        };
      });
      return {
        id,
        name,
        subtitle,
        person,
        tasks: items,
        presence: person ? this.ganttPresence(person, start, end) : null,
        trackHeight: Math.max(54, 34 + laneEnds.length * 24),
      };
    };

    const rows: GanttRow[] = [];
    const unassigned = visibleTasks.filter(task => task.assigneeIds.length === 0);
    if (unassigned.length) {
      rows.push(createRow('unassigned', 'Non affecté', 'À répartir', null, unassigned));
    }

    const representedAccountIds = new Set<string>();
    for (const person of hub.people) {
      const accountId = person.account?.id ?? null;
      if (accountId) representedAccountIds.add(accountId);
      rows.push(createRow(
        `person-${person.id}`,
        `${person.firstName} ${person.lastName}`.trim(),
        person.room ? `${person.room.houseName} · ${person.room.name}` : person.account ? 'Aucun lit attribué' : 'Sans compte',
        person,
        accountId ? visibleTasks.filter(task => task.assigneeIds.includes(accountId)) : [],
      ));
    }

    for (const account of hub.accounts.filter(item => !representedAccountIds.has(item.id))) {
      rows.push(createRow(
        `account-${account.id}`,
        account.name,
        'Compte organisateur',
        null,
        visibleTasks.filter(task => task.assigneeIds.includes(account.id)),
      ));
    }
    return rows;
  });

  readonly selectedPerson = computed(() => this.hub()?.people.find(person => person.id === this.selectedPersonId()) ?? null);
  readonly selectedTask = computed(() => this.hub()?.tasks.find(task => task.id === this.selectedTaskId()) ?? null);
  readonly earlierTasks = computed(() => {
    const hub = this.hub();
    return hub ? hub.tasks
      .filter(task => this.toInputDateTime(task.scheduledAt).slice(0, 10) < hub.config.dailyStart)
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt)) : [];
  });

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    try {
      const hub = await this.api.load();
      this.hub.set(hub);
      this.selectedDate.set(this.clampDate(this.selectedDate() || hub.config.today, hub.config.dailyStart, hub.config.weddingDate));
      const selectedPersonExists = hub.people.some(person => person.id === this.selectedPersonId());
      if (!selectedPersonExists && !this.selectedTaskId()) {
        const ownPerson = hub.people.find(person => person.id === this.auth.account()?.guestId);
        this.selectedPersonId.set((ownPerson ?? hub.people[0])?.id ?? null);
      }
      if (this.selectedTaskId() && !hub.tasks.some(task => task.id === this.selectedTaskId())) {
        this.selectedTaskId.set(null);
      }
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

  shortDate(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
  }

  taskTime(task: FinalWeeksTask): string {
    const start = new Date(task.scheduledAt);
    const end = task.endsAt ? new Date(task.endsAt) : new Date(start.getTime() + DEFAULT_TASK_DURATION);
    const time = (value: Date) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(value);
    return `${time(start)}–${time(end)}`;
  }

  toInputDateTime(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  selectDay(date: string): void {
    this.selectedDate.set(date);
  }

  selectPerson(person: FinalWeeksPerson): void {
    this.selectedPersonId.set(person.id);
    this.selectedTaskId.set(null);
    this.showTaskForm.set(false);
  }

  selectTask(task: FinalWeeksTask): void {
    this.selectedTaskId.set(task.id);
    this.selectedPersonId.set(null);
    this.showTaskForm.set(false);
    const date = this.toInputDateTime(task.scheduledAt).slice(0, 10);
    const hub = this.hub();
    if (hub && date >= hub.config.dailyStart && date <= hub.config.weddingDate) this.selectedDate.set(date);
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

  openNewTask(): void {
    const hub = this.hub();
    if (!hub) return;
    this.editingTaskId = null;
    const start = `${this.selectedDate() || hub.config.dailyStart}T09:00`;
    this.taskForm = {
      ...this.emptyTaskForm(),
      scheduledAt: start,
      endsAt: this.addHoursToInput(start, 2),
      untilDate: hub.config.weddingDate,
    };
    this.selectedTaskId.set(null);
    this.selectedPersonId.set(null);
    this.showTaskForm.set(true);
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
    const scheduledAt = this.toInputDateTime(task.scheduledAt);
    this.taskForm = {
      title: task.title,
      notes: task.notes,
      category: task.category,
      scheduledAt,
      endsAt: this.toInputDateTime(task.endsAt) || this.addHoursToInput(scheduledAt, 2),
      assigneeIds: [...task.assigneeIds],
      recurrenceType: 'none',
      weekdays: [],
      untilDate: this.hub()?.config.weddingDate ?? '',
    };
    this.showTaskForm.set(true);
  }

  cancelTaskEdit(): void {
    this.editingTaskId = null;
    this.taskForm = this.emptyTaskForm();
    this.showTaskForm.set(false);
  }

  taskFormValid(): boolean {
    return Boolean(
      this.taskForm.title.trim()
      && this.taskForm.scheduledAt
      && this.taskForm.endsAt
      && new Date(this.taskForm.endsAt) > new Date(this.taskForm.scheduledAt),
    );
  }

  async submitTask(): Promise<void> {
    if (!this.taskFormValid()) return;
    const payload: TaskPayload = {
      title: this.taskForm.title,
      notes: this.taskForm.notes,
      category: this.taskForm.category,
      scheduledAt: new Date(this.taskForm.scheduledAt).toISOString(),
      endsAt: new Date(this.taskForm.endsAt).toISOString(),
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
      this.selectedTaskId.set(null);
      this.cancelTaskEdit();
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

  private ganttPresence(person: FinalWeeksPerson, start: number, end: number): GanttRange | null {
    if (!person.arrivalAt && !person.departureAt) return null;
    const arrival = person.arrivalAt ? new Date(person.arrivalAt).getTime() : start;
    const departure = person.departureAt ? new Date(person.departureAt).getTime() : end;
    const clippedStart = Math.max(start, arrival);
    const clippedEnd = Math.min(end, departure);
    if (clippedEnd <= clippedStart) return null;
    return {
      left: ((clippedStart - start) / (end - start)) * 100,
      width: ((clippedEnd - clippedStart) / (end - start)) * 100,
    };
  }

  private presentOnDate(person: FinalWeeksPerson, date: string, kind: MealKind = 'lunch'): boolean {
    const hour = kind === 'breakfast' ? 8 : kind === 'lunch' ? 13 : 20;
    const at = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
    const arrival = person.arrivalAt ? new Date(person.arrivalAt) : null;
    const departure = person.departureAt ? new Date(person.departureAt) : null;
    return Boolean(arrival || departure) && (!arrival || arrival <= at) && (!departure || departure >= at);
  }

  private clampDate(date: string, min: string, max: string): string {
    if (date < min) return min;
    if (date > max) return max;
    return date;
  }

  private addDays(date: string, amount: number): string {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + amount);
    return value.toISOString().slice(0, 10);
  }

  private addHoursToInput(value: string, hours: number): string {
    const date = new Date(value);
    date.setHours(date.getHours() + hours);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  private emptyTaskForm() {
    return {
      title: '', notes: '', category: 'other' as TaskCategory, scheduledAt: '', endsAt: '', assigneeIds: [] as string[],
      recurrenceType: 'none' as 'none' | 'daily' | 'weekdays', weekdays: [] as number[], untilDate: '',
    };
  }
}
