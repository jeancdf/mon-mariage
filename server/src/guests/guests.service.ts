import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Not, Repository } from 'typeorm';
import { RoomGuestEntity } from '../housing/room-guest.entity';
import { TableGuestEntity } from '../seating/table-guest.entity';
import { GuestEntity, Kid } from './guest.entity';
import { AccountsService, normalizeEmail } from '../auth/accounts.service';

type GuestInput = Omit<GuestEntity, 'id' | 'kids'> & { id?: string; kids?: Partial<Kid>[] };

@Injectable()
export class GuestsService {
  constructor(
    @InjectRepository(GuestEntity)
    private readonly guestsRepository: Repository<GuestEntity>,
    @InjectRepository(RoomGuestEntity)
    private readonly roomAssignmentsRepository: Repository<RoomGuestEntity>,
    @InjectRepository(TableGuestEntity)
    private readonly tableAssignmentsRepository: Repository<TableGuestEntity>,
    private readonly accountsService: AccountsService,
  ) {}

  async findAll(): Promise<GuestEntity[]> {
    const guests = await this.guestsRepository.find({
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    return Promise.all(guests.map(guest => this.ensureKidIds(guest)));
  }

  async create(rawGuest: GuestInput): Promise<GuestEntity> {
    await this.accountsService.assertGuestAccountEmail(rawGuest.email, undefined, rawGuest.organizationRole ?? 'other');
    const guest = this.guestsRepository.create(this.normalizeGuest(rawGuest));
    const savedGuest = await this.guestsRepository.save(guest);
    await this.accountsService.syncGuestAccount(savedGuest);
    return savedGuest;
  }

  async update(id: string, rawGuest: Partial<GuestInput>): Promise<GuestEntity> {
    const existing = await this.guestsRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Guest not found');
    }

    await this.accountsService.assertGuestAccountEmail(
      rawGuest.email ?? existing.email,
      id,
      rawGuest.organizationRole ?? existing.organizationRole,
    );

    const merged = this.guestsRepository.merge(existing, this.normalizeGuest({
      ...existing,
      ...rawGuest,
    }));
    const savedGuest = await this.guestsRepository.save(merged);
    await this.accountsService.syncGuestAccount(savedGuest);
    const validPersonIds = new Set(this.guestPersonIds(savedGuest));
    const removedPersonIds = this.guestPersonIds(existing).filter(personId => !validPersonIds.has(personId));
    if (removedPersonIds.length) {
      await this.deleteAssignmentsForGuestIds(removedPersonIds);
    }
    return savedGuest;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.guestsRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Guest not found');
    }

    const result = await this.guestsRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Guest not found');
    }
    await this.deleteAssignmentsForGuestIds(this.guestPersonIds(existing));
    await this.accountsService.reconcileGuestAccounts(await this.guestsRepository.find());
  }

  async replaceAll(rawGuests: GuestInput[]): Promise<GuestEntity[]> {
    const guests = rawGuests
      .map(guest => this.normalizeGuest(guest))
      .filter(guest => guest.firstName);

    const duplicateEligibleEmails = guests
      .filter(guest => ['parent', 'sibling', 'witness'].includes(guest.organizationRole) && guest.email)
      .map(guest => guest.email)
      .filter((email, index, values) => values.indexOf(email) !== index);
    if (duplicateEligibleEmails.length) {
      throw new ConflictException(`Adresse e-mail dupliquée dans l'import : ${duplicateEligibleEmails[0]}`);
    }
    for (const guest of guests) {
      await this.accountsService.assertImportAccountEmail(guest.email, guest.organizationRole);
    }

    await this.guestsRepository.clear();
    if (!guests.length) {
      await this.deleteAssignmentsExcept([]);
      await this.accountsService.reconcileGuestAccounts([]);
      return [];
    }

    await this.guestsRepository.insert(guests);
    const savedGuests = await this.findAll();
    await this.deleteAssignmentsExcept(savedGuests.flatMap(guest => this.guestPersonIds(guest)));
    await this.accountsService.reconcileGuestAccounts(savedGuests);
    return savedGuests;
  }

  private plusOneGuestId(guestId: string): string {
    return `${guestId}__plus_one`;
  }

  private guestPersonIds(guest: Pick<GuestEntity, 'id' | 'hasPlusOne' | 'kids'>): string[] {
    return [
      guest.id,
      ...(guest.hasPlusOne ? [this.plusOneGuestId(guest.id)] : []),
      ...this.normalizeKids(guest.kids).map(kid => kid.id),
    ];
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
      email: normalizeEmail(guest.email),
      organizationRole: ['parent', 'sibling', 'witness', 'friend_cousin', 'other'].includes(guest.organizationRole)
        ? guest.organizationRole
        : guest.category === 'temoins' ? 'witness' : 'other',
      category: guest.category ?? 'amis',
      rsvp: guest.rsvp ?? 'pending',
      hasPlusOne: Boolean(guest.hasPlusOne),
      plusOneName: String(guest.plusOneName ?? '').trim(),
      kids: this.normalizeKids(guest.kids),
      dietary: String(guest.dietary ?? '').trim(),
      events: Array.isArray(guest.events) ? guest.events : [],
      transport: String(guest.transport ?? '').trim(),
      notes: String(guest.notes ?? '').trim(),
    };
  }

  private async ensureKidIds(guest: GuestEntity): Promise<GuestEntity> {
    const kids = this.normalizeKids(guest.kids);
    if (JSON.stringify(kids) === JSON.stringify(guest.kids ?? [])) {
      return guest;
    }
    guest.kids = kids;
    return this.guestsRepository.save(guest);
  }

  private normalizeKids(kids: unknown): Kid[] {
    if (!Array.isArray(kids)) return [];
    return kids.map(kid => {
      const value = kid as Partial<Kid> | null;
      const id = typeof value?.id === 'string' && value.id.trim()
        ? value.id.trim()
        : randomUUID();
      return {
        id,
        name: String(value?.name ?? '').trim(),
        age: typeof value?.age === 'number' ? value.age : String(value?.age ?? '').trim(),
      };
    });
  }
}
