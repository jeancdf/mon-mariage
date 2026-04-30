import { Injectable, computed, signal } from '@angular/core';
import {
  Budget, BudgetCategory, BudgetItem, Guest, House, Room, Table, TodoGroup, Task, ThemeKey,
} from './types';

@Injectable({ providedIn: 'root' })
export class WeddingStore {
  readonly guests = signal<Guest[]>([]);
  readonly houses = signal<House[]>([]);
  readonly tables = signal<Table[]>([]);
  readonly budget = signal<Budget>({ categories: [] });
  readonly todos = signal<TodoGroup[]>([]);
  readonly theme = signal<ThemeKey>('blanc');

  readonly confirmedCount = computed(() =>
    this.guests().filter(g => g.rsvp === 'confirmed').length,
  );

  // ── Guests ────────────────────────────────────────────────────────
  addGuest(g: Guest) {
    this.guests.update(arr => [...arr, g]);
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
  }
  updateGuest(g: Guest) {
    this.guests.update(arr => arr.map(x => x.id === g.id ? g : x));
  }
  deleteGuest(id: string) {
    this.guests.update(arr => arr.filter(x => x.id !== id));
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
    this.houses.set(houses);
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
    this.tables.set(tables);
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

  // ── Theme ─────────────────────────────────────────────────────────
  setTheme(theme: ThemeKey) {
    this.theme.set(theme);
  }
}
