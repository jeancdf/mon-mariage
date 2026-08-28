import { EventKey, GuestEntity, Kid, Rsvp } from '../guests/guest.entity';

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

export const PUBLIC_EVENT_LABELS: Record<EventKey, string> = {
  rehearsal: 'Répétition',
  ceremony: 'Cérémonie',
  dinner: 'Dîner',
};

export const toPublicHousehold = (guest: GuestEntity): PublicRsvpHousehold => {
  const people: PublicRsvpPerson[] = [{
    id: guest.id,
    name: `${guest.firstName} ${guest.lastName}`.trim(),
    kind: 'guest',
    rsvp: guest.rsvp,
  }];
  if (guest.hasPlusOne) {
    people.push({
      id: `${guest.id}__plus_one`,
      name: guest.plusOneName.trim() || 'Accompagnateur',
      kind: 'plusOne',
      rsvp: guest.plusOneRsvp ?? 'pending',
    });
  }
  for (const kid of guest.kids ?? []) {
    const name = String(kid.name ?? '').trim();
    if (!name) continue;
    people.push({
      id: kid.id,
      name,
      kind: 'kid',
      rsvp: (kid as Kid).rsvp ?? 'pending',
    });
  }
  return {
    guestId: guest.id,
    people,
    events: Array.isArray(guest.events) ? guest.events : [],
    dietary: guest.dietary ?? '',
    transport: guest.transport ?? '',
    needsHousing: Boolean(guest.needsHousing),
  };
};
