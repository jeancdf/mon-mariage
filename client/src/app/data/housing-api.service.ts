import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BedType, House, Room } from './types';
import { GuestPerson } from '../shared/wedding-utils';

export interface HousingPerson extends GuestPerson { arrivalDate: string | null; departureDate: string | null; }
export interface HousingCalendar {
  weddingDate: string;
  startDate: string;
  endDate: string;
  nights: string[];
  houses: House[];
  people: HousingPerson[];
  assignments: { guestId: string; roomId: string; night: string }[];
}

@Injectable({ providedIn: 'root' })
export class HousingApiService {
  private readonly http = inject(HttpClient);

  async loadHousing(): Promise<House[]> {
    return firstValueFrom(this.http.get<House[]>('/api/housing'));
  }

  async loadPeople(): Promise<GuestPerson[]> {
    return firstValueFrom(this.http.get<GuestPerson[]>('/api/housing/people'));
  }

  loadCalendar(): Promise<HousingCalendar> {
    return firstValueFrom(this.http.get<HousingCalendar>('/api/housing/calendar'));
  }

  saveStay(guestId: string, arrivalDate: string, departureDate: string): Promise<unknown> {
    return firstValueFrom(this.http.put(`/api/housing/people/${encodeURIComponent(guestId)}/stay`, { arrivalDate, departureDate }));
  }

  async createHouse(name: string): Promise<House[]> {
    return firstValueFrom(this.http.post<House[]>('/api/housing/houses', { name }));
  }

  async deleteHouse(id: string): Promise<House[]> {
    return firstValueFrom(this.http.delete<House[]>(`/api/housing/houses/${id}`));
  }

  async createRoom(houseId: string, room: { name: string; bedType: BedType; beds: number }): Promise<House[]> {
    return firstValueFrom(this.http.post<House[]>(`/api/housing/houses/${houseId}/rooms`, room));
  }

  async updateRoom(room: Room): Promise<House[]> {
    return firstValueFrom(this.http.patch<House[]>(`/api/housing/rooms/${room.id}`, room));
  }

  async deleteRoom(roomId: string): Promise<House[]> {
    return firstValueFrom(this.http.delete<House[]>(`/api/housing/rooms/${roomId}`));
  }

  async assignGuest(guestId: string, roomId: string | null, from?: string, until?: string): Promise<House[]> {
    return firstValueFrom(this.http.put<House[]>(`/api/housing/assignments/${guestId}`, { roomId, from, until }));
  }
}
