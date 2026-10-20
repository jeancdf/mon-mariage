import { GuestEntity, Rsvp } from './guest.entity';

/** A household is expanded identically for counts, room occupants and cleanup. */
export function guestPeople(guest: Pick<GuestEntity, 'id' | 'firstName' | 'lastName' | 'category' | 'rsvp' | 'hasPlusOne' | 'plusOneName' | 'plusOneRsvp' | 'kids' | 'needsHousing'>) {
  const person = (id: string, firstName: string, lastName: string, rsvp: Rsvp, isPlusOne = false, isKid = false) => ({
    id, firstName, lastName, rsvp, isPlusOne, isKid, parentGuestId: guest.id,
    category: isKid ? 'enfants' as const : guest.category,
    needsHousing: Boolean(guest.needsHousing),
  });
  return [
    person(guest.id, guest.firstName, guest.lastName, guest.rsvp),
    ...(guest.hasPlusOne ? [person(`${guest.id}__plus_one`, guest.plusOneName || `+1 ${guest.firstName}`, '', guest.plusOneRsvp ?? guest.rsvp, true)] : []),
    ...(guest.kids ?? []).filter(kid => kid.name.trim()).map(kid => person(kid.id, kid.name, guest.lastName, kid.rsvp ?? guest.rsvp, false, true)),
  ];
}

// One wedding, small write volume: serialize person/placement changes across instances.
// Acquired inside the same transaction as all affected rows.
export const GUEST_PLACEMENT_LOCK = 728_431_003;
