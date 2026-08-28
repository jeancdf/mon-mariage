const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { GuestsService } = require('../dist/guests/guests.service.js');
const { toPublicHousehold } = require('../dist/public/public.types.js');

const emptyRepository = () => ({
  create: value => ({ ...value }),
  save: async value => value,
  findOne: async () => null,
  find: async () => [],
  count: async () => 0,
  update: async () => undefined,
  upsert: async () => undefined,
  insert: async () => undefined,
  delete: async () => ({ affected: 1 }),
  clear: async () => undefined,
  merge: (existing, patch) => Object.assign(existing, patch),
});

const accountsStub = {
  assertGuestAccountEmail: async () => undefined,
  assertImportAccountEmail: async () => undefined,
  syncGuestAccount: async () => undefined,
  reconcileGuestAccounts: async () => undefined,
};

const makeGuest = (overrides = {}) => ({
  id: 'guest-a',
  firstName: 'Paul',
  lastName: 'Martin',
  email: '',
  organizationRole: 'other',
  category: 'amis',
  rsvp: 'pending',
  hasPlusOne: true,
  plusOneName: 'Lea Martin',
  plusOneRsvp: 'pending',
  kids: [{ id: 'kid-a', name: 'Tom', age: 6, rsvp: 'pending' }],
  dietary: '',
  events: ['ceremony', 'dinner'],
  transport: '',
  needsHousing: false,
  notes: 'interne',
  inviteToken: 'token-household-a',
  inviteTokenCreatedAt: new Date(),
  ...overrides,
});

describe('public RSVP tokens', () => {
  it('updates the matching Guest entity and ignores other households', async () => {
    const guestA = makeGuest();
    const guestB = makeGuest({
      id: 'guest-b',
      firstName: 'Sophie',
      lastName: 'Durand',
      hasPlusOne: false,
      plusOneName: '',
      kids: [],
      inviteToken: 'token-household-b',
      dietary: 'ne pas toucher',
      rsvp: 'pending',
    });
    const saved = [];
    const guests = {
      ...emptyRepository(),
      findOne: async ({ where }) => {
        if (where.inviteToken === guestA.inviteToken) return guestA;
        if (where.inviteToken === guestB.inviteToken) return guestB;
        if (where.id === guestA.id) return guestA;
        if (where.id === guestB.id) return guestB;
        return null;
      },
      save: async value => {
        saved.push({ ...value, kids: (value.kids ?? []).map(kid => ({ ...kid })) });
        Object.assign(value.id === guestB.id ? guestB : guestA, value);
        return value;
      },
    };
    const service = new GuestsService(guests, emptyRepository(), emptyRepository(), accountsStub);

    const updated = await service.applyPublicRsvp('token-household-a', {
      people: [
        { id: 'guest-a', rsvp: 'confirmed' },
        { id: 'guest-a__plus_one', rsvp: 'declined' },
        { id: 'kid-a', rsvp: 'confirmed' },
      ],
      events: ['ceremony'],
      dietary: 'Vegetarien',
      transport: 'train',
      needsHousing: true,
    });

    assert.equal(updated.id, 'guest-a');
    assert.equal(updated.rsvp, 'confirmed');
    assert.equal(updated.plusOneRsvp, 'declined');
    assert.equal(updated.kids[0].rsvp, 'confirmed');
    assert.deepEqual(updated.events, ['ceremony']);
    assert.equal(updated.dietary, 'Vegetarien');
    assert.equal(updated.transport, 'train');
    assert.equal(updated.needsHousing, true);
    assert.equal(guestB.rsvp, 'pending');
    assert.equal(guestB.dietary, 'ne pas toucher');
    assert.equal(saved.some(item => item.id === 'guest-b'), false);
  });

  it('rejects a token that tries to mutate another household person', async () => {
    const guestA = makeGuest();
    const guests = {
      ...emptyRepository(),
      findOne: async ({ where }) => where.inviteToken === guestA.inviteToken ? guestA : null,
      save: async value => value,
    };
    const service = new GuestsService(guests, emptyRepository(), emptyRepository(), accountsStub);

    await assert.rejects(
      () => service.applyPublicRsvp('token-household-a', {
        people: [
          { id: 'guest-a', rsvp: 'confirmed' },
          { id: 'guest-b', rsvp: 'declined' },
        ],
      }),
      error => {
        assert.match(String(error.message), /ne concerne pas/);
        return true;
      },
    );
    assert.equal(guestA.rsvp, 'pending');
  });

  it('does not expose organizer notes on the public household payload', () => {
    const publicHousehold = toPublicHousehold(makeGuest({ notes: 'secret organizer note' }));
    assert.equal('notes' in publicHousehold, false);
    assert.equal('email' in publicHousehold, false);
    assert.equal('inviteToken' in publicHousehold, false);
    assert.equal(publicHousehold.guestId, 'guest-a');
    assert.equal(publicHousehold.people.length, 3);
  });
});
