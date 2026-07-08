import { Component, computed, inject, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { Table } from '../../data/types';
import { SeatingApiService } from '../../data/seating-api.service';
import { WeddingStore } from '../../data/store';
import { IconComponent } from '../../shared/icon.component';
import { GuestSidebarComponent } from '../../shared/guest-sidebar.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ToastService } from '../../shared/toast.service';
import { GuestPerson, allGuestPeople, plusOneGuestId } from '../../shared/wedding-utils';

interface PairSuggestion {
  partnerId: string;
  partnerName: string;
  tableId: string;
}

@Component({
  selector: 'app-seating',
  standalone: true,
  imports: [FormsModule, CdkDrag, CdkDropList, CdkDropListGroup, IconComponent, GuestSidebarComponent, ConfirmDialogComponent],
  templateUrl: './seating.component.html',
  host: { class: 'split-pane-host' },
})
export class SeatingComponent {
  readonly store = inject(WeddingStore);
  private readonly seatingApi = inject(SeatingApiService);
  private readonly toast = inject(ToastService);
  addingTable = false;
  tableForm: { name: string; seats: number | string } = { name: '', seats: 12 };
  editingTableId: string | null = null;
  editTableForm: { name: string; seats: number | string } = { name: '', seats: 12 };
  tablePendingDeletion: Table | null = null;
  readonly dragging = signal(false);
  readonly pairSuggestion = signal<PairSuggestion | null>(null);

  readonly guests = computed(() => allGuestPeople(this.store.guests()));
  readonly guestMap = computed(() => new Map(this.guests().map(guest => [guest.id, guest])));
  readonly assignedIds = computed(() => new Set(this.store.tables().flatMap(table => table.guestIds)));
  readonly unplacedGuests = computed(() => this.guests().filter(guest => guest.rsvp !== 'declined' && !this.assignedIds().has(guest.id)));
  readonly totals = computed(() => {
    const tables = this.store.tables();
    return {
      totalSeats: tables.reduce((sum, table) => sum + table.seats, 0),
      placed: tables.reduce((sum, table) => sum + table.guestIds.length, 0),
    };
  });

  guestById(id: string): GuestPerson | undefined {
    return this.guestMap().get(id);
  }

  initials(guest: GuestPerson | undefined): string {
    return guest ? `${guest.firstName[0] ?? ''}${guest.lastName[0] ?? ''}` : '';
  }

  isTableFull(table: Table): boolean {
    return table.guestIds.length >= table.seats;
  }

  tableEnterPredicate = (table: Table) => (drag: CdkDrag<string>): boolean => {
    if (table.guestIds.includes(drag.data)) return false;
    return !this.isTableFull(table);
  };

  onDragStarted(): void {
    this.dragging.set(true);
    this.pairSuggestion.set(null);
  }

  onDragEnded(): void {
    this.dragging.set(false);
  }

  async onDrop(event: CdkDragDrop<Table>): Promise<void> {
    if (event.previousContainer === event.container) return;
    const guestId = event.item.data as string;
    const target = event.container.data as Table | 'sidebar';
    await this.moveGuest(guestId, target === 'sidebar' ? null : target);
  }

  async removeGuest(guestId: string): Promise<void> {
    await this.moveGuest(guestId, null);
  }

  async acceptPairSuggestion(): Promise<void> {
    const suggestion = this.pairSuggestion();
    if (!suggestion) return;
    this.pairSuggestion.set(null);
    const table = this.store.tables().find(t => t.id === suggestion.tableId);
    if (!table || this.isTableFull(table)) return;
    await this.moveGuest(suggestion.partnerId, table);
  }

  dismissPairSuggestion(): void {
    this.pairSuggestion.set(null);
  }

  private async moveGuest(guestId: string, table: Table | null): Promise<void> {
    const snapshot = this.store.tables();
    this.store.assignGuestTable(guestId, table?.id ?? null);
    try {
      const tables = await this.seatingApi.assignGuest(guestId, table?.id ?? null);
      this.store.replaceTables(tables);
      if (table) this.suggestPartner(guestId, table.id);
    } catch {
      this.store.tables.set(snapshot);
      this.toast.error("Impossible d'enregistrer le placement. Vérifiez la connexion et réessayez.");
    }
  }

  private suggestPartner(personId: string, tableId: string): void {
    const person = this.guestMap().get(personId);
    if (!person) return;
    const partnerId = person.isPlusOne ? person.parentGuestId : plusOneGuestId(person.id);
    const partner = this.guestMap().get(partnerId);
    if (!partner || partner.rsvp === 'declined') return;
    if (this.assignedIds().has(partnerId)) return;
    const table = this.store.tables().find(t => t.id === tableId);
    if (!table || this.isTableFull(table)) return;
    this.pairSuggestion.set({
      partnerId,
      partnerName: `${partner.firstName} ${partner.lastName}`.trim(),
      tableId,
    });
  }

  async addTable(): Promise<void> {
    const name = this.tableForm.name.trim();
    if (!name) return;
    const seats = this.normalizeSeats(this.tableForm.seats);
    try {
      const tables = await this.seatingApi.createTable({ name, seats });
      this.store.replaceTables(tables);
      this.tableForm = { name: '', seats: 12 };
      this.addingTable = false;
    } catch {
      this.toast.error('Impossible de créer la table.');
    }
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
    try {
      const tables = await this.seatingApi.updateTable({ ...table, name, seats });
      this.store.replaceTables(tables);
      this.cancelEditing();
    } catch {
      this.toast.error('Impossible de modifier la table.');
    }
  }

  requestDeleteTable(table: Table): void {
    this.tablePendingDeletion = table;
  }

  cancelDeleteTable(): void {
    this.tablePendingDeletion = null;
  }

  async confirmDeleteTable(): Promise<void> {
    const table = this.tablePendingDeletion;
    if (!table) return;
    this.tablePendingDeletion = null;
    await this.deleteTable(table.id);
  }

  private async deleteTable(id: string): Promise<void> {
    try {
      const tables = await this.seatingApi.deleteTable(id);
      this.store.replaceTables(tables);
      if (this.editingTableId === id) {
        this.cancelEditing();
      }
    } catch {
      this.toast.error('Impossible de supprimer la table.');
    }
  }

  private normalizeSeats(value: number | string): number {
    const seats = Math.trunc(Number(value));
    if (!Number.isFinite(seats)) return 12;
    return Math.min(Math.max(seats, 2), 40);
  }
}
