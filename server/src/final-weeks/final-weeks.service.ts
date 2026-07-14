import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import { AccountEntity } from '../auth/entities/account.entity';
import { GuestEntity } from '../guests/guest.entity';
import { RoomGuestEntity } from '../housing/room-guest.entity';
import { EventConfigService } from '../event-config/event-config.service';
import { MealCookEntity } from './entities/meal-cook.entity';
import { MealPlanEntity } from './entities/meal-plan.entity';
import { OperationalTaskCategory, OperationalTaskEntity, OperationalTaskStatus } from './entities/operational-task.entity';
import { MealKind, MealSelections, PresenceEntity } from './entities/presence.entity';
import { TaskAssigneeEntity } from './entities/task-assignee.entity';
import { expandRecurrenceDates, isDateInWindow, RecurrenceInput } from './final-weeks.utils';

const MEAL_KINDS: MealKind[] = ['breakfast', 'lunch', 'dinner'];
const TASK_CATEGORIES: OperationalTaskCategory[] = ['groceries', 'errands', 'cooking', 'cleaning', 'wedding', 'other'];
const TASK_STATUSES: OperationalTaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];

interface PresenceInput {
  arrivalAt?: string | null;
  departureAt?: string | null;
  mealSelections?: MealSelections;
}

interface TaskInput {
  title?: string;
  notes?: string;
  category?: OperationalTaskCategory;
  scheduledAt?: string;
  status?: OperationalTaskStatus;
  assigneeIds?: string[];
  recurrence?: RecurrenceInput;
}

@Injectable()
export class FinalWeeksService {
  constructor(
    @InjectRepository(PresenceEntity) private readonly presencesRepository: Repository<PresenceEntity>,
    @InjectRepository(MealPlanEntity) private readonly mealsRepository: Repository<MealPlanEntity>,
    @InjectRepository(MealCookEntity) private readonly cooksRepository: Repository<MealCookEntity>,
    @InjectRepository(OperationalTaskEntity) private readonly tasksRepository: Repository<OperationalTaskEntity>,
    @InjectRepository(TaskAssigneeEntity) private readonly assigneesRepository: Repository<TaskAssigneeEntity>,
    @InjectRepository(GuestEntity) private readonly guestsRepository: Repository<GuestEntity>,
    @InjectRepository(AccountEntity) private readonly accountsRepository: Repository<AccountEntity>,
    @InjectRepository(RoomGuestEntity) private readonly roomAssignmentsRepository: Repository<RoomGuestEntity>,
    private readonly eventConfig: EventConfigService,
  ) {}

  async getHub(now = new Date()): Promise<Record<string, unknown>> {
    const config = this.eventConfig.getConfiguration();
    const [guests, accounts, presences, rooms, meals, tasks] = await Promise.all([
      this.guestsRepository.find({ order: { firstName: 'ASC', lastName: 'ASC' } }),
      this.accountsRepository.find({ order: { email: 'ASC' } }),
      this.presencesRepository.find(),
      this.roomAssignmentsRepository.find({ relations: { room: { house: true } } }),
      this.mealsRepository.find({ relations: { cooks: { account: true } }, order: { date: 'ASC', kind: 'ASC' } }),
      this.tasksRepository.find({ relations: { assignees: { account: true } }, order: { scheduledAt: 'ASC' } }),
    ]);
    const people = this.buildPeople(guests, accounts, presences, rooms);
    const accountNames = this.accountNames(accounts, guests);
    const serializedMeals = meals.map(meal => ({
      id: meal.id,
      date: meal.date,
      kind: meal.kind,
      menu: meal.menu,
      notes: meal.notes,
      cookIds: (meal.cooks ?? []).map(cook => cook.accountId),
      headcount: this.mealHeadcount(people, meal.date, meal.kind),
    }));
    const serializedTasks = tasks.map(task => this.serializeTask(task));
    const today = this.localDate(now);
    const activeTasks = serializedTasks.filter(task => task.status !== 'done' && task.status !== 'cancelled');
    return {
      config: { ...config, today, phase: this.phase(today, config.preparationStart, config.dailyStart, config.weddingDate) },
      summary: {
        currentlyPresent: this.presentCount(people, now),
        todayMeals: Object.fromEntries(MEAL_KINDS.map(kind => [kind, this.mealHeadcount(people, today, kind)])),
        unfinished: activeTasks.length,
        unassigned: activeTasks.filter(task => task.assigneeIds.length === 0).length,
        overdue: activeTasks.filter(task => task.scheduledAt.slice(0, 10) < today).length,
        completion: serializedTasks.length
          ? Math.round((serializedTasks.filter(task => task.status === 'done').length / serializedTasks.length) * 100)
          : 0,
      },
      people,
      meals: serializedMeals,
      tasks: serializedTasks,
      accounts: accounts.filter(account => account.status !== 'disabled').map(account => ({
        id: account.id,
        guestId: account.guestId,
        name: accountNames.get(account.id) ?? account.email,
        status: account.status,
      })),
    };
  }

  async getDashboardSummary(now = new Date()): Promise<Record<string, unknown>> {
    const hub = await this.getHub(now) as { summary: Record<string, unknown> };
    return hub.summary;
  }

  async updatePresence(account: AccountEntity, guestPersonId: string, input: PresenceInput): Promise<void> {
    const people = this.allPersonIds(await this.guestsRepository.find());
    if (!people.has(guestPersonId)) throw new NotFoundException('Personne introuvable.');
    if (!account.isOrganizer && account.guestId !== guestPersonId) {
      throw new ForbiddenException('Vous ne pouvez modifier que votre propre présence.');
    }
    let presence = await this.presencesRepository.findOne({ where: { guestPersonId } });
    if (!presence) {
      presence = this.presencesRepository.create({ guestPersonId, arrivalAt: null, departureAt: null, mealSelections: {} });
    }
    if ('arrivalAt' in input) presence.arrivalAt = this.optionalDate(input.arrivalAt);
    if ('departureAt' in input) presence.departureAt = this.optionalDate(input.departureAt);
    if (presence.arrivalAt && presence.departureAt && presence.departureAt < presence.arrivalAt) {
      throw new BadRequestException("Le départ doit être postérieur à l'arrivée.");
    }
    if (input.mealSelections) presence.mealSelections = this.normalizeMealSelections(input.mealSelections);
    await this.presencesRepository.save(presence);
  }

  async saveMeal(account: AccountEntity, date: string, kind: MealKind, input: { menu?: string; notes?: string; cookIds?: string[] }): Promise<void> {
    this.assertDate(date);
    if (!MEAL_KINDS.includes(kind)) throw new BadRequestException('Type de repas invalide.');
    let meal = await this.mealsRepository.findOne({ where: { date, kind }, relations: { cooks: true } });
    if (!account.isOrganizer && !(meal?.cooks ?? []).some(cook => cook.accountId === account.id)) {
      throw new ForbiddenException('Seuls les organisateurs et cuisiniers affectés peuvent modifier ce repas.');
    }
    if (!meal) meal = this.mealsRepository.create({ date, kind, menu: '', notes: '' });
    if (typeof input.menu === 'string') meal.menu = input.menu.trim();
    if (typeof input.notes === 'string') meal.notes = input.notes.trim();
    meal = await this.mealsRepository.save(meal);
    if (account.isOrganizer && Array.isArray(input.cookIds)) {
      await this.replaceMealCooks(meal.id, input.cookIds);
    }
  }

  async createTasks(account: AccountEntity, input: TaskInput): Promise<void> {
    if (!account.isOrganizer) throw new ForbiddenException('Seuls les organisateurs peuvent créer des responsabilités.');
    const title = String(input.title ?? '').trim();
    if (!title) throw new BadRequestException('Le titre est obligatoire.');
    const scheduledAt = this.requiredDate(input.scheduledAt);
    const datePart = scheduledAt.toISOString().slice(0, 10);
    this.assertDate(datePart);
    const config = this.eventConfig.getConfiguration();
    const dates = expandRecurrenceDates(datePart, config.weddingDate, input.recurrence);
    const timePart = this.inputTime(input.scheduledAt ?? '');
    const recurrenceGroupId = dates.length > 1 ? randomUUID() : null;
    const assigneeIds = this.uniqueIds(input.assigneeIds);
    await this.assertAccountsExist(assigneeIds);
    for (const date of dates) {
      const task = await this.tasksRepository.save(this.tasksRepository.create({
        title,
        notes: String(input.notes ?? '').trim(),
        category: TASK_CATEGORIES.includes(input.category as OperationalTaskCategory) ? input.category! : 'other',
        scheduledAt: new Date(`${date}T${timePart}`),
        status: 'todo',
        recurrenceGroupId,
        createdByAccountId: account.id,
      }));
      await this.replaceTaskAssignees(task.id, assigneeIds);
    }
  }

  async updateTask(account: AccountEntity, taskId: string, input: TaskInput): Promise<void> {
    const task = await this.tasksRepository.findOne({ where: { id: taskId }, relations: { assignees: true } });
    if (!task) throw new NotFoundException('Responsabilité introuvable.');
    const assigned = task.assignees.some(assignee => assignee.accountId === account.id);
    if (!account.isOrganizer && !assigned) throw new ForbiddenException("Cette responsabilité ne vous est pas affectée.");
    if (!account.isOrganizer) {
      const forbiddenFields = ['title', 'category', 'scheduledAt', 'assigneeIds', 'recurrence']
        .filter(field => field in input);
      if (forbiddenFields.length) throw new ForbiddenException('Vous pouvez seulement mettre à jour le statut et les notes.');
    }
    if (typeof input.title === 'string') {
      if (!input.title.trim()) throw new BadRequestException('Le titre est obligatoire.');
      task.title = input.title.trim();
    }
    if (typeof input.notes === 'string') task.notes = input.notes.trim();
    if (input.category) {
      if (!TASK_CATEGORIES.includes(input.category)) throw new BadRequestException('Catégorie invalide.');
      task.category = input.category;
    }
    if (input.status) {
      if (!TASK_STATUSES.includes(input.status)) throw new BadRequestException('Statut invalide.');
      task.status = input.status;
    }
    if (input.scheduledAt) {
      const scheduledAt = this.requiredDate(input.scheduledAt);
      this.assertDate(scheduledAt.toISOString().slice(0, 10));
      task.scheduledAt = scheduledAt;
    }
    await this.tasksRepository.save(task);
    if (account.isOrganizer && Array.isArray(input.assigneeIds)) {
      const ids = this.uniqueIds(input.assigneeIds);
      await this.assertAccountsExist(ids);
      await this.replaceTaskAssignees(task.id, ids);
    }
  }

  async deleteTask(account: AccountEntity, taskId: string): Promise<void> {
    if (!account.isOrganizer) throw new ForbiddenException('Seuls les organisateurs peuvent supprimer une responsabilité.');
    const result = await this.tasksRepository.delete(taskId);
    if (!result.affected) throw new NotFoundException('Responsabilité introuvable.');
  }

  private buildPeople(guests: GuestEntity[], accounts: AccountEntity[], presences: PresenceEntity[], rooms: RoomGuestEntity[]) {
    const accountByGuestId = new Map(accounts.filter(account => account.guestId).map(account => [account.guestId!, account]));
    const presenceByPersonId = new Map(presences.map(presence => [presence.guestPersonId, presence]));
    const roomByPersonId = new Map(rooms.map(assignment => [assignment.guestId, assignment]));
    const people: Array<Record<string, unknown>> = [];
    for (const guest of guests) {
      const sourcePeople = [
        { id: guest.id, firstName: guest.firstName, lastName: guest.lastName, primary: true },
        ...(guest.hasPlusOne ? [{
          id: `${guest.id}__plus_one`,
          firstName: guest.plusOneName || `+1 ${guest.firstName}`,
          lastName: '',
          primary: false,
        }] : []),
        ...(guest.kids ?? []).filter(kid => kid.name?.trim()).map(kid => ({
          id: kid.id,
          firstName: kid.name,
          lastName: guest.lastName,
          primary: false,
        })),
      ];
      for (const person of sourcePeople) {
        const presence = presenceByPersonId.get(person.id);
        const assignment = roomByPersonId.get(person.id);
        const account = person.primary ? accountByGuestId.get(guest.id) : undefined;
        people.push({
          id: person.id,
          guestId: guest.id,
          firstName: person.firstName,
          lastName: person.lastName,
          primary: person.primary,
          organizationRole: guest.organizationRole,
          arrivalAt: presence?.arrivalAt?.toISOString() ?? null,
          departureAt: presence?.departureAt?.toISOString() ?? null,
          mealSelections: presence?.mealSelections ?? {},
          account: account ? { id: account.id, status: account.status } : null,
          room: assignment ? {
            id: assignment.roomId,
            name: assignment.room.name,
            houseName: assignment.room.house?.name ?? '',
          } : null,
        });
      }
    }
    return people;
  }

  private serializeTask(task: OperationalTaskEntity) {
    return {
      id: task.id,
      title: task.title,
      notes: task.notes,
      category: task.category,
      scheduledAt: task.scheduledAt.toISOString(),
      status: task.status,
      recurrenceGroupId: task.recurrenceGroupId,
      assigneeIds: (task.assignees ?? []).map(assignee => assignee.accountId),
    };
  }

  private accountNames(accounts: AccountEntity[], guests: GuestEntity[]): Map<string, string> {
    const guestById = new Map(guests.map(guest => [guest.id, guest]));
    return new Map(accounts.map(account => {
      const guest = account.guestId ? guestById.get(account.guestId) : undefined;
      return [account.id, guest ? `${guest.firstName} ${guest.lastName}`.trim() : 'Organisateur'];
    }));
  }

  private mealHeadcount(people: Array<Record<string, unknown>>, date: string, kind: MealKind): number {
    const mealHour = kind === 'breakfast' ? 8 : kind === 'lunch' ? 13 : 20;
    const at = new Date(`${date}T${String(mealHour).padStart(2, '0')}:00:00`);
    return people.filter(person => {
      const meals = (person['mealSelections'] ?? {}) as MealSelections;
      return (meals[date] ?? []).includes(kind) && this.isPresent(person, at);
    }).length;
  }

  private presentCount(people: Array<Record<string, unknown>>, at: Date): number {
    return people.filter(person => this.isPresent(person, at)).length;
  }

  private isPresent(person: Record<string, unknown>, at: Date): boolean {
    const arrival = person['arrivalAt'] ? new Date(String(person['arrivalAt'])) : null;
    const departure = person['departureAt'] ? new Date(String(person['departureAt'])) : null;
    if (!arrival && !departure) return false;
    return (!arrival || arrival <= at) && (!departure || departure >= at);
  }

  private phase(today: string, start: string, dailyStart: string, weddingDate: string): string {
    if (today < start) return 'before';
    if (today < dailyStart) return 'weekly';
    if (today <= weddingDate) return 'daily';
    return 'complete';
  }

  private allPersonIds(guests: GuestEntity[]): Set<string> {
    return new Set(guests.flatMap(guest => [
      guest.id,
      ...(guest.hasPlusOne ? [`${guest.id}__plus_one`] : []),
      ...(guest.kids ?? []).map(kid => kid.id),
    ]));
  }

  private normalizeMealSelections(input: MealSelections): MealSelections {
    const config = this.eventConfig.getConfiguration();
    return Object.fromEntries(Object.entries(input)
      .filter(([date]) => isDateInWindow(date, config.preparationStart, config.weddingDate))
      .map(([date, values]) => [date, Array.from(new Set(Array.isArray(values) ? values.filter(value => MEAL_KINDS.includes(value)) : []))]));
  }

  private optionalDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Date invalide.');
    return date;
  }

  private requiredDate(value: string | undefined): Date {
    const date = this.optionalDate(value);
    if (!date) throw new BadRequestException('La date est obligatoire.');
    return date;
  }

  private assertDate(date: string): void {
    const config = this.eventConfig.getConfiguration();
    if (!isDateInWindow(date, config.preparationStart, config.weddingDate)) {
      throw new BadRequestException('La date doit être comprise entre D−56 et le jour du mariage.');
    }
  }

  private inputTime(value: string): string {
    const match = value.match(/T(\d{2}:\d{2}(?::\d{2})?)/);
    return `${match?.[1] ?? '09:00'}${match?.[1]?.length === 5 ? ':00' : ''}`;
  }

  private uniqueIds(ids: string[] | undefined): string[] {
    return Array.from(new Set((ids ?? []).filter(id => typeof id === 'string' && id)));
  }

  private async assertAccountsExist(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const accounts = await this.accountsRepository.find({ where: { id: In(ids) } });
    if (accounts.length !== ids.length || accounts.some(account => account.status === 'disabled')) {
      throw new BadRequestException('Un compte affecté est introuvable ou désactivé.');
    }
  }

  private async replaceTaskAssignees(taskId: string, accountIds: string[]): Promise<void> {
    await this.assigneesRepository.delete({ taskId });
    if (accountIds.length) {
      await this.assigneesRepository.insert(accountIds.map(accountId => ({ taskId, accountId })));
    }
  }

  private async replaceMealCooks(mealId: string, accountIds: string[]): Promise<void> {
    const ids = this.uniqueIds(accountIds);
    await this.assertAccountsExist(ids);
    await this.cooksRepository.delete({ mealId });
    if (ids.length) await this.cooksRepository.insert(ids.map(accountId => ({ mealId, accountId })));
  }

  private localDate(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);
  }
}
