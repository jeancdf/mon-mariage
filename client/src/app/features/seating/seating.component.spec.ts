import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { SeatingApiService } from '../../data/seating-api.service';
import { Table } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { SeatingComponent } from './seating.component';

const table = (assignments: Table['assignments'], id = 'table-1', seats = 10): Table => ({
  id,
  name: id === 'table-1' ? 'Table 1' : 'Table 2',
  seats,
  shape: 'rect',
  x: 100,
  y: 100,
  rotation: 0,
  assignments,
});

describe('SeatingComponent', () => {
  let assignGuest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assignGuest = vi.fn(async (guestId: string, _tableId: string, seat: number | null) => [
      table([{ guestId, seat: seat ?? 0 }]),
    ]);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: SeatingApiService, useValue: { assignGuest } },
      ],
    });
  });

  it('refuses the central drop zone when the table is full', () => {
    const component = TestBed.runInInjectionContext(() => new SeatingComponent());
    const currentTable = table([
      { guestId: 'guest-1', seat: 0 },
      { guestId: 'guest-2', seat: 1 },
    ], 'table-1', 2);
    const drag = { data: 'guest-1' } as CdkDrag<string>;

    expect(component.tableEnterPredicate(currentTable)(drag)).toBe(false);
  });

  it('allows a seated guest to target an occupied seat at another full table', () => {
    const component = TestBed.runInInjectionContext(() => new SeatingComponent());
    const source = table([{ guestId: 'guest-1', seat: 0 }]);
    const target = table([
      { guestId: 'guest-2', seat: 0 },
      { guestId: 'guest-3', seat: 1 },
    ], 'table-2', 2);
    component.store.tables.set([source, target]);

    expect(component.seatEnterPredicate(target, 0)({ data: 'guest-1' } as CdkDrag<string>)).toBe(true);
    expect(component.seatEnterPredicate(target, 0)({ data: 'unplaced' } as CdkDrag<string>)).toBe(false);
  });

  it('places a guest on the explicit seat target without using drop coordinates', async () => {
    const component = TestBed.runInInjectionContext(() => new SeatingComponent());
    const source = table([{ guestId: 'guest-1', seat: 0 }]);
    const target = table([], 'table-2');
    component.store.tables.set([source, target]);
    const container = { data: target } as CdkDropList<Table>;
    const event = {
      item: { data: 'guest-1' },
      container,
      previousContainer: { data: source },
    } as unknown as CdkDragDrop<Table>;

    await component.onSeatDrop(event, target, 4);

    expect(assignGuest).toHaveBeenCalledWith('guest-1', 'table-2', 4);
  });

  it('uses the first free seat for a drop at the centre of another table', async () => {
    const component = TestBed.runInInjectionContext(() => new SeatingComponent());
    const source = table([{ guestId: 'guest-1', seat: 0 }]);
    const target = table([], 'table-2');
    component.store.tables.set([source, target]);
    const event = { item: { data: 'guest-1' } } as unknown as CdkDragDrop<Table>;

    await component.onTableDrop(event, target);

    expect(assignGuest).toHaveBeenCalledWith('guest-1', 'table-2', null);
  });
});

describe('WeddingStore table seating', () => {
  it('moves a guest to an empty seat on the same table', () => {
    const store = new WeddingStore();
    store.tables.set([table([{ guestId: 'guest-1', seat: 0 }])]);

    store.assignGuestTable('guest-1', 'table-1', 4);

    expect(store.tables()[0].assignments).toEqual([{ guestId: 'guest-1', seat: 4 }]);
  });

  it('swaps guests between occupied seats on the same table', () => {
    const store = new WeddingStore();
    store.tables.set([table([
      { guestId: 'guest-1', seat: 0 },
      { guestId: 'guest-2', seat: 1 },
    ])]);

    store.assignGuestTable('guest-1', 'table-1', 1);

    expect(store.tables()[0].assignments).toEqual(expect.arrayContaining([
      { guestId: 'guest-1', seat: 1 },
      { guestId: 'guest-2', seat: 0 },
    ]));
  });

  it('swaps guests between two full tables', () => {
    const store = new WeddingStore();
    store.tables.set([
      table([{ guestId: 'guest-1', seat: 0 }], 'table-1', 1),
      table([{ guestId: 'guest-2', seat: 0 }], 'table-2', 1),
    ]);

    store.assignGuestTable('guest-1', 'table-2', 0);

    expect(store.tables()[0].assignments).toEqual([{ guestId: 'guest-2', seat: 0 }]);
    expect(store.tables()[1].assignments).toEqual([{ guestId: 'guest-1', seat: 0 }]);
  });

  it('keeps the plan unchanged when an unplaced guest targets an occupied seat at a full table', () => {
    const store = new WeddingStore();
    const fullTable = table([{ guestId: 'guest-1', seat: 0 }], 'table-1', 1);
    store.tables.set([fullTable]);

    store.assignGuestTable('unplaced', 'table-1', 0);

    expect(store.tables()).toEqual([fullTable]);
  });
});
