import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { In, Not, Repository } from 'typeorm';
import { RoomGuestEntity } from '../housing/room-guest.entity';
import { TableGuestEntity } from '../seating/table-guest.entity';
import { EventKey, GuestEntity, Kid, Rsvp } from './guest.entity';
import { AccountsService, normalizeEmail } from '../auth/accounts.service';

type GuestInput = Omit<GuestEntity, 'id' | 'kids'> & { id?: string; kids?: Partial<Kid>[] };

export interface PublicRsvpPersonInput {
  id: string;
  rsvp: Rsvp;
}

export interface PublicRsvpInput {
  people: PublicRsvpPersonInput[];
  events?: EventKey[];
  dietary?: string;
  transport?: string;
  needsHousing?: boolean;
}

const RSVP_VALUES: Rsvp[] = ['confirmed', 'pending', 'declined'];
const EVENT_VALUES: EventKey[] = ['rehearsal', 'ceremony', 'dinner'];

const isRsvp = (value: unknown): value is Rsvp =>
  typeof value === 'string' && RSVP_VALUES.includes(value as Rsvp);

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

  async findByInviteToken(token: string): Promise<GuestEntity> {
    const normalized = String(token ?? '').trim();
    if (normalized.length < 16) {
      throw new NotFoundException('Invitation introuvable.');
    }
    const guest = await this.guestsRepository.findOne({ where: { inviteToken: normalized } });
    if (!guest) {
      throw new NotFoundException('Invitation introuvable.');
    }
    return this.ensureKidIds(guest);
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

    const { inviteToken: _ignoredToken, inviteTokenCreatedAt: _ignoredAt, ...safePatch } = rawGuest;
    const merged = this.guestsRepository.merge(existing, this.normalizeGuest({
      ...existing,
      ...safePatch,
    }, existing));
    merged.inviteToken = existing.inviteToken;
    merged.inviteTokenCreatedAt = existing.inviteTokenCreatedAt;
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

  async issueInviteToken(id: string, rotate = false): Promise<{ token: string }> {
    const guest = await this.guestsRepository.findOne({ where: { id } });
    if (!guest) {
      throw new NotFoundException('Guest not found');
    }
    if (guest.inviteToken && !rotate) {
      return { token: guest.inviteToken };
    }
    guest.inviteToken = randomBytes(32).toString('base64url');
    guest.inviteTokenCreatedAt = new Date();
    await this.guestsRepository.save(guest);
    return { token: guest.inviteToken };
  }

  async applyPublicRsvp(token: string, input: PublicRsvpInput): Promise<GuestEntity> {
    const guest = await this.findByInviteToken(token);
    const householdIds = new Set(this.guestPersonIds(guest));
    const people = Array.isArray(input.people) ? input.people : [];
    if (!people.length) {
      throw new BadRequestException('Indiquez une réponse pour chaque personne invitée.');
    }
    for (const person of people) {
      if (!householdIds.has(person.id)) {
        throw new BadRequestException('Cette invitation ne concerne pas cette personne.');
      }
      if (!isRsvp(person.rsvp)) {
        throw new BadRequestException('Réponse RSVP invalide.');
      }
    }

    const rsvpById = new Map(people.map(person => [person.id, person.rsvp]));
    const primaryRsvp = rsvpById.get(guest.id);
    if (!primaryRsvp) {
      throw new BadRequestException('Indiquez une réponse pour l’invité principal.');
    }

    if (guest.hasPlusOne) {
      const plusId = this.plusOneGuestId(guest.id);
      guest.plusOneRsvp = rsvpById.get(plusId) ?? guest.plusOneRsvp ?? 'pending';
    }
    guest.kids = this.normalizeKids(guest.kids, guest.kids).map(kid => ({
      ...kid,
      rsvp: rsvpById.get(kid.id) ?? kid.rsvp ?? 'pending',
    }));
    guest.rsvp = primaryRsvp;

    if (input.events !== undefined) {
      if (!Array.isArray(input.events)) {
        throw new BadRequestException('Événements invalides.');
      }
      guest.events = input.events.filter((event): event is EventKey => EVENT_VALUES.includes(event));
    }
    if (input.dietary !== undefined) {
      guest.dietary = String(input.dietary ?? '').trim();
    }
    if (input.transport !== undefined) {
      guest.transport = String(input.transport ?? '').trim();
    }
    if (input.needsHousing !== undefined) {
      guest.needsHousing = Boolean(input.needsHousing);
    }

    return this.guestsRepository.save(guest);
  }

  plusOneGuestId(guestId: string): string {
    return `${guestId}__plus_one`;
  }

  guestPersonIds(guest: Pick<GuestEntity, 'id' | 'hasPlusOne' | 'kids'>): string[] {
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

  private normalizeGuest(guest: GuestInput, previous?: GuestEntity): Omit<GuestEntity, 'id'> {
    const hasPlusOne = Boolean(guest.hasPlusOne);
    return {
      firstName: String(guest.firstName ?? '').trim(),
      lastName: String(guest.lastName ?? '').trim(),
      email: normalizeEmail(guest.email),
      organizationRole: ['parent', 'sibling', 'witness', 'friend_cousin', 'other'].includes(guest.organizationRole)
        ? guest.organizationRole
        : guest.category === 'temoins' ? 'witness' : 'other',
      category: guest.category ?? 'amis',
      rsvp: isRsvp(guest.rsvp) ? guest.rsvp : 'pending',
      hasPlusOne,
      plusOneName: String(guest.plusOneName ?? '').trim(),
      plusOneRsvp: hasPlusOne
        ? (isRsvp(guest.plusOneRsvp) ? guest.plusOneRsvp : (previous?.plusOneRsvp ?? 'pending'))
        : 'pending',
      kids: this.normalizeKids(guest.kids, previous?.kids),
      dietary: String(guest.dietary ?? '').trim(),
      events: Array.isArray(guest.events)
        ? guest.events.filter((event): event is EventKey => EVENT_VALUES.includes(event))
        : [],
      transport: String(guest.transport ?? '').trim(),
      needsHousing: Boolean(guest.needsHousing),
      notes: String(guest.notes ?? '').trim(),
      inviteToken: previous?.inviteToken ?? null,
      inviteTokenCreatedAt: previous?.inviteTokenCreatedAt ?? null,
    };
  }

  private async ensureKidIds(guest: GuestEntity): Promise<GuestEntity> {
    const kids = this.normalizeKids(guest.kids, guest.kids);
    const plusOneRsvp = isRsvp(guest.plusOneRsvp) ? guest.plusOneRsvp : 'pending';
    const needsHousing = Boolean(guest.needsHousing);
    const unchanged = JSON.stringify(kids) === JSON.stringify(guest.kids ?? [])
      && guest.plusOneRsvp === plusOneRsvp
      && guest.needsHousing === needsHousing;
    if (unchanged) {
      return guest;
    }
    guest.kids = kids;
    guest.plusOneRsvp = plusOneRsvp;
    guest.needsHousing = needsHousing;
    return this.guestsRepository.save(guest);
  }

  private normalizeKids(kids: unknown, previous: Kid[] = []): Kid[] {
    if (!Array.isArray(kids)) return [];
    return kids.map(kid => {
      const value = kid as Partial<Kid> | null;
      const id = typeof value?.id === 'string' && value.id.trim()
        ? value.id.trim()
        : randomUUID();
      const previousKid = previous.find(item => item.id === id);
      return {
        id,
        name: String(value?.name ?? '').trim(),
        age: typeof value?.age === 'number' ? value.age : String(value?.age ?? '').trim(),
        rsvp: isRsvp(value?.rsvp) ? value.rsvp : (previousKid?.rsvp ?? 'pending'),
      };
    });
  }
}
