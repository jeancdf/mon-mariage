import { Injectable } from '@angular/core';
import { AdminAccount, AdminProfile } from '../data/admin-api.service';
import { DashboardSummary } from '../data/dashboard-api.service';
import {
  FinalWeeksHub, FinalWeeksPerson, FinalWeeksTask, MealKind, TaskPayload,
} from '../data/final-weeks-api.service';
import {
  Budget, BudgetCategory, BudgetItem, Guest, House, Room, Table, Task, TodoGroup, Vendor,
} from '../data/types';
import { allGuestPeople, guestPeople } from '../shared/wedding-utils';
import { DemoDataset, DemoPresence, createDemoDataset } from './demo-data';

const MEAL_KINDS: MealKind[] = ['breakfast', 'lunch', 'dinner'];
/** Tasks without an explicit end are drawn as one hour, matching the final-weeks gantt. */
const DEFAULT_TASK_DURATION = 60 * 60 * 1000;

const newId = (): string => Math.random().toString(36).slice(2, 11);

const localDate = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const shiftDays = (date: string, offset: number): string => {
  const shifted = new Date(`${date}T12:00:00`);
  shifted.setDate(shifted.getDate() + offset);
  return localDate(shifted);
};

/** Thrown by the demo backend so the interceptor can surface a matching HTTP status. */
export class DemoHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/**
 * In-memory replacement for the NestJS API, used only while the demo mode is on.
 * It owns a mutable copy of the demo dataset so a visitor can create, edit and
 * delete freely: nothing leaves the browser, and reloading restores the seed.
 */
@Injectable({ providedIn: 'root' })
export class DemoBackendService {
  private data: DemoDataset = createDemoDataset();

  reset(): void {
    this.data = createDemoDataset();
  }

  handle(method: string, path: string, body: unknown): unknown {
    const segments = path.replace(/^\/api\//, '').split('/').map(decodeURIComponent);
    const [root] = segments;
    const rest = segments.slice(1);
    switch (root) {
      case 'auth': return this.auth(method, rest);
      case 'event-config': return this.data.eventConfig;
      case 'health': return { status: 'ok' };
      case 'guests': return this.guests(method, rest, body);
      case 'housing': return this.housing(method, rest, body);
      case 'seating': return this.seating(method, rest, body);
      case 'budget': return this.budgetRoutes(method, rest, body);
      case 'todos': return this.todosRoutes(method, rest, body);
      case 'vendors': return this.vendorsRoutes(method, rest, body);
      case 'dashboard': return this.dashboard();
      case 'final-weeks': return this.finalWeeks(method, rest, body);
      case 'admin': return this.admin(method, rest, body);
      default: throw new DemoHttpError(404, `Route de démonstration inconnue : ${path}`);
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────
  private auth(method: string, rest: string[]): unknown {
    const [action] = rest;
    if (action === 'me' || action === 'login') {
      return { account: this.data.account, csrfToken: 'demo-csrf-token' };
    }
    if (action === 'logout') return { success: true };
    if (action === 'setup') return { configured: true };
    if (action === 'invitation') {
      throw new DemoHttpError(403, 'Les invitations ne s’utilisent pas en mode démonstration.');
    }
    if (action === 'password') {
      throw new DemoHttpError(403, 'Le mot de passe ne peut pas être modifié en mode démonstration.');
    }
    throw new DemoHttpError(404, `Route d’authentification inconnue : ${method} ${rest.join('/')}`);
  }

  // ── Guests ────────────────────────────────────────────────────────
  private guests(method: string, rest: string[], body: unknown): unknown {
    if (method === 'GET' && rest.length === 0) return this.data.guests;
    if (method === 'PUT' && rest[0] === 'import') {
      const payload = body as { guests?: Guest[] };
      this.data.guests = (payload.guests ?? []).map(guest => ({ ...guest, id: guest.id || newId() }));
      this.pruneAssignments();
      return this.data.guests;
    }
    if (method === 'POST' && rest.length === 0) {
      const guest = { ...(body as Guest), id: (body as Guest).id || newId() };
      this.data.guests = [...this.data.guests, guest];
      return guest;
    }
    if (method === 'PATCH' && rest.length === 1) {
      const existing = this.find(this.data.guests, rest[0], 'Invité introuvable.');
      const updated = { ...existing, ...(body as Partial<Guest>), id: existing.id };
      this.data.guests = this.data.guests.map(guest => guest.id === updated.id ? updated : guest);
      this.pruneAssignments();
      return updated;
    }
    if (method === 'DELETE' && rest.length === 1) {
      this.data.guests = this.data.guests.filter(guest => guest.id !== rest[0]);
      this.pruneAssignments();
      return { success: true };
    }
    throw new DemoHttpError(404, `Route invités inconnue : ${method} ${rest.join('/')}`);
  }

  /** Drops room seats, table seats and presence rows pointing at people who no longer exist. */
  private pruneAssignments(): void {
    const valid = new Set(allGuestPeople(this.data.guests).map(person => person.id));
    this.data.houses = this.data.houses.map(house => ({
      ...house,
      rooms: house.rooms.map(room => ({ ...room, guestIds: room.guestIds.filter(id => valid.has(id)) })),
    }));
    this.data.tables = this.data.tables.map(table => ({
      ...table,
      assignments: table.assignments.filter(assignment => valid.has(assignment.guestId)),
    }));
    for (const personId of Object.keys(this.data.presences)) {
      if (!valid.has(personId)) delete this.data.presences[personId];
    }
  }

  // ── Housing ───────────────────────────────────────────────────────
  private housing(method: string, rest: string[], body: unknown): House[] {
    if (method === 'GET' && rest.length === 0) return this.data.houses;

    if (rest[0] === 'houses') {
      if (method === 'POST' && rest.length === 1) {
        const { name } = body as { name: string };
        this.data.houses = [...this.data.houses, { id: newId(), name, rooms: [] }];
        return this.data.houses;
      }
      if (method === 'DELETE' && rest.length === 2) {
        this.data.houses = this.data.houses.filter(house => house.id !== rest[1]);
        return this.data.houses;
      }
      if (method === 'POST' && rest.length === 3 && rest[2] === 'rooms') {
        const room = body as Omit<Room, 'id' | 'guestIds'>;
        this.find(this.data.houses, rest[1], 'Logement introuvable.');
        this.data.houses = this.data.houses.map(house => house.id === rest[1]
          ? { ...house, rooms: [...house.rooms, { ...room, id: newId(), guestIds: [] }] }
          : house);
        return this.data.houses;
      }
    }

    if (rest[0] === 'rooms' && rest.length === 2) {
      if (method === 'PATCH') {
        const patch = body as Partial<Room>;
        this.data.houses = this.data.houses.map(house => ({
          ...house,
          rooms: house.rooms.map(room => room.id === rest[1]
            ? { ...room, ...patch, id: room.id, guestIds: room.guestIds }
            : room),
        }));
        return this.data.houses;
      }
      if (method === 'DELETE') {
        this.data.houses = this.data.houses.map(house => ({
          ...house,
          rooms: house.rooms.filter(room => room.id !== rest[1]),
        }));
        return this.data.houses;
      }
    }

    if (rest[0] === 'assignments' && rest.length === 2) {
      const guestId = rest[1];
      const cleared = this.data.houses.map(house => ({
        ...house,
        rooms: house.rooms.map(room => ({ ...room, guestIds: room.guestIds.filter(id => id !== guestId) })),
      }));
      if (method === 'DELETE') {
        this.data.houses = cleared;
        return this.data.houses;
      }
      if (method === 'PUT') {
        const { roomId } = body as { roomId: string };
        this.data.houses = cleared.map(house => ({
          ...house,
          rooms: house.rooms.map(room => room.id === roomId
            ? { ...room, guestIds: [...room.guestIds, guestId] }
            : room),
        }));
        return this.data.houses;
      }
    }

    throw new DemoHttpError(404, `Route hébergement inconnue : ${method} ${rest.join('/')}`);
  }

  // ── Seating ───────────────────────────────────────────────────────
  private seating(method: string, rest: string[], body: unknown): Table[] {
    if (method === 'GET' && rest.length === 0) return this.data.tables;

    if (rest[0] === 'tables') {
      if (method === 'POST' && rest.length === 1) {
        const table = body as Omit<Table, 'id' | 'rotation' | 'assignments'>;
        this.data.tables = [...this.data.tables, { rotation: 0, assignments: [], ...table, id: newId() }];
        return this.data.tables;
      }
      if (method === 'PATCH' && rest.length === 2) {
        const patch = body as Partial<Table>;
        this.data.tables = this.data.tables.map(table => table.id === rest[1]
          ? { ...table, ...patch, id: table.id, assignments: this.fitAssignments(table, patch.seats) }
          : table);
        return this.data.tables;
      }
      if (method === 'DELETE' && rest.length === 2) {
        this.data.tables = this.data.tables.filter(table => table.id !== rest[1]);
        return this.data.tables;
      }
    }

    if (rest[0] === 'assignments' && rest.length === 2) {
      const guestId = rest[1];
      if (method === 'DELETE') {
        this.data.tables = this.data.tables.map(table => ({
          ...table,
          assignments: table.assignments.filter(assignment => assignment.guestId !== guestId),
        }));
        return this.data.tables;
      }
      if (method === 'PUT') {
        const { tableId, seat } = body as { tableId: string; seat: number | null };
        this.assignSeat(guestId, tableId, seat);
        return this.data.tables;
      }
    }

    throw new DemoHttpError(404, `Route plan de table inconnue : ${method} ${rest.join('/')}`);
  }

  private fitAssignments(table: Table, seats: number | undefined): Table['assignments'] {
    if (seats === undefined || seats >= table.seats) return table.assignments;
    return table.assignments.filter(assignment => assignment.seat < seats);
  }

  /** Mirrors the server: take the seat, and either swap with the occupant or bump them to a free one. */
  private assignSeat(guestId: string, tableId: string, seat: number | null): void {
    const target = this.find(this.data.tables, tableId, 'Table introuvable.');
    let previous: { tableId: string; seat: number } | null = null;
    for (const table of this.data.tables) {
      const found = table.assignments.find(assignment => assignment.guestId === guestId);
      if (found) previous = { tableId: table.id, seat: found.seat };
    }

    const tables = this.data.tables.map(table => ({
      ...table,
      assignments: table.assignments.filter(assignment => assignment.guestId !== guestId),
    }));
    const destination = tables.find(table => table.id === target.id)!;
    const taken = new Set(destination.assignments.map(assignment => assignment.seat));
    const firstFree = (excluded: number | null = null): number | null => {
      for (let index = 0; index < destination.seats; index += 1) {
        if (index !== excluded && !taken.has(index)) return index;
      }
      return null;
    };

    const wanted = seat !== null && seat >= 0 && seat < destination.seats ? seat : firstFree();
    if (wanted === null) throw new DemoHttpError(400, 'Cette table est complète.');

    const occupant = destination.assignments.find(assignment => assignment.seat === wanted);
    if (occupant) {
      if (previous) {
        const origin = tables.find(table => table.id === previous!.tableId)!;
        origin.assignments = [
          ...origin.assignments.filter(assignment => assignment.guestId !== occupant.guestId),
          { guestId: occupant.guestId, seat: previous.seat },
        ];
        if (previous.tableId !== destination.id) {
          destination.assignments = destination.assignments.filter(a => a.guestId !== occupant.guestId);
        }
      } else {
        taken.delete(wanted);
        const fallback = firstFree(wanted);
        if (fallback === null) throw new DemoHttpError(400, 'Cette table est complète.');
        destination.assignments = destination.assignments.map(assignment =>
          assignment.guestId === occupant.guestId ? { ...assignment, seat: fallback } : assignment);
      }
    }

    destination.assignments = [
      ...destination.assignments.filter(a => a.guestId !== guestId && a.seat !== wanted),
      { guestId, seat: wanted },
    ];
    this.data.tables = tables;
  }

  // ── Budget ────────────────────────────────────────────────────────
  private budgetRoutes(method: string, rest: string[], body: unknown): Budget {
    if (method === 'GET' && rest.length === 0) return this.data.budget;
    const categories = this.data.budget.categories;

    if (rest[0] === 'categories') {
      if (method === 'POST' && rest.length === 1) {
        const { name, estimated } = body as { name: string; estimated: number };
        return this.setBudget([...categories, { id: newId(), name, estimated, items: [] }]);
      }
      if (method === 'PATCH' && rest.length === 2) {
        const patch = body as Partial<BudgetCategory>;
        return this.setBudget(categories.map(category => category.id === rest[1]
          ? { ...category, ...patch, id: category.id, items: category.items }
          : category));
      }
      if (method === 'DELETE' && rest.length === 2) {
        return this.setBudget(categories.filter(category => category.id !== rest[1]));
      }
      if (method === 'POST' && rest.length === 3 && rest[2] === 'items') {
        const item = body as Omit<BudgetItem, 'id'>;
        this.find(categories, rest[1], 'Catégorie introuvable.');
        return this.setBudget(categories.map(category => category.id === rest[1]
          ? { ...category, items: [...category.items, { ...item, id: newId() }] }
          : category));
      }
    }

    if (rest[0] === 'items' && rest.length === 2) {
      if (method === 'PATCH') {
        const patch = body as Partial<BudgetItem>;
        return this.setBudget(categories.map(category => ({
          ...category,
          items: category.items.map(item => item.id === rest[1] ? { ...item, ...patch, id: item.id } : item),
        })));
      }
      if (method === 'DELETE') {
        return this.setBudget(categories.map(category => ({
          ...category,
          items: category.items.filter(item => item.id !== rest[1]),
        })));
      }
    }

    throw new DemoHttpError(404, `Route budget inconnue : ${method} ${rest.join('/')}`);
  }

  private setBudget(categories: BudgetCategory[]): Budget {
    this.data.budget = { categories };
    return this.data.budget;
  }

  // ── Todos ─────────────────────────────────────────────────────────
  private todosRoutes(method: string, rest: string[], body: unknown): TodoGroup[] {
    if (method === 'GET' && rest.length === 0) return this.data.todos;

    if (rest[0] === 'groups') {
      if (method === 'POST' && rest.length === 1) {
        const { title } = body as { title: string };
        this.data.todos = [...this.data.todos, { id: newId(), title, tasks: [] }];
        return this.data.todos;
      }
      if (method === 'PATCH' && rest.length === 2) {
        const patch = body as Partial<TodoGroup>;
        this.data.todos = this.data.todos.map(group => group.id === rest[1]
          ? { ...group, ...patch, id: group.id, tasks: group.tasks }
          : group);
        return this.data.todos;
      }
      if (method === 'DELETE' && rest.length === 2) {
        this.data.todos = this.data.todos.filter(group => group.id !== rest[1]);
        return this.data.todos;
      }
      if (method === 'POST' && rest.length === 3 && rest[2] === 'tasks') {
        const task = body as Omit<Task, 'id'>;
        this.find(this.data.todos, rest[1], 'Groupe introuvable.');
        this.data.todos = this.data.todos.map(group => group.id === rest[1]
          ? { ...group, tasks: [...group.tasks, { ...task, id: newId() }] }
          : group);
        return this.data.todos;
      }
    }

    if (rest[0] === 'tasks' && rest.length === 2) {
      if (method === 'PATCH') {
        const patch = body as Partial<Task>;
        this.data.todos = this.data.todos.map(group => ({
          ...group,
          tasks: group.tasks.map(task => task.id === rest[1] ? { ...task, ...patch, id: task.id } : task),
        }));
        return this.data.todos;
      }
      if (method === 'DELETE') {
        this.data.todos = this.data.todos.map(group => ({
          ...group,
          tasks: group.tasks.filter(task => task.id !== rest[1]),
        }));
        return this.data.todos;
      }
    }

    throw new DemoHttpError(404, `Route à-faire inconnue : ${method} ${rest.join('/')}`);
  }

  // ── Vendors ───────────────────────────────────────────────────────
  private vendorsRoutes(method: string, rest: string[], body: unknown): Vendor[] {
    if (method === 'GET' && rest.length === 0) return this.data.vendors;
    if (method === 'POST' && rest.length === 0) {
      this.data.vendors = [...this.data.vendors, { ...(body as Vendor), id: newId() }];
      return this.data.vendors;
    }
    if (method === 'PATCH' && rest.length === 1) {
      const patch = body as Partial<Vendor>;
      this.data.vendors = this.data.vendors.map(vendor => vendor.id === rest[0]
        ? { ...vendor, ...patch, id: vendor.id }
        : vendor);
      return this.data.vendors;
    }
    if (method === 'DELETE' && rest.length === 1) {
      this.data.vendors = this.data.vendors.filter(vendor => vendor.id !== rest[0]);
      return this.data.vendors;
    }
    throw new DemoHttpError(404, `Route prestataires inconnue : ${method} ${rest.join('/')}`);
  }

  // ── Dashboard ─────────────────────────────────────────────────────
  private dashboard(): DashboardSummary {
    const partySize = (guest: Guest): number =>
      1 + (guest.hasPlusOne ? 1 : 0) + guest.kids.filter(kid => kid.name.trim()).length;
    const countBy = (rsvp: Guest['rsvp']): number => this.data.guests
      .filter(guest => guest.rsvp === rsvp)
      .reduce((total, guest) => total + partySize(guest), 0);

    const rooms = this.data.houses.flatMap(house => house.rooms);
    const spentOf = (category: BudgetCategory): number =>
      category.items.reduce((total, item) => total + item.amount, 0);
    const tasks = this.data.todos.flatMap(group => group.tasks);
    const committed = this.data.vendors.reduce(
      (total, vendor) => total + (vendor.priceFinal || vendor.priceEstimate), 0);
    const weddingDate = new Date(`${this.data.eventConfig.weddingDate}T00:00:00`);
    const todayStart = new Date(`${localDate(new Date())}T00:00:00`);

    return {
      guests: {
        total: this.data.guests.reduce((total, guest) => total + partySize(guest), 0),
        confirmed: countBy('confirmed'),
        pending: countBy('pending'),
        declined: countBy('declined'),
      },
      housing: {
        occupiedBeds: rooms.reduce((total, room) => total + room.guestIds.length, 0),
        totalBeds: rooms.reduce((total, room) => total + room.beds * (room.bedType === 'double' ? 2 : 1), 0),
      },
      seating: {
        seated: this.data.tables.reduce((total, table) => total + table.assignments.length, 0),
        totalSeats: this.data.tables.reduce((total, table) => total + table.seats, 0),
      },
      budget: {
        totalEstimated: this.data.budget.categories.reduce((total, category) => total + category.estimated, 0),
        totalSpent: this.data.budget.categories.reduce((total, category) => total + spentOf(category), 0),
        categories: this.data.budget.categories.map(category => ({
          id: category.id, name: category.name, estimated: category.estimated, spent: spentOf(category),
        })),
      },
      todos: { total: tasks.length, done: tasks.filter(task => task.done).length },
      vendors: {
        count: this.data.vendors.length,
        reserved: this.data.vendors.filter(vendor =>
          ['reserve', 'acompte-paye', 'solde-paye'].includes(vendor.status)).length,
        totalCommitted: committed,
      },
      daysRemaining: Math.max(0, Math.round((weddingDate.getTime() - todayStart.getTime()) / 86400000)),
      finalWeeks: this.buildHub().summary,
    };
  }

  // ── Final weeks ───────────────────────────────────────────────────
  private finalWeeks(method: string, rest: string[], body: unknown): unknown {
    if (method === 'GET' && rest.length === 0) return this.buildHub();

    if (rest[0] === 'people' && rest.length === 2 && method === 'PUT') {
      const input = body as Partial<DemoPresence>;
      const current = this.data.presences[rest[1]] ?? { arrivalAt: null, departureAt: null, mealSelections: {} };
      this.data.presences[rest[1]] = {
        arrivalAt: 'arrivalAt' in input ? input.arrivalAt ?? null : current.arrivalAt,
        departureAt: 'departureAt' in input ? input.departureAt ?? null : current.departureAt,
        mealSelections: input.mealSelections ?? current.mealSelections,
      };
      return { success: true };
    }

    if (rest[0] === 'meals' && rest.length === 3 && method === 'PUT') {
      const [, date, kind] = rest;
      const input = body as { menu?: string; notes?: string; cookIds?: string[] };
      const existing = this.data.meals.find(meal => meal.date === date && meal.kind === kind);
      if (existing) {
        if (typeof input.menu === 'string') existing.menu = input.menu;
        if (typeof input.notes === 'string') existing.notes = input.notes;
        if (input.cookIds) existing.cookIds = [...input.cookIds];
      } else {
        this.data.meals = [...this.data.meals, {
          id: newId(), date, kind: kind as MealKind,
          menu: input.menu ?? '', notes: input.notes ?? '', cookIds: input.cookIds ?? [], headcount: 0,
        }];
      }
      return { success: true };
    }

    if (rest[0] === 'tasks') {
      if (method === 'POST' && rest.length === 1) {
        this.createFinalTasks(body as TaskPayload);
        return { success: true };
      }
      if (method === 'PATCH' && rest.length === 2) {
        const payload = body as TaskPayload;
        this.data.finalTasks = this.data.finalTasks.map(task => task.id === rest[1]
          ? {
            ...task,
            ...(payload.title !== undefined ? { title: payload.title } : {}),
            ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
            ...(payload.category !== undefined ? { category: payload.category } : {}),
            ...(payload.scheduledAt !== undefined ? { scheduledAt: new Date(payload.scheduledAt).toISOString() } : {}),
            ...(payload.endsAt !== undefined ? { endsAt: payload.endsAt ? new Date(payload.endsAt).toISOString() : null } : {}),
            ...(payload.status !== undefined ? { status: payload.status } : {}),
            ...(payload.assigneeIds !== undefined ? { assigneeIds: [...payload.assigneeIds] } : {}),
          }
          : task);
        return { success: true };
      }
      if (method === 'DELETE' && rest.length === 2) {
        this.data.finalTasks = this.data.finalTasks.filter(task => task.id !== rest[1]);
        return { success: true };
      }
    }

    throw new DemoHttpError(404, `Route dernières semaines inconnue : ${method} ${rest.join('/')}`);
  }

  /** Expands the recurrence options the task form offers into one task per matching day. */
  private createFinalTasks(payload: TaskPayload): void {
    const scheduledAt = payload.scheduledAt ?? new Date().toISOString();
    const startDate = scheduledAt.slice(0, 10);
    const duration = payload.endsAt
      ? new Date(payload.endsAt).getTime() - new Date(scheduledAt).getTime()
      : DEFAULT_TASK_DURATION;
    const recurrence = payload.recurrence ?? { type: 'none' as const };
    const until = recurrence.untilDate || startDate;
    const weekdays = recurrence.weekdays ?? [];

    const dates: string[] = [];
    for (let cursor = startDate; cursor <= until; cursor = shiftDays(cursor, 1)) {
      const weekday = new Date(`${cursor}T12:00:00`).getDay();
      const matches = recurrence.type === 'daily'
        || (recurrence.type === 'weekdays' && weekdays.includes(weekday));
      if (cursor === startDate || matches) dates.push(cursor);
      if (recurrence.type === 'none') break;
    }

    const groupId = dates.length > 1 ? newId() : null;
    const time = scheduledAt.slice(10);
    const created = dates.map(date => {
      const start = new Date(`${date}${time}`);
      return {
        id: newId(),
        title: payload.title ?? 'Nouvelle tâche',
        notes: payload.notes ?? '',
        category: payload.category ?? 'other',
        scheduledAt: start.toISOString(),
        endsAt: new Date(start.getTime() + duration).toISOString(),
        status: payload.status ?? 'todo',
        recurrenceGroupId: groupId,
        assigneeIds: [...(payload.assigneeIds ?? [])],
      } satisfies FinalWeeksTask;
    });
    this.data.finalTasks = [...this.data.finalTasks, ...created];
  }

  private buildHub(): FinalWeeksHub {
    const config = this.data.eventConfig;
    const now = new Date();
    const today = localDate(now);
    const people = this.buildPeople();
    const meals = this.data.meals.map(meal => ({
      ...meal,
      headcount: this.mealHeadcount(people, meal.date, meal.kind),
    }));
    const active = this.data.finalTasks.filter(task => task.status !== 'done' && task.status !== 'cancelled');

    return {
      config: {
        weddingDate: config.weddingDate,
        weddingPlace: config.weddingPlace,
        preparationStart: config.preparationStart,
        dailyStart: config.dailyStart,
        today,
        phase: this.phase(today, config),
      },
      summary: {
        currentlyPresent: people.filter(person => this.presentAt(person, now)).length,
        todayMeals: Object.fromEntries(
          MEAL_KINDS.map(kind => [kind, this.mealHeadcount(people, today, kind)]),
        ) as Record<MealKind, number>,
        unfinished: active.length,
        unassigned: active.filter(task => task.assigneeIds.length === 0).length,
        overdue: active.filter(task => task.scheduledAt.slice(0, 10) < today).length,
        completion: this.data.finalTasks.length
          ? Math.round((this.data.finalTasks.filter(task => task.status === 'done').length / this.data.finalTasks.length) * 100)
          : 0,
      },
      people,
      meals,
      tasks: [...this.data.finalTasks],
      accounts: this.data.accounts
        .filter(account => account.status !== 'disabled')
        .map(account => ({
          id: account.id, guestId: account.guestId, name: account.name, status: account.status,
        })),
    };
  }

  private buildPeople(): FinalWeeksPerson[] {
    const roomByPerson = new Map<string, { id: string; name: string; houseName: string }>();
    for (const house of this.data.houses) {
      for (const room of house.rooms) {
        for (const personId of room.guestIds) {
          roomByPerson.set(personId, { id: room.id, name: room.name, houseName: house.name });
        }
      }
    }
    const accountByGuest = new Map(this.data.accounts
      .filter(account => account.guestId)
      .map(account => [account.guestId!, { id: account.id, status: account.status }]));

    return this.data.guests.flatMap(guest => guestPeople(guest).map(person => {
      const presence = this.data.presences[person.id];
      return {
        id: person.id,
        guestId: guest.id,
        firstName: person.firstName,
        lastName: person.lastName,
        primary: person.id === guest.id,
        organizationRole: guest.organizationRole,
        arrivalAt: presence?.arrivalAt ?? null,
        departureAt: presence?.departureAt ?? null,
        mealSelections: presence?.mealSelections ?? {},
        account: (person.id === guest.id ? accountByGuest.get(guest.id) : undefined) ?? null,
        room: roomByPerson.get(person.id) ?? null,
      } satisfies FinalWeeksPerson;
    }));
  }

  private mealHeadcount(people: FinalWeeksPerson[], date: string, kind: MealKind): number {
    return people.filter(person => (person.mealSelections[date] ?? []).includes(kind)).length;
  }

  private presentAt(person: FinalWeeksPerson, at: Date): boolean {
    const arrival = person.arrivalAt ? new Date(person.arrivalAt) : null;
    const departure = person.departureAt ? new Date(person.departureAt) : null;
    return (!arrival || arrival <= at) && (!departure || departure >= at);
  }

  private phase(today: string, config: DemoDataset['eventConfig']): FinalWeeksHub['config']['phase'] {
    if (today < config.preparationStart) return 'before';
    if (today < config.dailyStart) return 'weekly';
    if (today <= config.weddingDate) return 'daily';
    return 'complete';
  }

  // ── Admin ─────────────────────────────────────────────────────────
  private admin(method: string, rest: string[], body: unknown): unknown {
    if (rest[0] === 'mail') {
      if (method === 'GET' && rest[1] === 'status') {
        return {
          host: '', port: 587, user: '', from: '', applicationUrl: '',
          passwordConfigured: false, passwordLength: 0,
        };
      }
      if (method === 'POST' && rest[1] === 'test') {
        throw new DemoHttpError(503, "Les e-mails ne s’envoient pas en mode démonstration. Testez ce bouton sur l’application déployée.");
      }
      throw new DemoHttpError(404, `Route administration inconnue : ${method} ${rest.join('/')}`);
    }
    if (rest[0] === 'accounts') {
      if (method === 'GET' && rest.length === 1) return this.data.accounts;
      if (method === 'POST' && rest.length === 3 && rest[1] === 'guests') {
        const guest = this.find(this.data.guests, rest[2], 'Invité introuvable.');
        if (!guest.email) throw new DemoHttpError(400, 'Adresse e-mail invalide.');
        const duplicate = this.data.accounts.find(account => account.email === guest.email && account.guestId !== guest.id);
        if (duplicate) throw new DemoHttpError(409, 'Cette adresse e-mail est déjà utilisée.');
        const existing = this.data.accounts.find(account => account.guestId === guest.id);
        const created = existing ?? {
          id: newId(),
          guestId: guest.id,
          email: guest.email,
          status: 'pending' as const,
          hasPassword: false,
          invitationSentAt: null,
          invitationExpiresAt: null,
          profileKey: this.profileForGuest(guest),
          isOrganizer: false,
          lastLoginAt: null,
          name: `${guest.firstName} ${guest.lastName}`.trim(),
        };
        const invited = this.markInvited({
          ...created,
          email: guest.email,
          profileKey: this.profileForGuest(guest),
          ...(created.hasPassword ? {} : { status: 'pending' as const }),
        });
        this.data.accounts = existing
          ? this.data.accounts.map(account => account.id === invited.id ? invited : account)
          : [...this.data.accounts, invited];
        return { success: true };
      }
      if (method === 'PATCH' && rest.length === 3 && rest[2] === 'status') {
        const { status } = body as { status: 'pending' | 'active' | 'disabled' };
        this.data.accounts = this.data.accounts.map(account =>
          account.id === rest[1] ? { ...account, status } : account);
        return { success: true };
      }
      if (method === 'POST' && rest.length === 3 && rest[2] === 'invite') {
        const existing = this.find(this.data.accounts, rest[1], 'Compte introuvable.');
        if (existing.isOrganizer) throw new DemoHttpError(404, 'Compte introuvable.');
        if (existing.status === 'disabled') {
          throw new DemoHttpError(400, "Réactivez ce compte avant d'envoyer une invitation.");
        }
        this.data.accounts = this.data.accounts.map(account =>
          account.id === existing.id ? this.markInvited(account) : account);
        return { success: true };
      }
    }

    if (rest[0] === 'profiles') {
      if (method === 'GET' && rest.length === 1) return this.data.profiles;
      if (method === 'PATCH' && rest.length === 2) {
        const payload = body as { name: string; permissions: Record<string, { canView: boolean; canEdit: boolean }> };
        const updated = this.data.profiles.map(profile => profile.key === rest[1]
          ? {
            ...profile,
            name: payload.name,
            permissions: profile.permissions.map(permission => ({
              ...permission,
              ...(payload.permissions[permission.section] ?? {}),
            })),
          }
          : profile);
        this.data.profiles = updated;
        return updated.find(profile => profile.key === rest[1]) as AdminProfile;
      }
    }

    throw new DemoHttpError(404, `Route administration inconnue : ${method} ${rest.join('/')}`);
  }

  private find<T extends { id: string }>(items: T[], id: string, message: string): T {
    const found = items.find(item => item.id === id);
    if (!found) throw new DemoHttpError(404, message);
    return found;
  }

  private profileForGuest(guest: Guest): AdminAccount['profileKey'] {
    const role = guest.organizationRole;
    if (role === 'parent' || role === 'sibling' || role === 'witness' || role === 'friend_cousin') return role;
    return 'other';
  }

  /** Mirrors the 48h invitation window the real API stamps on send. */
  private markInvited(account: AdminAccount): AdminAccount {
    const sentAt = new Date();
    return {
      ...account,
      invitationSentAt: sentAt.toISOString(),
      invitationExpiresAt: new Date(sentAt.getTime() + 48 * 60 * 60 * 1000).toISOString(),
    };
  }
}
