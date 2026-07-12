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
import { AutofocusDirective } from '../../shared/autofocus.directive';

export const FLOOR_WIDTH = 1400;
export const FLOOR_HEIGHT = 900;
const SEAT_PITCH = 38;
const SEAT_GAP = 27;
const DEFAULT_TABLE_SEATS = 10;
const ZOOM_LEVELS = [0.5, 0.65, 0.8, 1, 1.2, 1.4];

interface SeatSpot {
  index: number;
  x: number;
  y: number;
}

interface TableLayout {
  width: number;
  height: number;
  extent: number;
  seats: SeatSpot[];
}

interface SeatRef {
  tableId: string;
  seat: number;
}

interface PairSuggestion {
  partnerId: string;
  partnerName: string;
  tableId: string;
  tableName: string;
  seat: number | null;
}

interface NeighborInfo {
  guestName: string;
  tableName: string;
  neighborNames: string[];
}

interface TableForm {
  name: string;
  seats: number | string;
}

@Component({
  selector: 'app-seating',
  standalone: true,
  imports: [FormsModule, CdkDrag, CdkDropList, CdkDropListGroup, IconComponent, GuestSidebarComponent, ConfirmDialogComponent, AutofocusDirective],
  templateUrl: './seating.component.html',
  host: { class: 'split-pane-host' },
})
export class SeatingComponent {
  readonly store = inject(WeddingStore);
  private readonly seatingApi = inject(SeatingApiService);
  private readonly toast = inject(ToastService);

  readonly floorWidth = FLOOR_WIDTH;
  readonly floorHeight = FLOOR_HEIGHT;

  addingTable = false;
  tableForm: TableForm = { name: '', seats: DEFAULT_TABLE_SEATS };
  editingTableId: string | null = null;
  editTableForm: TableForm = { name: '', seats: DEFAULT_TABLE_SEATS };
  tablePendingDeletion: Table | null = null;

  readonly zoom = signal(1);
  readonly dragging = signal(false);
  readonly draggingTableId = signal<string | null>(null);
  readonly hoveredSeat = signal<SeatRef | null>(null);
  readonly pairSuggestion = signal<PairSuggestion | null>(null);

  readonly guests = computed(() => allGuestPeople(this.store.guests()));
  readonly guestMap = computed(() => new Map(this.guests().map(guest => [guest.id, guest])));
  readonly assignedIds = computed(() =>
    new Set(this.store.tables().flatMap(table => table.assignments.map(assignment => assignment.guestId))));
  readonly unplacedGuests = computed(() =>
    this.guests().filter(guest => guest.rsvp !== 'declined' && !this.assignedIds().has(guest.id)));
  readonly totals = computed(() => {
    const tables = this.store.tables();
    return {
      totalSeats: tables.reduce((sum, table) => sum + table.seats, 0),
      placed: tables.reduce((sum, table) => sum + table.assignments.length, 0),
    };
  });

  readonly layouts = computed(() => {
    const map = new Map<string, TableLayout>();
    for (const table of this.store.tables()) {
      map.set(table.id, this.computeLayout(table));
    }
    return map;
  });

  readonly seatOccupants = computed(() => {
    const map = new Map<string, GuestPerson>();
    const guests = this.guestMap();
    for (const table of this.store.tables()) {
      for (const assignment of table.assignments) {
        const guest = guests.get(assignment.guestId);
        if (guest) map.set(`${table.id}:${assignment.seat}`, guest);
      }
    }
    return map;
  });

  readonly neighborSeatKeys = computed(() => {
    const hovered = this.hoveredSeat();
    if (!hovered) return new Set<string>();
    const table = this.store.tables().find(t => t.id === hovered.tableId);
    if (!table) return new Set<string>();
    return new Set(this.adjacentSeats(table, hovered.seat).map(seat => `${table.id}:${seat}`));
  });

  readonly neighborInfo = computed<NeighborInfo | null>(() => {
    const hovered = this.hoveredSeat();
    if (!hovered) return null;
    const table = this.store.tables().find(t => t.id === hovered.tableId);
    const guest = this.seatOccupants().get(`${hovered.tableId}:${hovered.seat}`);
    if (!table || !guest) return null;
    const neighborNames = this.adjacentSeats(table, hovered.seat)
      .map(seat => this.seatOccupants().get(`${table.id}:${seat}`))
      .filter((person): person is GuestPerson => !!person)
      .map(person => `${person.firstName} ${person.lastName}`.trim());
    return {
      guestName: `${guest.firstName} ${guest.lastName}`.trim(),
      tableName: table.name,
      neighborNames,
    };
  });

  // ── Geometry ──────────────────────────────────────────────────────

  private computeLayout(table: Table): TableLayout {
    const topCount = Math.ceil(table.seats / 2);
    const bottomCount = table.seats - topCount;
    const width = Math.max(topCount, bottomCount) * SEAT_PITCH + 26;
    const height = 66;
    const seats: SeatSpot[] = [];
    for (let i = 0; i < topCount; i += 1) {
      seats.push({
        index: i,
        x: Math.round((i - (topCount - 1) / 2) * SEAT_PITCH),
        y: -(height / 2 + SEAT_GAP - 5),
      });
    }
    for (let j = 0; j < bottomCount; j += 1) {
      seats.push({
        index: topCount + j,
        x: Math.round((j - (bottomCount - 1) / 2) * SEAT_PITCH),
        y: height / 2 + SEAT_GAP - 5,
      });
    }
    return { width, height, extent: Math.max(width, height) / 2 + SEAT_GAP + 15, seats };
  }

  /** Seats immediately to the left/right of a seat on the same side of the rectangular table. */
  private adjacentSeats(table: Table, seat: number): number[] {
    const count = table.seats;
    if (count <= 1) return [];
    const topCount = Math.ceil(count / 2);
    const neighbors: number[] = [];
    if (seat < topCount) {
      if (seat > 0) neighbors.push(seat - 1);
      if (seat < topCount - 1) neighbors.push(seat + 1);
    } else {
      const j = seat - topCount;
      const bottomCount = count - topCount;
      if (j > 0) neighbors.push(topCount + j - 1);
      if (j < bottomCount - 1) neighbors.push(topCount + j + 1);
    }
    return neighbors;
  }

  layoutOf(table: Table): TableLayout {
    return this.layouts().get(table.id) ?? this.computeLayout(table);
  }

  occupant(table: Table, seat: number): GuestPerson | undefined {
    return this.seatOccupants().get(`${table.id}:${seat}`);
  }

  isNeighborSeat(table: Table, seat: number): boolean {
    return this.neighborSeatKeys().has(`${table.id}:${seat}`);
  }

  isHoveredSeat(table: Table, seat: number): boolean {
    const hovered = this.hoveredSeat();
    return !!hovered && hovered.tableId === table.id && hovered.seat === seat;
  }

  initials(guest: GuestPerson | undefined): string {
    return guest ? `${guest.firstName[0] ?? ''}${guest.lastName[0] ?? ''}` : '';
  }

  guestTitle(guest: GuestPerson): string {
    const suffix = guest.isKid ? ' (enfant)' : guest.isPlusOne ? ' (+1)' : '';
    return `${guest.firstName} ${guest.lastName}`.trim() + suffix;
  }

  isTableFull(table: Table): boolean {
    return table.assignments.length >= table.seats;
  }

  // ── Zoom ──────────────────────────────────────────────────────────

  zoomIn(): void {
    const idx = ZOOM_LEVELS.indexOf(this.zoom());
    this.zoom.set(ZOOM_LEVELS[Math.min(idx + 1, ZOOM_LEVELS.length - 1)] ?? 1);
  }

  zoomOut(): void {
    const idx = ZOOM_LEVELS.indexOf(this.zoom());
    this.zoom.set(ZOOM_LEVELS[Math.max(idx - 1, 0)] ?? 1);
  }

  resetZoom(): void {
    this.zoom.set(1);
  }

  // ── Table dragging (free positioning) ─────────────────────────────

  onTablePointerDown(event: PointerEvent, table: Table): void {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.floor-seat, .floor-table-actions, button, input, select')) return;
    event.preventDefault();
    const layout = this.layoutOf(table);
    const margin = layout.extent;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = table.x;
    const originY = table.y;
    const snapshot = this.store.tables();
    let moved = false;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / this.zoom();
      const dy = (moveEvent.clientY - startY) / this.zoom();
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      this.draggingTableId.set(table.id);
      this.store.updateTableGeometry(table.id, {
        x: Math.round(Math.min(Math.max(originX + dx, margin), FLOOR_WIDTH - margin)),
        y: Math.round(Math.min(Math.max(originY + dy, margin), FLOOR_HEIGHT - margin)),
      });
    };

    const onUp = async () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      this.draggingTableId.set(null);
      if (!moved) return;
      const current = this.store.tables().find(t => t.id === table.id);
      if (!current) return;
      try {
        const tables = await this.seatingApi.updateTable(table.id, { x: current.x, y: current.y });
        this.store.replaceTables(tables);
      } catch {
        this.store.tables.set(snapshot);
        this.toast.error("Impossible d'enregistrer la position de la table.");
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  async rotateTable(table: Table): Promise<void> {
    const rotation = (table.rotation + 45) % 360;
    const snapshot = this.store.tables();
    this.store.updateTableGeometry(table.id, { rotation });
    try {
      const tables = await this.seatingApi.updateTable(table.id, { rotation });
      this.store.replaceTables(tables);
    } catch {
      this.store.tables.set(snapshot);
      this.toast.error("Impossible d'enregistrer la rotation.");
    }
  }

  // ── Guest placement ───────────────────────────────────────────────

  tableEnterPredicate = (table: Table) => (drag: CdkDrag<string>): boolean => {
    const alreadyAtTable = table.assignments.some(assignment => assignment.guestId === drag.data);
    const alreadySeated = this.store.tables().some(candidate =>
      candidate.assignments.some(assignment => assignment.guestId === drag.data));
    return alreadyAtTable || alreadySeated || !this.isTableFull(table);
  };

  onDragStarted(): void {
    this.dragging.set(true);
    this.hoveredSeat.set(null);
    this.pairSuggestion.set(null);
  }

  onDragEnded(): void {
    this.dragging.set(false);
  }

  async onTableDrop(event: CdkDragDrop<Table>): Promise<void> {
    const guestId = event.item.data as string;
    const table = event.container.data;
    const targetSeat = this.seatAtDropPoint(table.id, event.dropPoint);
    const currentSeat = table.assignments.find(assignment => assignment.guestId === guestId)?.seat;
    if (event.previousContainer === event.container && (targetSeat === null || targetSeat === currentSeat)) return;
    await this.placeGuest(guestId, table.id, targetSeat);
  }

  private seatAtDropPoint(tableId: string, dropPoint: { x: number; y: number }): number | null {
    let nearestSeat: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    const seats = document.querySelectorAll<HTMLElement>('.floor-seat[data-table-id]');
    for (const element of seats) {
      if (element.dataset['tableId'] !== tableId) continue;
      const seat = Number(element.dataset['seat']);
      if (!Number.isInteger(seat)) continue;
      const rect = element.getBoundingClientRect();
      const distance = Math.hypot(dropPoint.x - (rect.left + rect.width / 2), dropPoint.y - (rect.top + rect.height / 2));
      const hitRadius = Math.max(rect.width, rect.height) * 0.75;
      if (distance <= hitRadius && distance < nearestDistance) {
        nearestSeat = seat;
        nearestDistance = distance;
      }
    }
    return nearestSeat;
  }

  async removeGuest(guestId: string): Promise<void> {
    await this.placeGuest(guestId, null, null);
  }

  private async placeGuest(guestId: string, tableId: string | null, seat: number | null): Promise<void> {
    this.hoveredSeat.set(null);
    const snapshot = this.store.tables();
    this.store.assignGuestTable(guestId, tableId, seat);
    try {
      const tables = await this.seatingApi.assignGuest(guestId, tableId, seat);
      this.store.replaceTables(tables);
      if (tableId) this.suggestPartner(guestId, tableId);
    } catch {
      this.store.tables.set(snapshot);
      this.toast.error("Impossible d'enregistrer le placement. Vérifiez la connexion et réessayez.");
    }
  }

  async acceptPairSuggestion(): Promise<void> {
    const suggestion = this.pairSuggestion();
    if (!suggestion) return;
    this.pairSuggestion.set(null);
    const table = this.store.tables().find(t => t.id === suggestion.tableId);
    if (!table || this.isTableFull(table)) return;
    await this.placeGuest(suggestion.partnerId, table.id, suggestion.seat);
  }

  dismissPairSuggestion(): void {
    this.pairSuggestion.set(null);
  }

  /** Offer to seat the partner (+1 or inviting guest) next to the freshly placed person. */
  private suggestPartner(personId: string, tableId: string): void {
    const person = this.guestMap().get(personId);
    if (!person || person.isKid) return;
    const partnerId = person.isPlusOne ? person.parentGuestId : plusOneGuestId(person.id);
    const partner = this.guestMap().get(partnerId);
    if (!partner || partner.rsvp === 'declined') return;
    if (this.assignedIds().has(partnerId)) return;
    const table = this.store.tables().find(t => t.id === tableId);
    if (!table || this.isTableFull(table)) return;
    const personSeat = table.assignments.find(assignment => assignment.guestId === personId)?.seat;
    const taken = new Set(table.assignments.map(assignment => assignment.seat));
    const freeNeighbor = personSeat === undefined
      ? undefined
      : this.adjacentSeats(table, personSeat).find(seat => !taken.has(seat));
    this.pairSuggestion.set({
      partnerId,
      partnerName: `${partner.firstName} ${partner.lastName}`.trim(),
      tableId,
      tableName: table.name,
      seat: freeNeighbor ?? null,
    });
  }

  // ── Table CRUD ────────────────────────────────────────────────────

  async addTable(): Promise<void> {
    const name = this.tableForm.name.trim();
    if (!name) return;
    const seats = this.normalizeSeats(this.tableForm.seats);
    const position = this.findFreeSpot();
    try {
      const tables = await this.seatingApi.createTable({
        name,
        seats,
        shape: 'rect',
        x: position.x,
        y: position.y,
      });
      this.store.replaceTables(tables);
      this.tableForm = { name: '', seats: DEFAULT_TABLE_SEATS };
      this.addingTable = false;
    } catch {
      this.toast.error('Impossible de créer la table.');
    }
  }

  private findFreeSpot(): { x: number; y: number } {
    const tables = this.store.tables();
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const x = 190 + col * 330;
        const y = 170 + row * 270;
        const free = tables.every(table => Math.hypot(table.x - x, table.y - y) > 250);
        if (free) return { x, y };
      }
    }
    return { x: FLOOR_WIDTH / 2, y: FLOOR_HEIGHT / 2 };
  }

  startEditing(table: Table): void {
    this.editingTableId = table.id;
    this.editTableForm = { name: table.name, seats: table.seats };
    this.addingTable = false;
  }

  cancelEditing(): void {
    this.editingTableId = null;
    this.editTableForm = { name: '', seats: DEFAULT_TABLE_SEATS };
  }

  async saveTable(): Promise<void> {
    const id = this.editingTableId;
    if (!id) return;
    const name = this.editTableForm.name.trim();
    if (!name) return;
    const seats = this.normalizeSeats(this.editTableForm.seats);
    try {
      const tables = await this.seatingApi.updateTable(id, {
        name,
        seats,
        shape: 'rect',
      });
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
    try {
      const tables = await this.seatingApi.deleteTable(table.id);
      this.store.replaceTables(tables);
      if (this.editingTableId === table.id) {
        this.cancelEditing();
      }
    } catch {
      this.toast.error('Impossible de supprimer la table.');
    }
  }

  private normalizeSeats(value: number | string): number {
    const seats = Math.trunc(Number(value));
    if (!Number.isFinite(seats)) return DEFAULT_TABLE_SEATS;
    return Math.min(Math.max(seats, 2), 40);
  }
}
