import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { EntityManager, In, Repository } from 'typeorm';
import { RoomGuestEntity } from '../housing/room-guest.entity';
import { TableGuestEntity } from '../seating/table-guest.entity';
import { EventKey, GuestEntity, Kid, Rsvp } from './guest.entity';
import { AccountsService, normalizeEmail } from '../auth/accounts.service';
import { PresenceEntity } from '../final-weeks/entities/presence.entity';
import { guestPeople, GUEST_PLACEMENT_LOCK } from './guest-people';
import { HousingStayEntity } from '../housing/housing-stay.entity';

type GuestInput = Partial<Omit<GuestEntity, 'kids'>> & { kids?: Partial<Kid>[] };

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
  private transactionManager?: EntityManager;
  constructor(
    @InjectRepository(GuestEntity)
    private readonly guestsRepository: Repository<GuestEntity>,
    @InjectRepository(RoomGuestEntity)
    private readonly roomAssignmentsRepository: Repository<RoomGuestEntity>,
    @InjectRepository(TableGuestEntity)
    private readonly tableAssignmentsRepository: Repository<TableGuestEntity>,
    private readonly accountsService: AccountsService,
  ) {}

  private transaction<T>(work: (service: GuestsService) => Promise<T>): Promise<T> {
    return this.guestsRepository.manager.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [GUEST_PLACEMENT_LOCK]);
      const service = new GuestsService(manager.getRepository(GuestEntity),
        manager.getRepository(RoomGuestEntity), manager.getRepository(TableGuestEntity),
        this.accountsService.withManager(manager));
      service.transactionManager = manager;
      return work(service);
    });
  }

  async findAll(): Promise<GuestEntity[]> {
    if (!this.transactionManager) return this.transaction(service => service.findAll());
    const guests = await this.guestsRepository.find({
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    return Promise.all(guests.map(guest => this.ensureKidIds(guest)));
  }

  async findByInviteToken(token: string): Promise<GuestEntity> {
    if (!this.transactionManager) return this.transaction(service => service.findByInviteToken(token));
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
    if (!this.transactionManager) return this.transaction(service => service.create(rawGuest));
    await this.accountsService.assertGuestAccountEmail(rawGuest.email, undefined, rawGuest.organizationRole ?? 'other');
    const guest = this.guestsRepository.create(this.normalizeGuest(rawGuest));
    guest.id = randomUUID();
    await this.assertPersonIds(guest);
    const savedGuest = await this.guestsRepository.save(guest);
    await this.accountsService.syncGuestAccount(savedGuest);
    return savedGuest;
  }

  async update(id: string, rawGuest: Partial<GuestInput>): Promise<GuestEntity> {
    if (!this.transactionManager) return this.transaction(service => service.update(id, rawGuest));
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
    const previousIds = this.guestPersonIds(existing);
    const merged = this.guestsRepository.create({ id: existing.id, ...this.normalizeGuest({
      ...existing,
      ...safePatch,
    }, existing) });
    merged.inviteToken = existing.inviteToken;
    merged.inviteTokenCreatedAt = existing.inviteTokenCreatedAt;
    await this.assertPersonIds(merged);
    const savedGuest = await this.guestsRepository.save(merged);
    await this.accountsService.syncGuestAccount(savedGuest);
    const validPersonIds = new Set(this.guestPersonIds(savedGuest));
    const removedPersonIds = previousIds.filter(personId => !validPersonIds.has(personId));
    if (removedPersonIds.length) {
      await this.deleteAssignmentsForGuestIds(removedPersonIds);
      await this.transactionManager!.getRepository(PresenceEntity).delete({ guestPersonId: In(removedPersonIds) });
      await this.transactionManager!.getRepository(HousingStayEntity).delete({ guestId: In(removedPersonIds) });
    }
    await this.removeDeclinedAssignments(savedGuest);
    return savedGuest;
  }

  async delete(id: string): Promise<void> {
    if (!this.transactionManager) return this.transaction(service => service.delete(id));
    const existing = await this.guestsRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Guest not found');
    }

    const result = await this.guestsRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Guest not found');
    }
    await this.deleteAssignmentsForGuestIds(this.guestPersonIds(existing));
    await this.transactionManager!.getRepository(PresenceEntity).delete({ guestPersonId: In(this.guestPersonIds(existing)) });
    await this.transactionManager!.getRepository(HousingStayEntity).delete({ guestId: In(this.guestPersonIds(existing)) });
    await this.accountsService.reconcileGuestAccounts(await this.guestsRepository.find());
  }

  async importGuests(rawGuests: GuestInput[]): Promise<GuestEntity[]> {
    if (!Array.isArray(rawGuests) || !rawGuests.length || rawGuests.length > 2000) {
      throw new BadRequestException('Importez entre 1 et 2 000 foyers.');
    }
    if (!this.transactionManager) return this.transaction(service => service.importGuests(rawGuests));
    const seen = new Set<string>();
    for (const row of rawGuests) {
      if (!row || typeof row !== 'object') throw new BadRequestException('Ligne d’import invalide.');
      if (row.id) {
        if (seen.has(row.id)) throw new BadRequestException('Un foyer est sélectionné plusieurs fois dans l’import.');
        seen.add(row.id);
        await this.update(row.id, row);
      } else {
        await this.create(row);
      }
    }
    return this.findAll();
  }

  async issueInviteToken(id: string, rotate = false): Promise<{ token: string }> {
    if (!this.transactionManager) return this.transaction(service => service.issueInviteToken(id, rotate));
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
    if (!this.transactionManager) return this.transaction(service => service.applyPublicRsvp(token, input));
    if (!input || typeof input !== 'object') throw new BadRequestException('Réponse invalide.');
    const guest = await this.findByInviteToken(token);
    const householdIds = new Set(this.guestPersonIds(guest));
    const people = Array.isArray(input.people) ? input.people : [];
    if (!people.length) {
      throw new BadRequestException('Indiquez une réponse pour chaque personne invitée.');
    }
    for (const person of people) {
      if (!person || !householdIds.has(person.id)) {
        throw new BadRequestException('Cette invitation ne concerne pas cette personne.');
      }
      if (!isRsvp(person.rsvp)) {
        throw new BadRequestException('Réponse RSVP invalide.');
      }
    }

    const rsvpById = new Map(people.map(person => [person.id, person.rsvp]));
    if (rsvpById.size !== people.length || rsvpById.size !== householdIds.size) {
      throw new BadRequestException('Indiquez une seule réponse pour chaque personne invitée.');
    }
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
      if (typeof input.needsHousing !== 'boolean') throw new BadRequestException('Besoin de couchage invalide.');
      guest.needsHousing = Boolean(input.needsHousing);
    }

    const saved = await this.guestsRepository.save(guest);
    await this.removeDeclinedAssignments(saved);
    return saved;
  }

  plusOneGuestId(guestId: string): string {
    return `${guestId}__plus_one`;
  }

  guestPersonIds(guest: Pick<GuestEntity, 'id' | 'hasPlusOne' | 'kids'>): string[] {
    return [
      guest.id,
      ...(guest.hasPlusOne ? [this.plusOneGuestId(guest.id)] : []),
      ...(guest.kids ?? []).filter(kid => kid.name.trim()).map(kid => kid.id),
    ];
  }

  private async deleteAssignmentsForGuestIds(guestIds: string[]): Promise<void> {
    await Promise.all([
      this.roomAssignmentsRepository.delete({ guestId: In(guestIds) }),
      this.tableAssignmentsRepository.delete({ guestId: In(guestIds) }),
    ]);
  }

  private async removeDeclinedAssignments(guest: GuestEntity): Promise<void> {
    const ids = guestPeople(guest).filter(person => person.rsvp === 'declined').map(person => person.id);
    if (ids.length) await this.deleteAssignmentsForGuestIds(ids);
  }

  private async assertPersonIds(guest: GuestEntity): Promise<void> {
    const ids = this.guestPersonIds(guest);
    const others = (await this.guestsRepository.find()).filter(item => item.id !== guest.id);
    const used = new Set(others.flatMap(item => this.guestPersonIds(item)));
    if (new Set(ids).size !== ids.length || ids.some(id => used.has(id))) {
      throw new ConflictException('Un identifiant de personne appartient déjà à un autre membre ou foyer.');
    }
  }

  private normalizeGuest(guest: GuestInput, previous?: GuestEntity): Omit<GuestEntity, 'id'> {
    if (!guest || typeof guest !== 'object' || !String(guest.firstName ?? '').trim()) {
      throw new BadRequestException('Le prénom est obligatoire.');
    }
    for (const key of ['hasPlusOne', 'needsHousing'] as const) {
      if (guest[key] !== undefined && typeof guest[key] !== 'boolean') throw new BadRequestException('Choix oui/non invalide.');
    }
    for (const value of [guest.rsvp, guest.plusOneRsvp]) {
      if (value !== undefined && !isRsvp(value)) throw new BadRequestException('Réponse RSVP invalide.');
    }
    if (guest.category !== undefined && !['famille-moi', 'famille-elle', 'amis', 'temoins', 'enfants'].includes(guest.category)) {
      throw new BadRequestException('Catégorie d’invité invalide.');
    }
    if (guest.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(guest.email).trim())) throw new BadRequestException('Adresse e-mail invalide.');
    const hasPlusOne = Boolean(guest.hasPlusOne);
    return {
      firstName: String(guest.firstName ?? '').trim(),
      lastName: String(guest.lastName ?? '').trim(),
      email: normalizeEmail(guest.email),
      organizationRole: guest.organizationRole && ['parent', 'sibling', 'witness', 'friend_cousin', 'other'].includes(guest.organizationRole)
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
    if (kids === undefined) return [];
    if (!Array.isArray(kids)) throw new BadRequestException('Liste des enfants invalide.');
    return kids.map(kid => {
      const value = kid as Partial<Kid> | null;
      const id = typeof value?.id === 'string' && value.id.trim()
        ? value.id.trim()
        : randomUUID();
      const previousKid = previous.find(item => item.id === id);
      if (value?.rsvp !== undefined && !isRsvp(value.rsvp)) throw new BadRequestException('Réponse RSVP enfant invalide.');
      if (value?.age !== '' && value?.age !== undefined && (!Number.isInteger(Number(value.age)) || Number(value.age) < 0 || Number(value.age) > 17)) {
        throw new BadRequestException('L’âge d’un enfant doit être compris entre 0 et 17 ans.');
      }
      return {
        id,
        name: String(value?.name ?? '').trim(),
        age: typeof value?.age === 'number' ? value.age : String(value?.age ?? '').trim(),
        rsvp: isRsvp(value?.rsvp) ? value.rsvp : (previousKid?.rsvp ?? 'pending'),
      };
    }).filter(kid => kid.name);
  }
}
