import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Guest } from './types';

@Injectable({ providedIn: 'root' })
export class GuestApiService {
  private readonly http = inject(HttpClient);

  async loadGuests(): Promise<Guest[]> {
    return firstValueFrom(this.http.get<Guest[]>('/api/guests'));
  }

  async replaceGuests(guests: Guest[]): Promise<Guest[]> {
    return firstValueFrom(
      this.http.put<Guest[]>('/api/guests/import', { guests }),
    );
  }

  async createGuest(guest: Guest): Promise<Guest> {
    return firstValueFrom(this.http.post<Guest>('/api/guests', guest));
  }

  async updateGuest(guest: Guest): Promise<Guest> {
    return firstValueFrom(this.http.patch<Guest>(`/api/guests/${guest.id}`, guest));
  }

  async deleteGuest(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<{ success: true }>(`/api/guests/${id}`));
  }
}
