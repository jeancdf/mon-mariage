import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Table } from './types';

@Injectable({ providedIn: 'root' })
export class SeatingApiService {
  private readonly http = inject(HttpClient);

  async loadTables(): Promise<Table[]> {
    return firstValueFrom(this.http.get<Table[]>('/api/seating'));
  }

  async createTable(table: { name: string; seats: number }): Promise<Table[]> {
    return firstValueFrom(this.http.post<Table[]>('/api/seating/tables', table));
  }

  async updateTable(table: Pick<Table, 'id' | 'name' | 'seats'>): Promise<Table[]> {
    return firstValueFrom(this.http.patch<Table[]>(`/api/seating/tables/${table.id}`, {
      name: table.name,
      seats: table.seats,
    }));
  }

  async deleteTable(id: string): Promise<Table[]> {
    return firstValueFrom(this.http.delete<Table[]>(`/api/seating/tables/${id}`));
  }

  async assignGuest(guestId: string, tableId: string | null): Promise<Table[]> {
    if (!tableId) {
      return firstValueFrom(this.http.delete<Table[]>(`/api/seating/assignments/${guestId}`));
    }
    return firstValueFrom(this.http.put<Table[]>(`/api/seating/assignments/${guestId}`, { tableId }));
  }
}
