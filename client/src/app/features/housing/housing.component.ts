import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BedType, House, Room } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { IconComponent } from '../../shared/icon.component';
import { GuestSidebarComponent } from '../../shared/guest-sidebar.component';
import { HousingApiService } from '../../data/housing-api.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { GuestPerson, allGuestPeople } from '../../shared/wedding-utils';

interface RoomFormState {
  name: string;
  bedType: BedType;
  beds: number | string;
}

@Component({
  selector: 'app-housing',
  standalone: true,
  imports: [FormsModule, IconComponent, GuestSidebarComponent, ConfirmDialogComponent],
  templateUrl: './housing.component.html',
  host: { class: 'split-pane-host' },
})
export class HousingComponent {
  readonly store = inject(WeddingStore);
  private readonly housingApi = inject(HousingApiService);
  expanded: Record<string, boolean> = { h1: true, h2: true, h3: true };
  addingHouse = false;
  houseName = '';
  addingRoomFor: string | null = null;
  roomForm: RoomFormState = { name: '', bedType: 'double', beds: 1 };
  editingRoomId: string | null = null;
  editRoomForm: RoomFormState = { name: '', bedType: 'double', beds: 1 };
  selectedGuestId: string | null = null;
  housePendingDeletion: House | null = null;

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

  selectedGuest(): GuestPerson | undefined {
    return this.selectedGuestId ? this.guestById(this.selectedGuestId) : undefined;
  }

  isRoomFull(room: Room): boolean {
    return room.guestIds.length >= this.roomCapacity(room);
  }

  isHouseFull(house: House): boolean {
    const capacity = this.houseCapacity(house);
    return capacity > 0 && this.houseOccupied(house) >= capacity;
  }

  canAssignRoom(room: Room): boolean {
    if (!this.selectedGuestId) return false;
    if (room.guestIds.includes(this.selectedGuestId)) return false;
    return !this.isRoomFull(room);
  }

  toggleHouse(houseId: string): void {
    this.expanded = { ...this.expanded, [houseId]: this.expanded[houseId] === false };
  }

  async addHouse(): Promise<void> {
    const name = this.houseName.trim();
    if (!name) return;
    const houses = await this.housingApi.createHouse(name);
    this.store.replaceHouses(houses);
    this.houseName = '';
    this.addingHouse = false;
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
    const houses = await this.housingApi.deleteHouse(id);
    this.store.replaceHouses(houses);
  }

  async addRoom(houseId: string): Promise<void> {
    const name = this.roomForm.name.trim();
    if (!name) return;
    const houses = await this.housingApi.createRoom(houseId, {
      name,
      bedType: this.roomForm.bedType,
      beds: this.normalizeBeds(this.roomForm.beds),
    });
    this.store.replaceHouses(houses);
    this.roomForm = { name: '', bedType: 'double', beds: 1 };
    this.addingRoomFor = null;
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
    const houses = await this.housingApi.updateRoom(nextRoom);
    this.store.replaceHouses(houses);
    this.cancelEditingRoom();
  }

  async deleteRoom(roomId: string): Promise<void> {
    const houses = await this.housingApi.deleteRoom(roomId);
    this.store.replaceHouses(houses);
    if (this.editingRoomId === roomId) {
      this.cancelEditingRoom();
    }
  }

  async assignSelectedToRoom(room: Room): Promise<void> {
    if (!this.canAssignRoom(room)) return;
    const guestId = this.selectedGuestId;
    if (!guestId) return;
    this.selectedGuestId = null;
    await this.assignGuestRoom(guestId, room.id);
  }

  async assignGuestRoom(guestId: string, roomId: string | null): Promise<void> {
    const houses = await this.housingApi.assignGuest(guestId, roomId);
    this.store.replaceHouses(houses);
  }

  clearSelection(): void {
    this.selectedGuestId = null;
  }

  private normalizeBeds(value: number | string): number {
    const beds = Math.trunc(Number(value));
    if (!Number.isFinite(beds) || beds < 1) return 1;
    return Math.min(beds, 8);
  }
}
