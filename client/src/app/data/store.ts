import { Injectable, computed, signal } from '@angular/core';
import {
  Budget, BudgetCategory, BudgetItem, Guest, House, Room, Table, TodoGroup, Task, ThemeKey, Vendor,
} from './types';
import { allGuestPeople, guestPeople, THEME_KEYS } from '../shared/wedding-utils';

const THEME_STORAGE_KEY = 'wedding-theme';

const readStoredTheme = (): ThemeKey => {
  if (typeof localStorage === 'undefined') return 'nuit';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_KEYS.includes(stored as ThemeKey) ? stored as ThemeKey : 'nuit';
  } catch {
    return 'nuit';
  }
};

@Injectable({ providedIn: 'root' })
export class WeddingStore {
  readonly guests = signal<Guest[]>([]);
  readonly houses = signal<House[]>([]);
  readonly tables = signal<Table[]>([]);
  readonly budget = signal<Budget>({ categories: [] });
  readonly todos = signal<TodoGroup[]>([]);
  readonly vendors = signal<Vendor[]>([]);
  readonly theme = signal<ThemeKey>(readStoredTheme());
  readonly loaded = signal(false);

  readonly guestCount = computed(() =>
    this.guests().reduce((count, guest) => count + this.guestPartySize(guest), 0),
  );

  readonly confirmedCount = computed(() =>
    this.countGuestsByRsvp('confirmed'),
  );

  readonly pendingCount = computed(() =>
    this.countGuestsByRsvp('pending'),
  );

  guestPartySize(guest: Guest): number {
    const namedKids = guest.kids.filter(kid => kid.name.trim()).length;
    return 1 + (guest.hasPlusOne ? 1 : 0) + namedKids;
  }

  countGuestList(guests: Guest[]): number {
    return guests.reduce((count, guest) => count + this.guestPartySize(guest), 0);
  }

  private countGuestsByRsvp(rsvp: Guest['rsvp']): number {
    return this.guests()
      .filter(guest => guest.rsvp === rsvp)
      .reduce((count, guest) => count + this.guestPartySize(guest), 0);
  }

  // ── Guests ────────────────────────────────────────────────────────
  addGuest(g: Guest) {
    this.guests.update(arr => [...arr, g]);
  }
  replaceGuests(guests: Guest[]) {
    const validGuestIds = new Set(allGuestPeople(guests).map(person => person.id));
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
  }
  updateGuest(g: Guest) {
    const previous = this.guests().find(guest => guest.id === g.id);
    this.guests.update(arr => arr.map(x => x.id === g.id ? g : x));
    if (previous) {
      const validPersonIds = new Set(guestPeople(g).map(person => person.id));
      for (const person of guestPeople(previous)) {
        if (!validPersonIds.has(person.id)) {
          this.removeGuestAssignments(person.id);
        }
      }
    }
  }
  deleteGuest(id: string) {
    const removedGuest = this.guests().find(guest => guest.id === id);
    const removedPersonIds = removedGuest
      ? guestPeople(removedGuest).map(person => person.id)
      : [id];
    this.guests.update(arr => arr.filter(x => x.id !== id));
    for (const personId of removedPersonIds) {
      this.removeGuestAssignments(personId);
    }
  }

  private removeGuestAssignments(id: string) {
    this.houses.update(hs => hs.map(h => ({
      ...h,
      rooms: h.rooms.map(r => ({ ...r, guestIds: r.guestIds.filter(x => x !== id) })),
    })));
    this.tables.update(ts => ts.map(t => ({ ...t, guestIds: t.guestIds.filter(x => x !== id) })));
  }

  // ── Houses & rooms ────────────────────────────────────────────────
  addHouse(h: House) {
    this.houses.update(arr => [...arr, h]);
  }
  replaceHouses(houses: House[]) {
    this.houses.set(this.filterHouseAssignments(houses));
  }
  deleteHouse(id: string) {
    this.houses.update(arr => arr.filter(x => x.id !== id));
  }
  addRoom(houseId: string, room: Room) {
    this.houses.update(arr => arr.map(h => h.id === houseId
      ? { ...h, rooms: [...h.rooms, room] } : h));
  }
  deleteRoom(houseId: string, roomId: string) {
    this.houses.update(arr => arr.map(h => h.id === houseId
      ? { ...h, rooms: h.rooms.filter(r => r.id !== roomId) } : h));
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
  }

  // ── Tables ────────────────────────────────────────────────────────
  addTable(t: Table) {
    this.tables.update(arr => [...arr, t]);
  }
  replaceTables(tables: Table[]) {
    this.tables.set(this.filterTableAssignments(tables));
  }
  deleteTable(id: string) {
    this.tables.update(arr => arr.filter(x => x.id !== id));
  }
  assignGuestTable(guestId: string, tableId: string | null) {
    this.tables.update(arr => {
      const cleared = arr.map(t => ({ ...t, guestIds: t.guestIds.filter(id => id !== guestId) }));
      if (!tableId) return cleared;
      return cleared.map(t => t.id === tableId
        ? { ...t, guestIds: [...t.guestIds, guestId] } : t);
    });
  }
  removeGuestTable(tableId: string, guestId: string) {
    this.tables.update(arr => arr.map(t => t.id === tableId
      ? { ...t, guestIds: t.guestIds.filter(id => id !== guestId) } : t));
  }

  // ── Todos ─────────────────────────────────────────────────────────
  addTodoGroup(g: TodoGroup) {
    this.todos.update(arr => [...arr, g]);
  }
  replaceTodos(todos: TodoGroup[]) {
    this.todos.set(todos);
  }
  deleteTodoGroup(id: string) {
    this.todos.update(arr => arr.filter(g => g.id !== id));
  }
  addTodoTask(groupId: string, task: Task) {
    this.todos.update(arr => arr.map(g => g.id === groupId
      ? { ...g, tasks: [...g.tasks, task] } : g));
  }
  updateTodoTask(groupId: string, task: Task) {
    this.todos.update(arr => arr.map(g => g.id === groupId
      ? { ...g, tasks: g.tasks.map(tk => tk.id === task.id ? task : tk) } : g));
  }
  deleteTodoTask(groupId: string, taskId: string) {
    this.todos.update(arr => arr.map(g => g.id === groupId
      ? { ...g, tasks: g.tasks.filter(tk => tk.id !== taskId) } : g));
  }

  // ── Budget ────────────────────────────────────────────────────────
  addBudgetCat(cat: BudgetCategory) {
    this.budget.update(b => ({ ...b, categories: [...b.categories, cat] }));
  }
  replaceBudget(budget: Budget) {
    this.budget.set(budget);
  }
  updateBudgetCat(cat: BudgetCategory) {
    this.budget.update(b => ({
      ...b,
      categories: b.categories.map(c => c.id === cat.id ? cat : c),
    }));
  }
  deleteBudgetCat(id: string) {
    this.budget.update(b => ({ ...b, categories: b.categories.filter(c => c.id !== id) }));
  }
  addBudgetItem(catId: string, item: BudgetItem) {
    this.budget.update(b => ({
      ...b,
      categories: b.categories.map(c => c.id === catId
        ? { ...c, items: [...c.items, item] } : c),
    }));
  }
  deleteBudgetItem(catId: string, itemId: string) {
    this.budget.update(b => ({
      ...b,
      categories: b.categories.map(c => c.id === catId
        ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c),
    }));
  }

  // ── Vendors ───────────────────────────────────────────────────────
  replaceVendors(vendors: Vendor[]) {
    this.vendors.set(vendors);
  }
  addVendor(v: Vendor) {
    this.vendors.update(arr => [...arr, v]);
  }
  updateVendor(v: Vendor) {
    this.vendors.update(arr => arr.map(x => x.id === v.id ? v : x));
  }
  deleteVendor(id: string) {
    this.vendors.update(arr => arr.filter(x => x.id !== id));
  }

  // ── Theme ─────────────────────────────────────────────────────────
  markLoaded() {
    this.loaded.set(true);
  }

  setTheme(theme: ThemeKey) {
    this.theme.set(theme);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Theme persistence is best effort.
      }
    }
  }

  private validGuestIds(): Set<string> {
    return new Set(allGuestPeople(this.guests()).map(person => person.id));
  }

  private filterHouseAssignments(houses: House[]): House[] {
    const validGuestIds = this.validGuestIds();
    return houses.map(house => ({
      ...house,
      rooms: house.rooms.map(room => ({
        ...room,
        guestIds: room.guestIds.filter(id => validGuestIds.has(id)),
      })),
    }));
  }

  private filterTableAssignments(tables: Table[]): Table[] {
    const validGuestIds = this.validGuestIds();
    return tables.map(table => ({
      ...table,
      guestIds: table.guestIds.filter(id => validGuestIds.has(id)),
    }));
  }
}
