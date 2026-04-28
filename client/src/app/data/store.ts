import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Budget, BudgetCategory, BudgetItem, Guest, House, PlannerState, Room, Table, TodoGroup, Task, ThemeKey,
} from './types';
import {
  INITIAL_BUDGET, INITIAL_GUESTS, INITIAL_HOUSES, INITIAL_TABLES, INITIAL_TODOS,
} from './seed';
import { PlannerApiService } from './planner-api.service';

@Injectable({ providedIn: 'root' })
export class WeddingStore {
  private readonly plannerApi = inject(PlannerApiService);
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private isHydrating = false;

  readonly guests = signal<Guest[]>(INITIAL_GUESTS);
  readonly houses = signal<House[]>(INITIAL_HOUSES);
  readonly tables = signal<Table[]>(INITIAL_TABLES);
  readonly budget = signal<Budget>(INITIAL_BUDGET);
  readonly todos = signal<TodoGroup[]>(INITIAL_TODOS);
  readonly theme = signal<ThemeKey>('blanc');

  readonly confirmedCount = computed(() =>
    this.guests().filter(g => g.rsvp === 'confirmed').length,
  );

  async loadFromBackend(): Promise<void> {
    try {
      const state = await this.plannerApi.loadPlanner();
      if (state) {
        this.applyState(state);
      } else {
        await this.persistNow();
      }
    } catch {
      // Keep seed/local state when the API is unavailable during frontend-only development.
    }
  }

  // ── Guests ────────────────────────────────────────────────────────
  addGuest(g: Guest) {
    this.guests.update(arr => [...arr, g]);
    this.queuePersist();
  }
  replaceGuests(guests: Guest[]) {
    const validGuestIds = new Set(guests.map(guest => guest.id));
    this.guests.set(guests);
    this.houses.update(houses => houses.map(house => ({
      ...house,
      rooms: house.rooms.map(room => ({
        ...room,
        guestIds: room.guestIds.filter(id => validGuestIds.has(id)),
      })),
    })));
    this.tables.update(tables => tables.map(table => ({
      ...table,
      guestIds: table.guestIds.filter(id => validGuestIds.has(id)),
    })));
    this.queuePersist();
  }
  updateGuest(g: Guest) {
    this.guests.update(arr => arr.map(x => x.id === g.id ? g : x));
    this.queuePersist();
  }
  deleteGuest(id: string) {
    this.guests.update(arr => arr.filter(x => x.id !== id));
    this.houses.update(hs => hs.map(h => ({
      ...h,
      rooms: h.rooms.map(r => ({ ...r, guestIds: r.guestIds.filter(x => x !== id) })),
    })));
    this.tables.update(ts => ts.map(t => ({ ...t, guestIds: t.guestIds.filter(x => x !== id) })));
    this.queuePersist();
  }

  // ── Houses & rooms ────────────────────────────────────────────────
  addHouse(h: House) {
    this.houses.update(arr => [...arr, h]);
    this.queuePersist();
  }
  deleteHouse(id: string) {
    this.houses.update(arr => arr.filter(x => x.id !== id));
    this.queuePersist();
  }
  addRoom(houseId: string, room: Room) {
    this.houses.update(arr => arr.map(h => h.id === houseId
      ? { ...h, rooms: [...h.rooms, room] } : h));
    this.queuePersist();
  }
  deleteRoom(houseId: string, roomId: string) {
    this.houses.update(arr => arr.map(h => h.id === houseId
      ? { ...h, rooms: h.rooms.filter(r => r.id !== roomId) } : h));
    this.queuePersist();
  }
  assignGuestRoom(guestId: string, houseId: string | null, roomId: string | null) {
    this.houses.update(arr => {
      const cleared = arr.map(h => ({
        ...h,
        rooms: h.rooms.map(r => ({ ...r, guestIds: r.guestIds.filter(id => id !== guestId) })),
      }));
      if (!roomId || !houseId) return cleared;
      return cleared.map(h => h.id === houseId
        ? { ...h, rooms: h.rooms.map(r => r.id === roomId
          ? { ...r, guestIds: [...r.guestIds, guestId] } : r) }
        : h);
    });
    this.queuePersist();
  }

  // ── Tables ────────────────────────────────────────────────────────
  addTable(t: Table) {
    this.tables.update(arr => [...arr, t]);
    this.queuePersist();
  }
  deleteTable(id: string) {
    this.tables.update(arr => arr.filter(x => x.id !== id));
    this.queuePersist();
  }
  assignGuestTable(guestId: string, tableId: string | null) {
    this.tables.update(arr => {
      const cleared = arr.map(t => ({ ...t, guestIds: t.guestIds.filter(id => id !== guestId) }));
      if (!tableId) return cleared;
      return cleared.map(t => t.id === tableId
        ? { ...t, guestIds: [...t.guestIds, guestId] } : t);
    });
    this.queuePersist();
  }
  removeGuestTable(tableId: string, guestId: string) {
    this.tables.update(arr => arr.map(t => t.id === tableId
      ? { ...t, guestIds: t.guestIds.filter(id => id !== guestId) } : t));
    this.queuePersist();
  }

  // ── Todos ─────────────────────────────────────────────────────────
  addTodoGroup(g: TodoGroup) {
    this.todos.update(arr => [...arr, g]);
    this.queuePersist();
  }
  deleteTodoGroup(id: string) {
    this.todos.update(arr => arr.filter(g => g.id !== id));
    this.queuePersist();
  }
  addTodoTask(groupId: string, task: Task) {
    this.todos.update(arr => arr.map(g => g.id === groupId
      ? { ...g, tasks: [...g.tasks, task] } : g));
    this.queuePersist();
  }
  updateTodoTask(groupId: string, task: Task) {
    this.todos.update(arr => arr.map(g => g.id === groupId
      ? { ...g, tasks: g.tasks.map(tk => tk.id === task.id ? task : tk) } : g));
    this.queuePersist();
  }
  deleteTodoTask(groupId: string, taskId: string) {
    this.todos.update(arr => arr.map(g => g.id === groupId
      ? { ...g, tasks: g.tasks.filter(tk => tk.id !== taskId) } : g));
    this.queuePersist();
  }

  // ── Budget ────────────────────────────────────────────────────────
  addBudgetCat(cat: BudgetCategory) {
    this.budget.update(b => ({ ...b, categories: [...b.categories, cat] }));
    this.queuePersist();
  }
  updateBudgetCat(cat: BudgetCategory) {
    this.budget.update(b => ({
      ...b,
      categories: b.categories.map(c => c.id === cat.id ? cat : c),
    }));
    this.queuePersist();
  }
  deleteBudgetCat(id: string) {
    this.budget.update(b => ({ ...b, categories: b.categories.filter(c => c.id !== id) }));
    this.queuePersist();
  }
  addBudgetItem(catId: string, item: BudgetItem) {
    this.budget.update(b => ({
      ...b,
      categories: b.categories.map(c => c.id === catId
        ? { ...c, items: [...c.items, item] } : c),
    }));
    this.queuePersist();
  }
  deleteBudgetItem(catId: string, itemId: string) {
    this.budget.update(b => ({
      ...b,
      categories: b.categories.map(c => c.id === catId
        ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c),
    }));
    this.queuePersist();
  }

  // ── Theme ─────────────────────────────────────────────────────────
  setTheme(theme: ThemeKey) {
    this.theme.set(theme);
    this.queuePersist();
  }

  snapshot(): PlannerState {
    return {
      guests: this.guests(),
      houses: this.houses(),
      tables: this.tables(),
      budget: this.budget(),
      todos: this.todos(),
      theme: this.theme(),
    };
  }

  private applyState(state: PlannerState): void {
    this.isHydrating = true;
    this.guests.set(state.guests ?? []);
    this.houses.set(state.houses ?? []);
    this.tables.set(state.tables ?? []);
    this.budget.set(state.budget ?? { categories: [] });
    this.todos.set(state.todos ?? []);
    this.theme.set(state.theme ?? 'blanc');
    this.isHydrating = false;
  }

  private queuePersist(): void {
    if (this.isHydrating) return;
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistNow();
    }, 250);
  }

  private async persistNow(): Promise<void> {
    try {
      await this.plannerApi.savePlanner(this.snapshot());
    } catch {
      // Keep UI responsive if the API is temporarily unavailable.
    }
  }
}
