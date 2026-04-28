import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BedType, House, Room } from './types';

@Injectable({ providedIn: 'root' })
export class HousingApiService {
  private readonly http = inject(HttpClient);

  async loadHousing(): Promise<House[]> {
    return firstValueFrom(this.http.get<House[]>('/api/housing'));
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

  async assignGuest(guestId: string, roomId: string | null): Promise<House[]> {
    if (!roomId) {
      return firstValueFrom(this.http.delete<House[]>(`/api/housing/assignments/${guestId}`));
    }
    return firstValueFrom(this.http.put<House[]>(`/api/housing/assignments/${guestId}`, { roomId }));
  }
}
