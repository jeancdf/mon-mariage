import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Guest } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { gid } from '../../data/seed';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-seating',
  standalone: true,
  imports: [FormsModule, IconComponent],
  templateUrl: './seating.component.html',
})
export class SeatingComponent {
  readonly store = inject(WeddingStore);
  addingTable = false;
  tableForm: { name: string; seats: number | string } = { name: '', seats: 12 };
  selectedGuestId: string | null = null;

  readonly guestMap = computed(() => new Map(this.store.guests().map(guest => [guest.id, guest])));
  readonly assignedIds = computed(() => new Set(this.store.tables().flatMap(table => table.guestIds)));
  readonly unplacedGuests = computed(() => this.store.guests().filter(guest => guest.rsvp === 'confirmed' && !this.assignedIds().has(guest.id)));
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

  addTable(): void {
    const name = this.tableForm.name.trim();
    if (!name) return;
    this.store.addTable({ id: gid(), name, seats: Number(this.tableForm.seats) || 12, guestIds: [] });
    this.tableForm = { name: '', seats: 12 };
    this.addingTable = false;
  }

  placeGuest(tableId: string, isFull: boolean): void {
    if (!this.selectedGuestId || isFull) return;
    this.store.assignGuestTable(this.selectedGuestId, tableId);
    this.selectedGuestId = null;
  }
}
