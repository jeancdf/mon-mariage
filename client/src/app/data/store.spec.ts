import { WeddingStore } from './store';
import { emptyGuest } from '../shared/wedding-utils';

describe('Household and housing state', () => {
  const guest = () => ({ ...emptyGuest(), id: 'g', firstName: 'Paul', lastName: 'Martin',
    rsvp: 'confirmed' as const, hasPlusOne: true, plusOneRsvp: 'declined' as const,
    kids: [{ id: 'kid', name: 'Tom', age: 6, rsvp: 'pending' as const }],
  });
  const house = () => ({ id: 'h', name: 'Maison', rooms: [{ id: 'r', name: 'Chambre', beds: 2, bedType: 'single' as const, guestIds: ['g', 'kid'] }] });

  it('retains occupants when housing arrives before guests', () => {
    const store = new WeddingStore();
    store.replaceHouses([house()]);
    store.replaceGuests([guest()]);
    expect(store.houses()[0].rooms[0].guestIds).toEqual(['g', 'kid']);
  });
  it('retains placements for a housing-only profile', () => {
    const store = new WeddingStore();
    store.replaceHouses([house()]);
    expect(store.houses()[0].rooms[0].guestIds).toEqual(['g', 'kid']);
  });
  it('counts each response and removes only deleted or declined members', () => {
    const store = new WeddingStore();
    store.replaceGuests([guest()]);
    store.replaceHouses([house()]);
    expect(store.guestCount()).toBe(3);
    expect(store.confirmedCount()).toBe(1);
    expect(store.pendingCount()).toBe(1);
    store.updateGuest({ ...guest(), kids: [] });
    expect(store.houses()[0].rooms[0].guestIds).toEqual(['g']);
    store.updateGuest({ ...guest(), kids: [], rsvp: 'declined' });
    expect(store.houses()[0].rooms[0].guestIds).toEqual([]);
  });
  it('clears data on session reset', () => {
    const store = new WeddingStore();
    store.replaceGuests([guest()]);
    store.replaceHouses([house()]);
    store.markLoaded();
    store.reset();
    expect(store.guests()).toEqual([]);
    expect(store.houses()).toEqual([]);
    expect(store.loaded()).toBe(false);
  });
});
