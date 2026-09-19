// Dedicated, disposable CI database only. This script recreates its public schema.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DataSource } = require('typeorm');
const { HouseEntity } = require('../dist/housing/house.entity');
const { RoomEntity } = require('../dist/housing/room.entity');
const { RoomGuestEntity } = require('../dist/housing/room-guest.entity');
const { GuestEntity } = require('../dist/guests/guest.entity');
const { HousingService } = require('../dist/housing/housing.service');

async function main() {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url && new URL(url).pathname === '/mon_mariage_test', 'Requires disposable mon_mariage_test database');
  const db = new DataSource({ type: 'postgres', url, entities: [join(__dirname, '../dist/**/*.entity.js')], synchronize: false });
  await db.initialize();
  try {
    for (const migration of ['synchronize', 'sql']) {
      await db.synchronize(true);
      const house = await db.getRepository(HouseEntity).save({ name: 'Préparatifs' });
      const secondHouse = await db.getRepository(HouseEntity).save({ name: 'Mariage' });
      const room = await db.getRepository(RoomEntity).save({ name: 'Simple', beds: 1, bedType: 'single', houseId: house.id });
      const wedding = await db.getRepository(RoomEntity).save({ name: 'Double', beds: 1, bedType: 'double', houseId: secondHouse.id });
      const guests = await db.getRepository(GuestEntity).save([
        { firstName: 'Camille', category: 'amis', rsvp: 'confirmed' },
        { firstName: 'Alex', category: 'amis', rsvp: 'confirmed' },
      ]);
      // Restore the previous schema: one room per person, no nightly dates.
      await db.query('ALTER TABLE room_guests DROP COLUMN night CASCADE');
      await db.query('ALTER TABLE room_guests ADD CONSTRAINT legacy_one_room UNIQUE ("guestId")');
      await db.query('DROP TABLE housing_stays');
      const [legacy] = await db.query('INSERT INTO room_guests ("guestId", "roomId") VALUES ($1, $2) RETURNING id', [guests[0].id, wedding.id]);

      if (migration === 'synchronize') await db.synchronize();
      else {
        const sql = readFileSync(join(__dirname, '../sql/2026-09-19-nightly-housing.sql'), 'utf8');
        await db.query(sql);
        await db.query(sql); // Manual migration is safe to re-run.
      }
      const housing = new HousingService(db.getRepository(HouseEntity), db.getRepository(RoomEntity), db.getRepository(RoomGuestEntity), {
        getConfiguration: () => ({ weddingDate: '2027-07-16', dailyStart: '2027-07-09' }),
        getTimeZone: () => 'Europe/Paris',
      });
      await housing.onApplicationBootstrap();
      await housing.onApplicationBootstrap();
      assert.equal((await db.getRepository(RoomGuestEntity).findOneByOrFail({ id: legacy.id })).night, '2027-07-16');

      await housing.assignGuest(guests[0].id, room.id, '2027-07-12', '2027-07-16');
      let calendar = await housing.calendar();
      assert.equal(calendar.assignments.filter(a => a.guestId === guests[0].id).length, 5);
      assert.equal(calendar.assignments.find(a => a.night === '2027-07-16').roomId, wedding.id);
      await assert.rejects(housing.assignGuest(guests[1].id, room.id, '2027-07-11', '2027-07-14'), /complète/);
      assert.equal(await db.getRepository(RoomGuestEntity).countBy({ guestId: guests[1].id }), 0);

      const concurrent = await Promise.allSettled(guests.map(guest => housing.assignGuest(guest.id, room.id, '2027-07-10', '2027-07-11')));
      assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(concurrent.filter(result => result.status === 'rejected').length, 1);
      assert.equal(await db.getRepository(RoomGuestEntity).countBy({ roomId: room.id, night: '2027-07-10' }), 1);
      await assert.rejects(db.getRepository(RoomGuestEntity).save({ guestId: guests[0].id, roomId: room.id, night: '2027-07-16' }), /duplicate key/);
      await housing.assignGuest(guests[0].id, null, '2027-07-12', '2027-07-13');
      calendar = await housing.calendar();
      assert.ok(calendar.assignments.some(a => a.guestId === guests[0].id && a.night === '2027-07-16'));
      console.log(`PostgreSQL ${migration}: legacy migration, nightly moves, atomic failure, concurrency and unique constraint passed`);
    }
  } finally { await db.destroy(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
