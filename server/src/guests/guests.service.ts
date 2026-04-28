import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuestEntity } from './guest.entity';

type GuestInput = Omit<GuestEntity, 'id'> & { id?: string };

@Injectable()
export class GuestsService {
  constructor(
    @InjectRepository(GuestEntity)
    private readonly guestsRepository: Repository<GuestEntity>,
  ) {}

  findAll(): Promise<GuestEntity[]> {
    return this.guestsRepository.find({
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
  }

  async replaceAll(rawGuests: GuestInput[]): Promise<GuestEntity[]> {
    const guests = rawGuests
      .map(guest => this.normalizeGuest(guest))
      .filter(guest => guest.firstName);

    await this.guestsRepository.clear();
    if (!guests.length) {
      return [];
    }

    await this.guestsRepository.insert(guests);
    return this.findAll();
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
