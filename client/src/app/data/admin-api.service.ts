import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AccessProfileKey, SectionKey } from '../auth/auth.types';

export interface AdminAccount {
  id: string;
  guestId: string | null;
  email: string;
  status: 'pending' | 'active' | 'disabled';
  profileKey: AccessProfileKey;
  isOrganizer: boolean;
  lastLoginAt: string | null;
  name: string;
}

export interface AdminProfile {
  key: AccessProfileKey;
  name: string;
  permissions: Array<{ id: string; section: SectionKey; canView: boolean; canEdit: boolean }>;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  listAccounts(): Promise<AdminAccount[]> { return firstValueFrom(this.http.get<AdminAccount[]>('/api/admin/accounts')); }
  listProfiles(): Promise<AdminProfile[]> { return firstValueFrom(this.http.get<AdminProfile[]>('/api/admin/profiles')); }
  async enableGuest(guestId: string): Promise<void> {
    await firstValueFrom(this.http.post(`/api/admin/accounts/guests/${guestId}`, {}));
  }

  async createOrganizer(input: {
    displayName: string;
    email: string;
    password: string;
  }): Promise<void> {
    await firstValueFrom(this.http.post('/api/admin/accounts/organizers', input));
  }

  async setStatus(
    accountId: string,
    status: AdminAccount['status'],
  ): Promise<void> {
    await firstValueFrom(this.http.patch(
      `/api/admin/accounts/${accountId}/status`,
      { status },
    ));
  }

  async reset(accountId: string, newPassword?: string): Promise<void> {
    await firstValueFrom(this.http.post(
      `/api/admin/accounts/${accountId}/reset`,
      newPassword ? { newPassword } : {},
    ));
  }
  async saveProfile(profile: AdminProfile): Promise<AdminProfile> {
    const permissions = Object.fromEntries(profile.permissions.map(permission => [permission.section, {
      canView: permission.canView, canEdit: permission.canEdit,
    }]));
    return firstValueFrom(this.http.patch<AdminProfile>(`/api/admin/profiles/${profile.key}`, { name: profile.name, permissions }));
  }
}

