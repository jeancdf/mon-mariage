import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { RoomGuestEntity } from '../housing/room-guest.entity';
import { TableGuestEntity } from '../seating/table-guest.entity';
import { GuestEntity } from './guest.entity';

type GuestInput = Omit<GuestEntity, 'id'> & { id?: string };

@Injectable()
export class GuestsService {
  constructor(
    @InjectRepository(GuestEntity)
    private readonly guestsRepository: Repository<GuestEntity>,
    @InjectRepository(RoomGuestEntity)
    private readonly roomAssignmentsRepository: Repository<RoomGuestEntity>,
    @InjectRepository(TableGuestEntity)
    private readonly tableAssignmentsRepository: Repository<TableGuestEntity>,
  ) {}

  findAll(): Promise<GuestEntity[]> {
    return this.guestsRepository.find({
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
  }

  async create(rawGuest: GuestInput): Promise<GuestEntity> {
    const guest = this.guestsRepository.create(this.normalizeGuest(rawGuest));
    return this.guestsRepository.save(guest);
  }

  async update(id: string, rawGuest: Partial<GuestInput>): Promise<GuestEntity> {
    const existing = await this.guestsRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Guest not found');
    }

    const merged = this.guestsRepository.merge(existing, this.normalizeGuest({
      ...existing,
      ...rawGuest,
    }));
    const savedGuest = await this.guestsRepository.save(merged);
    if (existing.hasPlusOne && !savedGuest.hasPlusOne) {
      await this.deleteAssignmentsForGuestIds([this.plusOneGuestId(savedGuest.id)]);
    }
    return savedGuest;
  }

  async delete(id: string): Promise<void> {
    const result = await this.guestsRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Guest not found');
    }
    await this.deleteAssignmentsForGuestIds([id, this.plusOneGuestId(id)]);
  }

  async replaceAll(rawGuests: GuestInput[]): Promise<GuestEntity[]> {
    const guests = rawGuests
      .map(guest => this.normalizeGuest(guest))
      .filter(guest => guest.firstName);

    await this.guestsRepository.clear();
    if (!guests.length) {
      await this.deleteAssignmentsExcept([]);
      return [];
    }

    await this.guestsRepository.insert(guests);
    const savedGuests = await this.findAll();
    await this.deleteAssignmentsExcept(savedGuests.flatMap(guest => [
      guest.id,
      ...(guest.hasPlusOne ? [this.plusOneGuestId(guest.id)] : []),
    ]));
    return savedGuests;
  }

  private plusOneGuestId(guestId: string): string {
    return `${guestId}__plus_one`;
  }

  private async deleteAssignmentsForGuestIds(guestIds: string[]): Promise<void> {
    await Promise.all([
      this.roomAssignmentsRepository.delete({ guestId: In(guestIds) }),
      this.tableAssignmentsRepository.delete({ guestId: In(guestIds) }),
    ]);
  }

  private async deleteAssignmentsExcept(validGuestIds: string[]): Promise<void> {
    if (!validGuestIds.length) {
      await Promise.all([
        this.roomAssignmentsRepository.clear(),
        this.tableAssignmentsRepository.clear(),
      ]);
      return;
    }

    await Promise.all([
      this.roomAssignmentsRepository.delete({ guestId: Not(In(validGuestIds)) }),
      this.tableAssignmentsRepository.delete({ guestId: Not(In(validGuestIds)) }),
    ]);
  }

  private normalizeGuest(guest: GuestInput): Omit<GuestEntity, 'id'> {
    return {
      firstName: String(guest.firstName ?? '').trim(),
      lastName: String(guest.lastName ?? '').trim(),
      category: guest.category ?? 'amis',
      rsvp: guest.rsvp ?? 'pending',
      hasPlusOne: Boolean(guest.hasPlusOne),
      plusOneName: String(guest.plusOneName ?? '').trim(),
      kids: Array.isArray(guest.kids) ? guest.kids : [],
      dietary: String(guest.dietary ?? '').trim(),
      events: Array.isArray(guest.events) ? guest.events : [],
      transport: String(guest.transport ?? '').trim(),
      notes: String(guest.notes ?? '').trim(),
    };
  }
}
