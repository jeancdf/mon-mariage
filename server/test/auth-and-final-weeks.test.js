const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { AccountsService, normalizeEmail, profileForOrganizationRole } = require('../dist/auth/accounts.service.js');
const { PasswordService } = require('../dist/auth/password.service.js');
const { addDays } = require('../dist/event-config/event-config.service.js');
const { expandRecurrenceDates, isDateInWindow } = require('../dist/final-weeks/final-weeks.utils.js');
const { FinalWeeksService } = require('../dist/final-weeks/final-weeks.service.js');

const config = values => ({
  get(key, fallback) {
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback;
  },
});

const emptyRepository = () => ({
  create: value => ({ ...value }),
  save: async value => value,
  findOne: async () => null,
  find: async () => [],
  count: async () => 0,
  update: async () => undefined,
  upsert: async () => undefined,
});

describe('password security', () => {
  it('hashes with a random salt and verifies without storing plaintext', async () => {
    const passwords = new PasswordService();
    const first = await passwords.hash('une phrase secrète solide');
    const second = await passwords.hash('une phrase secrète solide');

    assert.match(first, /^scrypt:/);
    assert.notEqual(first, second);
    assert.equal(await passwords.verify('une phrase secrète solide', first), true);
    assert.equal(await passwords.verify('mauvais mot de passe', first), false);
    assert.equal(first.includes('une phrase secrète solide'), false);
  });

  it('rejects passwords shorter than twelve characters', async () => {
    const passwords = new PasswordService();
    await assert.rejects(() => passwords.hash('trop-court'));
  });
});

describe('guest account provisioning', () => {
  it('normalizes email and maps organization roles to access profiles', () => {
    assert.equal(normalizeEmail('  Prenom.NOM@Example.COM '), 'prenom.nom@example.com');
    assert.equal(profileForOrganizationRole('parent'), 'parent');
    assert.equal(profileForOrganizationRole('sibling'), 'sibling');
    assert.equal(profileForOrganizationRole('witness'), 'witness');
    assert.equal(profileForOrganizationRole('friend_cousin'), 'friend_cousin');
    assert.equal(profileForOrganizationRole('other'), 'other');
  });

  it('creates pending accounts only for eligible roles with an email', async () => {
    const saved = [];
    const accounts = {
      ...emptyRepository(),
      findOne: async () => null,
      save: async value => { saved.push({ ...value }); return value; },
    };
    const service = new AccountsService(
      accounts, emptyRepository(), emptyRepository(), emptyRepository(), emptyRepository(),
      new PasswordService(), config({ SESSION_SECRET: 'a'.repeat(32) }),
    );

    await service.syncGuestAccount({ id: '00000000-0000-0000-0000-000000000001', email: ' Parent@Example.com ', organizationRole: 'parent' });
    await service.syncGuestAccount({ id: '00000000-0000-0000-0000-000000000002', email: 'ami@example.com', organizationRole: 'friend_cousin' });

    assert.equal(saved.length, 1);
    assert.equal(saved[0].email, 'parent@example.com');
    assert.equal(saved[0].status, 'pending');
    assert.equal(saved[0].profileKey, 'parent');
    assert.equal(saved[0].guestId, '00000000-0000-0000-0000-000000000001');
  });

  it('updates an existing account profile without deleting it', async () => {
    const existing = {
      id: 'account-1', guestId: 'guest-1', email: 'old@example.com', status: 'active',
      profileKey: 'parent', isOrganizer: false,
    };
    const accounts = {
      ...emptyRepository(),
      findOne: async ({ where }) => where.guestId === 'guest-1' ? existing : null,
      save: async value => value,
    };
    const service = new AccountsService(
      accounts, emptyRepository(), emptyRepository(), emptyRepository(), emptyRepository(),
      new PasswordService(), config({ SESSION_SECRET: 'b'.repeat(32) }),
    );

    await service.syncGuestAccount({ id: 'guest-1', email: 'new@example.com', organizationRole: 'witness' });
    assert.equal(existing.id, 'account-1');
    assert.equal(existing.email, 'new@example.com');
    assert.equal(existing.profileKey, 'witness');
    assert.equal(existing.status, 'active');
  });

  it('prevents an eligible guest from reusing another account email', async () => {
    const accounts = {
      ...emptyRepository(),
      findOne: async () => ({ id: 'account-2', guestId: 'another-guest', email: 'same@example.com' }),
    };
    const service = new AccountsService(
      accounts, emptyRepository(), emptyRepository(), emptyRepository(), emptyRepository(),
      new PasswordService(), config({ SESSION_SECRET: 'c'.repeat(32) }),
    );
    await assert.rejects(() => service.assertGuestAccountEmail('SAME@example.com', 'guest-1', 'parent'));
  });
});

describe('server-side sessions and CSRF', () => {
  it('sets a secure HTTP-only strict cookie and validates its CSRF token', async () => {
    let storedSession = null;
    let cookie = null;
    const sessions = {
      ...emptyRepository(),
      create: value => ({ id: 'session-1', ...value }),
      save: async value => { storedSession = value; return value; },
      findOne: async () => storedSession,
    };
    const service = new AccountsService(
      emptyRepository(), sessions, emptyRepository(), emptyRepository(), emptyRepository(),
      new PasswordService(), config({ NODE_ENV: 'production', SESSION_SECRET: 'd'.repeat(32) }),
    );
    const response = {
      cookie: (name, value, options) => { cookie = { name, value, options }; },
      clearCookie: () => undefined,
    };
    const account = { id: 'account-1', status: 'active', profile: { permissions: [] } };

    const created = await service.createSession(account, response, 'test-agent');
    assert.equal(cookie.name, 'mm_session');
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.secure, true);
    assert.equal(cookie.options.sameSite, 'strict');
    assert.equal(service.verifyCsrfToken(storedSession, created.csrfToken), true);
    assert.equal(service.verifyCsrfToken(storedSession, 'wrong'), false);

    storedSession.account = account;
    const resolved = await service.resolveSession(`another=value; mm_session=${cookie.value}`);
    assert.equal(resolved.id, 'session-1');
  });

  it('rejects expired sessions and revokes them server-side', async () => {
    let saved = null;
    const sessions = {
      ...emptyRepository(),
      findOne: async () => ({
        id: 'expired', expiresAt: new Date(Date.now() - 1000), revokedAt: null,
        account: { id: 'account-1', status: 'active' },
      }),
      save: async value => { saved = value; return value; },
    };
    const service = new AccountsService(
      emptyRepository(), sessions, emptyRepository(), emptyRepository(), emptyRepository(),
      new PasswordService(), config({ SESSION_SECRET: 'e'.repeat(32) }),
    );
    assert.equal(await service.resolveSession('mm_session=unknown'), null);
    assert.ok(saved.revokedAt instanceof Date);
  });
});

describe('operational data for a 20-40 person household', () => {
  const eventConfig = {
    getConfiguration: () => ({
      weddingDate: '2027-07-16', weddingPlace: 'Escayrac', preparationStart: '2027-05-21',
      dailyStart: '2027-07-09', timeZone: 'Europe/Paris',
    }),
    getTimeZone: () => 'Europe/Paris',
  };

  it('combines presence windows and explicit meal selections for headcounts', () => {
    const service = new FinalWeeksService(
      emptyRepository(), emptyRepository(), emptyRepository(), emptyRepository(), emptyRepository(),
      emptyRepository(), emptyRepository(), emptyRepository(), eventConfig,
    );
    const people = Array.from({ length: 40 }, (_, index) => ({
      id: `person-${index}`,
      arrivalAt: '2027-07-11T16:00:00.000Z',
      departureAt: index < 35 ? '2027-07-15T20:00:00.000Z' : '2027-07-12T09:00:00.000Z',
      mealSelections: { '2027-07-12': index < 30 ? ['lunch', 'dinner'] : ['dinner'] },
    }));

    assert.equal(service.mealHeadcount(people, '2027-07-12', 'lunch'), 30);
    assert.equal(service.mealHeadcount(people, '2027-07-12', 'dinner'), 35);
  });

  it('materializes repeated work as separate tasks with multiple assignees', async () => {
    const tasks = [];
    const assignments = [];
    const tasksRepository = {
      ...emptyRepository(),
      create: value => ({ ...value }),
      save: async value => {
        const saved = { id: `task-${tasks.length + 1}`, ...value };
        tasks.push(saved);
        return saved;
      },
    };
    const assigneesRepository = {
      ...emptyRepository(),
      delete: async () => undefined,
      insert: async rows => { assignments.push(...rows); },
    };
    const accountsRepository = {
      ...emptyRepository(),
      find: async () => [{ id: 'account-1', status: 'active' }, { id: 'account-2', status: 'active' }],
    };
    const service = new FinalWeeksService(
      emptyRepository(), emptyRepository(), emptyRepository(), tasksRepository, assigneesRepository,
      emptyRepository(), accountsRepository, emptyRepository(), eventConfig,
    );

    await service.createTasks(
      { id: 'organizer', isOrganizer: true },
      {
        title: 'Préparer la maison',
        category: 'cleaning',
        scheduledAt: '2027-07-12T07:00:00.000Z',
        endsAt: '2027-07-12T09:00:00.000Z',
        assigneeIds: ['account-1', 'account-2'],
        recurrence: { type: 'daily', untilDate: '2027-07-14' },
      },
    );

    assert.equal(tasks.length, 3);
    assert.equal(new Set(tasks.map(task => task.id)).size, 3);
    assert.equal(new Set(tasks.map(task => task.recurrenceGroupId)).size, 1);
    assert.ok(tasks.every(task => task.endsAt.getTime() - task.scheduledAt.getTime() === 2 * 60 * 60 * 1000));
    assert.equal(assignments.length, 6);
    assert.deepEqual(new Set(assignments.map(item => item.accountId)), new Set(['account-1', 'account-2']));
  });
});

describe('eight-week calendar and recurrence expansion', () => {
  it('derives D-56 and D-7 without daylight-saving drift', () => {
    assert.equal(addDays('2027-07-16', -56), '2027-05-21');
    assert.equal(addDays('2027-07-16', -7), '2027-07-09');
    assert.equal(isDateInWindow('2027-05-21', '2027-05-21', '2027-07-16'), true);
    assert.equal(isDateInWindow('2027-05-20', '2027-05-21', '2027-07-16'), false);
  });

  it('expands daily occurrences into independently addressable dates', () => {
    assert.deepEqual(
      expandRecurrenceDates('2027-07-12', '2027-07-16', { type: 'daily', untilDate: '2027-07-14' }),
      ['2027-07-12', '2027-07-13', '2027-07-14'],
    );
  });

  it('expands only selected weekdays and rejects an empty selection', () => {
    assert.deepEqual(
      expandRecurrenceDates('2027-07-09', '2027-07-16', { type: 'weekdays', weekdays: [1, 3, 5], untilDate: '2027-07-16' }),
      ['2027-07-09', '2027-07-12', '2027-07-14', '2027-07-16'],
    );
    assert.throws(() => expandRecurrenceDates('2027-07-09', '2027-07-16', { type: 'weekdays', weekdays: [] }));
  });
});
