import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { SeatingApiService } from '../../data/seating-api.service';
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

  afterEach(() => {
    document.querySelectorAll('.floor-seat[data-table-id]').forEach(element => element.remove());
  });

  it('allows a seated guest to remain in the table drop zone', () => {
    const component = TestBed.runInInjectionContext(() => new SeatingComponent());
    const currentTable = table([{ guestId: 'guest-1', seat: 0 }]);
    const drag = { data: 'guest-1' } as CdkDrag<string>;

    expect(component.tableEnterPredicate(currentTable)(drag)).toBe(true);
  });

  it('uses the drop coordinates to move a guest within the same table container', async () => {
    const component = TestBed.runInInjectionContext(() => new SeatingComponent());
    const currentTable = table([{ guestId: 'guest-1', seat: 0 }]);
    component.store.tables.set([currentTable]);
    const seat = document.createElement('div');
    seat.className = 'floor-seat';
    seat.dataset['tableId'] = currentTable.id;
    seat.dataset['seat'] = '4';
    seat.getBoundingClientRect = () => ({
      x: 100,
      y: 100,
      left: 100,
      top: 100,
      right: 130,
      bottom: 130,
      width: 30,
      height: 30,
      toJSON: () => ({}),
    });
    document.body.appendChild(seat);
    const container = { data: currentTable } as CdkDropList<Table>;
    const event = {
      item: { data: 'guest-1' },
      container,
      previousContainer: container,
      dropPoint: { x: 115, y: 115 },
    } as unknown as CdkDragDrop<Table>;

    await component.onTableDrop(event);

    expect(assignGuest).toHaveBeenCalledWith('guest-1', 'table-1', 4);
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
