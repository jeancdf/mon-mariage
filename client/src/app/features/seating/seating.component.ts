import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Guest } from '../../data/types';
import { SeatingApiService } from '../../data/seating-api.service';
import { WeddingStore } from '../../data/store';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-seating',
  standalone: true,
  imports: [FormsModule, IconComponent],
  templateUrl: './seating.component.html',
})
export class SeatingComponent {
  readonly store = inject(WeddingStore);
  private readonly seatingApi = inject(SeatingApiService);
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

  async addTable(): Promise<void> {
    const name = this.tableForm.name.trim();
    if (!name) return;
    const tables = await this.seatingApi.createTable({ name, seats: Number(this.tableForm.seats) || 12 });
    this.store.replaceTables(tables);
    this.tableForm = { name: '', seats: 12 };
    this.addingTable = false;
  }

  async deleteTable(id: string): Promise<void> {
    const tables = await this.seatingApi.deleteTable(id);
    this.store.replaceTables(tables);
  }

  async placeGuest(tableId: string, isFull: boolean): Promise<void> {
    if (!this.selectedGuestId || isFull) return;
    const tables = await this.seatingApi.assignGuest(this.selectedGuestId, tableId);
    this.store.replaceTables(tables);
    this.selectedGuestId = null;
  }

  async removeGuest(guestId: string): Promise<void> {
    const tables = await this.seatingApi.assignGuest(guestId, null);
    this.store.replaceTables(tables);
  }
}
