const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { SeatingService } = require('../dist/seating/seating.service.js');

const makeService = ({ table, assignments }) => {
  const deleted = [];
  const tablesRepository = {
    findOne: async () => table,
    find: async () => [{ ...table, assignments }],
    save: async value => value,
  };
  const assignmentsRepository = {
    find: async () => assignments,
    save: async value => value,
    delete: async id => { deleted.push(id); },
  };
  return { service: new SeatingService(tablesRepository, assignmentsRepository), deleted };
};

describe('seating capacity', () => {
  it('refuses to shrink a table below its seated guests instead of dropping them', async () => {
    const assignments = [0, 1, 2, 3].map(seat => ({ id: `a${seat}`, guestId: `g${seat}`, tableId: 't', seat }));
    const table = { id: 't', name: 'Famille', seats: 4, shape: 'rect', x: 100, y: 100, rotation: 0, assignments };
    const { service, deleted } = makeService({ table, assignments });

    await assert.rejects(service.updateTable('t', { seats: 2 }), /Déplacez-en 2/);
    assert.equal(table.seats, 4);
    assert.deepEqual(deleted, []);
  });

  it('still allows shrinking down to the number of seated guests', async () => {
    const assignments = [{ id: 'a0', guestId: 'g0', tableId: 't', seat: 5 }];
    const table = { id: 't', name: 'Amis', seats: 8, shape: 'rect', x: 100, y: 100, rotation: 0, assignments };
    const { service, deleted } = makeService({ table, assignments });

    await service.updateTable('t', { seats: 2 });
    assert.equal(table.seats, 2);
    assert.deepEqual(deleted, []);
    assert.ok(assignments[0].seat < 2);
  });
});
