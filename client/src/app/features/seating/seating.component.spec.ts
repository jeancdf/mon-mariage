import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { Table } from '../../data/types';
import { WeddingStore } from '../../data/store';
import { SeatingComponent } from './seating.component';

const table = (assignments: Table['assignments']): Table => ({
  id: 'table-1',
  name: 'Table 1',
  seats: 10,
  shape: 'rect',
  x: 100,
  y: 100,
  rotation: 0,
  assignments,
});

describe('SeatingComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
  });

  it('allows a seated guest to enter another seat on the same table', () => {
    const component = TestBed.runInInjectionContext(() => new SeatingComponent());
    const currentTable = table([{ guestId: 'guest-1', seat: 0 }]);
    const drag = { data: 'guest-1' } as CdkDrag<string>;

    expect(component.seatEnterPredicate(currentTable, 1)(drag)).toBe(true);
    expect(component.tableEnterPredicate(currentTable)(drag)).toBe(true);
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
});
