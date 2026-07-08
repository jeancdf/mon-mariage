import { Component, computed, inject, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { BedType, House, Room } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { IconComponent } from '../../shared/icon.component';
import { GuestSidebarComponent } from '../../shared/guest-sidebar.component';
import { HousingApiService } from '../../data/housing-api.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ToastService } from '../../shared/toast.service';
import { GuestPerson, allGuestPeople, plusOneGuestId } from '../../shared/wedding-utils';

interface RoomFormState {
  name: string;
  bedType: BedType;
  beds: number | string;
}

interface PairSuggestion {
  partnerId: string;
  partnerName: string;
  roomId: string;
}

@Component({
  selector: 'app-housing',
  standalone: true,
  imports: [FormsModule, CdkDrag, CdkDropList, CdkDropListGroup, IconComponent, GuestSidebarComponent, ConfirmDialogComponent],
  templateUrl: './housing.component.html',
  host: { class: 'split-pane-host' },
})
export class HousingComponent {
  readonly store = inject(WeddingStore);
  private readonly housingApi = inject(HousingApiService);
  private readonly toast = inject(ToastService);
  expanded: Record<string, boolean> = { h1: true, h2: true, h3: true };
  addingHouse = false;
  houseName = '';
  addingRoomFor: string | null = null;
  roomForm: RoomFormState = { name: '', bedType: 'double', beds: 1 };
  editingRoomId: string | null = null;
  editRoomForm: RoomFormState = { name: '', bedType: 'double', beds: 1 };
  housePendingDeletion: House | null = null;
  roomPendingDeletion: Room | null = null;
  readonly dragging = signal(false);
  readonly pairSuggestion = signal<PairSuggestion | null>(null);

  readonly guests = computed(() => allGuestPeople(this.store.guests()));
  readonly guestMap = computed(() => new Map(this.guests().map(guest => [guest.id, guest])));
  readonly assignedGuestIds = computed(() => new Set(this.store.houses().flatMap(house => house.rooms.flatMap(room => room.guestIds))));
  readonly unassignedGuests = computed(() =>
    this.guests().filter(guest => guest.rsvp !== 'declined' && !this.assignedGuestIds().has(guest.id)));
  readonly totals = computed(() => {
    const houses = this.store.houses();
    const totalBeds = houses.reduce((sum, house) => sum + house.rooms.reduce((roomSum, room) => roomSum + this.roomCapacity(room), 0), 0);
    const occupied = houses.reduce((sum, house) => sum + house.rooms.reduce((roomSum, room) => roomSum + room.guestIds.length, 0), 0);
    return { totalBeds, occupied };
  });

  roomCapacity(room: Room): number {
    return room.beds * (room.bedType === 'double' ? 2 : 1);
  }

  bedLabel(room: Room): string {
    const label = room.bedType === 'double' ? 'double' : 'simple';
    return `${room.beds} lit${room.beds > 1 ? 's' : ''} ${label}${room.beds > 1 && room.bedType === 'double' ? 's' : ''}`;
  }

  houseCapacity(house: House): number {
    return house.rooms.reduce((sum, room) => sum + this.roomCapacity(room), 0);
  }

  houseOccupied(house: House): number {
    return house.rooms.reduce((sum, room) => sum + room.guestIds.length, 0);
  }

  guestById(id: string): GuestPerson | undefined {
    return this.guestMap().get(id);
  }

  isRoomFull(room: Room): boolean {
    return room.guestIds.length >= this.roomCapacity(room);
  }

  isHouseFull(house: House): boolean {
    const capacity = this.houseCapacity(house);
    return capacity > 0 && this.houseOccupied(house) >= capacity;
  }

  roomEnterPredicate = (room: Room) => (drag: CdkDrag<string>): boolean => {
    if (room.guestIds.includes(drag.data)) return false;
    return !this.isRoomFull(room);
  };

  onDragStarted(): void {
    this.dragging.set(true);
    this.pairSuggestion.set(null);
  }

  onDragEnded(): void {
    this.dragging.set(false);
  }

  async onDrop(event: CdkDragDrop<Room>): Promise<void> {
    if (event.previousContainer === event.container) return;
    const guestId = event.item.data as string;
    const target = event.container.data as Room | 'sidebar';
    await this.moveGuest(guestId, target === 'sidebar' ? null : target);
  }

  async unassignGuest(guestId: string): Promise<void> {
    await this.moveGuest(guestId, null);
  }

  async acceptPairSuggestion(): Promise<void> {
    const suggestion = this.pairSuggestion();
    if (!suggestion) return;
    this.pairSuggestion.set(null);
    const room = this.roomById(suggestion.roomId);
    if (!room || this.isRoomFull(room)) return;
    await this.moveGuest(suggestion.partnerId, room);
  }

  dismissPairSuggestion(): void {
    this.pairSuggestion.set(null);
  }

  private async moveGuest(guestId: string, room: Room | null): Promise<void> {
    const snapshot = this.store.houses();
    this.store.assignGuestRoom(guestId, room ? this.houseIdOf(room.id) : null, room?.id ?? null);
    try {
      const houses = await this.housingApi.assignGuest(guestId, room?.id ?? null);
      this.store.replaceHouses(houses);
      if (room) this.suggestPartner(guestId, room.id);
    } catch {
      this.store.houses.set(snapshot);
      this.toast.error("Impossible d'enregistrer l'affectation. Vérifiez la connexion et réessayez.");
    }
  }

  private suggestPartner(personId: string, roomId: string): void {
    const person = this.guestMap().get(personId);
    if (!person) return;
    if (person.isKid) return;
    const partnerId = person.isPlusOne ? person.parentGuestId : plusOneGuestId(person.id);
    const partner = this.guestMap().get(partnerId);
    if (!partner || partner.rsvp === 'declined') return;
    if (this.assignedGuestIds().has(partnerId)) return;
    const room = this.roomById(roomId);
    if (!room || this.isRoomFull(room)) return;
    this.pairSuggestion.set({
      partnerId,
      partnerName: `${partner.firstName} ${partner.lastName}`.trim(),
      roomId,
    });
  }

  private roomById(roomId: string): Room | undefined {
    for (const house of this.store.houses()) {
      const room = house.rooms.find(r => r.id === roomId);
      if (room) return room;
    }
    return undefined;
  }

  private houseIdOf(roomId: string): string | null {
    return this.store.houses().find(house => house.rooms.some(room => room.id === roomId))?.id ?? null;
  }

  toggleHouse(houseId: string): void {
    this.expanded = { ...this.expanded, [houseId]: this.expanded[houseId] === false };
  }

  async addHouse(): Promise<void> {
    const name = this.houseName.trim();
    if (!name) return;
    try {
      const houses = await this.housingApi.createHouse(name);
      this.store.replaceHouses(houses);
      this.houseName = '';
      this.addingHouse = false;
    } catch {
      this.toast.error("Impossible d'ajouter le logement.");
    }
  }

  requestDeleteHouse(house: House): void {
    this.housePendingDeletion = house;
  }

  cancelDeleteHouse(): void {
    this.housePendingDeletion = null;
  }

  async confirmDeleteHouse(): Promise<void> {
    const house = this.housePendingDeletion;
    if (!house) return;
    this.housePendingDeletion = null;
    await this.deleteHouse(house.id);
  }

  private async deleteHouse(id: string): Promise<void> {
    try {
      const houses = await this.housingApi.deleteHouse(id);
      this.store.replaceHouses(houses);
    } catch {
      this.toast.error('Impossible de supprimer le logement.');
    }
  }

  async addRoom(houseId: string): Promise<void> {
    const name = this.roomForm.name.trim();
    if (!name) return;
    try {
      const houses = await this.housingApi.createRoom(houseId, {
        name,
        bedType: this.roomForm.bedType,
        beds: this.normalizeBeds(this.roomForm.beds),
      });
      this.store.replaceHouses(houses);
      this.roomForm = { name: '', bedType: 'double', beds: 1 };
      this.addingRoomFor = null;
    } catch {
      this.toast.error("Impossible d'ajouter la chambre.");
    }
  }

  startEditingRoom(room: Room): void {
    this.editingRoomId = room.id;
    this.editRoomForm = { name: room.name, bedType: room.bedType, beds: room.beds };
  }

  cancelEditingRoom(): void {
    this.editingRoomId = null;
    this.editRoomForm = { name: '', bedType: 'double', beds: 1 };
  }

  async saveRoom(room: Room): Promise<void> {
    const name = this.editRoomForm.name.trim();
    if (!name) return;
    const beds = this.normalizeBeds(this.editRoomForm.beds);
    const bedType = this.editRoomForm.bedType;
    const capacity = beds * (bedType === 'double' ? 2 : 1);
    const guestIds = room.guestIds.slice(0, capacity);
    const nextRoom: Room = { ...room, name, bedType, beds, guestIds };
    try {
      const houses = await this.housingApi.updateRoom(nextRoom);
      this.store.replaceHouses(houses);
      this.cancelEditingRoom();
    } catch {
      this.toast.error('Impossible de modifier la chambre.');
    }
  }

  requestDeleteRoom(room: Room): void {
    this.roomPendingDeletion = room;
  }

  cancelDeleteRoom(): void {
    this.roomPendingDeletion = null;
  }

  async confirmDeleteRoom(): Promise<void> {
    const room = this.roomPendingDeletion;
    if (!room) return;
    this.roomPendingDeletion = null;
    await this.deleteRoom(room.id);
  }

  private async deleteRoom(roomId: string): Promise<void> {
    try {
      const houses = await this.housingApi.deleteRoom(roomId);
      this.store.replaceHouses(houses);
      if (this.editingRoomId === roomId) {
        this.cancelEditingRoom();
      }
    } catch {
      this.toast.error('Impossible de supprimer la chambre.');
    }
  }

  private normalizeBeds(value: number | string): number {
    const beds = Math.trunc(Number(value));
    if (!Number.isFinite(beds) || beds < 1) return 1;
    return Math.min(beds, 8);
  }
}
