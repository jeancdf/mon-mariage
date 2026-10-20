import { Component, computed, inject, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { BedType, House, Room } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { IconComponent } from '../../shared/icon.component';
import { GuestSidebarComponent } from '../../shared/guest-sidebar.component';
import { HousingApiService, HousingCalendar, HousingPerson } from '../../data/housing-api.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ToastService } from '../../shared/toast.service';
import { GuestPerson, plusOneGuestId } from '../../shared/wedding-utils';
import { AutofocusDirective } from '../../shared/autofocus.directive';
import { AuthService } from '../../auth/auth.service';
import { apiError } from '../../shared/api-error';

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
  imports: [FormsModule, CdkDrag, CdkDropList, CdkDropListGroup, IconComponent, GuestSidebarComponent, ConfirmDialogComponent, AutofocusDirective],
  templateUrl: './housing.component.html',
  host: { class: 'split-pane-host' },
})
export class HousingComponent {
  readonly store = inject(WeddingStore);
  private readonly housingApi = inject(HousingApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
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
  readonly assigning = signal(false);
  readonly housingFilter = signal<'requested' | 'all' | 'pending'>('requested');
  selectedPersonId = '';
  selectedRoomId = '';
  savingRoomId: string | null = null;
  readonly calendar = signal<HousingCalendar | null>(null);
  readonly calendarLoading = signal(true);
  readonly calendarError = signal('');
  readonly selectedNight = signal('');
  assignmentFrom = '';
  assignmentUntil = '';
  stayArrival = '';
  stayDeparture = '';
  readonly houses = computed(() => {
    const calendar = this.calendar();
    if (!calendar) return [];
    const assignments = calendar.assignments.filter(item => item.night === this.selectedNight());
    return calendar.houses.map(house => ({ ...house, rooms: house.rooms.map(room => ({
      ...room, guestIds: assignments.filter(item => item.roomId === room.id).map(item => item.guestId),
    })) }));
  });

  readonly guests = computed(() => this.calendar()?.people ?? []);
  readonly guestMap = computed(() => new Map(this.guests().map(guest => [guest.id, guest])));
  readonly assignedGuestIds = computed(() => new Set(this.houses().flatMap(house => house.rooms.flatMap(room => room.guestIds))));
  readonly allUnassignedGuests = computed(() =>
    this.guests().filter(guest => guest.rsvp !== 'declined' && this.presentForNight(guest, this.selectedNight()) && !this.assignedGuestIds().has(guest.id)));
  readonly requestedGuests = computed(() => this.allUnassignedGuests().filter(guest => guest.needsHousing));
  readonly unassignedGuests = computed(() => this.allUnassignedGuests().filter(guest =>
    this.housingFilter() === 'all' || (this.housingFilter() === 'pending' ? guest.rsvp === 'pending' : guest.needsHousing)));
  readonly availablePeople = computed(() => this.guests().filter(guest => guest.rsvp !== 'declined'));
  readonly roomOptions = computed(() => this.houses().flatMap(house => house.rooms.map(room => ({
    room, label: `${house.name} · ${room.name} (${room.guestIds.length}/${this.roomCapacity(room)})`,
  }))));
  readonly totals = computed(() => {
    const houses = this.houses();
    const totalBeds = houses.reduce((sum, house) => sum + house.rooms.reduce((roomSum, room) => roomSum + this.roomCapacity(room), 0), 0);
    const occupied = houses.reduce((sum, house) => sum + house.rooms.reduce((roomSum, room) => roomSum + room.guestIds.length, 0), 0);
    return { totalBeds, occupied };
  });

  constructor() { void this.reloadCalendar(); }

  async reloadCalendar(): Promise<void> {
    this.calendarLoading.set(true);
    this.calendarError.set('');
    try {
      const calendar = await this.housingApi.loadCalendar();
      this.calendar.set(calendar);
      if (!calendar.nights.includes(this.selectedNight())) this.selectNight(calendar.weddingDate);
    } catch (error) {
      this.calendarError.set(apiError(error, 'Impossible de charger le calendrier des chambres.'));
    } finally { this.calendarLoading.set(false); }
  }

  private async refreshHousing(houses: House[]): Promise<void> {
    this.store.replaceHouses(houses);
    await this.reloadCalendar();
  }

  nextDate(date: string): string {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + 1);
    return value.toISOString().slice(0, 10);
  }

  selectNight(night: string): void {
    this.selectedNight.set(night);
    this.assignmentFrom = night;
    this.assignmentUntil = this.nextDate(night);
    this.pairSuggestion.set(null);
  }

  nightLabel(night: string): string {
    return new Date(`${night}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
  }

  occupiedForNight(night: string): number {
    return this.calendar()?.assignments.filter(item => item.night === night).length ?? 0;
  }

  presentForNight(person: HousingPerson, night: string): boolean {
    return (!person.arrivalDate || person.arrivalDate <= night) && (!person.departureDate || night < person.departureDate);
  }

  selectPerson(id: string): void {
    this.selectedPersonId = id;
    const person = this.guestMap().get(id);
    this.stayArrival = person?.arrivalDate ?? this.selectedNight();
    this.stayDeparture = person?.departureDate ?? this.nextDate(this.selectedNight());
  }

  async saveStay(): Promise<void> {
    if (!this.auth.can('housing', 'edit') || !this.selectedPersonId || this.assigning()) return;
    this.assigning.set(true);
    try {
      await this.housingApi.saveStay(this.selectedPersonId, this.stayArrival, this.stayDeparture);
      await this.reloadCalendar();
      this.toast.success('Dates de séjour enregistrées. Les chambres se réservent séparément pour chaque période.');
    } catch (error) { this.toast.error(apiError(error, 'Impossible d’enregistrer le séjour.')); }
    finally { this.assigning.set(false); }
  }

  roomForNight(guestId: string, night: string): string {
    const assignment = this.calendar()?.assignments.find(item => item.guestId === guestId && item.night === night);
    if (!assignment) {
      const person = this.guestMap().get(guestId);
      return person && !this.presentForNight(person, night) ? 'Hors séjour' : 'Sans réservation';
    }
    for (const house of this.calendar()?.houses ?? []) {
      const room = house.rooms.find(item => item.id === assignment.roomId);
      if (room) return `${house.name} · ${room.name}`;
    }
    return 'Chambre indisponible';
  }

  roomCapacity(room: Room): number {
    return room.beds * (room.bedType === 'double' ? 2 : 1);
  }

  bedLabel(room: Room): string {
    const label = room.bedType === 'double' ? 'double' : 'simple';
    return `${room.beds} lit${room.beds > 1 ? 's' : ''} ${label}${room.beds > 1 ? 's' : ''}`;
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

  async assignSelection(): Promise<void> {
    if (!this.selectedPersonId || !this.selectedRoomId) return;
    const room = this.roomById(this.selectedRoomId);
    if (!room) return;
    await this.moveGuest(this.selectedPersonId, room, this.assignmentFrom, this.assignmentUntil);
  }

  async removeSelection(): Promise<void> {
    if (this.selectedPersonId) await this.moveGuest(this.selectedPersonId, null, this.assignmentFrom, this.assignmentUntil);
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

  private async moveGuest(guestId: string, room: Room | null, from = this.selectedNight(), until = this.nextDate(from)): Promise<void> {
    if (!this.auth.can('housing', 'edit') || this.assigning()) return;
    if (room && from === this.selectedNight() && until === this.nextDate(from) && this.isRoomFull(room) && !room.guestIds.includes(guestId)) {
      this.toast.error('Cette chambre est complète. Choisissez une autre chambre.');
      return;
    }
    this.assigning.set(true);
    try {
      const houses = await this.housingApi.assignGuest(guestId, room?.id ?? null, from, until);
      await this.refreshHousing(houses);
      if (room && until === this.nextDate(from) && from === this.selectedNight()) this.suggestPartner(guestId, room.id);
      this.toast.success(`Hébergement ${room ? 'enregistré' : 'retiré'} du ${this.nightLabel(from)} au ${this.nightLabel(until)} (départ).`);
    } catch (error) {
      this.toast.error(apiError(error, "Impossible d'enregistrer l'affectation. Vérifiez la connexion et réessayez."));
    } finally {
      this.assigning.set(false);
    }
  }

  private suggestPartner(personId: string, roomId: string): void {
    const person = this.guestMap().get(personId);
    if (!person) return;
    if (person.isKid) return;
    const partnerId = person.isPlusOne ? person.parentGuestId : plusOneGuestId(person.id);
    const partner = this.guestMap().get(partnerId);
    if (!partner || partner.rsvp === 'declined' || !this.presentForNight(partner, this.selectedNight())) return;
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
    for (const house of this.houses()) {
      const room = house.rooms.find(r => r.id === roomId);
      if (room) return room;
    }
    return undefined;
  }

  toggleHouse(houseId: string): void {
    this.expanded = { ...this.expanded, [houseId]: this.expanded[houseId] === false };
  }

  async addHouse(): Promise<void> {
    if (!this.auth.can('housing', 'edit')) return;
    const name = this.houseName.trim();
    if (!name) return;
    try {
      const houses = await this.housingApi.createHouse(name);
      await this.refreshHousing(houses);
      this.houseName = '';
      this.addingHouse = false;
    } catch {
      this.toast.error("Impossible d'ajouter le logement.");
    }
  }

  requestDeleteHouse(house: House): void {
    if (!this.auth.can('housing', 'edit')) return;
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
      await this.refreshHousing(houses);
    } catch {
      this.toast.error('Impossible de supprimer le logement.');
    }
  }

  async addRoom(houseId: string): Promise<void> {
    if (!this.auth.can('housing', 'edit')) return;
    const name = this.roomForm.name.trim();
    if (!name) return;
    try {
      const houses = await this.housingApi.createRoom(houseId, {
        name,
        bedType: this.roomForm.bedType,
        beds: this.normalizeBeds(this.roomForm.beds),
      });
      await this.refreshHousing(houses);
      this.roomForm = { name: '', bedType: 'double', beds: 1 };
      this.addingRoomFor = null;
    } catch {
      this.toast.error("Impossible d'ajouter la chambre.");
    }
  }

  startEditingRoom(room: Room): void {
    if (!this.auth.can('housing', 'edit')) return;
    this.editingRoomId = room.id;
    this.editRoomForm = { name: room.name, bedType: room.bedType, beds: room.beds };
  }

  cancelEditingRoom(): void {
    this.editingRoomId = null;
    this.editRoomForm = { name: '', bedType: 'double', beds: 1 };
  }

  async saveRoom(room: Room): Promise<void> {
    if (!this.auth.can('housing', 'edit') || this.savingRoomId) return;
    const name = this.editRoomForm.name.trim();
    if (!name) return;
    const beds = this.normalizeBeds(this.editRoomForm.beds);
    const bedType = this.editRoomForm.bedType;
    const capacity = beds * (bedType === 'double' ? 2 : 1);
    if (capacity < room.guestIds.length) {
      const names = room.guestIds.map(id => this.guestById(id)?.firstName || 'un occupant').join(', ');
      this.toast.error(`Déplacez ${room.guestIds.length - capacity} personne(s) avant de réduire la capacité. Occupants : ${names}.`);
      return;
    }
    const nextRoom: Room = { ...room, name, bedType, beds };
    this.savingRoomId = room.id;
    try {
      const houses = await this.housingApi.updateRoom(nextRoom);
      await this.refreshHousing(houses);
      this.cancelEditingRoom();
    } catch (error) {
      this.toast.error(apiError(error, 'Impossible de modifier la chambre.'));
    } finally {
      this.savingRoomId = null;
    }
  }

  requestDeleteRoom(room: Room): void {
    if (!this.auth.can('housing', 'edit')) return;
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
      await this.refreshHousing(houses);
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
