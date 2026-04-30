import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Guest, Table } from '../../data/types';
import { SeatingApiService } from '../../data/seating-api.service';
import { WeddingStore } from '../../data/store';
import { IconComponent } from '../../shared/icon.component';
import { GuestSidebarComponent } from '../../shared/guest-sidebar.component';
import { gid } from '../../data/seed';

@Component({
  selector: 'app-seating',
  standalone: true,
  imports: [FormsModule, IconComponent, GuestSidebarComponent],
  templateUrl: './seating.component.html',
  host: { class: 'split-pane-host' },
})
export class SeatingComponent {
  readonly store = inject(WeddingStore);
  private readonly seatingApi = inject(SeatingApiService);
  addingTable = false;
  tableForm: { name: string; seats: number | string } = { name: '', seats: 12 };
  editingTableId: string | null = null;
  editTableForm: { name: string; seats: number | string } = { name: '', seats: 12 };
  selectedGuestId: string | null = null;

  readonly guestMap = computed(() => new Map(this.store.guests().map(guest => [guest.id, guest])));
  readonly assignedIds = computed(() => new Set(this.store.tables().flatMap(table => table.guestIds)));
  readonly unplacedGuests = computed(() => this.store.guests().filter(guest => guest.rsvp !== 'declined' && !this.assignedIds().has(guest.id)));
  readonly totals = computed(() => {
    const tables = this.store.tables();
    return {
      totalSeats: tables.reduce((sum, table) => sum + table.seats, 0),
      placed: tables.reduce((sum, table) => sum + table.guestIds.length, 0),
    };
  });

  guestById(id: string): Guest | undefined {
    return this.guestMap().get(id);
  }

  initials(guest: Guest | undefined): string {
    return guest ? `${guest.firstName[0] ?? ''}${guest.lastName[0] ?? ''}` : '';
  }

  selectedGuest(): Guest | undefined {
    return this.selectedGuestId ? this.guestById(this.selectedGuestId) : undefined;
  }

  canPlace(table: Table): boolean {
    if (!this.selectedGuestId) return false;
    if (table.guestIds.length >= table.seats) return false;
    return !table.guestIds.includes(this.selectedGuestId);
  }

  clearSelection(): void {
    this.selectedGuestId = null;
  }

  async addTable(): Promise<void> {
    const name = this.tableForm.name.trim();
    if (!name) return;
    const seats = this.normalizeSeats(this.tableForm.seats);
    try {
      const tables = await this.seatingApi.createTable({ name, seats });
      this.store.replaceTables(tables);
    } catch {
      this.store.addTable({ id: gid(), name, seats, guestIds: [] });
    }
    this.tableForm = { name: '', seats: 12 };
    this.addingTable = false;
  }

  startEditing(table: Table): void {
    this.editingTableId = table.id;
    this.editTableForm = { name: table.name, seats: table.seats };
  }

  cancelEditing(): void {
    this.editingTableId = null;
    this.editTableForm = { name: '', seats: 12 };
  }

  async saveTable(table: Table): Promise<void> {
    const name = this.editTableForm.name.trim();
    if (!name) return;
    const seats = this.normalizeSeats(this.editTableForm.seats);
    const nextTable = { ...table, name, seats };
    try {
      const tables = await this.seatingApi.updateTable(nextTable);
      this.store.replaceTables(tables);
    } catch {
      this.store.replaceTables(this.store.tables().map(item => item.id === table.id ? nextTable : item));
    }
    this.cancelEditing();
  }

  async deleteTable(id: string): Promise<void> {
    try {
      const tables = await this.seatingApi.deleteTable(id);
      this.store.replaceTables(tables);
    } catch {
      this.store.deleteTable(id);
    }
    if (this.editingTableId === id) {
      this.cancelEditing();
    }
  }

  async placeSelected(table: Table): Promise<void> {
    if (!this.canPlace(table)) return;
    const guestId = this.selectedGuestId;
    if (!guestId) return;
    this.selectedGuestId = null;
    try {
      const tables = await this.seatingApi.assignGuest(guestId, table.id);
      this.store.replaceTables(tables);
    } catch {
      this.store.assignGuestTable(guestId, table.id);
    }
  }

  async removeGuest(guestId: string): Promise<void> {
    try {
      const tables = await this.seatingApi.assignGuest(guestId, null);
      this.store.replaceTables(tables);
    } catch {
      this.store.assignGuestTable(guestId, null);
    }
  }

  async handleSeatClick(table: Table, guest: Guest | undefined, event: Event): Promise<void> {
    event.stopPropagation();
    if (guest) {
      await this.removeGuest(guest.id);
      return;
    }
    await this.placeSelected(table);
  }

  private normalizeSeats(value: number | string): number {
    const seats = Math.trunc(Number(value));
    if (!Number.isFinite(seats)) return 12;
    return Math.min(Math.max(seats, 2), 40);
  }
}
