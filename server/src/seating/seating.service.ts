import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table } from '../planner/planner-state.entity';
import { SeatingTableEntity } from './seating-table.entity';
import { TableGuestEntity } from './table-guest.entity';

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
    return tables.map(table => this.mapTable(table));
  }

  async createTable(input: { name: string; seats: number }): Promise<Table[]> {
    await this.tablesRepository.save(this.tablesRepository.create({
      name: String(input.name ?? '').trim(),
      seats: Number(input.seats) || 12,
    }));
    return this.findAll();
  }

  async updateTable(id: string, input: Partial<Table>): Promise<Table[]> {
    const table = await this.tablesRepository.findOne({ where: { id } });
    if (!table) throw new NotFoundException('Table not found');
    table.name = String(input.name ?? table.name).trim();
    table.seats = Number(input.seats ?? table.seats) || 12;
    await this.tablesRepository.save(table);
    return this.findAll();
  }

  async deleteTable(id: string): Promise<Table[]> {
    const result = await this.tablesRepository.delete(id);
    if (!result.affected) throw new NotFoundException('Table not found');
    return this.findAll();
  }

  async assignGuest(guestId: string, tableId: string | null): Promise<Table[]> {
    await this.assignmentsRepository.delete({ guestId });
    if (tableId) {
      const table = await this.tablesRepository.findOne({
        where: { id: tableId },
        relations: { assignments: true },
      });
      if (!table) throw new NotFoundException('Table not found');
      if ((table.assignments ?? []).length >= table.seats) {
        return this.findAll();
      }
      await this.assignmentsRepository.save(this.assignmentsRepository.create({ guestId, tableId }));
    }
    return this.findAll();
  }

  private mapTable(table: SeatingTableEntity): Table {
    return {
      id: table.id,
      name: table.name,
      seats: table.seats,
      guestIds: (table.assignments ?? []).map(assignment => assignment.guestId),
    };
  }
}
