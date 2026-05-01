import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Vendor } from './types';

@Injectable({ providedIn: 'root' })
export class VendorsApiService {
  private readonly http = inject(HttpClient);

  async loadVendors(): Promise<Vendor[]> {
    return firstValueFrom(this.http.get<Vendor[]>('/api/vendors'));
  }

  async createVendor(vendor: Omit<Vendor, 'id'>): Promise<Vendor[]> {
    return firstValueFrom(this.http.post<Vendor[]>('/api/vendors', vendor));
  }

  async updateVendor(vendor: Vendor): Promise<Vendor[]> {
    return firstValueFrom(this.http.patch<Vendor[]>(`/api/vendors/${vendor.id}`, vendor));
  }

  async deleteVendor(id: string): Promise<Vendor[]> {
    return firstValueFrom(this.http.delete<Vendor[]>(`/api/vendors/${id}`));
  }
}
