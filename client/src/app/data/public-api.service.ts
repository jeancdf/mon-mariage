import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { EventKey, Rsvp } from './types';

export interface PublicSiteEvent {
  key: EventKey;
  label: string;
}

export interface PublicSiteInfo {
  coupleNames: string[];
  weddingDate: string;
  weddingPlace: string;
  timeZone: string;
  daysRemaining: number;
  events: PublicSiteEvent[];
}

export interface PublicRsvpPerson {
  id: string;
  name: string;
  kind: 'guest' | 'plusOne' | 'kid';
  rsvp: Rsvp;
}

export interface PublicRsvpHousehold {
  guestId: string;
  people: PublicRsvpPerson[];
  events: EventKey[];
  dietary: string;
  transport: string;
  needsHousing: boolean;
}

export interface PublicRsvpPayload {
  people: { id: string; rsvp: Rsvp }[];
  events: EventKey[];
  dietary: string;
  transport: string;
  needsHousing: boolean;
}

@Injectable({ providedIn: 'root' })
export class PublicApiService {
  private readonly http = inject(HttpClient);

  loadSite(): Promise<PublicSiteInfo> {
    return firstValueFrom(this.http.get<PublicSiteInfo>('/api/public/site'));
  }

  loadHousehold(token: string): Promise<PublicRsvpHousehold> {
    return firstValueFrom(this.http.get<PublicRsvpHousehold>(`/api/public/rsvp/${encodeURIComponent(token)}`));
  }

  submitHousehold(token: string, payload: PublicRsvpPayload): Promise<PublicRsvpHousehold> {
    return firstValueFrom(this.http.put<PublicRsvpHousehold>(`/api/public/rsvp/${encodeURIComponent(token)}`, payload));
  }
}
