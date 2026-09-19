import { BadRequestException, ConflictException, Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { BedType, House, Room } from '../planner/planner-state.entity';
import { HouseEntity } from './house.entity';
import { RoomGuestEntity } from './room-guest.entity';
import { RoomEntity } from './room.entity';
import { GuestEntity } from '../guests/guest.entity';
import { guestPeople, GUEST_PLACEMENT_LOCK } from '../guests/guest-people';
import { addDays, EventConfigService } from '../event-config/event-config.service';
import { HousingStayEntity } from './housing-stay.entity';
import { PresenceEntity } from '../final-weeks/entities/presence.entity';

@Injectable()
export class HousingService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(HouseEntity)
    private readonly housesRepository: Repository<HouseEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(RoomGuestEntity)
    private readonly assignmentsRepository: Repository<RoomGuestEntity>,
    private readonly eventConfig: EventConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.transaction(async manager => {
      await manager.getRepository(RoomGuestEntity).update({ night: IsNull() }, { night: this.window().weddingDate });
    });
  }

  private window() {
    const { weddingDate, dailyStart } = this.eventConfig.getConfiguration();
    return { weddingDate, startDate: dailyStart, endDate: addDays(weddingDate, 2) };
  }

  private nights(from: string, until: string): string[] {
    const { startDate, endDate } = this.window();
    const valid = (value: string) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (!valid(from) || !valid(until) || from < startDate || until > endDate || until <= from) {
      throw new BadRequestException(`Choisissez un séjour entre le ${startDate} et le ${endDate}, avec un départ après l’arrivée.`);
    }
    const result: string[] = [];
    for (let date = from; date < until; date = addDays(date, 1)) result.push(date);
    return result;
  }

  async calendar() {
    const window = this.window();
    return this.transaction(async manager => {
      const [houses, assignments, guests, stays, presences] = await Promise.all([
        manager.getRepository(HouseEntity).find({ relations: { rooms: true }, order: { name: 'ASC', rooms: { name: 'ASC' } } }),
        manager.getRepository(RoomGuestEntity).find(),
        manager.getRepository(GuestEntity).find({ order: { firstName: 'ASC', lastName: 'ASC' } }),
        manager.getRepository(HousingStayEntity).find(), manager.getRepository(PresenceEntity).find(),
      ]);
      const dateInZone = (date: Date | null | undefined) => date ? new Intl.DateTimeFormat('en-CA', {
        timeZone: this.eventConfig.getTimeZone(), year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(date) : null;
      const people = guests.flatMap(guestPeople).map(person => {
        const stay = stays.find(item => item.guestId === person.id);
        const presence = presences.find(item => item.guestPersonId === person.id);
        return { ...person, needsHousing: person.needsHousing || Boolean(stay), arrivalDate: stay?.arrivalDate ?? dateInZone(presence?.arrivalAt), departureDate: stay?.departureDate ?? dateInZone(presence?.departureAt) };
      });
      return { ...window, nights: this.nights(window.startDate, window.endDate),
        houses: houses.map(house => this.mapHouse(house)), people,
        assignments: assignments.map(item => ({ guestId: item.guestId, roomId: item.roomId, night: item.night ?? window.weddingDate })),
      };
    });
  }

  async saveStay(guestId: string, arrivalDate: string, departureDate: string): Promise<void> {
    const nights = new Set(this.nights(arrivalDate, departureDate));
    await this.transaction(async manager => {
      const person = (await manager.getRepository(GuestEntity).find()).flatMap(guestPeople).find(item => item.id === guestId);
      if (!person) throw new NotFoundException('Personne introuvable.');
      const assignments = manager.getRepository(RoomGuestEntity);
      const existing = await assignments.find({ where: { guestId } });
      if (existing.some(item => !nights.has(item.night ?? this.window().weddingDate))) {
        throw new ConflictException('Des chambres sont réservées en dehors de ces dates. Retirez ces nuits avant de raccourcir le séjour.');
      }
      await manager.getRepository(HousingStayEntity).save({ guestId, arrivalDate, departureDate });
    });
  }

  private transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.housesRepository.manager.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [GUEST_PLACEMENT_LOCK]);
      return work(manager);
    });
  }

  async findPeople() {
    // Minimal placement projection; no email, notes, tokens or account access required.
    return (await this.housesRepository.manager.getRepository(GuestEntity).find({
      order: { firstName: 'ASC', lastName: 'ASC' },
    })).flatMap(guestPeople);
  }

  private name(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException('Le nom est obligatoire.');
    return value.trim();
  }

  private roomValues(input: { name: unknown; beds: unknown; bedType: unknown }): { name: string; beds: number; bedType: BedType } {
    const beds = Number(input.beds);
    if (!Number.isInteger(beds) || beds < 1 || beds > 8) throw new BadRequestException('Indiquez entre 1 et 8 lits.');
    if (input.bedType !== 'single' && input.bedType !== 'double') throw new BadRequestException('Type de lit invalide.');
    return { name: this.name(input.name), beds, bedType: input.bedType };
  }

  async findAll(): Promise<House[]> {
    const houses = await this.housesRepository.find({
      relations: { rooms: { assignments: true } },
      order: { name: 'ASC', rooms: { name: 'ASC' } },
    });
    return houses.map(house => this.mapHouse(house));
  }

  async createHouse(input: { name: string }): Promise<House[]> {
    await this.housesRepository.save(this.housesRepository.create({
      name: this.name(input?.name),
    }));
    return this.findAll();
  }

  async updateHouse(id: string, input: { name?: string }): Promise<House[]> {
    const house = await this.housesRepository.findOne({ where: { id } });
    if (!house) throw new NotFoundException('House not found');
    house.name = this.name(input?.name ?? house.name);
    await this.housesRepository.save(house);
    return this.findAll();
  }

  async deleteHouse(id: string): Promise<House[]> {
    const result = await this.transaction(manager => manager.getRepository(HouseEntity).delete(id));
    if (!result.affected) throw new NotFoundException('House not found');
    return this.findAll();
  }

  async createRoom(houseId: string, input: { name: string; bedType: BedType; beds: number }): Promise<House[]> {
    const values = this.roomValues(input ?? {} as typeof input);
    await this.transaction(async manager => {
      const house = await manager.getRepository(HouseEntity).findOne({ where: { id: houseId } });
      if (!house) throw new NotFoundException('Maison introuvable.');
      const rooms = manager.getRepository(RoomEntity);
      await rooms.save(rooms.create({ houseId, ...values }));
    });
    return this.findAll();
  }

  async updateRoom(roomId: string, input: Partial<Room>): Promise<House[]> {
    await this.transaction(async manager => {
      const rooms = manager.getRepository(RoomEntity);
      const room = await rooms.findOne({ where: { id: roomId } });
      if (!room) throw new NotFoundException('Chambre introuvable.');
      const values = this.roomValues({ ...room, ...input });
      const assignments = await manager.getRepository(RoomGuestEntity).find({ where: { roomId } });
      const capacity = values.beds * (values.bedType === 'double' ? 2 : 1);
      const byNight = new Map<string, number>();
      for (const assignment of assignments) {
        const night = assignment.night ?? this.window().weddingDate;
        byNight.set(night, (byNight.get(night) ?? 0) + 1);
      }
      const conflict = [...byNight].find(([, occupied]) => occupied > capacity);
      if (conflict) throw new ConflictException(`La nuit du ${conflict[0]} compte ${conflict[1]} occupants. Déplacez-en ${conflict[1] - capacity} avant de réduire la capacité.`);
      Object.assign(room, values);
      await rooms.save(room);
    });
    return this.findAll();
  }

  async deleteRoom(roomId: string): Promise<House[]> {
    const result = await this.transaction(manager => manager.getRepository(RoomEntity).delete(roomId));
    if (!result.affected) throw new NotFoundException('Room not found');
    return this.findAll();
  }

  async assignGuest(guestId: string, roomId: string | null, from?: string, until?: string): Promise<House[]> {
    if (roomId !== null && (typeof roomId !== 'string' || !roomId)) throw new BadRequestException('Choisissez une chambre.');
    const firstNight = from ?? this.window().weddingDate;
    const nights = this.nights(firstNight, until ?? (Number.isFinite(Date.parse(firstNight)) ? addDays(firstNight, 1) : firstNight));
    await this.transaction(async manager => {
      const assignments = manager.getRepository(RoomGuestEntity);
      if (roomId === null) {
        await assignments.delete({ guestId, night: In(nights) });
        return;
      }
      const people = (await manager.getRepository(GuestEntity).find()).flatMap(guestPeople);
      const person = people.find(item => item.id === guestId);
      if (!person) throw new NotFoundException('Personne introuvable.');
      if (person.rsvp === 'declined') throw new ConflictException('Cette personne a décliné l’invitation.');
      const stay = await manager.getRepository(HousingStayEntity).findOne({ where: { guestId } });
      if (stay && nights.some(night => night < stay.arrivalDate || night >= stay.departureDate)) {
        throw new ConflictException('Ces nuits sont en dehors du séjour de cette personne. Modifiez d’abord ses dates d’arrivée et de départ.');
      }
      const room = await manager.getRepository(RoomEntity).findOne({ where: { id: roomId } });
      if (!room) throw new NotFoundException('Chambre introuvable.');
      const existing = await assignments.find({ where: { guestId, night: In(nights) } });
      const target = await assignments.find({ where: { roomId, night: In(nights) } });
      for (const night of nights) {
        const occupied = target.filter(item => item.night === night && item.guestId !== guestId).length;
        if (occupied >= room.beds * (room.bedType === 'double' ? 2 : 1)) throw new ConflictException(`Cette chambre est complète la nuit du ${night}. Aucune nuit n’a été modifiée.`);
      }
      for (const night of nights) {
        const previous = existing.find(item => item.night === night);
        await assignments.save(previous ? { ...previous, roomId } : assignments.create({ guestId, roomId, night }));
      }
    });
    return this.findAll();
  }

  private mapHouse(house: HouseEntity): House {
    return {
      id: house.id,
      name: house.name,
      rooms: (house.rooms ?? []).map(room => ({
        id: room.id,
        name: room.name,
        bedType: room.bedType,
        beds: room.beds,
        guestIds: (room.assignments ?? []).filter(assignment => (assignment.night ?? this.window().weddingDate) === this.window().weddingDate).map(assignment => assignment.guestId),
      })),
    };
  }
}
