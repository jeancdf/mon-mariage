import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BedType, Guest, House, Room } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { gid } from '../../data/seed';
import { BadgeComponent } from '../../shared/badge.component';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-housing',
  standalone: true,
  imports: [FormsModule, BadgeComponent, IconComponent],
  templateUrl: './housing.component.html',
})
export class HousingComponent {
  readonly store = inject(WeddingStore);
  expanded: Record<string, boolean> = { h1: true, h2: true, h3: true };
  addingHouse = false;
  houseName = '';
  addingRoomFor: string | null = null;
  roomForm: { name: string; bedType: BedType; beds: number | string } = { name: '', bedType: 'double', beds: 1 };

  readonly guestMap = computed(() => new Map(this.store.guests().map(guest => [guest.id, guest])));
  readonly assignedGuestIds = computed(() => new Set(this.store.houses().flatMap(house => house.rooms.flatMap(room => room.guestIds))));
  readonly unassignedGuests = computed(() =>
    this.store.guests().filter(guest => guest.rsvp !== 'declined' && !this.assignedGuestIds().has(guest.id)));
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

  guestById(id: string): Guest | undefined {
    return this.guestMap().get(id);
  }

  toggleHouse(houseId: string): void {
    this.expanded = { ...this.expanded, [houseId]: this.expanded[houseId] === false };
  }

  addHouse(): void {
    const name = this.houseName.trim();
    if (!name) return;
    this.store.addHouse({ id: gid(), name, rooms: [] });
    this.houseName = '';
    this.addingHouse = false;
  }

  addRoom(houseId: string): void {
    const name = this.roomForm.name.trim();
    if (!name) return;
    this.store.addRoom(houseId, {
      id: gid(),
      name,
      bedType: this.roomForm.bedType,
      beds: Number(this.roomForm.beds) || 1,
      guestIds: [],
    });
    this.roomForm = { name: '', bedType: 'double', beds: 1 };
    this.addingRoomFor = null;
  }
}
