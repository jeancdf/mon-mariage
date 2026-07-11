import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatingTableEntity } from './seating-table.entity';
import { TableGuestEntity } from './table-guest.entity';
import { FLOOR_HEIGHT, FLOOR_WIDTH, Table, TableShape } from './seating.types';

@Injectable()
export class SeatingService {
  constructor(
    @InjectRepository(SeatingTableEntity)
    private readonly tablesRepository: Repository<SeatingTableEntity>,
    @InjectRepository(TableGuestEntity)
    private readonly assignmentsRepository: Repository<TableGuestEntity>,
  ) {}

  async findAll(): Promise<Table[]> {
    const tables = await this.tablesRepository.find({
      relations: { assignments: true },
      order: { name: 'ASC' },
    });
    await this.normalize(tables);
    return tables.map(table => this.mapTable(table));
  }

  async createTable(input: { name: string; seats: number; shape?: TableShape; x?: number; y?: number }): Promise<Table[]> {
    await this.tablesRepository.save(this.tablesRepository.create({
      name: String(input.name ?? '').trim(),
      seats: this.normalizeSeats(input.seats),
      shape: input.shape === 'rect' ? 'rect' : 'round',
      x: this.clamp(Number(input.x), 0, FLOOR_WIDTH),
      y: this.clamp(Number(input.y), 0, FLOOR_HEIGHT),
      rotation: 0,
    }));
    return this.findAll();
  }

  async updateTable(id: string, input: Partial<Table>): Promise<Table[]> {
    const table = await this.tablesRepository.findOne({
      where: { id },
      relations: { assignments: true },
    });
    if (!table) throw new NotFoundException('Table not found');
    if (input.name !== undefined) table.name = String(input.name).trim();
    if (input.seats !== undefined) table.seats = this.normalizeSeats(input.seats);
    if (input.shape !== undefined) table.shape = input.shape === 'rect' ? 'rect' : 'round';
    if (input.x !== undefined) table.x = this.clamp(Number(input.x), 0, FLOOR_WIDTH);
    if (input.y !== undefined) table.y = this.clamp(Number(input.y), 0, FLOOR_HEIGHT);
    if (input.rotation !== undefined) table.rotation = Math.round(Number(input.rotation) || 0) % 360;
    await this.tablesRepository.save(table);
    await this.relocateOverflow(table);
    return this.findAll();
  }

  async deleteTable(id: string): Promise<Table[]> {
    const result = await this.tablesRepository.delete(id);
    if (!result.affected) throw new NotFoundException('Table not found');
    return this.findAll();
  }

  async assignGuest(guestId: string, tableId: string | null, seat?: number | null): Promise<Table[]> {
    const previous = await this.assignmentsRepository.findOne({ where: { guestId } });
    await this.assignmentsRepository.delete({ guestId });
    if (!tableId) return this.findAll();

    const table = await this.tablesRepository.findOne({
      where: { id: tableId },
      relations: { assignments: true },
    });
    if (!table) throw new NotFoundException('Table not found');
    const others = (table.assignments ?? []).filter(assignment => assignment.guestId !== guestId);
    const taken = new Set(others.map(assignment => assignment.seat).filter((value): value is number => value !== null));

    let targetSeat = Number.isInteger(seat) && Number(seat) >= 0 && Number(seat) < table.seats
      ? Number(seat)
      : this.firstFreeSeat(table.seats, taken);

    if (targetSeat === null) return this.restoreAndReload(previous);

    const occupant = others.find(assignment => assignment.seat === targetSeat);
    if (occupant) {
      if (previous) {
        occupant.tableId = previous.tableId;
        occupant.seat = previous.seat;
        await this.assignmentsRepository.save(occupant);
      } else {
        taken.delete(targetSeat);
        const fallback = this.firstFreeSeat(table.seats, new Set([...taken, targetSeat]));
        if (fallback === null) return this.restoreAndReload(previous);
        occupant.seat = fallback;
        await this.assignmentsRepository.save(occupant);
      }
    }

    await this.assignmentsRepository.save(this.assignmentsRepository.create({
      guestId,
      tableId,
      seat: targetSeat,
    }));
    return this.findAll();
  }

  private async restoreAndReload(previous: TableGuestEntity | null): Promise<Table[]> {
    if (previous) {
      await this.assignmentsRepository.save(this.assignmentsRepository.create({
        guestId: previous.guestId,
        tableId: previous.tableId,
        seat: previous.seat,
      }));
    }
    return this.findAll();
  }

  /** Reseat assignments left out of range after a seat-count reduction; drop those that no longer fit. */
  private async relocateOverflow(table: SeatingTableEntity): Promise<void> {
    const assignments = await this.assignmentsRepository.find({ where: { tableId: table.id } });
    const taken = new Set(
      assignments
        .filter(assignment => assignment.seat !== null && assignment.seat < table.seats)
        .map(assignment => assignment.seat as number),
    );
    for (const assignment of assignments) {
      if (assignment.seat !== null && assignment.seat < table.seats) continue;
      const free = this.firstFreeSeat(table.seats, taken);
      if (free === null) {
        await this.assignmentsRepository.delete(assignment.id);
      } else {
        assignment.seat = free;
        taken.add(free);
        await this.assignmentsRepository.save(assignment);
      }
    }
  }

  /** Legacy rows have no position/seat: lay tables out on a grid and give guests the first free seats. */
  private async normalize(tables: SeatingTableEntity[]): Promise<void> {
    const dirtyTables: SeatingTableEntity[] = [];
    const dirtyAssignments: TableGuestEntity[] = [];
    tables.forEach((table, index) => {
      if (table.x === null || table.y === null) {
        table.x = 190 + (index % 4) * 330;
        table.y = 170 + Math.floor(index / 4) * 270;
        dirtyTables.push(table);
      }
      const used = new Set<number>();
      const sorted = [...(table.assignments ?? [])].sort((a, b) =>
        (a.seat ?? Number.MAX_SAFE_INTEGER) - (b.seat ?? Number.MAX_SAFE_INTEGER) || a.guestId.localeCompare(b.guestId));
      for (const assignment of sorted) {
        let seatNumber = assignment.seat;
        if (seatNumber === null || seatNumber < 0 || seatNumber >= table.seats || used.has(seatNumber)) {
          seatNumber = this.firstFreeSeat(table.seats, used);
          if (seatNumber === null) continue;
          assignment.seat = seatNumber;
          dirtyAssignments.push(assignment);
        }
        used.add(seatNumber);
      }
    });
    if (dirtyTables.length) {
      await this.tablesRepository.save(dirtyTables.map(({ assignments: _assignments, ...rest }) => rest));
    }
    if (dirtyAssignments.length) await this.assignmentsRepository.save(dirtyAssignments);
  }

  private firstFreeSeat(seats: number, taken: Set<number>): number | null {
    for (let seatNumber = 0; seatNumber < seats; seatNumber += 1) {
      if (!taken.has(seatNumber)) return seatNumber;
    }
    return null;
  }

  private normalizeSeats(value: unknown): number {
    const seats = Math.trunc(Number(value)) || 12;
    return Math.min(Math.max(seats, 2), 40);
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return (min + max) / 2;
    return Math.min(Math.max(value, min), max);
  }

  private mapTable(table: SeatingTableEntity): Table {
    return {
      id: table.id,
      name: table.name,
      seats: table.seats,
      shape: table.shape === 'rect' ? 'rect' : 'round',
      x: table.x ?? FLOOR_WIDTH / 2,
      y: table.y ?? FLOOR_HEIGHT / 2,
      rotation: table.rotation ?? 0,
      assignments: (table.assignments ?? [])
        .filter(assignment => assignment.seat !== null)
        .sort((a, b) => (a.seat as number) - (b.seat as number))
        .map(assignment => ({ guestId: assignment.guestId, seat: assignment.seat as number })),
    };
  }
}
