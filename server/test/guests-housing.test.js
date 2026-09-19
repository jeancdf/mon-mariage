const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { randomUUID } = require('node:crypto');
const { GuestsService } = require('../dist/guests/guests.service');
const { GuestsController } = require('../dist/guests/guests.controller');
const { guestPeople, GUEST_PLACEMENT_LOCK } = require('../dist/guests/guest-people');
const { HousingService } = require('../dist/housing/housing.service');
const { GuestEntity } = require('../dist/guests/guest.entity');
const { RoomGuestEntity } = require('../dist/housing/room-guest.entity');
const { HouseEntity } = require('../dist/housing/house.entity');
const { RoomEntity } = require('../dist/housing/room.entity');
const { HousingStayEntity } = require('../dist/housing/housing-stay.entity');
const { TableGuestEntity } = require('../dist/seating/table-guest.entity');
const { PresenceEntity } = require('../dist/final-weeks/entities/presence.entity');

const guest = (id = 'g', patch = {}) => ({ id, firstName: 'Paul', lastName: 'Martin', email: '',
  organizationRole: 'other', category: 'amis', rsvp: 'confirmed', hasPlusOne: false,
  plusOneName: '', plusOneRsvp: 'pending', kids: [], events: ['dinner'], dietary: '', transport: '',
  needsHousing: true, notes: 'private', inviteToken: `long-token-for-${id}`, inviteTokenCreatedAt: new Date(0), ...patch,
});

// Repository doubles verify service behavior and transaction boundaries. They do not
// pretend to validate PostgreSQL locking; every placement transaction must acquire it.
function fixture() {
  let state = new Map();
  const repositories = new Map();
  const locks = [];
  const rows = entity => { if (!state.has(entity)) state.set(entity, []); return state.get(entity); };
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) =>
    value?.type === 'in' ? value.value.includes(row[key]) : value?.type === 'isNull' ? row[key] == null : row[key] === value);
  const manager = {
    query: async (sql, params) => { assert.match(sql, /pg_advisory_xact_lock/); locks.push(params[0]); },
    getRepository(entity) {
      if (repositories.has(entity)) return repositories.get(entity);
      const repository = {
        manager,
        create: input => structuredClone(input),
        find: async (options = {}) => rows(entity).filter(row => matches(row, options.where)).map(row => {
          const copy = structuredClone(row);
          if (entity === HouseEntity && options.relations) copy.rooms = rows(RoomEntity).filter(room => room.houseId === row.id).map(room => ({
            ...room, assignments: rows(RoomGuestEntity).filter(item => item.roomId === room.id).map(item => ({ ...item })),
          }));
          return copy;
        }),
        findOne: async options => structuredClone(rows(entity).find(row => matches(row, options.where)) ?? null),
        count: async options => rows(entity).filter(row => matches(row, options?.where)).length,
        save: async input => {
          const key = entity === HousingStayEntity ? 'guestId' : 'id';
          const saved = { ...structuredClone(input), [key]: input[key] || randomUUID() };
          const index = rows(entity).findIndex(row => row[key] === saved[key]);
          if (index < 0) rows(entity).push(saved); else rows(entity)[index] = saved;
          return structuredClone(saved);
        },
        delete: async condition => {
          const before = rows(entity).length;
          state.set(entity, rows(entity).filter(row => !matches(row, typeof condition === 'string' ? { id: condition } : condition)));
          return { affected: before - rows(entity).length };
        },
        update: async (condition, patch) => {
          for (const row of rows(entity)) if (matches(row, condition)) Object.assign(row, patch);
        },
      };
      repositories.set(entity, repository);
      return repository;
    },
    async transaction(work) {
      const snapshot = new Map([...state].map(([entity, values]) => [entity, structuredClone(values)]));
      try { return await work(manager); } catch (error) { state = snapshot; throw error; }
    },
  };
  const accounts = { withManager: () => accounts, assertGuestAccountEmail: async () => {},
    syncGuestAccount: async value => { if (value.firstName === 'FAIL') throw new Error('account write failed'); },
    reconcileGuestAccounts: async () => {},
  };
  const guests = new GuestsService(manager.getRepository(GuestEntity), manager.getRepository(RoomGuestEntity), manager.getRepository(TableGuestEntity), accounts);
  const config = { getConfiguration: () => ({ weddingDate: '2027-07-16', dailyStart: '2027-07-09' }), getTimeZone: () => 'Europe/Paris' };
  const housing = new HousingService(manager.getRepository(HouseEntity), manager.getRepository(RoomEntity), manager.getRepository(RoomGuestEntity), config);
  rows(GuestEntity).push(guest(), guest('other'));
  rows(HouseEntity).push({ id: 'house', name: 'Préparation' }, { id: 'venue', name: 'Mariage' });
  rows(RoomEntity).push({ id: 'prep', houseId: 'house', name: 'Studio', beds: 1, bedType: 'single' },
    { id: 'wedding', houseId: 'venue', name: 'Suite', beds: 1, bedType: 'double' });
  return { rows, guests, housing, locks };
}

describe('guest identity and safe imports', () => {
  it('counts individual RSVP, not the primary response for the whole family', () => {
    const people = guestPeople(guest('family', { hasPlusOne: true, plusOneRsvp: 'declined', kids: [{ id: 'kid', name: 'Tom', age: 6, rsvp: 'pending' }] }));
    assert.deepEqual(people.map(person => person.rsvp), ['confirmed', 'declined', 'pending']);
  });
  it('removes deleted children from all nights, tables, presences and stays', async () => {
    const f = fixture();
    f.rows(GuestEntity)[0].kids = [{ id: 'kid', name: 'Tom', age: 6, rsvp: 'confirmed' }];
    f.rows(RoomGuestEntity).push({ id: 'r1', guestId: 'kid', roomId: 'prep', night: '2027-07-10' }, { id: 'r2', guestId: 'kid', roomId: 'wedding', night: '2027-07-16' });
    f.rows(TableGuestEntity).push({ id: 't', guestId: 'kid' });
    f.rows(PresenceEntity).push({ guestPersonId: 'kid' });
    f.rows(HousingStayEntity).push({ guestId: 'kid' });
    await f.guests.update('g', { kids: [] });
    for (const entity of [RoomGuestEntity, TableGuestEntity, PresenceEntity, HousingStayEntity]) assert.equal(f.rows(entity).length, 0);
    assert.equal(f.rows(GuestEntity)[0].inviteToken, 'long-token-for-g');
  });
  it('rolls back a guest mutation when account synchronization fails', async () => {
    const f = fixture();
    await assert.rejects(() => f.guests.update('g', { firstName: 'FAIL' }), /account write failed/);
    assert.equal(f.rows(GuestEntity)[0].firstName, 'Paul');
  });
  it('merges without deleting absent guests or changing invitation and placement identities', async () => {
    const f = fixture();
    f.rows(RoomGuestEntity).push({ id: 'r', guestId: 'g', roomId: 'prep', night: '2027-07-10' });
    await f.guests.importGuests([{ id: 'g', firstName: 'Pierre' }]);
    assert.equal(f.rows(GuestEntity).length, 2);
    assert.equal(f.rows(GuestEntity)[0].inviteToken, 'long-token-for-g');
    assert.equal(f.rows(RoomGuestEntity)[0].guestId, 'g');
    await assert.rejects(() => f.guests.importGuests([{ id: 'g', firstName: 'Nouveau' }, { firstName: 'FAIL' }]), /account write failed/);
    assert.equal(f.rows(GuestEntity)[0].firstName, 'Pierre');
    assert.equal(f.rows(GuestEntity).length, 2);
  });
  it('rejects a child identifier belonging to another person', async () => {
    const f = fixture();
    await assert.rejects(() => f.guests.update('g', { kids: [{ id: 'other', name: 'Enfant', age: 6 }] }), /identifiant/);
    assert.deepEqual(f.rows(GuestEntity)[0].kids, []);
  });
  it('does not expose RSVP bearer tokens through the read controller', async () => {
    const f = fixture();
    const list = await new GuestsController(f.guests).findAll();
    assert.equal(list[0].hasInviteLink, true);
    assert.equal('inviteToken' in list[0], false);
    assert.equal('inviteTokenCreatedAt' in list[0], false);
  });
  it('a public refusal frees every night for that person without cancelling another guest', async () => {
    const f = fixture();
    f.rows(RoomGuestEntity).push({ id: 'a', guestId: 'g', roomId: 'prep', night: '2027-07-10' }, { id: 'b', guestId: 'g', roomId: 'wedding', night: '2027-07-16' }, { id: 'c', guestId: 'other', roomId: 'wedding', night: '2027-07-16' });
    await f.guests.applyPublicRsvp('long-token-for-g', { people: [{ id: 'g', rsvp: 'declined' }] });
    assert.deepEqual(f.rows(RoomGuestEntity).map(item => item.guestId), ['other']);
  });
});

describe('night-by-night accommodation', () => {
  it('preserves existing placements as the wedding night on upgrade', async () => {
    const f = fixture();
    f.rows(RoomGuestEntity).push({ id: 'legacy', guestId: 'g', roomId: 'wedding', night: null });
    await f.housing.onApplicationBootstrap();
    await f.housing.onApplicationBootstrap();
    assert.deepEqual(f.rows(RoomGuestEntity), [{ id: 'legacy', guestId: 'g', roomId: 'wedding', night: '2027-07-16' }]);
  });
  it('books preparation and wedding in different houses, checkout excluded', async () => {
    const f = fixture();
    await f.housing.saveStay('g', '2027-07-12', '2027-07-18');
    await f.housing.assignGuest('g', 'prep', '2027-07-12', '2027-07-16');
    await f.housing.assignGuest('g', 'wedding', '2027-07-16', '2027-07-18');
    assert.equal(f.rows(RoomGuestEntity).length, 6);
    assert.equal(f.rows(RoomGuestEntity).find(item => item.night === '2027-07-15').roomId, 'prep');
    assert.equal(f.rows(RoomGuestEntity).find(item => item.night === '2027-07-16').roomId, 'wedding');
    assert.equal(f.rows(RoomGuestEntity).some(item => item.night === '2027-07-18'), false);
    assert.ok(f.locks.every(key => key === GUEST_PLACEMENT_LOCK));
  });
  it('allows a room to be reused on a different night', async () => {
    const f = fixture();
    await f.housing.assignGuest('g', 'prep', '2027-07-10', '2027-07-11');
    await f.housing.assignGuest('other', 'prep', '2027-07-11', '2027-07-12');
    assert.equal(f.rows(RoomGuestEntity).length, 2);
  });
  it('rejects the whole period if a later night is full and retains all old rooms', async () => {
    const f = fixture();
    await f.housing.assignGuest('g', 'wedding', '2027-07-10', '2027-07-13');
    await f.housing.assignGuest('other', 'prep', '2027-07-12', '2027-07-13');
    const before = structuredClone(f.rows(RoomGuestEntity));
    await assert.rejects(() => f.housing.assignGuest('g', 'prep', '2027-07-10', '2027-07-13'), /2027-07-12/);
    assert.deepEqual(f.rows(RoomGuestEntity), before);
  });
  it('an invalid room never deletes the old reservation', async () => {
    const f = fixture();
    await f.housing.assignGuest('g', 'prep', '2027-07-10', '2027-07-11');
    await assert.rejects(() => f.housing.assignGuest('g', 'absent', '2027-07-10', '2027-07-11'), /introuvable/);
    assert.equal(f.rows(RoomGuestEntity)[0].roomId, 'prep');
  });
  it('removes only the selected nights', async () => {
    const f = fixture();
    await f.housing.assignGuest('g', 'prep', '2027-07-10', '2027-07-13');
    await f.housing.assignGuest('g', null, '2027-07-11', '2027-07-12');
    assert.deepEqual(f.rows(RoomGuestEntity).map(item => item.night), ['2027-07-10', '2027-07-12']);
  });
  it('validates every night before reducing room capacity', async () => {
    const f = fixture();
    await f.housing.assignGuest('g', 'wedding', '2027-07-12', '2027-07-13');
    await f.housing.assignGuest('other', 'wedding', '2027-07-12', '2027-07-13');
    await assert.rejects(() => f.housing.updateRoom('wedding', { bedType: 'single', beds: 1 }), /2027-07-12/);
    assert.equal(f.rows(RoomEntity).find(room => room.id === 'wedding').bedType, 'double');
  });
  it('refuses shortening a stay over booked nights and booking outside a stay', async () => {
    const f = fixture();
    await f.housing.saveStay('g', '2027-07-10', '2027-07-13');
    await f.housing.assignGuest('g', 'prep', '2027-07-10', '2027-07-13');
    await assert.rejects(() => f.housing.saveStay('g', '2027-07-10', '2027-07-12'), /en dehors/);
    assert.equal(f.rows(HousingStayEntity)[0].departureDate, '2027-07-13');
    await assert.rejects(() => f.housing.assignGuest('g', 'wedding', '2027-07-16', '2027-07-17'), /en dehors/);
  });
  it('rejects bad dates and exposes only placement information in the calendar', async () => {
    const f = fixture();
    await assert.rejects(() => f.housing.assignGuest('g', 'prep', '2027-07-12', '2027-07-12'), /séjour/);
    await assert.rejects(() => f.housing.assignGuest('g', 'prep', '2027-02-31', '2027-07-12'), /séjour/);
    const calendar = await f.housing.calendar();
    assert.equal(calendar.nights.length, 9);
    assert.equal('email' in calendar.people[0], false);
    assert.equal('notes' in calendar.people[0], false);
    assert.equal('inviteToken' in calendar.people[0], false);
  });
});
